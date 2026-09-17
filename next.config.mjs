/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 与 sharp 是原生模块，必须留给 Node 运行时自行 require；
  // ws 打进 bundle 后会被换成浏览器桩子，连不上也不报错，只能干等到超时
  serverExternalPackages: ['better-sqlite3', 'sharp', 'ws'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 允许被微信小程序 web-view 等容器嵌入
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
