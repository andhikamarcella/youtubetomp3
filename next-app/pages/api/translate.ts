import type { NextApiRequest, NextApiResponse } from 'next';
import { TranslationServiceClient } from '@google-cloud/translate';
import { getSessionUser } from '../../lib/auth';

let translationClient: TranslationServiceClient | null = null;

function getTranslationClient(): TranslationServiceClient {
  if (translationClient) return translationClient;
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON env var is required');
  }
  const credentials = JSON.parse(credentialsJson);
  const projectId: string | undefined = credentials.project_id;
  if (!projectId) {
    throw new Error('Service account credentials missing project_id');
  }
  translationClient = new TranslationServiceClient({
    credentials,
    projectId,
  });
  return translationClient;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await getSessionUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, targetLang } = req.body ?? {};
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (typeof targetLang !== 'string' || targetLang.trim().length === 0) {
    return res.status(400).json({ error: 'targetLang is required' });
  }

  try {
    // TODO: apply per-user rate limiting using a shared store (Redis, Upstash, etc.)
    const client = getTranslationClient();
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON as string);
    const location = 'global';
    const [response] = await client.translateText({
      parent: `projects/${credentials.project_id}/locations/${location}`,
      contents: [text],
      mimeType: 'text/plain',
      targetLanguageCode: targetLang,
    });
    const translated = response.translations?.[0]?.translatedText ?? '';
    return res.status(200).json({ translatedText: translated });
  } catch (error) {
    console.error('/api/translate error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
