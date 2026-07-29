import '../tokens.css';
import './global.css/index.css';
import { Providers } from './providers';
import Link from 'next/link';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import ConditionalChrome from '@/components/ConditionalChrome';
import { BRAND } from '@/constants/brand';

const display = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

const HOST = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

export const metadata = {
  metadataBase: new URL(HOST),
  title: BRAND.metadata.title,
  description: BRAND.metadata.description,
  openGraph: {
    title: BRAND.metadata.title,
    description: BRAND.metadata.description,
    type: 'website',
    siteName: BRAND.name,
    images: [
      {
        url: '/api/og?type=landing',
        width: 1200,
        height: 630,
        alt: 'Fourcast — verification and reputation for prediction-market agents',
      },
    ],
  },
  // No twitter.site/creator: no X account. Warpcast/Farcaster reads the
  // openGraph tags above directly, so the card still renders there.
  twitter: {
    card: 'summary_large_image',
    title: BRAND.metadata.title,
    description: BRAND.metadata.description,
    images: ['/api/og?type=landing'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: 'dark' }}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body suppressHydrationWarning className="font-sans antialiased">
        <Providers>
          {children}
          <ConditionalChrome />
          <footer className="platform-footer w-full px-5 py-8">
            <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <Link href="/agent" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">{BRAND.navLabels.agent ?? 'Mandate'}</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/world-cup" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">{BRAND.navLabels.worldCup ?? 'Proof Theatre'}</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/positions" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">{BRAND.navLabels.positions ?? 'Diligence'}</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/markets" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">Markets</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/signals" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">Signals</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/labs" className="text-[12px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] transition-colors no-underline">Labs</Link>
                <span className="text-[var(--color-rule-strong)] text-[10px]">·</span>
                <Link href="/status" className="text-[12px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors no-underline font-medium">Status</Link>
              </div>
              <div className="text-left text-[11px] font-light text-[var(--color-ink-faint)] sm:text-right">
                {BRAND.name} · {new Date().getFullYear()}
                <span className="hidden sm:inline text-[var(--color-rule-strong)]"> · </span>
                <span className="block sm:inline text-[var(--color-rule-strong)] mt-0.5 sm:mt-0">{BRAND.footerStrip}</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
