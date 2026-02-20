import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
            DEFAULT: '#E65100',
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
        'kpi': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'kpi-label': ['0.75rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      spacing: {
        'card': '1.5rem',
        'section': '2rem',
      },
      borderRadius: {
        'card': '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
