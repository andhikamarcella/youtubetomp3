import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../lib/auth';
import { getPool } from '../../lib/db';
import { listFaqEntries } from '../../lib/faq';

interface AiNavigatorBody {
  question?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const session = await getSessionUser(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as AiNavigatorBody;
  const question = body?.question ? String(body.question).trim() : '';
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  // TODO: Implement rate limiting and abuse prevention for AI Navigator requests.
  // TODO: Persist chat logs for support analytics and safety review.
  const sanitizedQuestion = question.slice(0, 2000);

  try {
    const profile = await ensureUserRecord(session);
    const pool = getPool();
    const [conversionResult, faqEntries] = await Promise.all([
      pool.query<{
        job_id: string;
        source_video_id: string;
        format: string;
        created_at: Date;
      }>(
        `SELECT job_id, source_video_id, format, created_at
           FROM conversions
          WHERE user_id = $1
       ORDER BY created_at DESC
          LIMIT 1`,
        [profile.id]
      ),
      listFaqEntries(3),
    ]);

    const xpValue = profile.current_xp ?? '0';
    const roleValue = profile.role ?? session.role ?? 'user';
    const lastConversion = conversionResult.rows[0];

    const faqContext = faqEntries
      .map((entry, index) => `FAQ ${index + 1}: Q: ${entry.question}\nA: ${entry.answer}`)
      .join('\n\n');

    const lastConversionContext = lastConversion
      ? `Last conversion job ${lastConversion.job_id} for video ${lastConversion.source_video_id} in format ${lastConversion.format} at ${lastConversion.created_at.toISOString()}.`
      : 'No conversions have been completed yet.';

    const systemPrompt = `You are the AI Navigator for the youtubemp3 audio toolkit. Help users troubleshoot conversions, explain XP and streak systems, and guide them to features like Drive uploads and playlists. Prefer concise Indonesian unless the user uses English.`;

    const contextualPrompt = [
      `User role: ${roleValue}`,
      `Current XP: ${xpValue}`,
      lastConversionContext,
      faqContext ? `Recent FAQ entries:\n${faqContext}` : 'No FAQ entries available.',
      `User question: ${sanitizedQuestion}`,
      'Respond with a friendly explanation followed by a line that starts with "Recommended next step:" and gives one actionable instruction.',
    ].join('\n\n');

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n${contextualPrompt}` },
          ],
        },
      ],
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const geminiJson = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error('Gemini API error', geminiResponse.status, geminiJson);
      return res.status(geminiResponse.status).json({ error: 'Failed to generate AI response' });
    }

    const candidate = geminiJson?.candidates?.[0];
    const answerText = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
          .map((part: { text?: string }) => part?.text ?? '')
          .join('\n')
          .trim()
      : '';

    if (!answerText) {
      return res.status(502).json({ error: 'Gemini response missing text' });
    }

    return res.status(200).json({ answer: answerText });
  } catch (error) {
    console.error('/api/ai-navigator error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
