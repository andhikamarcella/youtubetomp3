import { PoolClient } from 'pg';
import { getPool } from './db';

export interface StreakInfo {
  currentStreak: number;
  lastConversionAt: string | null;
  conversionsToday: number;
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getStreakForUser(userId: string, client?: PoolClient): Promise<StreakInfo> {
  const runner = async (runnerClient: PoolClient): Promise<StreakInfo> => {
    const result = await runnerClient.query<{ day: string; conversions: number }>(
      `SELECT DATE(created_at) AS day, COUNT(*)::int AS conversions
         FROM conversions
        WHERE user_id = $1
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { currentStreak: 0, lastConversionAt: null, conversionsToday: 0 };
    }

    const todayKey = toDateKey(new Date());
    let streak = 0;
    let conversionsToday = 0;
    let expectedKey = todayKey;

    for (const row of result.rows) {
      const rowDate = new Date(row.day);
      const key = toDateKey(rowDate);
      if (key === expectedKey) {
        streak += 1;
        if (key === todayKey) {
          conversionsToday = row.conversions;
        }
        const expectedDate = new Date(rowDate);
        expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
        expectedKey = toDateKey(expectedDate);
      } else if (key < expectedKey) {
        break;
      }
    }

    const lastConversionAt = result.rows[0]?.day ?? null;
    return { currentStreak: streak, lastConversionAt, conversionsToday };
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
