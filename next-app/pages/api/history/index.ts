import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../../lib/auth';
import { listConversionsForUser } from '../../../lib/conversions';

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

    const user = await ensureUserRecord(session);
    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const cursorParam = Array.isArray(req.query.cursor) ? req.query.cursor[0] : req.query.cursor;

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const conversions = await listConversionsForUser(user.id, { limit, cursor: cursorParam ?? undefined });

    return res.status(200).json({
      items: conversions.map((row) => ({
        id: row.id,
        job_id: row.job_id,
        source_video_id: row.source_video_id,
        format: row.format,
        created_at: row.created_at.toISOString(),
      })),
      nextCursor: conversions.length > 0 ? conversions[conversions.length - 1].created_at.toISOString() : null,
    });
  } catch (error) {
    console.error('/api/history error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
