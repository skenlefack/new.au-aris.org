import type { MetadataRoute } from 'next';

const isStaging = (process.env.NEXT_PUBLIC_API_URL ?? '').includes('test.');

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: isStaging
      ? 'ARIS 4.0 [STAGING] — Animal Resources Information System'
      : 'ARIS 4.0 — Animal Resources Information System',
    short_name: isStaging ? 'ARIS STG' : 'ARIS',
    description: isStaging
      ? 'STAGING — AU-IBAR Continental Digital Infrastructure for Animal Resources'
      : 'AU-IBAR Continental Digital Infrastructure for Animal Resources',
    id: isStaging ? '/staging' : '/',
    start_url: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: isStaging ? '#FFF8E1' : '#F9FAFB',
    theme_color: isStaging ? '#E65100' : '#1B5E20',
    orientation: 'any',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['government', 'productivity', 'utilities'],
  };
}
