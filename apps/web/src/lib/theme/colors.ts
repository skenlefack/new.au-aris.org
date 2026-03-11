// ─── Dynamic Entity Theme — Color Utilities ────────────────────────────────
// Provides color manipulation, contrast calculation, and CSS variable management
// for ARIS 4.0's dynamic entity-based theming (AU-IBAR, RECs, Countries).

export interface EntityThemeColors {
  accent: string;
  secondary: string;
}

/* ── Color manipulation helpers ────────────────────────────────────────────── */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns white or dark text color based on background luminance */
export function getContrastColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return luminance(r, g, b) > 0.179 ? '#1a1a2e' : '#ffffff';
}

/** Darken a hex color by percentage (0-100) */
export function darken(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(
    Math.round(r * factor),
    Math.round(g * factor),
    Math.round(b * factor),
  );
}

/** Lighten a hex color by percentage (0-100) */
export function lighten(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex(
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  );
}

/* ── Entity color definitions ──────────────────────────────────────────────── */

export const ENTITY_COLORS: Record<string, EntityThemeColors> = {
  // Continental
  'AU-IBAR': { accent: '#006B3F', secondary: '#D4A843' },
  AU: { accent: '#006B3F', secondary: '#D4A843' },
  // RECs
  ECOWAS: { accent: '#003399', secondary: '#6B8CC7' },
  CEDEAO: { accent: '#003399', secondary: '#6B8CC7' },
  ECCAS: { accent: '#8B0000', secondary: '#C44D4D' },
  CEEAC: { accent: '#8B0000', secondary: '#C44D4D' },
  EAC: { accent: '#006B3F', secondary: '#4DA67A' },
  CAE: { accent: '#006B3F', secondary: '#4DA67A' },
  SADC: { accent: '#00308F', secondary: '#4D6DB8' },
  IGAD: { accent: '#FF8C00', secondary: '#FFB84D' },
  UMA: { accent: '#4B0082', secondary: '#8B4DBA' },
  'CEN-SAD': { accent: '#DAA520', secondary: '#E8C86B' },
  CENSAD: { accent: '#DAA520', secondary: '#E8C86B' },
  COMESA: { accent: '#228B22', secondary: '#5DB85D' },
};

const DEFAULT_COLORS: EntityThemeColors = { accent: '#006B3F', secondary: '#D4A843' };

/** Resolve entity colors by code or name */
export function getEntityColor(codeOrName: string): EntityThemeColors {
  const key = codeOrName.toUpperCase().trim();
  return ENTITY_COLORS[key] ?? DEFAULT_COLORS;
}

/* ── CSS Custom Properties ─────────────────────────────────────────────────── */

/** Apply entity accent theme to :root via CSS custom properties */
export function applyEntityTheme(accentColor: string, secondaryColor?: string) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const secondary = secondaryColor ?? lighten(accentColor, 30);
  const { r, g, b } = hexToRgb(accentColor);

  root.style.setProperty('--color-accent', accentColor);
  root.style.setProperty('--color-accent-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--color-accent-light', accentColor + '15');
  root.style.setProperty('--color-accent-lighter', accentColor + '08');
  root.style.setProperty('--color-accent-hover', darken(accentColor, 12));
  root.style.setProperty('--color-accent-active', darken(accentColor, 20));
  root.style.setProperty('--color-accent-text', getContrastColor(accentColor));
  root.style.setProperty('--color-secondary', secondary);
  root.style.setProperty('--color-secondary-light', secondary + '20');
}
