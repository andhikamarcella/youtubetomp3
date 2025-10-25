import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../lib/auth';
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
    console.error('RECAPTCHA_SECRET_KEY is missing; cannot verify captcha');
    return false;
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

  const session = await getSessionUser(req);
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
  if (!captchaToken) {
    return res.status(400).json({ error: 'captchaToken is required' });
  }

  const captchaValid = await verifyCaptcha(captchaToken);
  if (!captchaValid) {
    return res.status(400).json({ error: 'Captcha verification failed' });
  }

  // TODO: Apply rate limiting / abuse controls for job creation.

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

    const textPayload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker create-job failed', workerResponse.status, textPayload);
      return res.status(workerResponse.status).json({ error: 'Failed to create job', details: tryParseJson(textPayload) });
    }

    const jobResponse = tryParseJson(textPayload) as { jobId?: string; [key: string]: unknown };
    if (!jobResponse?.jobId || typeof jobResponse.jobId !== 'string') {
      console.error('Worker response missing jobId', jobResponse);
      return res.status(502).json({ error: 'Invalid worker response' });
    }

    const jobId = jobResponse.jobId;
    let awardedXp = 0;
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO conversions (user_id, job_id, source_video_id, format)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (job_id) DO NOTHING`,
        [session.id, jobId, videoId, format]
      );

      const baseXp = 25; // Base XP for creating a job.
      const multiplier = getXpMultiplierForRole(session.role);
      const xpDelta = Math.max(1, Math.round(baseXp * multiplier));
      // TODO: Add streak bonus XP calculations.
      // TODO: Apply per-user rate limiting to prevent XP farming via repeated create-job calls.
      awardedXp = xpDelta;
      await applyXpEvent(
        {
          userId: session.id,
          delta: xpDelta,
          reason: 'convert',
          eventId: `job:${jobId}:create`,
        },
        client
      );
    });

    return res.status(200).json({ jobId, awardedXp });
  } catch (error) {
    console.error('/api/create-job error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

function tryParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
}
