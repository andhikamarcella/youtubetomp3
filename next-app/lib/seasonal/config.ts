export type SeasonalThemeId = 'ramadhan' | 'independence' | 'christmas' | 'newyear' | 'default';

export type SeasonalTheme = {
  id: SeasonalThemeId;
  label: string;
  badge: string;
  gradient: { from: string; to: string };
  accent: string;
  effect: 'stars' | 'confetti' | 'snow' | 'fireworks' | 'modern';
};

export const SEASONAL_THEMES: Record<SeasonalThemeId, SeasonalTheme> = {
  ramadhan: {
    id: 'ramadhan',
    label: 'Ramadhan',
    badge: '🟩 Ketupat Ramadhan Mode',
    gradient: { from: '#064e2a', to: '#02170d' },
    accent: '#22c55e',
    effect: 'stars',
  },
  independence: {
    id: 'independence',
    label: 'Independence',
    badge: '🇮🇩 Independence Mode',
    gradient: { from: '#b0121a', to: '#ffffff' },
    accent: '#ef4444',
    effect: 'confetti',
  },
  christmas: {
    id: 'christmas',
    label: 'Christmas',
    badge: '🎄 Christmas Mode',
    gradient: { from: '#0b2b18', to: '#5f1010' },
    accent: '#22c55e',
    effect: 'snow',
  },
  newyear: {
    id: 'newyear',
    label: 'New Year',
    badge: '🎆 New Year Mode',
    gradient: { from: '#0b1026', to: '#3b1b68' },
    accent: '#a78bfa',
    effect: 'fireworks',
  },
  default: {
    id: 'default',
    label: 'Default',
    badge: '✨ Seasonal Engine',
    gradient: { from: '#0b0d13', to: '#1a1f2b' },
    accent: '#7c3aed',
    effect: 'modern',
  },
};

