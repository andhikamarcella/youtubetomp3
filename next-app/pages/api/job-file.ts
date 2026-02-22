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

  const jobIdStr = String(jobId).trim();
  // Restrict jobId to a safe format to prevent SSRF/path-manipulation via the worker URL.
  // Adjust this pattern if your job IDs use a different, known-safe format.
  const jobIdPattern = /^[A-Za-z0-9_-]+$/;
  if (!jobIdPattern.test(jobIdStr)) {
    return res.status(400).json({ error: 'Invalid jobId' });
  }

  try {
    // TODO: Permit admin-controlled overrides for customer support investigations.
    await assertJobOwnership(jobIdStr, session.id);
  } catch (error: any) {
    const status = typeof error?.statusCode === 'number' ? error.statusCode : 403;
    return res.status(status).json({ error: status === 404 ? 'Job not found' : 'Forbidden' });
  }

  try {
    const workerUrl = `${workerBase.replace(/\/$/, '')}/file/${jobIdStr}`;
    const workerResponse = await fetch(workerUrl, {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    });

    const payload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker job-file failed', workerResponse.status, payload);
      return res
        .status(workerResponse.status)
        .json({ error: 'Failed to resolve job file', details: safeJson(payload) });
    }

    const jsonPayload = safeJson(payload) as { downloadUrl?: string };
    if (!jsonPayload.downloadUrl) {
      return res.status(502).json({ error: 'Worker response missing downloadUrl' });
    }

    return res.status(200).json({ downloadUrl: jsonPayload.downloadUrl });
  } catch (error) {
    console.error('/api/job-file error', error);
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
