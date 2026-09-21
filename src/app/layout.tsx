import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import { UI_BOOT_SCRIPT } from '@/lib/themes';

export const metadata: Metadata = {
  title: '晨光 · 一天里最安静的那段时间',
  description: '每天安静阅读与记录的小工具',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#fbf8f1',
  viewportFit: 'cover', // 配合 safe-area，适配全面屏与小程序 web-view
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: UI_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider />
        <div className="mx-auto min-h-screen max-w-lg bg-paper">{children}</div>
      </body>
    </html>
  );
}
