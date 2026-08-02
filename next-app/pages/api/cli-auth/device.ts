import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createSecret,
  createUserCode,
  DEVICE_CODE_TTL_SECONDS,
  ensureCliAuthSchema,
  hashSecret,
  publicBaseUrl,
} from '../../../lib/cli-auth';
import { getPool } from '../../../lib/db';

function clean(value: unknown, fallback: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await ensureCliAuthSchema();
    const deviceCode = createSecret('ytdc', 32);
    let userCode = createUserCode();
    const pool = getPool();
    const deviceName = clean(req.body?.deviceName, 'Unknown device');
    const platform = clean(req.body?.platform, 'unknown', 40);
    const cliVersion = clean(req.body?.cliVersion, 'unknown', 40);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await pool.query(
          `INSERT INTO cli_device_codes
             (device_code_hash, user_code, device_name, platform, cli_version, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::interval)`,
          [hashSecret(deviceCode), userCode, deviceName, platform, cliVersion, String(DEVICE_CODE_TTL_SECONDS)]
        );
        break;
      } catch (error: any) {
        if (error?.code !== '23505' || attempt === 3) throw error;
        userCode = createUserCode();
      }
    }

    const base = publicBaseUrl(req);
    const verificationUri = `${base}/cli-login`;
    return res.status(200).json({
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
      expiresIn: DEVICE_CODE_TTL_SECONDS,
      interval: 4,
    });
  } catch (error) {
    console.error('/api/cli-auth/device error', error);
    return res.status(500).json({ error: 'Unable to start device login' });
  }
}
