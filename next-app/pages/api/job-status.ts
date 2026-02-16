import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../lib/auth';
import { assertJobOwnership } from '../../lib/conversions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const workerBase = process.env.WORKER_API_BASE;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerBase || !workerSecret) {
    return res.status(500).json({ error: 'Worker configuration missing' });
  }

  const session = await getSessionUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobId = Array.isArray(req.query.jobId) ? req.query.jobId[0] : req.query.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }
  if (!isValidJobId(jobId)) {
    return res.status(400).json({ error: 'Invalid jobId format' });
  }

  try {
    // TODO: Allow scoped admin support overrides when diagnosing jobs for other users.
    await assertJobOwnership(jobId, session.id);
  } catch (error: any) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 403;
    return res.status(status).json({ error: status === 404 ? 'Job not found' : 'Forbidden' });
  }

  // TODO: Apply rate limiting to job status polling.

  try {
    const workerResponse = await fetch(`${workerBase.replace(/\/$/, '')}/status/${jobId}`, {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    });
    const payload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker job-status failed', workerResponse.status, payload);
      return res.status(workerResponse.status).json({ error: 'Failed to fetch job status', details: safeJson(payload) });
    }
    return res.status(200).json(safeJson(payload));
  } catch (error) {
    console.error('/api/job-status error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

function isValidJobId(jobId: string): boolean {
  if (typeof jobId !== 'string') {
    return false;
  }
  // Restrict to a reasonable length and safe characters for a single path segment.
  if (jobId.length === 0 || jobId.length > 128) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(jobId);
}

function safeJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
}
