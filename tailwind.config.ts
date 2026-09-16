import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 羊皮纸 + 墨色，长时间阅读不刺眼
        paper: '#fbf8f1',
        card: '#ffffff',
        ink: '#2c2620',
        muted: '#8a8078',
        line: '#e8e0d4',
        brand: {
          50: '#f5f2ea',
          100: '#e6dfcd',
          300: '#c2ab7f',
          500: '#8a6d3b',
          600: '#755c31',
          700: '#5c4826',
        },
        accent: '#9c5b3f',
      },
      fontFamily: {
        serifcn: ['Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif SC', 'serif'],
      },
      boxShadow: {
        sheet: '0 -8px 32px rgba(44, 38, 32, 0.16)',
        soft: '0 1px 3px rgba(44, 38, 32, 0.06), 0 8px 24px rgba(44, 38, 32, 0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
