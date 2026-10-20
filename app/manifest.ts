import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RAAH — AI Disaster Intelligence',
    short_name: 'RAAH',
    description: 'Explainable disaster risk, simulation and response coordination for Pakistan (public demonstration).',
    start_url: '/mission-control',
    display: 'standalone',
    background_color: '#060b16',
    theme_color: '#060b16',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
