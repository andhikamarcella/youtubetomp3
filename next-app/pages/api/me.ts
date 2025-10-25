import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../lib/auth';

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

    const userRecord = await ensureUserRecord(session);
    return res.status(200).json({
      id: userRecord.id,
      display_name: userRecord.display_name,
      avatar_url: userRecord.avatar_url,
      role: userRecord.role,
      current_xp: userRecord.current_xp,
    });
  } catch (error) {
    console.error('/api/me error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
