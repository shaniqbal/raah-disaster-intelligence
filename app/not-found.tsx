import Link from 'next/link';
import { LogoMark } from '@/components/shell/Logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-center">
      <div className="max-w-md space-y-4">
        <LogoMark className="mx-auto size-12" />
        <h1 className="text-2xl font-semibold text-ink">This route does not exist</h1>
        <p className="text-sm text-muted">The page you are looking for is not part of RAAH. Mission Control and the guided demo are always available.</p>
        <div className="flex justify-center gap-2">
          <Link href="/mission-control" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Mission Control</Link>
          <Link href="/demo" className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink">Judge Demo</Link>
        </div>
      </div>
    </main>
  );
}
