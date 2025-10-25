import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../lib/auth';

const ALLOWED_FORMATS = new Set(['mp3', 'm4a', 'wav']);

async function verifyCaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET_KEY not set; skipping server-side captcha verification');
    return true;
  }
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }).toString(),
  });
  const data = await response.json();
  return Boolean(data.success);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const workerBase = process.env.WORKER_API_BASE;
  if (!workerBase) {
    return res.status(500).json({ error: 'WORKER_API_BASE not configured' });
  }

  const session = await getSessionUser(req);
  const { videoId, format, captchaToken, options } = req.body ?? {};
  if (typeof videoId !== 'string' || videoId.trim().length === 0) {
    return res.status(400).json({ error: 'videoId is required' });
  }
  if (typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) {
    return res.status(400).json({ error: 'Unsupported format' });
  }

  if (captchaToken && !(await verifyCaptchaToken(captchaToken))) {
    return res.status(400).json({ error: 'Captcha verification failed' });
  }

  try {
    const workerResponse = await fetch(`${workerBase.replace(/\/$/, '')}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        format,
        options,
        userId: session?.id ?? null,
      }),
    });

    const payload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker create-job failed', workerResponse.status, payload);
      return res.status(workerResponse.status).json({ error: 'Failed to create job', details: safeJson(payload) });
    }

    return res.status(200).json(safeJson(payload));
  } catch (error) {
    console.error('/api/create-job error', error);
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
