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

  const id: SeasonalThemeId =
    hijriMonth === 9
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

