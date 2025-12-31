import './global.css/index.css';
import { Providers } from './providers';

// Force all pages to be dynamic to avoid SSR/static generation issues with wallet libraries
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Metadata moved to generateMetadata to avoid build-time evaluation issues
export async function generateMetadata() {
  return {
    title: "Fourcast",
    description: "A decentralized weather application.",
    openGraph: {
      images: [`${process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app'}/logo.png`],
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}