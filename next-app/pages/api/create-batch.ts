import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../lib/auth';
import { withTransaction } from '../../lib/db';
import { recordConversionJobs } from '../../lib/conversions';
import { applyXpEvent, getXpMultiplierForRole } from '../../lib/xp';

const ALLOWED_FORMATS = new Set(['mp3', 'm4a', 'wav']);

interface BatchJobBody {
  videoIds?: unknown;
  format?: string;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  normalizeAudio?: boolean;
  volumeBoostDb?: number;
  captchaToken?: string;
}

interface WorkerBatchResponse {
  batchId?: string;
  jobs?: Array<{ jobId?: string; videoId?: string }>;
  [key: string]: unknown;
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
    console.error('Failed to verify captcha for batch create', response.status);
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

  const body = req.body as BatchJobBody;
  const { videoIds, format, trimStartSeconds, trimEndSeconds, normalizeAudio, volumeBoostDb, captchaToken } = body ?? {};

  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'videoIds must be a non-empty array' });
  }
  if (videoIds.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 items per batch' });
  }
  if (!format || typeof format !== 'string' || !ALLOWED_FORMATS.has(format)) {
    return res.status(400).json({ error: 'Unsupported format' });
  }
  if (!captchaToken || typeof captchaToken !== 'string') {
    return res.status(400).json({ error: 'captchaToken is required' });
  }

  const captchaValid = await verifyCaptcha(captchaToken);
  if (!captchaValid) {
    return res.status(400).json({ error: 'Captcha verification failed' });
  }

  // TODO: Apply rate limiting / abuse controls for batch job creation.

  const workerUrl = `${workerBase.replace(/\/$/, '')}/create-batch`;

  try {
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        userId: session.id,
        format,
        trimStartSeconds,
        trimEndSeconds,
        normalizeAudio,
        volumeBoostDb,
        videos: videoIds.map((id) => ({ videoId: id })),
      }),
    });

    const textPayload = await workerResponse.text();
    if (!workerResponse.ok) {
      console.error('Worker create-batch failed', workerResponse.status, textPayload);
      return res.status(workerResponse.status).json({ error: 'Failed to create batch', details: tryParseJson(textPayload) });
    }

    const payload = tryParseJson(textPayload) as WorkerBatchResponse;
    const batchId = typeof payload.batchId === 'string' ? payload.batchId : undefined;
    const jobs = Array.isArray(payload.jobs)
      ? payload.jobs.filter((item): item is { jobId: string; videoId: string } =>
          typeof item?.jobId === 'string' && typeof item?.videoId === 'string'
        )
      : [];

    if (!batchId || jobs.length === 0) {
      console.error('Worker batch response missing identifiers', payload);
      return res.status(502).json({ error: 'Invalid worker response' });
    }

    let awardedXp = 0;
    await withTransaction(async (client) => {
      await recordConversionJobs(
        session.id,
        jobs.map((job) => ({ jobId: job.jobId, videoId: job.videoId, format })),
        client
      );

      const baseXpPerJob = 20;
      const multiplier = getXpMultiplierForRole(session.role);
      const totalDelta = Math.max(1, Math.round(baseXpPerJob * jobs.length * multiplier));
      // TODO: Add streak bonus calculations for batch conversions.
      await applyXpEvent(
        {
          userId: session.id,
          delta: totalDelta,
          reason: 'convert_batch',
          eventId: `batch:${batchId}`,
        },
        client
      );
      awardedXp = totalDelta;
    });

    return res.status(200).json({ batchId, jobs, awardedXp });
  } catch (error) {
    console.error('/api/create-batch error', error);
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
