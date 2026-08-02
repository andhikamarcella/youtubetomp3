import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticatedCliUser } from '../../../lib/cli-auth';
import { getPool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const current = await authenticatedCliUser(req);
    if (!current) return res.status(401).json({ error: 'CLI session is missing, expired, or revoked' });

    const pool = getPool();
    const revokeAll = req.body?.all === true;
    const includeCurrent = req.body?.includeCurrent === true;
    const tokenId = typeof req.body?.tokenId === 'string' ? req.body.tokenId.trim() : '';

    let result;
    if (revokeAll) {
      result = await pool.query(
        `UPDATE cli_access_tokens
            SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND ($2::boolean OR id <> $3::uuid)
          RETURNING id`,
        [current.id, includeCurrent, current.token_id]
      );
    } else {
      if (!tokenId) return res.status(400).json({ error: 'tokenId or all=true is required' });
      if (tokenId === current.token_id && !includeCurrent) {
        return res.status(400).json({ error: 'Use ytconv logout to revoke the current device, or pass includeCurrent=true' });
      }
      result = await pool.query(
        `UPDATE cli_access_tokens
            SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE id = $1::uuid AND user_id = $2
          RETURNING id`,
        [tokenId, current.id]
      );
    }

    return res.status(200).json({
      ok: true,
      revoked: result.rows.map((row) => row.id),
      currentRevoked: result.rows.some((row) => row.id === current.token_id),
    });
  } catch (error: any) {
    if (error?.code === '22P02') return res.status(400).json({ error: 'Invalid token ID' });
    console.error('/api/cli-auth/revoke error', error);
    return res.status(500).json({ error: 'Unable to revoke CLI device' });
  }
}
