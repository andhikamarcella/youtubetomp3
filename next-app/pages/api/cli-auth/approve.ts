import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { ensureUserRecord } from '../../../lib/auth';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createSecret,
  encryptToken,
  ensureCliAuthSchema,
  hashSecret,
} from '../../../lib/cli-auth';
import { withTransaction } from '../../../lib/db';
import { authOptions } from '../../../lib/next-auth';

function normalizeCode(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/gu, '').replace(/(.{4})(?=.)/u, '$1-');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const sessionUser = session?.user as any;
    if (!sessionUser?.id || !sessionUser?.email) return res.status(401).json({ error: 'Sign in with Google first' });

    await ensureCliAuthSchema();
    const userCode = normalizeCode(req.body?.userCode);
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/u.test(userCode)) return res.status(400).json({ error: 'Invalid device code' });

    const user = await ensureUserRecord({
      id: sessionUser.id,
      email: sessionUser.email,
      displayName: sessionUser.name,
      avatarUrl: sessionUser.image,
      role: 'user',
    });

    const accessToken = createSecret('ytat', 36);
    const encrypted = encryptToken(accessToken);
    const approved = await withTransaction(async (client) => {
      const pending = await client.query(
        `SELECT id, device_name, platform, cli_version
           FROM cli_device_codes
          WHERE user_code = $1 AND status = 'pending' AND expires_at > NOW()
          FOR UPDATE`,
        [userCode]
      );
      if (!pending.rowCount) return null;

      const token = await client.query(
        `INSERT INTO cli_access_tokens
           (user_id, token_hash, device_name, platform, cli_version, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::interval)
         RETURNING id, expires_at`,
        [
          user.id,
          hashSecret(accessToken),
          pending.rows[0].device_name,
          pending.rows[0].platform,
          pending.rows[0].cli_version,
          String(ACCESS_TOKEN_TTL_SECONDS),
        ]
      );

      await client.query(
        `UPDATE cli_device_codes
            SET status = 'approved', user_id = $1, access_token_id = $2,
                token_ciphertext = $3, token_iv = $4, token_tag = $5, approved_at = NOW()
          WHERE id = $6`,
        [user.id, token.rows[0].id, encrypted.ciphertext, encrypted.iv, encrypted.tag, pending.rows[0].id]
      );
      return { tokenId: token.rows[0].id, expiresAt: token.rows[0].expires_at };
    });

    if (!approved) return res.status(404).json({ error: 'Code not found, already used, or expired' });
    return res.status(200).json({
      ok: true,
      account: { id: user.id, email: user.email, displayName: user.display_name },
      device: { tokenId: approved.tokenId, expiresAt: approved.expiresAt },
    });
  } catch (error) {
    console.error('/api/cli-auth/approve error', error);
    return res.status(500).json({ error: 'Unable to approve this device' });
  }
}
