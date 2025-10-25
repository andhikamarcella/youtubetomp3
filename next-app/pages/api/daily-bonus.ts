import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../lib/auth';
import { applyXpEvent } from '../../lib/xp';

const DAILY_BONUS_XP = 150;

function bonusEventId(userId: string): string {
  const today = new Date();
  const day = `${today.getUTCFullYear()}-${`${today.getUTCMonth() + 1}`.padStart(2, '0')}-${`${today.getUTCDate()}`.padStart(2, '0')}`;
  return `daily:${userId}:${day}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await ensureUserRecord(session);
    const eventId = bonusEventId(user.id);

    const result = await applyXpEvent({
      userId: user.id,
      delta: DAILY_BONUS_XP,
      reason: 'daily_bonus',
      eventId,
    });

    return res.status(200).json({
      awarded: result.createdEvent,
      current_xp: result.currentXp,
    });
  } catch (error) {
    console.error('/api/daily-bonus error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
