import type { NextApiRequest, NextApiResponse } from 'next';
import { listAllFaqEntries } from '../../lib/faq';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const entries = await listAllFaqEntries();
    return res.status(200).json({
      entries: entries.map((entry) => ({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        updated_at: entry.updated_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('/api/faq error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
