import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse를 번들링하지 않고 런타임에서 require (Vercel 서버리스 호환)
  serverExternalPackages: ['pdf-parse'],

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
