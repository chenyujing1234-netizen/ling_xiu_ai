/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp 是原生模块，必须留给 Node 运行时自行 require；
  // ws 打进 bundle 后会被换成浏览器桩子，连不上也不报错，只能干等到超时。
  // better-sqlite3 现在只有迁移脚本在用，应用代码已经换成 mysql2，
  // 留在这里是防它哪天又被引进来时炸在构建期
  serverExternalPackages: ['better-sqlite3', 'sharp', 'ws', 'nodemailer'],
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
