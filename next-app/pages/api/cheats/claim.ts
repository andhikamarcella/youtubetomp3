import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool, withTransaction } from '../../../lib/db';
import { applyXpEvent } from '../../../lib/xp';
import { getSessionUser } from '../../../lib/auth';

const CHEAT_FREE_30K = 'free30kxp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (process.env.ENABLE_CHEATS !== 'true') {
    return res.status(404).json({ error: 'Cheats are disabled' });
  }

  const session = await getSessionUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (session.role !== 'admin' && session.role !== 'tester') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { code } = req.body ?? {};
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required' });
  }

  const normalizedCode = code.trim().toLowerCase();
  if (normalizedCode !== CHEAT_FREE_30K) {
    return res.status(400).json({ error: 'Unknown cheat code' });
  }

  try {
    const pool = getPool();
    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [session.id]);
    if (userExists.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await withTransaction(async (client) => {
      const claim = await client.query(
        `INSERT INTO cheat_claims (id, user_id, code)
         VALUES (gen_random_uuid(), $1, $2)
         ON CONFLICT (user_id, code) DO NOTHING
         RETURNING id`,
        [session.id, normalizedCode]
      );

      if (claim.rowCount === 0) {
        throw new Error('Cheat already claimed');
      }

      return applyXpEvent(
        {
          userId: session.id,
          delta: 30000,
          reason: 'cheat:free30kxp',
          eventId: `cheat:${normalizedCode}:${session.id}`,
        },
        client
      );
    });

    return res.status(200).json({ current_xp: result.currentXp, createdEvent: result.createdEvent });
  } catch (error) {
    if ((error as Error).message === 'Cheat already claimed') {
      return res.status(409).json({ error: 'Cheat already claimed' });
    }
    console.error('/api/cheats/claim error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
