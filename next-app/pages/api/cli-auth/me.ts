import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticatedCliUser } from '../../../lib/cli-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const row = await authenticatedCliUser(req);
    if (!row) return res.status(401).json({ error: 'CLI session is missing, expired, or revoked' });
    return res.status(200).json({
      tokenId: row.token_id,
      expiresAt: row.expires_at,
      device: {
        name: row.device_name,
        platform: row.platform,
        cliVersion: row.cli_version,
      },
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: row.role,
        currentXp: row.current_xp,
      },
    });
  } catch (error) {
    console.error('/api/cli-auth/me error', error);
    return res.status(500).json({ error: 'Unable to validate CLI session' });
  }
}
