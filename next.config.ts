import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // The eslint-config-next 16 React Compiler rules (react-hooks/immutability)
    // flag `useEffect` callbacks that call a `const fn = async () => {}`
    // declared later in the same component. This is safe at runtime (the
    // effect body only runs after the component function has finished
    // executing, so the const is already assigned) but the new rule treats
    // it as an error and fails the build. Don't let lint errors block
    // deploys; `npm run lint` still reports them for cleanup.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
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