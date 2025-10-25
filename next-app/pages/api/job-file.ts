import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const workerBase = process.env.WORKER_API_BASE;
  if (!workerBase) {
    return res.status(500).json({ error: 'WORKER_API_BASE not configured' });
  }

  const jobId = Array.isArray(req.query.jobId) ? req.query.jobId[0] : req.query.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const targetUrl = `${workerBase.replace(/\/$/, '')}/jobs/${jobId}/file`;
  res.writeHead(302, { Location: targetUrl });
  res.end();
}
