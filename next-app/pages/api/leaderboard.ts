import type { NextApiRequest, NextApiResponse } from 'next';
import { getTopUsers } from '../../lib/leaderboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const users = await getTopUsers(limit);

    return res.status(200).json({
      entries: users.map((user) => ({
        id: user.id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role,
        current_xp: user.current_xp,
      })),
    });
  } catch (error) {
    console.error('/api/leaderboard error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
