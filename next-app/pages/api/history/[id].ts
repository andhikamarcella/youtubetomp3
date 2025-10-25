import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureUserRecord, getSessionUser } from '../../../lib/auth';
import { assertConversionOwnership } from '../../../lib/conversions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await ensureUserRecord(session);
    const conversionId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!conversionId) {
      return res.status(400).json({ error: 'Missing conversion id' });
    }

    const conversion = await assertConversionOwnership(conversionId, user.id);

    return res.status(200).json({
      id: conversion.id,
      job_id: conversion.job_id,
      source_video_id: conversion.source_video_id,
      format: conversion.format,
      created_at: conversion.created_at.toISOString(),
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('/api/history/[id] error', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
