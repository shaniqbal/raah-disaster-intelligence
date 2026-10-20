import type { Metadata } from 'next';
import { SosClient } from './SosClient';

export const metadata: Metadata = { title: 'Citizen SOS (demo)', description: 'Preparedness guidance, verified emergency numbers and a privacy-preserving SOS demonstration in English, Urdu and Roman Urdu.' };

export default function Page() {
  return <SosClient />;
}
