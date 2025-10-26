import express from 'express';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '1mb' }));

if (ffmpegInstaller?.path) {
  try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    console.log(`Configured ffmpeg binary from @ffmpeg-installer at ${ffmpegInstaller.path}`);
  } catch (error) {
    console.warn('Failed to configure ffmpeg binary from installer package', error);
  }
} else {
  console.warn('No ffmpeg installer path detected; relying on system ffmpeg in PATH');
}

const workerSecret = process.env.WORKER_SHARED_SECRET;
if (!workerSecret) {
  console.warn('WORKER_SHARED_SECRET is not set. Requests will be rejected until it is configured.');
}

const selfUrl = process.env.SELF_URL ?? '';
const normalizedSelfUrl = selfUrl.replace(/\/$/, '');

const COOKIES_PATH = process.env.WORKER_COOKIES_PATH || '/tmp/cookies.txt';
const COOKIES_SYNC_URL = process.env.WORKER_COOKIES_SYNC_URL || '';
const COOKIES_SYNC_TOKEN = process.env.WORKER_COOKIES_SYNC_TOKEN || '';
const COOKIES_REFRESH_INTERVAL_MS = Number.parseInt(
  process.env.WORKER_COOKIES_REFRESH_INTERVAL_MS ?? '',
  10
);

let lastCookiesHydration = 0;

if (COOKIES_PATH) {
  if (!fs.existsSync(COOKIES_PATH)) {
    if (COOKIES_SYNC_URL) {
      console.warn(
        `Worker cookies file not found at ${COOKIES_PATH}. Will attempt to fetch from WORKER_COOKIES_SYNC_URL when needed.`
      );
    } else {
      console.warn(
        `Worker cookies file not found at ${COOKIES_PATH}. Age-gated videos may fail until it is uploaded.`
      );
    }
  } else {
    console.log(`Worker will attach cookies from ${COOKIES_PATH} when available.`);
    lastCookiesHydration = Date.now();
  }
}

if (COOKIES_PATH && COOKIES_SYNC_URL) {
  hydrateCookiesFile().catch((error) => {
    console.warn('Initial cookies hydration failed', error);
  });
}

// TODO: persistent storage instead of in-memory JOBS (e.g. Redis or DB)
const JOBS = Object.create(null);
const DOWNLOAD_DIR = '/tmp';

const FORMAT_CONFIG = {
  mp3: { extension: 'mp3', mimeType: 'audio/mpeg', ffmpegFormat: 'mp3', audioCodec: 'libmp3lame' },
  m4a: { extension: 'm4a', mimeType: 'audio/mp4', ffmpegFormat: 'ipod', audioCodec: 'aac' },
  wav: { extension: 'wav', mimeType: 'audio/wav', ffmpegFormat: 'wav', audioCodec: 'pcm_s16le' },
};

function requireAuth(req, res, next) {
  if (!workerSecret) {
    return res.status(500).json({ error: 'worker_misconfigured' });
  }

  const authHeader = req.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${workerSecret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
}

function sanitizeFileComponent(input) {
  return String(input ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 128) || 'audio';
}

function appendJobLog(jobId, message, error) {
  if (!JOBS[jobId]) {
    return;
  }
  const timestamp = new Date().toISOString();
  const formatted = error ? `${timestamp} [error] ${message}` : `${timestamp} ${message}`;
  if (!Array.isArray(JOBS[jobId].logs)) {
    JOBS[jobId].logs = [];
  }
  JOBS[jobId].logs.push(formatted);
  if (JOBS[jobId].logs.length > 200) {
    JOBS[jobId].logs.splice(0, JOBS[jobId].logs.length - 200);
  }
  JOBS[jobId].updatedAt = Date.now();
}

function touchJob(jobId) {
  if (JOBS[jobId]) {
    JOBS[jobId].updatedAt = Date.now();
  }
}

async function removeFileIfExists(targetPath) {
  try {
    await fsPromises.unlink(targetPath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to remove temp file', targetPath, error);
    }
  }
}

async function fileExists(targetPath) {
  try {
    await fsPromises.access(targetPath, fs.constants.R_OK);
    return true;
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Error while checking file existence', targetPath, error);
    }
    return false;
  }
}

async function hydrateCookiesFile() {
  if (!COOKIES_PATH || !COOKIES_SYNC_URL) {
    return null;
  }

  try {
    const headers = {
      Accept: 'text/plain, */*;q=0.1',
    };
    const bearerSource = COOKIES_SYNC_TOKEN || workerSecret;
    if (bearerSource) {
      headers.Authorization = `Bearer ${bearerSource}`;
    }
    const response = await fetch(COOKIES_SYNC_URL, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.warn('Failed to fetch cookies from sync URL', response.status);
      return null;
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      console.warn('Cookies sync endpoint returned empty body');
      return null;
    }

    await fsPromises.mkdir(path.dirname(COOKIES_PATH), { recursive: true });
    await fsPromises.writeFile(COOKIES_PATH, text, 'utf8');
    lastCookiesHydration = Date.now();
    console.log(`Fetched cookies from sync URL into ${COOKIES_PATH}`);
    return COOKIES_PATH;
  } catch (error) {
    console.warn('Unable to hydrate cookies from sync URL', error);
    return null;
  }
}

async function resolveCookiesFile() {
  if (!COOKIES_PATH) {
    return null;
  }

  const now = Date.now();
  const refreshInterval = Number.isFinite(COOKIES_REFRESH_INTERVAL_MS)
    ? Math.max(30_000, COOKIES_REFRESH_INTERVAL_MS)
    : 5 * 60_000;

  if (COOKIES_SYNC_URL && (forceHydrationRequired(now, refreshInterval) || !(await fileExists(COOKIES_PATH)))) {
    const hydrated = await hydrateCookiesFile();
    if (hydrated) {
      return hydrated;
    }
  }

  if (await fileExists(COOKIES_PATH)) {
    return COOKIES_PATH;
  }

  return hydrateCookiesFile();
}

function forceHydrationRequired(now, refreshInterval) {
  if (!lastCookiesHydration) {
    return true;
  }
  return now - lastCookiesHydration > refreshInterval;
}

async function processJob(jobId, jobOptions) {
  const { videoId, format, trimStartSeconds, trimEndSeconds, normalizeAudio, volumeBoostDb, userId } = jobOptions;
  const config = FORMAT_CONFIG[format];
  const downloadTemplate = path.join(DOWNLOAD_DIR, `${jobId}.source.%(ext)s`);
  const finalPath = path.join(DOWNLOAD_DIR, `${jobId}.${config.extension}`);
  const normalizedUrl = (() => {
    if (typeof videoId !== 'string' || !videoId.trim()) {
      return videoId;
    }
    const trimmed = videoId.trim();
    if (/^https?:/i.test(trimmed)) {
      return trimmed;
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return `https://www.youtube.com/watch?v=${trimmed}`;
    }
    return trimmed;
  })();
  const baseLabel =
    typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId.trim())
      ? videoId.trim()
      : normalizedUrl;
  const fileName = `${sanitizeFileComponent(baseLabel)}.${config.extension}`;

  let tempDownloadPath;

  try {
    if (!JOBS[jobId]) {
      JOBS[jobId] = { status: 'processing', progress: 0, userId };
    }

    JOBS[jobId] = {
      ...JOBS[jobId],
      status: 'processing',
      progress: 5,
      fileName,
      mimeType: config.mimeType,
      userId,
    };
    touchJob(jobId);
    appendJobLog(jobId, `Normalized video URL ${normalizedUrl}`);

    const cookiesPath = await resolveCookiesFile();
    JOBS[jobId].usingCookies = Boolean(cookiesPath);
    touchJob(jobId);
    if (cookiesPath) {
      appendJobLog(jobId, `Using cookies file at ${cookiesPath}`);
    } else {
      appendJobLog(jobId, 'Proceeding without cookies');
    }

    await ytDlp(normalizedUrl, {
      output: downloadTemplate,
      format: 'bestaudio/best',
      extractAudio: false,
      quiet: true,
      ...(cookiesPath ? { cookies: cookiesPath } : {}),
    });
    appendJobLog(jobId, 'yt-dlp download finished');

    JOBS[jobId].progress = 40;
    touchJob(jobId);

    const downloadEntries = await fsPromises.readdir(DOWNLOAD_DIR);
    const sourceName = downloadEntries.find((entry) => entry.startsWith(`${jobId}.source.`));
    if (!sourceName) {
      throw new Error('download_missing');
    }

    tempDownloadPath = path.join(DOWNLOAD_DIR, sourceName);

    appendJobLog(jobId, 'Starting ffmpeg conversion');
    await new Promise((resolve, reject) => {
      const command = ffmpeg(tempDownloadPath)
        .audioCodec(config.audioCodec)
        .format(config.ffmpegFormat);

      if (typeof trimStartSeconds === 'number' && trimStartSeconds > 0) {
        command.setStartTime(trimStartSeconds);
      }

      if (typeof trimEndSeconds === 'number' && trimEndSeconds > 0) {
        const effectiveStart = typeof trimStartSeconds === 'number' && trimStartSeconds > 0 ? trimStartSeconds : 0;
        const duration = Math.max(0, trimEndSeconds - effectiveStart);
        if (duration > 0) {
          command.setDuration(duration);
        }
      }

      if (typeof volumeBoostDb === 'number' && !Number.isNaN(volumeBoostDb) && volumeBoostDb !== 0) {
        command.audioFilters(`volume=${volumeBoostDb}dB`);
      }

      if (normalizeAudio) {
        // TODO: add loudness normalization filter configuration.
      }

      command
        .on('progress', (progress) => {
          if (progress && typeof progress.percent === 'number') {
            JOBS[jobId].progress = Math.min(95, Math.max(0, Math.round(progress.percent)));
            touchJob(jobId);
          }
        })
        .on('end', resolve)
        .on('error', (error) => {
          appendJobLog(jobId, `ffmpeg error: ${error?.message || error}`, true);
          reject(error);
        })
        .save(finalPath);
    });
    appendJobLog(jobId, `ffmpeg saved output to ${finalPath}`);

    JOBS[jobId] = {
      ...JOBS[jobId],
      status: 'done',
      progress: 100,
      filePath: finalPath,
      fileName,
      mimeType: config.mimeType,
    };
    touchJob(jobId);
    appendJobLog(jobId, 'Job finished successfully');

    await removeFileIfExists(tempDownloadPath);
  } catch (error) {
    console.error('Worker failed to process job', jobId, error);
    appendJobLog(jobId, `Job failed: ${error?.message || error}`, true);
    JOBS[jobId] = {
      ...JOBS[jobId],
      status: 'error',
      progress: 0,
      error: 'convert_failed',
      userId,
      errorDetail: error?.message || 'convert_failed',
      logs: JOBS[jobId]?.logs || [],
    };
    touchJob(jobId);

    if (tempDownloadPath) {
      await removeFileIfExists(tempDownloadPath);
    } else {
      try {
        const downloadEntries = await fsPromises.readdir(DOWNLOAD_DIR);
        const sourceName = downloadEntries.find((entry) => entry.startsWith(`${jobId}.source.`));
        if (sourceName) {
          await removeFileIfExists(path.join(DOWNLOAD_DIR, sourceName));
        }
      } catch (cleanupError) {
        console.warn('Failed to inspect download directory during cleanup', cleanupError);
      }
    }

    await removeFileIfExists(finalPath);
  }
}

app.post('/create-job', requireAuth, async (req, res) => {
  const { userId, videoId, format, trimStartSeconds, trimEndSeconds, normalizeAudio, volumeBoostDb } = req.body ?? {};

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'video_id_required' });
  }
  if (!format || typeof format !== 'string' || !FORMAT_CONFIG[format]) {
    return res.status(400).json({ error: 'unsupported_format' });
  }
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'user_id_required' });
  }

  const jobId = uuidv4();

  JOBS[jobId] = {
    status: 'processing',
    progress: 0,
    userId,
    logs: [],
    acceptedAt: Date.now(),
    updatedAt: Date.now(),
  };
  appendJobLog(jobId, `Job accepted for user ${userId} with video ${videoId}`);
  touchJob(jobId);

  // TODO: persistent storage instead of in-memory JOBS (e.g. Redis or DB)
  // TODO: async queue instead of blocking request
  // TODO: rate limit / abuse prevention
  processJob(jobId, {
    userId,
    videoId,
    format,
    trimStartSeconds,
    trimEndSeconds,
    normalizeAudio,
    volumeBoostDb,
  }).catch((error) => {
    console.error('Unhandled error while processing job', jobId, error);
  });

  return res.status(202).json({ jobId });
});

app.get('/status/:jobId', requireAuth, (req, res) => {
  const jobId = req.params.jobId;
  const job = JOBS[jobId];

  if (!job) {
    return res.status(404).json({ error: 'not_found' });
  }

  if (job.status === 'done') {
    return res.status(200).json({ progress: 100, done: true });
  }

  if (job.status === 'error') {
    return res
      .status(200)
      .json({ progress: 0, done: true, error: 'convert_failed', errorDetail: job.errorDetail || null });
  }

  return res.status(200).json({ progress: job.progress ?? 0, done: false });
});

app.get('/file/:jobId', requireAuth, async (req, res) => {
  const jobId = req.params.jobId;
  const job = JOBS[jobId];

  if (!job || job.status !== 'done' || !job.filePath) {
    return res.status(404).json({ error: 'not_found' });
  }

  try {
    await fsPromises.access(job.filePath, fs.constants.R_OK);
  } catch (error) {
    console.error('File missing for job', jobId, error);
    return res.status(500).json({ error: 'file_unavailable' });
  }

  res.setHeader('Content-Type', job.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);

  const stream = fs.createReadStream(job.filePath);
  stream.on('error', (error) => {
    console.error('Streaming error for job', jobId, error);
    res.destroy(error);
  });
  stream.pipe(res);
});

app.get('/final-url/:jobId', requireAuth, (req, res) => {
  if (!normalizedSelfUrl) {
    return res.status(500).json({ error: 'worker_misconfigured' });
  }

  const jobId = req.params.jobId;
  const job = JOBS[jobId];

  if (!job || job.status !== 'done') {
    return res.status(404).json({ error: 'not_found' });
  }

  return res.status(200).json({
    downloadUrl: `${normalizedSelfUrl}/file/${jobId}`,
    suggestedName: job.fileName,
    mimeType: job.mimeType,
  });
});

app.post('/admin/upload-cookies', requireAuth, express.text({ type: '*/*', limit: '2mb' }), async (req, res) => {
  const body = typeof req.body === 'string' ? req.body : '';
  if (!body.trim()) {
    return res.status(400).json({ error: 'empty_body' });
  }

  if (!COOKIES_PATH) {
    return res.status(500).json({ error: 'cookies_path_missing' });
  }

  try {
    await fsPromises.mkdir(path.dirname(COOKIES_PATH), { recursive: true });
    await fsPromises.writeFile(COOKIES_PATH, body, 'utf8');
    const stat = await fsPromises.stat(COOKIES_PATH);
    return res.json({ ok: true, path: COOKIES_PATH, bytes: stat.size, mtime: stat.mtime });
  } catch (error) {
    console.error('Failed to persist cookies upload', error);
    return res.status(500).json({ error: 'cookies_write_failed' });
  }
});

app.get('/admin/cookies-status', requireAuth, async (_req, res) => {
  if (!COOKIES_PATH) {
    return res.status(500).json({ error: 'cookies_path_missing' });
  }

  try {
    const stat = await fsPromises.stat(COOKIES_PATH);
    return res.json({ exists: true, path: COOKIES_PATH, bytes: stat.size, mtime: stat.mtime });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return res.json({ exists: false });
    }
    console.error('Failed to read cookies status', error);
    return res.status(500).json({ error: 'cookies_status_failed' });
  }
});

app.post('/admin/refresh-cookies', requireAuth, async (_req, res) => {
  if (!COOKIES_PATH || !COOKIES_SYNC_URL) {
    return res.status(400).json({ error: 'sync_not_configured' });
  }

  try {
    const hydrated = await hydrateCookiesFile();
    if (!hydrated) {
      return res.status(502).json({ error: 'sync_failed' });
    }
    const stat = await fsPromises.stat(hydrated);
    return res.json({ ok: true, path: hydrated, bytes: stat.size, mtime: stat.mtime });
  } catch (error) {
    console.error('Manual cookies refresh failed', error);
    return res.status(500).json({ error: 'sync_failed' });
  }
});

app.get('/admin/jobs', requireAuth, (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit ?? '25', 10) || 25));
  const entries = Object.entries(JOBS)
    .sort((a, b) => (JOBS[b[0]].updatedAt ?? 0) - (JOBS[a[0]].updatedAt ?? 0))
    .slice(0, limit)
    .map(([jobId, job]) => ({
      jobId,
      status: job.status,
      progress: job.progress ?? 0,
      usingCookies: Boolean(job.usingCookies),
      updatedAt: job.updatedAt ?? null,
      userId: job.userId ?? null,
      error: job.error ?? null,
    }));

  return res.json({ jobs: entries, total: entries.length });
});

app.get('/admin/jobs/:jobId', requireAuth, (req, res) => {
  const jobId = req.params.jobId;
  const job = JOBS[jobId];
  if (!job) {
    return res.status(404).json({ error: 'not_found' });
  }

  return res.json({
    jobId,
    ...job,
    logs: job.logs || [],
  });
});

app.get('/admin/download-cookies', requireAuth, async (_req, res) => {
  if (!COOKIES_PATH) {
    return res.status(500).json({ error: 'cookies_path_missing' });
  }

  try {
    const contents = await fsPromises.readFile(COOKIES_PATH, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(contents);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return res.status(404).json({ error: 'not_found' });
    }
    console.error('Failed to stream cookies file', error);
    return res.status(500).json({ error: 'cookies_read_failed' });
  }
});

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});

// TODO: cleanup old /tmp files
