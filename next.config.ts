import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack 설정 (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      '@': './src',
    },
  },

  // React 19 호환성
  reactStrictMode: true,
};

export default nextConfig;
