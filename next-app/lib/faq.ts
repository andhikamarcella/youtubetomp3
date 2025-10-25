import { PoolClient } from 'pg';
import { getPool } from './db';

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  updated_at: Date;
}

const baseQuery = `SELECT id, question, answer, updated_at FROM faq_entries`;

export async function listFaqEntries(limit = 3): Promise<FaqEntry[]> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<FaqEntry>(
      `${baseQuery} ORDER BY updated_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function listAllFaqEntries(client?: PoolClient): Promise<FaqEntry[]> {
  const runner = async (runnerClient: PoolClient) => {
    const result = await runnerClient.query<FaqEntry>(
      `${baseQuery} ORDER BY updated_at DESC`
    );
    return result.rows;
  };

  if (client) {
    return runner(client);
  }

  const pool = getPool();
  const connection = await pool.connect();
  try {
    return await runner(connection);
  } finally {
    connection.release();
  }
}
