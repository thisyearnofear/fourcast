import './global.css/index.css';
import { Providers } from './providers';
import Link from 'next/link';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import ConditionalChrome from '@/components/ConditionalChrome';
import WaveGridBackground from '@/components/WaveGridBackground';
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

export async function generateMetadata() {
  const host = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';
  const landingOgImage = `${host}/api/og?type=landing`;

  return {
    title: BRAND.metadata.title,
    description: BRAND.metadata.description,
    openGraph: {
      title: BRAND.metadata.title,
      description: BRAND.metadata.description,
      type: 'website',
      images: [
        {
          url: landingOgImage,
          width: 1200,
          height: 630,
          alt: 'Fourcast edge scanner preview',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: BRAND.metadata.title,
      description: BRAND.metadata.description,
      images: [landingOgImage],
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: 'dark' }}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body suppressHydrationWarning className="font-sans antialiased">
        <WaveGridBackground />
        <Providers>
          {children}
          <ConditionalChrome />
          <footer className="w-full border-t border-white/[0.04] py-6 px-5">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <Link href="/markets" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Markets</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/world-cup" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">World Cup</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/signals" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Signals</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/agent" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Agent</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/positions" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Positions</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/labs" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Labs</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/status" className="text-[12px] text-slate-400 hover:text-slate-200 transition-colors no-underline font-medium">Status</Link>
              </div>
              <div className="text-[11px] text-slate-600 font-light text-center sm:text-right">
                {BRAND.name} · {new Date().getFullYear()}
                <span className="hidden sm:inline text-slate-700"> · </span>
                <span className="block sm:inline text-slate-700 mt-0.5 sm:mt-0">{BRAND.footerStrip}</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
