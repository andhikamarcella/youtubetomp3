import { SEASONAL_THEMES, type SeasonalTheme, type SeasonalThemeId } from './config';

export type SeasonalInput = {
  dateISO: string;
  hijriMonth?: number | null;
};

export function selectSeasonalTheme(input: SeasonalInput): SeasonalTheme {
  const d = safeParseISODate(input.dateISO) || new Date();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hijriMonth = typeof input.hijriMonth === 'number' ? input.hijriMonth : null;

  const dateISO = toISODateUTC(d);

  const id: SeasonalThemeId =
    isWithinISODateRange(dateISO, '2026-02-19', '2026-03-20') || hijriMonth === 9
      ? 'ramadhan'
      : month === 8
        ? 'independence'
        : month === 12
          ? 'christmas'
          : month === 1 && day >= 1 && day <= 7
            ? 'newyear'
            : 'default';

  return SEASONAL_THEMES[id];
}

function safeParseISODate(dateISO: string) {
  const s = String(dateISO || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWithinISODateRange(dateISO: string, startISO: string, endISO: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  return dateISO >= startISO && dateISO <= endISO;
}

