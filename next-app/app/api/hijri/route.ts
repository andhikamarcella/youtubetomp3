import { NextResponse } from 'next/server';
import { getCachedJson, setCachedJson } from '../../../lib/cacheJson';

type HijriPayload = {
  gregorianDateISO: string;
  hijriDateText: string;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  timezone: string;
  fetchedAtISO: string;
};

function formatToAladhan(dateISO: string) {
  const [y, m, d] = String(dateISO).split('-');
  return `${d}-${m}-${y}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateISO = String(url.searchParams.get('date') || '').trim();
  const tz = String(url.searchParams.get('tz') || 'UTC').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }

  const key = `hijri:v1:${tz}:${dateISO}`;
  const cached = await getCachedJson<HijriPayload>(key);
  if (cached) return NextResponse.json(cached);

  const endpoint = new URL('https://api.aladhan.com/v1/gToH');
  endpoint.searchParams.set('date', formatToAladhan(dateISO));

  const res = await fetch(endpoint.toString(), { method: 'GET' });
  if (!res.ok) {
    return NextResponse.json({ error: 'hijri_api_failed' }, { status: 502 });
  }
  const data = (await res.json()) as any;
  const hijri = data?.data?.hijri;
  const gregorian = data?.data?.gregorian;
  const payload: HijriPayload = {
    gregorianDateISO: dateISO,
    hijriDateText: String(hijri?.date || hijri?.day || ''),
    hijriDay: Number(hijri?.day || 0) || 0,
    hijriMonth: Number(hijri?.month?.number || 0) || 0,
    hijriYear: Number(hijri?.year || 0) || 0,
    timezone: tz,
    fetchedAtISO: new Date().toISOString(),
  };
  if (gregorian?.date && typeof hijri?.date === 'string') {
    payload.hijriDateText = String(hijri.date);
  }
  await setCachedJson(key, payload, 24 * 60 * 60);
  return NextResponse.json(payload);
}

