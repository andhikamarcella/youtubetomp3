import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../../../lib/auth';
import { assertConversionOwnership } from '../../../../lib/conversions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const workerBase = process.env.WORKER_API_BASE;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerBase || !workerSecret) {
    return res.status(500).json({ error: 'Worker configuration missing' });
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await ensureUserRecord(session);
    const conversionId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!conversionId) {
      return res.status(400).json({ error: 'Missing conversion id' });
    }

    const conversion = await assertConversionOwnership(conversionId, user.id);

    const workerUrl = `${workerBase.replace(/\/$/, '')}/file/${encodeURIComponent(conversion.job_id)}`;
    const workerResponse = await fetch(workerUrl, {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    });

    const payload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker redownload failed', workerResponse.status, payload);
      return res
        .status(workerResponse.status)
        .json({ error: 'Failed to resolve job file', details: safeJson(payload) });
    }

    return res.status(200).json(safeJson(payload));
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('/api/history/[id]/redownload error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
}
