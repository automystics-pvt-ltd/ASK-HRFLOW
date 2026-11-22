import mysql, { type Pool, type PoolOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function buildConfig(): PoolOptions {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, '') || undefined,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      dateStrings: false,
      multipleStatements: true,
    };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'hrflow',
    password: process.env.DB_PASSWORD || 'hrflow',
    database: process.env.DB_NAME || 'hrflow',
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true,
  };
}

export const pool: Pool = mysql.createPool(buildConfig());
export const DEFAULT_TENANT = 't-default';

/** Convert `$1`-style placeholders to MySQL `?`, expanding reused indexes. */
export function toMysql(text: string, params: unknown[] = []): { sql: string; params: unknown[] } {
  let sql = text
    .replace(/::jsonb/gi, '')
    .replace(/::user_role/gi, '')
    .replace(/::leave_status/gi, '')
    .replace(/::timesheet_status/gi, '')
    .replace(/::timestamptz/gi, '')
    .replace(/::text/gi, '')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bTRUE\b/g, '1')
    .replace(/\bFALSE\b/g, '0')
    .replace(/\bNOW\(\)/gi, 'NOW()')
    .replace(/RETURNING\s+[\w,\s]+$/i, '');

  const out: unknown[] = [];
  sql = sql.replace(/\$(\d+)/g, (_, n: string) => {
    out.push(params[Number(n) - 1]);
    return '?';
  });
  return { sql, params: out };
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { sql, params: p } = toMysql(text, params ?? []);
  const [rows] = await pool.query<T[]>(sql, p);
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function execute(text: string, params?: unknown[]): Promise<ResultSetHeader> {
  const { sql, params: p } = toMysql(text, params ?? []);
  const [result] = await pool.execute<ResultSetHeader>(sql, p);
  return result;
}

/** Insert and return insertId (for AUTO_INCREMENT) or first RETURNING-style fallback. */
export async function insert(text: string, params?: unknown[]): Promise<number> {
  const result = await execute(text, params);
  return Number(result.insertId);
}

export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
