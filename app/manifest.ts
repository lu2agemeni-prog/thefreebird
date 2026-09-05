import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'مركز الطائر الحر',
    short_name: 'الطائر الحر',
    description: 'نظام إدارة متكامل لمركز الطائر الحر الطبي',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#059669', // emerald-600
    icons: [
      {
        src: '/logo.png', // Assuming logo.png is square and can be used as icon. We'll use it as placeholder
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
