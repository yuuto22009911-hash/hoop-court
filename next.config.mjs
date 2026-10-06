/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages (edge runtime) での動作を想定
  // 画像最適化は Cloudflare Images 連携が必要になるため無効化しておく
  images: { unoptimized: true },
  // 旧管理画面（/admin）は廃止。管理画面は himawari-site に一本化済み（2026-10）。
  // 古いブックマークから来た運営者を正しい管理画面へ送る。
  async redirects() {
    return [
      {
        source: '/admin/:path*',
        destination: 'https://himawari-co.pages.dev/admin',
        permanent: false,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'async_hooks'];
    }
    return config;
  },
};

export default nextConfig;
