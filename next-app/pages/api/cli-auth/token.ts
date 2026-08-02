import type { NextApiRequest, NextApiResponse } from 'next';
import { decryptToken, ensureCliAuthSchema, hashSecret } from '../../../lib/cli-auth';
import { withTransaction } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await ensureCliAuthSchema();
    const deviceCode = String(req.body?.deviceCode || '').trim();
    if (!deviceCode) return res.status(400).json({ error: 'deviceCode is required' });

    const exchange = await withTransaction(async (client) => {
      const result = await client.query(
        `SELECT d.id, d.status, d.expires_at AS device_expires_at, d.consumed_at,
                d.token_ciphertext, d.token_iv, d.token_tag,
                t.id AS token_id, t.expires_at,
                u.id AS user_id, u.email, u.display_name, u.avatar_url, u.role
           FROM cli_device_codes d
           LEFT JOIN cli_access_tokens t ON t.id = d.access_token_id
           LEFT JOIN users u ON u.id = d.user_id
          WHERE d.device_code_hash = $1
          FOR UPDATE`,
        [hashSecret(deviceCode)]
      );
      if (!result.rowCount) return { status: 404, error: 'Unknown device code' };
      const row = result.rows[0];
      if (new Date(row.device_expires_at).getTime() <= Date.now()) return { status: 410, error: 'Device login expired' };
      if (row.status === 'denied') return { status: 403, error: 'Device login denied' };
      if (row.status !== 'approved') return { status: 428, error: 'authorization_pending' };
      if (row.consumed_at) return { status: 410, error: 'Device login was already completed' };
      if (!row.token_ciphertext || !row.token_iv || !row.token_tag || !row.token_id) {
        return { status: 500, error: 'Approved login is missing its token' };
      }

      const accessToken = decryptToken(row.token_ciphertext, row.token_iv, row.token_tag);
      await client.query(
        `UPDATE cli_device_codes
            SET consumed_at = NOW(), token_ciphertext = NULL, token_iv = NULL, token_tag = NULL
          WHERE id = $1`,
        [row.id]
      );
      return { status: 200, accessToken, row };
    });

    if (exchange.status !== 200) return res.status(exchange.status).json({ error: exchange.error });
    const { row, accessToken } = exchange;
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
