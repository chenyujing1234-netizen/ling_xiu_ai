import type { Config } from 'tailwindcss';

/** 主题 CSS 变量为 R G B 通道，才能用 bg-ink/35 这类透明度 */
const cv = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: cv('--tw-paper'),
        card: cv('--tw-card'),
        ink: cv('--tw-ink'),
        muted: cv('--tw-muted'),
        line: cv('--tw-line'),
        brand: {
          50: cv('--tw-brand-50'),
          100: cv('--tw-brand-100'),
          300: cv('--tw-brand-300'),
          500: cv('--tw-brand-500'),
          600: cv('--tw-brand-600'),
          700: cv('--tw-brand-700'),
        },
        accent: cv('--tw-accent'),
      },
      fontFamily: {
        serifcn: ['Songti SC', 'STSong', 'Source Han Serif SC', 'Noto Serif SC', 'serif'],
      },
      boxShadow: {
        sheet: 'var(--tw-shadow-sheet)',
        soft: 'var(--tw-shadow-soft)',
      },
    },
  },
  plugins: [],
} satisfies Config;
