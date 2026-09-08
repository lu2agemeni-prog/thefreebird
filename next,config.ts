import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // أفاتار Google (تسجيل الدخول بـ Google) — كانت مفقودة مما يكسر <Image> مع أفاتار المستخدمين
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      // مصادر أخرى لصور الأخبار/المقالات
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // `output: 'standalone'` is only for self-hosting (Docker/VPS). On Vercel it
  // breaks the build on Next.js 16.3.x (Turbopack + adapter suppresses
  // .next/next-server.js.nft.json while copyTracedFiles still reads it —
  // see https://github.com/vercel/next.js/issues/96646). Fixed in canary via
  // PR #97287 (ships in 16.4+); until then, disable it when building on Vercel.
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['motion'],
  turbopack: {},
};

export default nextConfig;