import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool, query } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applied(): Promise<Set<string>> {
  const rows = await query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

async function applyInit() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', ['001_init']);
  console.log('Applied migration 001_init (schema.sql)');
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = $1 AND COLUMN_NAME = $2
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

/** Add a column only when missing — safe on MySQL 8 / MariaDB. */
async function ensureColumn(table: string, column: string, definition: string) {
  if (await columnExists(table, column)) return;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  + ${table}.${column}`);
}

/** Columns introduced by 002 that cannot use ADD COLUMN IF NOT EXISTS on MySQL 8. */
async function ensureBrandingDocsColumns() {
  await ensureColumn('leave_types', 'carry_forward', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('leave_types', 'allow_half_day', 'TINYINT(1) NOT NULL DEFAULT 1');
  await ensureColumn('leave_types', 'eligibility_note', 'VARCHAR(255) NULL');
  await ensureColumn('leave_types', 'policy_json', 'JSON NULL');
  await ensureColumn('attendance_events', 'location_address', 'VARCHAR(512) NULL');
  await ensureColumn('attendance_days', 'location_address', 'VARCHAR(512) NULL');
}

async function main() {
  await ensureMigrationsTable();
  const done = await applied();
  if (!done.has('001_init')) {
    await applyInit();
  } else {
    console.log('001_init already applied');
  }
  // Future numbered .sql files under server/migrations (excluding 001 placeholder)
  const migDir = path.join(__dirname, '..', 'migrations');
  if (fs.existsSync(migDir)) {
    const files = fs
      .readdirSync(migDir)
      .filter((f) => /^\d{3}_.+\.sql$/i.test(f) && f !== '001_init.sql')
      .sort();
    for (const file of files) {
      const id = file.replace(/\.sql$/i, '');
      if (done.has(id)) {
        // Still ensure columns if 002 was applied before column helper existed
        if (id === '002_branding_docs_holidays_approvals') {
          await ensureBrandingDocsColumns();
        }
        continue;
      }
      const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
      await pool.query(sql);
      if (id === '002_branding_docs_holidays_approvals') {
        await ensureBrandingDocsColumns();
      }
      await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [id]);
      console.log(`Applied migration ${id}`);
    }
  }
  // Idempotent column ensure even when 002 already recorded
  await ensureBrandingDocsColumns();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
