import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_PATTERN = '{artist} - {title} ({bitrate})';
const INVALID_CHARS = /[<>:"/\\|?*]+/g;

interface NamingPreviewRequest {
  pattern?: string;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    channelTitle?: string;
    bitrate?: string | number;
    format?: string;
    index?: number;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as NamingPreviewRequest;
  const pattern = typeof body.pattern === 'string' && body.pattern.trim() ? body.pattern.trim() : DEFAULT_PATTERN;
  const metadata = body.metadata ?? {};

  const replacements = buildReplacementMap(metadata);
  const rendered = renderPattern(pattern, replacements);
  const extension = pickExtension(metadata.format);
  const safeName = sanitizeFilename(rendered);

  const finalName = extension ? `${safeName}.${extension}` : safeName;

  return res.status(200).json({ filename: finalName });
}

function buildReplacementMap(metadata: NamingPreviewRequest['metadata']): Record<string, string> {
  const entries: Record<string, string> = {};
  if (!metadata) {
    return entries;
  }

  const add = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      entries[key] = value.trim();
    }
  };

  add('title', metadata.title);
  add('artist', metadata.artist ?? metadata.channelTitle);
  add('channel', metadata.channelTitle);
  add('album', metadata.album);

  if (typeof metadata.bitrate === 'number') {
    entries.bitrate = `${metadata.bitrate}kbps`;
  } else if (typeof metadata.bitrate === 'string' && metadata.bitrate.trim()) {
    entries.bitrate = metadata.bitrate.trim();
  }

  if (typeof metadata.index === 'number' && Number.isFinite(metadata.index)) {
    entries.index = String(metadata.index + 1);
  }

  return entries;
}

function renderPattern(pattern: string, replacements: Record<string, string>): string {
  return pattern.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const replacement = replacements[key];
    if (typeof replacement === 'string') {
      return replacement;
    }
    if (key === 'index' && typeof replacements.index !== 'undefined') {
      return replacements.index;
    }
    return '';
  });
}

function sanitizeFilename(input: string): string {
  const trimmed = input.replace(INVALID_CHARS, ' ').trim();
  if (!trimmed) {
    return 'output';
  }
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .slice(0, 140);
}

function pickExtension(format: unknown): string | null {
  if (typeof format !== 'string') {
    return null;
  }
  const clean = format.trim().toLowerCase();
  if (!clean) {
    return null;
  }
  return clean;
}
