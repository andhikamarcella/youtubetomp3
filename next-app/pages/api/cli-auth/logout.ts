import type { NextApiRequest, NextApiResponse } from 'next';
import { bearerToken, ensureCliAuthSchema, hashSecret } from '../../../lib/cli-auth';
import { getPool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await ensureCliAuthSchema();
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Bearer token required' });
    await getPool().query(
      'UPDATE cli_access_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = $1',
      [hashSecret(token)]
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('/api/cli-auth/logout error', error);
    return res.status(500).json({ error: 'Unable to revoke CLI session' });
  }
}
