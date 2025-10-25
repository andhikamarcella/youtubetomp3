import type { NextApiRequest, NextApiResponse } from 'next';

interface WorkerToolVersions {
  yt_dlp?: { current?: string; latest?: string; outdated?: boolean | string };
  ffmpeg?: { current?: string; latest?: string; outdated?: boolean | string };
  checkedAt?: string;
  [key: string]: unknown;
}

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

  const workerUrl = `${workerBase.replace(/\/$/, '')}/tool-versions`;

  try {
    const response = await fetch(workerUrl, {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error('Worker tool-versions failed', response.status, raw);
      return res.status(response.status).json({ error: 'Failed to query worker tool versions' });
    }

    const payload = tryParseJson(raw) as WorkerToolVersions;
    const result = {
      yt_dlp: normalizeToolInfo(payload.yt_dlp),
      ffmpeg: normalizeToolInfo(payload.ffmpeg),
      checkedAt: payload.checkedAt ?? new Date().toISOString(),
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('/api/tool-versions error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

function normalizeToolInfo(info: WorkerToolVersions['yt_dlp']): {
  current: string | null;
  latest: string | null;
  outdated: boolean;
} {
  const rawOutdated = info?.outdated;
  let outdated = false;
  if (typeof rawOutdated === 'string') {
    outdated = rawOutdated.toLowerCase() === 'true';
  } else if (typeof rawOutdated === 'boolean') {
    outdated = rawOutdated;
  }

  return {
    current: typeof info?.current === 'string' ? info.current : null,
    latest: typeof info?.latest === 'string' ? info.latest : null,
    outdated,
  };
}

function tryParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
}
