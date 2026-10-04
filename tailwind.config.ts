import type { Config } from 'tailwindcss';

/** Every value maps to a token in src/design/tokens.css. Defaults are replaced, not extended. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const px = (n: number) => `${n}px`;
/** Strict 4px grid: key n → n × 4px. */
const grid = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((n) => [n, px(n * 4)]),
);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    screens: { sm: '640px', md: '900px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: token('bg'),
      surface: token('surface'),
      'surface-2': token('surface-2'),
      'surface-3': token('surface-3'),
      line: token('line'),
      'line-strong': token('line-strong'),
      ink: token('ink'),
      'ink-2': token('ink-2'),
      'ink-3': token('ink-3'),
      danger: token('danger'),
      'danger-soft': token('danger-soft'),
      scrim: token('scrim'),
      accent: token('accent'),
      'accent-fg': token('accent-fg'),
      'accent-soft': token('accent-soft'),
      'subj-bg': token('subj-bg'),
      'subj-fg': token('subj-fg'),
      'subj-dot': token('subj-dot'),
      bar: token('blur-bar'),
    },
    spacing: { px: '1px', ...grid },
    fontFamily: { sans: 'var(--font-sans)' },
    fontSize: {
      caption: ['12px', { lineHeight: '16px' }],
      small: ['14px', { lineHeight: '20px' }],
      body: ['16px', { lineHeight: '24px' }],
      lead: ['18px', { lineHeight: '24px' }],
      title: ['22px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
      large: ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
      display: ['34px', { lineHeight: '40px', letterSpacing: '-0.025em' }],
    },
    fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
    letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.04em' },
    lineHeight: { none: '1', 4: '16px', 5: '20px', 6: '24px' },
    borderRadius: {
      none: '0',
      xs: px(4),
      sm: px(8),
      md: px(12),
      lg: px(16),
      xl: px(20),
      '2xl': px(24),
      '3xl': px(28),
      full: '9999px',
    },
    borderWidth: { DEFAULT: '1px', 0: '0', 2: '2px' },
    boxShadow: {
      none: 'none',
      card: 'var(--shadow-card)',
      sheet: 'var(--shadow-sheet)',
      fab: 'var(--shadow-fab)',
      thumb: 'var(--shadow-thumb)',
    },
    zIndex: { 0: '0', base: '1', bar: '20', fab: '30', sheet: '40', toast: '50' },
    opacity: { 0: '0', 40: '0.4', 50: '0.5', 60: '0.6', 80: '0.8', 100: '1' },
    transitionDuration: { fast: 'var(--duration-fast)', DEFAULT: 'var(--duration-base)' },
    transitionTimingFunction: { DEFAULT: 'var(--ease-out)', out: 'var(--ease-out)' },
    extend: {
      maxWidth: { content: 'var(--content-max)', wide: '960px' },
      maxHeight: { sheet: '90dvh' },
      minHeight: { screen: '100dvh' },
      gridTemplateColumns: {
        'week-1': '40px repeat(1, minmax(0, 1fr))',
        'week-2': '40px repeat(2, minmax(0, 1fr))',
        'week-3': '40px repeat(3, minmax(0, 1fr))',
        'week-4': '40px repeat(4, minmax(0, 1fr))',
        'week-5': '40px repeat(5, minmax(0, 1fr))',
        'week-6': '40px repeat(6, minmax(0, 1fr))',
        'week-7': '40px repeat(7, minmax(0, 1fr))',
        lesson: '48px 4px minmax(0, 1fr) auto',
      },
      backdropBlur: { bar: '20px' },
    },
  },
  plugins: [],
} satisfies Config;
