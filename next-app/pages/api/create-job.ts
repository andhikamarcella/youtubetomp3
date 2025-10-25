import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { getUserFromSession } from '../../lib/auth';
import { withTransaction } from '../../lib/db';
import { applyXpEvent, getXpMultiplierForRole } from '../../lib/xp';

const ALLOWED_FORMATS = new Set(['mp3', 'm4a', 'wav']);

interface CreateJobRequest {
  videoId?: string;
  format?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  normalizeAudio?: boolean;
  volumeBoostDb?: number;
  captchaToken?: string;
}

async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    throw new Error('RECAPTCHA_SECRET_KEY is missing');
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }).toString(),
  });

  if (!response.ok) {
    console.error('Failed to verify captcha', response.status);
    return false;
  }

  const payload = await response.json();
  return Boolean(payload.success);
}

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

  const session = await getUserFromSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as CreateJobRequest;
  const { videoId, format, trimStartSeconds, trimEndSeconds, normalizeAudio, volumeBoostDb, captchaToken } = body ?? {};

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'videoId is required' });
  }
  if (!format || typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) {
    return res.status(400).json({ error: 'Unsupported format' });
  }
  if (!captchaToken || typeof captchaToken !== 'string') {
    return res.status(400).json({ error: 'captcha_required' });
  }

  try {
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'captcha_failed' });
    }
  } catch (error) {
    console.error('Captcha verification threw error', error);
    return res.status(500).json({ error: 'captcha_verification_error' });
  }

  // TODO: Apply rate limiting / abuse controls for job creation.
  // TODO: Ensure /api/job-status, /api/job-file, and /api/upload-to-drive also proxy to the worker
  //       with WORKER_API_BASE/WORKER_SHARED_SECRET and verify the job belongs to the current user.

  const workerUrl = `${workerBase.replace(/\/$/, '')}/create-job`;

  try {
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        userId: session.id,
        videoId,
        format,
        trimStartSeconds,
        trimEndSeconds,
        normalizeAudio,
        volumeBoostDb,
      }),
    });

    if (!workerResponse.ok) {
      console.error('Worker create-job failed', workerResponse.status);
      return res.status(502).json({ error: 'worker_failed' });
    }

    let jobResponse: { jobId?: string };
    try {
      jobResponse = (await workerResponse.json()) as { jobId?: string };
    } catch (error) {
      console.error('Unable to parse worker response as JSON', error);
      return res.status(502).json({ error: 'worker_failed' });
    }

    if (!jobResponse?.jobId || typeof jobResponse.jobId !== 'string') {
      console.error('Worker response missing jobId', jobResponse);
      return res.status(502).json({ error: 'worker_failed' });
    }

    const jobId = jobResponse.jobId;
    await withTransaction(async (client) => {
      const conversionId = randomUUID();
      await client.query(
        `INSERT INTO conversions (id, user_id, job_id, source_video_id, format, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [conversionId, session.id, jobId, videoId, format]
      );

      const baseDelta = 25;
      const multiplier = getXpMultiplierForRole(session.role);
      const xpDelta = Math.max(1, Math.round(baseDelta * multiplier));
      // TODO: streak bonus logic here
      // TODO: rate limit abuse (don't farm XP with spam)
      await applyXpEvent(
        {
          userId: session.id,
          delta: xpDelta,
          reason: 'convert',
          eventId: randomUUID(),
        },
        client
      );
    });

    return res.status(200).json({ jobId });
  } catch (error) {
    console.error('/api/create-job error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
