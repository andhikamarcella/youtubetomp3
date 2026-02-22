import { NextResponse } from 'next/server';
import { selectSeasonalTheme } from '../../../lib/seasonal/engine';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateISO = String(url.searchParams.get('date') || '').trim();
  const tz = String(url.searchParams.get('tz') || 'UTC').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }
  const hijriUrl = new URL('/api/hijri', url.origin);
  hijriUrl.searchParams.set('date', dateISO);
  hijriUrl.searchParams.set('tz', tz);

  let hijriMonth: number | null = null;
  let hijriDateText: string | null = null;
  try {
    const hijriRes = await fetch(hijriUrl.toString(), { method: 'GET' });
    const hijriPayload = (await hijriRes.json()) as any;
    if (hijriRes.ok) {
      hijriMonth = Number(hijriPayload?.hijriMonth || 0) || null;
      hijriDateText = hijriPayload?.hijriDateText ? String(hijriPayload.hijriDateText) : null;
    }
  } catch {
    hijriMonth = null;
  }

  const theme = selectSeasonalTheme({ dateISO, hijriMonth });
  return NextResponse.json({ theme, hijriDateText });
}

