import './global.css/index.css';

// Force all pages to be dynamic to avoid SSR/static generation issues with wallet libraries
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export const metadata = {
  title: "Fourcast",
  description: "A decentralized weather application.",
  openGraph: {
    images: [`${process.env.NEXT_PUBLIC_HOST}/logo.png`],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}