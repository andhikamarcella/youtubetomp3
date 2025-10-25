import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../lib/auth';
import { getPool } from '../../lib/db';

interface UploadBody {
  jobId?: string;
  filename?: string;
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
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { jobId, filename } = req.body as UploadBody;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  try {
    const pool = getPool();
    const tokenResult = await pool.query(
      `SELECT access_token, refresh_token, scope, expires_at
         FROM user_tokens
        WHERE user_id = $1 AND provider = 'google'`,
      [session.id]
    );

    if (tokenResult.rowCount === 0) {
      return res.status(403).json({ error: 'Google Drive is not connected for this user' });
    }

    const tokenRow = tokenResult.rows[0] as {
      access_token: string;
      refresh_token: string | null;
      scope: string | null;
      expires_at: Date | null;
    };

    if (!tokenRow.scope || !tokenRow.scope.includes('drive.file')) {
      return res.status(403).json({ error: 'Missing drive.file scope' });
    }

    if (tokenRow.expires_at && tokenRow.expires_at < new Date()) {
      // TODO: Refresh the Google access token using the stored refresh_token.
      return res.status(401).json({ error: 'Google token expired' });
    }

    // TODO: Verify that the requested jobId belongs to the authenticated user.

    const workerUrl = `${workerBase.replace(/\/$/, '')}/final-url/${jobId}`;
    const workerResponse = await fetch(workerUrl);
    if (!workerResponse.ok) {
      const text = await workerResponse.text();
      console.error('Worker final-url failed', workerResponse.status, text);
      return res.status(workerResponse.status).json({ error: 'Failed to resolve job file', details: tryParseJson(text) });
    }

    const workerJson = tryParseJson(await workerResponse.text()) as {
      downloadUrl?: string;
      suggestedName?: string;
    };
    if (!workerJson.downloadUrl) {
      return res.status(502).json({ error: 'Worker response missing downloadUrl' });
    }

    const fileResponse = await fetch(workerJson.downloadUrl);
    if (!fileResponse.ok) {
      const text = await fileResponse.text();
      console.error('Failed to download worker file', fileResponse.status, text);
      return res.status(fileResponse.status).json({ error: 'Unable to download file from worker' });
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const contentType = fileResponse.headers.get('content-type') ?? 'application/octet-stream';
    const finalName = filename ?? workerJson.suggestedName ?? `${jobId}.mp3`;

    const metadata = {
      name: finalName,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
    form.append('file', new Blob([fileBuffer], { type: contentType }), finalName);

    const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenRow.access_token}`,
      },
      body: form,
    });

    const driveText = await driveResponse.text();
    if (!driveResponse.ok) {
      console.error('Google Drive upload failed', driveResponse.status, driveText);
      return res.status(driveResponse.status).json({ error: 'Drive upload failed', details: tryParseJson(driveText) });
    }

    const driveJson = tryParseJson(driveText) as { id?: string; name?: string };
    if (!driveJson.id) {
      return res.status(502).json({ error: 'Drive response missing file id' });
    }

    // TODO: Log upload attempts for auditing.
    return res.status(200).json({ ok: true, fileId: driveJson.id, fileName: driveJson.name ?? finalName });
  } catch (error) {
    console.error('/api/upload-to-drive error', error);
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
