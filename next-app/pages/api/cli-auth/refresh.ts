import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  authenticatedCliUser,
  createSecret,
  hashSecret,
} from '../../../lib/cli-auth';
import { withTransaction } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const current = await authenticatedCliUser(req);
    if (!current) return res.status(401).json({ error: 'CLI session is missing, expired, or revoked' });

    const accessToken = createSecret('ytat', 36);
    const rotated = await withTransaction(async (client) => {
      const locked = await client.query(
        `SELECT id, user_id, device_name, platform, cli_version
           FROM cli_access_tokens
          WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()
          FOR UPDATE`,
        [current.token_id]
      );
      if (!locked.rowCount) return null;
      const old = locked.rows[0];
      const inserted = await client.query(
        `INSERT INTO cli_access_tokens
           (user_id, token_hash, device_name, platform, cli_version, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::interval)
         RETURNING id, expires_at`,
        [old.user_id, hashSecret(accessToken), old.device_name, old.platform, old.cli_version, String(ACCESS_TOKEN_TTL_SECONDS)]
      );
      await client.query('UPDATE cli_access_tokens SET revoked_at = NOW() WHERE id = $1', [old.id]);
      return inserted.rows[0];
    });

    if (!rotated) return res.status(409).json({ error: 'The current token was already revoked or expired' });
    return res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      tokenId: rotated.id,
      expiresAt: rotated.expires_at,
      user: {
        id: current.id,
        email: current.email,
        displayName: current.display_name,
        avatarUrl: current.avatar_url,
        role: current.role,
      },
    });
  } catch (error) {
    console.error('/api/cli-auth/refresh error', error);
    return res.status(500).json({ error: 'Unable to refresh CLI session' });
  }
}
