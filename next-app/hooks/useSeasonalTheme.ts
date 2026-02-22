'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeasonalTheme } from '../lib/seasonal/config';
import { SEASONAL_THEMES } from '../lib/seasonal/config';

type SeasonalState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  theme: SeasonalTheme | null;
  hijriDateText?: string | null;
  error?: string | null;
};

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function dateISOInTZ(tz: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
}

export function useSeasonalTheme() {
  const tz = useMemo(() => getTimeZone(), []);
  const [state, setState] = useState<SeasonalState>({ status: 'idle', theme: SEASONAL_THEMES.default, error: null });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const run = async () => {
      const dateISO = dateISOInTZ(tz);
      setState((s) => ({ ...s, status: 'loading', error: null }));
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      try {
        const url = new URL('/api/seasonal', window.location.origin);
        url.searchParams.set('date', dateISO);
        url.searchParams.set('tz', tz);
        const res = await fetch(url.toString(), { signal: controller.signal });
        const payload = (await res.json()) as { theme?: SeasonalTheme; hijriDateText?: string };
        if (!res.ok || !payload?.theme) {
          throw new Error('seasonal_fetch_failed');
        }
        setState({ status: 'success', theme: payload.theme, hijriDateText: payload.hijriDateText || null, error: null });
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', theme: s.theme || SEASONAL_THEMES.default, error: 'Failed to load seasonal theme.' }));
      }
    };

    run();
    const tick = window.setInterval(run, 6 * 60 * 60 * 1000);
    return () => {
      window.clearInterval(tick);
      inFlight.current?.abort();
    };
  }, [tz]);

  return { tz, ...state };
}

