import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '灵修AI · 读经不止于读过',
  description: '带约束的引导式圣经读经灵修工具',
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
    <html lang="zh-CN">
      <body>
        <div className="mx-auto min-h-screen max-w-lg bg-paper">{children}</div>
      </body>
    </html>
  );
}
