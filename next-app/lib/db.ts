import { Pool, PoolClient } from 'pg';

let pool: Pool | undefined;

declare global {
  // eslint-disable-next-line no-var
  var __youtubetomp3DbPool: Pool | undefined;
}

export function getPool(): Pool {
  if (pool) {
    return pool;
  }
  if (!global.__youtubetomp3DbPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL env var is required');
    }
    global.__youtubetomp3DbPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  pool = global.__youtubetomp3DbPool;
  return pool;
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
