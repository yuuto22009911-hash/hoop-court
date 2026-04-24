/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages (edge runtime) での動作を想定
  // 画像最適化は Cloudflare Images 連携が必要になるため無効化しておく
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'async_hooks'];
    }
    return config;
  },
};

export default nextConfig;
