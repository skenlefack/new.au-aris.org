import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui-components/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Dynamic accent via CSS custom properties ──────────────── */
        accent: {
          DEFAULT: 'var(--color-accent, #006B3F)',
          light: 'var(--color-accent-light, rgba(0,107,63,0.08))',
          lighter: 'var(--color-accent-lighter, rgba(0,107,63,0.04))',
          hover: 'var(--color-accent-hover, #005A35)',
          active: 'var(--color-accent-active, #004D2D)',
          text: 'var(--color-accent-text, #ffffff)',
        },
        'entity-secondary': {
          DEFAULT: 'var(--color-secondary, #D4A843)',
          light: 'var(--color-secondary-light, rgba(212,168,67,0.12))',
        },
        /* ── ARIS brand (static) ──────────────────────────────────── */
        aris: {
          primary: {
            50: '#E8F5E9',
            100: '#C8E6C9',
            200: '#A5D6A7',
            300: '#81C784',
            400: '#66BB6A',
            500: '#2E7D32',
            600: '#1B5E20',
            700: '#155A1A',
            800: '#104D14',
            900: '#0A3D0E',
            950: '#062D08',
            DEFAULT: '#1B5E20',
          },
          secondary: {
            50: '#E0F7FA',
            100: '#B2EBF2',
            200: '#80DEEA',
            300: '#4DD0E1',
            400: '#26C6DA',
            500: '#00838F',
            600: '#006064',
            700: '#00545A',
            800: '#004850',
            900: '#003C44',
            950: '#002830',
            DEFAULT: '#006064',
          },
          accent: {
            50: '#FBE9E7',
            100: '#FFCCBC',
            200: '#FFAB91',
            300: '#FF8A65',
            400: '#FF7043',
            500: '#F4511E',
            600: '#E65100',
            700: '#D84315',
            800: '#BF360C',
            900: '#A62C00',
            950: '#7A1F00',
            DEFAULT: '#E65100',
          },
          gold: {
            50: '#FFF8E1',
            100: '#FFECB3',
            200: '#FFE082',
            300: '#FFD54F',
            400: '#FFCA28',
            500: '#D4A843',
            600: '#B8922E',
            700: '#9A7B22',
            800: '#7C6418',
            900: '#5E4D10',
            DEFAULT: '#D4A843',
          },
        },
        quality: {
          pass: '#2E7D32',
          warning: '#F57F17',
          fail: '#C62828',
          skipped: '#9E9E9E',
        },
        workflow: {
          draft: '#9E9E9E',
          submitted: '#1565C0',
          pending: '#F57F17',
          approved: '#2E7D32',
          rejected: '#C62828',
          escalated: '#6A1B9A',
          wahis: '#00838F',
          analytics: '#1B5E20',
          published: '#2E7D32',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        kpi: ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'kpi-label': [
          '0.75rem',
          { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.05em' },
        ],
      },
      spacing: {
        card: '1.5rem',
        section: '2rem',
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        'accent-sm': '0 1px 3px 0 rgba(var(--color-accent-rgb, 0,107,63), 0.12)',
        'accent-md': '0 4px 12px 0 rgba(var(--color-accent-rgb, 0,107,63), 0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'count-bump': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out forwards',
        'fade-in-up': 'fade-in-up 400ms ease-out forwards',
        'scale-in': 'scale-in 150ms ease-out forwards',
        'slide-in-right': 'slide-in-right 200ms ease-out forwards',
        'count-bump': 'count-bump 300ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
