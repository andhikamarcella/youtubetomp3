import figlet from 'figlet';

const BRAND = 'YTCONV';
const PREFERRED_FONTS = ['ANSI Shadow', 'Slant', 'Standard'];

export function renderBrand({ compact = false, tiny = false, width = 80 } = {}) {
  if (tiny) return BRAND;
  if (compact) return `${BRAND} · social media downloader`;

  for (const font of PREFERRED_FONTS) {
    try {
      return figlet.textSync(BRAND, {
        font,
        horizontalLayout: 'fitted',
        verticalLayout: 'fitted',
        width: Math.max(40, Number(width) || 80),
        whitespaceBreak: true,
      }).trimEnd();
    } catch {
      // Try the next bundled font. The plain brand is the final fallback.
    }
  }

  return BRAND;
}
