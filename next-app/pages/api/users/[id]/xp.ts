import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../../lib/db';
import { applyXpEvent } from '../../../../lib/xp';
import { canMutateXp, getSessionUser } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const targetUserId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Missing user id' });
  }

  const session = await getSessionUser(req);
  if (!canMutateXp(session, targetUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { delta, reason, event_id: eventId } = req.body ?? {};
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return res.status(400).json({ error: 'delta must be a finite number' });
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'reason is required' });
  }
  if (typeof eventId !== 'string' || eventId.trim().length === 0) {
    return res.status(400).json({ error: 'event_id is required' });
  }

  try {
    const pool = getPool();
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await applyXpEvent({
      userId: targetUserId,
      delta,
      reason,
      eventId,
    });

    // TODO: Apply premium XP multiplier and streak bonuses when invoked via privileged flows.
    // TODO: Enforce per-user rate limits to avoid XP mutation abuse.
    return res.status(200).json({ current_xp: result.currentXp, createdEvent: result.createdEvent });
  } catch (error) {
    console.error('/api/users/[id]/xp error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
