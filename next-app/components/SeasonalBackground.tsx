'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSeasonalTheme } from '../hooks/useSeasonalTheme';
import type { SeasonalTheme } from '../lib/seasonal/config';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function toVars(theme: SeasonalTheme) {
  return {
    ['--sb-from' as any]: theme.gradient.from,
    ['--sb-to' as any]: theme.gradient.to,
    ['--sb-accent' as any]: theme.accent,
  } as CSSProperties;
}

export default function SeasonalBackground() {
  const { theme, hijriDateText } = useSeasonalTheme();
  const [prev, setPrev] = useState<SeasonalTheme | null>(null);
  const [active, setActive] = useState<SeasonalTheme | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (!theme) return;
    setPrev(active);
    setActive(theme);
    const t = window.setTimeout(() => setPrev(null), 650);
    return () => window.clearTimeout(t);
  }, [theme]);

  const badgeText = useMemo(() => active?.badge || '✨ Seasonal Engine', [active]);
  const hijriText = useMemo(() => hijriDateText || '', [hijriDateText]);

  return (
    <div className="seasonal-root" aria-hidden="true">
      {prev && (
        <div className="seasonal-layer seasonal-layer-exit" data-theme={prev.id} style={toVars(prev)}>
          <SeasonalEffects theme={prev} reduced={reduced} />
        </div>
      )}
      {active && (
        <div className="seasonal-layer seasonal-layer-enter" data-theme={active.id} style={toVars(active)}>
          <SeasonalEffects theme={active} reduced={reduced} />
        </div>
      )}
      <div className="seasonal-badge">
        <span className="badge-chip" style={{ borderColor: 'rgba(255,255,255,0.16)' }}>
          <span>{badgeText}</span>
          {hijriText ? <span style={{ opacity: 0.75 }}>• {hijriText}</span> : null}
        </span>
      </div>
    </div>
  );
}

function SeasonalEffects({ theme, reduced }: { theme: SeasonalTheme; reduced: boolean }) {
  if (reduced) return null;
  if (theme.effect === 'stars') {
    return (
      <>
        <div className="seasonal-stars" />
        <div className="seasonal-moon" />
        <div className="seasonal-pulse" />
      </>
    );
  }
  if (theme.effect === 'confetti') {
    return <div className="seasonal-confetti" />;
  }
  if (theme.effect === 'snow') {
    return <div className="seasonal-snow" />;
  }
  if (theme.effect === 'fireworks') {
    return <div className="seasonal-fireworks" />;
  }
  return <div className="seasonal-modern" />;
}

