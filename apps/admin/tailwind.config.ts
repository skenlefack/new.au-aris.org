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
        // Admin dark theme palette
        admin: {
          bg: '#0f1117',
          surface: '#1a1d27',
          card: '#1e2130',
          border: '#2a2d3a',
          hover: '#252838',
          muted: '#6b7280',
          text: '#e5e7eb',
          heading: '#f9fafb',
        },
        // ARIS brand colors
        primary: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50',
          600: '#43A047',
          700: '#388E3C',
          800: '#2E7D32',
          900: '#1B5E20',
        },
        secondary: {
          50: '#E0F2F1',
          200: '#80CBC4',
          500: '#009688',
          700: '#00796B',
          900: '#006064',
        },
        accent: {
          50: '#FFF3E0',
          200: '#FFCC80',
          500: '#FF9800',
          700: '#F57C00',
          900: '#E65100',
        },
        danger: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        // Status colors
        status: {
          healthy: '#22c55e',
          degraded: '#f59e0b',
          down: '#ef4444',
          unknown: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      fontSize: {
        kpi: ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'kpi-sm': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};

export default config;
