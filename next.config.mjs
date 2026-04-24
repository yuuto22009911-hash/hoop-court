/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages (edge runtime) での動作を想定
  // 画像最適化は Cloudflare Images 連携が必要になるため無効化しておく
  images: { unoptimized: true }
};

export default nextConfig;
