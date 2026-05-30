import './global.css/index.css';
import { Providers } from './providers';
import Link from 'next/link';
import HUDToggle from '@/components/HUDToggle';
import LocationSettingsButton from '@/components/LocationSettingsButton';
import HUDFooterWrapper from '@/components/HUDFooterWrapper';
import { BRAND } from '@/constants/brand';

// Force all pages to be dynamic to avoid SSR/static generation issues with wallet libraries
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Metadata moved to generateMetadata to avoid build-time evaluation issues
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
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <HUDToggle />
          <LocationSettingsButton />
          <HUDFooterWrapper>
          {/* Global Footer */}
          <footer className="w-full border-t border-white/[0.04] bg-[#0a0a0f] py-6 px-5">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <Link href="/markets" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Markets</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/signals" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Signals</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/agent" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Agent</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/positions" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">Positions</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/labs" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors no-underline">🧪 Labs</Link>
                <span className="text-slate-700 text-[10px]">·</span>
                <Link href="/status" className="text-[12px] text-slate-400 hover:text-slate-200 transition-colors no-underline font-medium">🩺 Status</Link>
              </div>
              <div className="text-[11px] text-slate-600 font-light text-center sm:text-right">
                {BRAND.name} · {new Date().getFullYear()}
                <span className="hidden sm:inline text-slate-700"> · </span>
                <span className="block sm:inline text-slate-700 mt-0.5 sm:mt-0">{BRAND.footerStrip}</span>
              </div>
            </div>
          </footer>
          </HUDFooterWrapper>
        </Providers>
      </body>
    </html>
  );
}
