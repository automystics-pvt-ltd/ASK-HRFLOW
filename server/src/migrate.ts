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

async function main() {
  await ensureMigrationsTable();
  const done = await applied();
  if (!done.has('001_init')) {
    await applyInit();
  } else {
    console.log('Migrations up to date (001_init already applied)');
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
      if (done.has(id)) continue;
      const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [id]);
      console.log(`Applied migration ${id}`);
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
