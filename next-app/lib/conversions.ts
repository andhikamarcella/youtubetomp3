import { PoolClient } from 'pg';
import { getPool } from './db';

export interface ConversionRecord {
  id: string;
  user_id: string;
  job_id: string;
  source_video_id: string;
  format: string;
  created_at: Date;
}

const baseSelect = `SELECT id, user_id, job_id, source_video_id, format, created_at FROM conversions`;

export async function findConversionByJobId(jobId: string, client?: PoolClient): Promise<ConversionRecord | null> {
  const runner = async (runnerClient: PoolClient) => {
    const result = await runnerClient.query<ConversionRecord>(
      `${baseSelect} WHERE job_id = $1 LIMIT 1`,
      [jobId]
    );
    return result.rows[0] ?? null;
  };

  if (client) {
    return runner(client);
  }

  const pool = getPool();
  const pooledClient = await pool.connect();
  try {
    return await runner(pooledClient);
  } finally {
    pooledClient.release();
  }
}

export async function assertJobOwnership(jobId: string, userId: string, client?: PoolClient): Promise<ConversionRecord> {
  const conversion = await findConversionByJobId(jobId, client);
  if (!conversion) {
    throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  }
  if (conversion.user_id !== userId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  return conversion;
}

export async function findConversionById(id: string, client?: PoolClient): Promise<ConversionRecord | null> {
  const runner = async (runnerClient: PoolClient) => {
    const result = await runnerClient.query<ConversionRecord>(
      `${baseSelect} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows[0] ?? null;
  };

  if (client) {
    return runner(client);
  }

  const pool = getPool();
  const pooledClient = await pool.connect();
  try {
    return await runner(pooledClient);
  } finally {
    pooledClient.release();
  }
}

export async function assertConversionOwnership(conversionId: string, userId: string, client?: PoolClient): Promise<ConversionRecord> {
  const conversion = await findConversionById(conversionId, client);
  if (!conversion) {
    throw Object.assign(new Error('Conversion not found'), { statusCode: 404 });
  }
  if (conversion.user_id !== userId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  return conversion;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export async function listConversionsForUser(userId: string, options: ListOptions = {}): Promise<ConversionRecord[]> {
  const limit = Number.isFinite(options.limit) ? Math.min(Math.max(Number(options.limit), 1), 100) : 25;
  const cursorDate = options.cursor ? new Date(options.cursor) : null;

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (cursorDate) {
      const result = await client.query<ConversionRecord>(
        `${baseSelect} WHERE user_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3`,
        [userId, cursorDate, limit]
      );
      return result.rows;
    }

    const result = await client.query<ConversionRecord>(
      `${baseSelect} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function countConversionsForUser(userId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM conversions WHERE user_id = $1',
    [userId]
  );
  const value = result.rows[0]?.count;
  return value ? Number.parseInt(value, 10) : 0;
}

interface ConversionJobInput {
  jobId: string;
  videoId: string;
  format: string;
}

export async function recordConversionJobs(
  userId: string,
  jobs: ConversionJobInput[],
  client?: PoolClient
): Promise<void> {
  if (!jobs.length) {
    return;
  }

  const runner = async (runnerClient: PoolClient) => {
    const values: any[] = [];
    const placeholders: string[] = [];

    jobs.forEach((job, index) => {
      const offset = index * 4;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      values.push(userId, job.jobId, job.videoId, job.format);
    });

    await runnerClient.query(
      `INSERT INTO conversions (user_id, job_id, source_video_id, format)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (job_id) DO NOTHING`,
      values
    );
  };

  if (client) {
    await runner(client);
    return;
  }

  const pool = getPool();
  const pooledClient = await pool.connect();
  try {
    await pooledClient.query('BEGIN');
    await runner(pooledClient);
    await pooledClient.query('COMMIT');
  } catch (error) {
    await pooledClient.query('ROLLBACK');
    throw error;
  } finally {
    pooledClient.release();
  }
}
