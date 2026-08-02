import type { NextApiRequest, NextApiResponse } from 'next';
import { decryptToken, ensureCliAuthSchema, hashSecret } from '../../../lib/cli-auth';
import { getPool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await ensureCliAuthSchema();
    const deviceCode = String(req.body?.deviceCode || '').trim();
    if (!deviceCode) return res.status(400).json({ error: 'deviceCode is required' });

    const pool = getPool();
    const result = await pool.query(
      `SELECT d.id, d.status, d.expires_at AS device_expires_at, d.token_ciphertext, d.token_iv, d.token_tag,
              t.id AS token_id, t.expires_at,
              u.id AS user_id, u.email, u.display_name, u.avatar_url, u.role
         FROM cli_device_codes d
         LEFT JOIN cli_access_tokens t ON t.id = d.access_token_id
         LEFT JOIN users u ON u.id = d.user_id
        WHERE d.device_code_hash = $1
        LIMIT 1`,
      [hashSecret(deviceCode)]
    );

    if (!result.rowCount) return res.status(404).json({ error: 'Unknown device code' });
    const row = result.rows[0];
    if (new Date(row.device_expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Device login expired' });
    if (row.status === 'denied') return res.status(403).json({ error: 'Device login denied' });
    if (row.status !== 'approved') return res.status(428).json({ error: 'authorization_pending' });
    if (!row.token_ciphertext || !row.token_iv || !row.token_tag || !row.token_id) {
      return res.status(500).json({ error: 'Approved login is missing its token' });
    }

    const accessToken = decryptToken(row.token_ciphertext, row.token_iv, row.token_tag);
    await pool.query('UPDATE cli_device_codes SET consumed_at = COALESCE(consumed_at, NOW()) WHERE id = $1', [row.id]);
    return res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      tokenId: row.token_id,
      expiresAt: row.expires_at,
      user: {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: row.role,
      },
    });
  } catch (error) {
    console.error('/api/cli-auth/token error', error);
    return res.status(500).json({ error: 'Unable to finish device login' });
  }
}
