import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/components/shell/AppProviders';
import { ServiceWorkerRegistrar } from '@/components/shell/ServiceWorkerRegistrar';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://raah-disaster-intelligence.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'RAAH — AI Disaster Intelligence for Pakistan', template: '%s · RAAH' },
  description:
    'Explore disaster risk, simulate emergencies, plan evacuation and coordinate response across Pakistan. Explainable, offline-capable public demonstration.',
  applicationName: 'RAAH',
  keywords: ['Pakistan', 'disaster risk', 'flood', 'earthquake', 'evacuation', 'emergency response', 'digital twin', 'explainable AI'],
  authors: [{ name: 'Shan Iqbal' }],
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'RAAH — AI Disaster Intelligence',
    description: 'Predict. Prepare. Protect. Explainable risk, what-if simulation and response coordination for Pakistan.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'RAAH Mission Control' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: '#060b16',
  width: 'device-width',
  initialScale: 1,
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('raah:theme');if(t)document.documentElement.dataset.theme=JSON.parse(t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProviders>
          {children}
          <ServiceWorkerRegistrar />
        </AppProviders>
      </body>
    </html>
  );
}
