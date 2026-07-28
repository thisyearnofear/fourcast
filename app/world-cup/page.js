import WorldCupClient from './WorldCupClient';

export const metadata = {
  title: 'World Cup · Fourcast',
  description:
    'TxLINE-powered World Cup intelligence terminal: live consensus odds, score replay, and Solana-verified match receipts.',
  openGraph: {
    title: 'World Cup · Fourcast',
    description:
      'TxLINE-powered World Cup intelligence terminal: live consensus odds, score replay, and Solana-verified match receipts.',
    url: '/world-cup',
    siteName: 'Fourcast',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'World Cup · Fourcast',
    description:
      'TxLINE-powered World Cup intelligence terminal: live consensus odds, score replay, and Solana-verified match receipts.',
  },
};

export default function WorldCupPage() {
  return <WorldCupClient />;
}
