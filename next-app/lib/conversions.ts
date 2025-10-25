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

export async function findConversionByJobId(jobId: string, client?: PoolClient): Promise<ConversionRecord | null> {
  const runner = async (runnerClient: PoolClient) => {
    const result = await runnerClient.query<ConversionRecord>(
      `SELECT id, user_id, job_id, source_video_id, format, created_at
         FROM conversions
        WHERE job_id = $1
        LIMIT 1`,
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
