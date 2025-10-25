import { PoolClient } from 'pg';
import { getPool } from './db';

export interface XpEventInput {
  userId: string;
  delta: number;
  reason: string;
  eventId: string;
}

export interface XpMutationResult {
  currentXp: string;
  createdEvent: boolean;
}

export async function applyXpEvent({ userId, delta, reason, eventId }: XpEventInput, client?: PoolClient): Promise<XpMutationResult> {
  if (!Number.isFinite(delta)) {
    throw new Error('delta must be a finite number');
  }
  if (!eventId) {
    throw new Error('eventId is required for XP mutation');
  }

  const runner = async (runnerClient: PoolClient): Promise<XpMutationResult> => {
    const existing = await runnerClient.query('SELECT id FROM xp_events WHERE event_id = $1', [eventId]);
    if ((existing.rowCount ?? 0) > 0) {
      const user = await runnerClient.query('SELECT current_xp FROM users WHERE id = $1', [userId]);
      return { currentXp: user.rows[0]?.current_xp ?? '0', createdEvent: false };
    }

    await runnerClient.query(
      `INSERT INTO xp_events (id, user_id, delta, reason, event_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [userId, delta, reason, eventId]
    );
    const update = await runnerClient.query('UPDATE users SET current_xp = current_xp + $1 WHERE id = $2 RETURNING current_xp', [delta, userId]);
    const updatedXp = update.rows[0]?.current_xp;
    if (typeof updatedXp === 'undefined') {
      throw new Error('Failed to update XP');
    }
    return { currentXp: updatedXp, createdEvent: true };
  };

  if (client) {
    return runner(client);
  }

  const pool = getPool();
  const pooledClient = await pool.connect();
  try {
    await pooledClient.query('BEGIN');
    const result = await runner(pooledClient);
    await pooledClient.query('COMMIT');
    return result;
  } catch (error) {
    await pooledClient.query('ROLLBACK');
    throw error;
  } finally {
    pooledClient.release();
  }
}
