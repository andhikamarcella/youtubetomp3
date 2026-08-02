import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticatedCliUser } from '../../../lib/cli-auth';
import { getPool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const current = await authenticatedCliUser(req);
    if (!current) return res.status(401).json({ error: 'CLI session is missing, expired, or revoked' });

    const result = await getPool().query(
      `SELECT id, device_name, platform, cli_version, created_at, last_used_at, expires_at, revoked_at
         FROM cli_access_tokens
        WHERE user_id = $1
        ORDER BY COALESCE(last_used_at, created_at) DESC`,
      [current.id]
    );

    return res.status(200).json({
      currentTokenId: current.token_id,
      devices: result.rows.map((row) => ({
        tokenId: row.id,
        deviceName: row.device_name,
        platform: row.platform,
        cliVersion: row.cli_version,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        current: row.id === current.token_id,
        active: !row.revoked_at && new Date(row.expires_at).getTime() > Date.now(),
      })),
    });
  } catch (error) {
    console.error('/api/cli-auth/devices error', error);
    return res.status(500).json({ error: 'Unable to list CLI devices' });
  }
}
