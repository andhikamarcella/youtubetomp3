import express from 'express';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';

const app = express();
app.use(express.json({ limit: '1mb' }));

const workerSecret = process.env.WORKER_SHARED_SECRET;
if (!workerSecret) {
  console.warn('WORKER_SHARED_SECRET is not set. Requests will be rejected until it is configured.');
}

const selfUrl = process.env.SELF_URL ?? '';
const normalizedSelfUrl = selfUrl.replace(/\/$/, '');

const COOKIES_PATH = process.env.WORKER_COOKIES_PATH || '/tmp/cookies.txt';

if (COOKIES_PATH) {
  if (!fs.existsSync(COOKIES_PATH)) {
    console.warn(`Worker cookies file not found at ${COOKIES_PATH}. Age-gated videos may fail until it is uploaded.`);
  } else {
    console.log(`Worker will attach cookies from ${COOKIES_PATH} when available.`);
  }
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

async function removeFileIfExists(targetPath) {
  try {
    await fsPromises.unlink(targetPath);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to remove temp file', targetPath, error);
    }
  }
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

    const cookiesPath = COOKIES_PATH && fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : null;

    await ytDlp(normalizedUrl, {
      output: downloadTemplate,
      format: 'bestaudio/best',
      extractAudio: false,
      quiet: true,
      ...(cookiesPath ? { cookies: cookiesPath } : {}),
    });

    JOBS[jobId].progress = 40;

    const downloadEntries = await fsPromises.readdir(DOWNLOAD_DIR);
    const sourceName = downloadEntries.find((entry) => entry.startsWith(`${jobId}.source.`));
    if (!sourceName) {
      throw new Error('download_missing');
    }

    tempDownloadPath = path.join(DOWNLOAD_DIR, sourceName);

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
          }
        })
        .on('end', resolve)
        .on('error', reject)
        .save(finalPath);
    });

    JOBS[jobId] = {
      ...JOBS[jobId],
      status: 'done',
      progress: 100,
      filePath: finalPath,
      fileName,
      mimeType: config.mimeType,
    };

    await removeFileIfExists(tempDownloadPath);
  } catch (error) {
    console.error('Worker failed to process job', jobId, error);
    JOBS[jobId] = {
      status: 'error',
      progress: 0,
      error: 'convert_failed',
      userId,
    };

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
  };

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
    return res.status(200).json({ progress: 0, done: true, error: 'convert_failed' });
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

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});

// TODO: cleanup old /tmp files
