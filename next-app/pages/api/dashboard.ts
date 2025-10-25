import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../lib/auth';
import { countConversionsForUser, listConversionsForUser } from '../../lib/conversions';
import { getStreakForUser } from '../../lib/streak';
import { getPool } from '../../lib/db';

interface DashboardResponse {
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    current_xp: string;
    created_at: string;
  };
  totals: {
    conversions: number;
    recentConversions: Array<{ id: string; job_id: string; format: string; created_at: string }>;
  };
  streak: {
    currentStreak: number;
    lastConversionAt: string | null;
    conversionsToday: number;
    dailyBonusAvailable: boolean;
  };
}

function todayEventId(userId: string): string {
  const today = new Date();
  const day = `${today.getUTCFullYear()}-${`${today.getUTCMonth() + 1}`.padStart(2, '0')}-${`${today.getUTCDate()}`.padStart(2, '0')}`;
  return `daily:${userId}:${day}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const record = await ensureUserRecord(session);

    const [totalConversions, recentConversions, streakInfo, bonusClaim] = await Promise.all([
      countConversionsForUser(record.id),
      listConversionsForUser(record.id, { limit: 10 }),
      getStreakForUser(record.id),
      hasDailyBonus(record.id, todayEventId(record.id)),
    ]);

    const response: DashboardResponse = {
      profile: {
        id: record.id,
        display_name: record.display_name,
        avatar_url: record.avatar_url,
        role: record.role,
        current_xp: record.current_xp,
        created_at: record.created_at.toISOString(),
      },
      totals: {
        conversions: totalConversions,
        recentConversions: recentConversions.map((row) => ({
          id: row.id,
          job_id: row.job_id,
          format: row.format,
          created_at: row.created_at.toISOString(),
        })),
      },
      streak: {
        currentStreak: streakInfo.currentStreak,
        lastConversionAt: streakInfo.lastConversionAt,
        conversionsToday: streakInfo.conversionsToday,
        dailyBonusAvailable: !bonusClaim,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('/api/dashboard error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function hasDailyBonus(userId: string, eventId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM xp_events WHERE user_id = $1 AND event_id = $2) AS exists',
    [userId, eventId]
  );
  return result.rows[0]?.exists ?? false;
}
