import type { NextApiRequest, NextApiResponse } from 'next';

interface VerifyCaptchaBody {
  captchaToken?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: 'Missing RECAPTCHA_SECRET_KEY' });
  }

  const body = req.body as VerifyCaptchaBody;
  if (!body?.captchaToken) {
    return res.status(400).json({ error: 'captchaToken is required' });
  }

  // TODO: Add rate limiting to prevent captcha brute force.
  try {
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ secret, response: body.captchaToken }).toString(),
    });

    const verifyJson = await verifyResponse.json();
    if (!verifyJson.success) {
      return res.status(400).json({ error: 'Captcha verification failed', details: verifyJson });
    }

    return res.status(200).json({ ok: true, score: verifyJson.score ?? null });
  } catch (error) {
    console.error('/api/verify-captcha error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
