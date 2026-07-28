import WorldCupClient from './WorldCupClient';

const TITLE = 'Proof Theatre · Fourcast';
const DESCRIPTION =
  'Archived World Cup 2026 fixture set: sealed decision receipts, TxLINE-Merkle proofs, and on-chain settlement — all auditable on Solana.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/world-cup',
    siteName: 'Fourcast',
    images: [{ url: '/api/og?type=route&name=proof', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/api/og?type=route&name=proof'],
  },
};

export default function WorldCupPage() {
  return <WorldCupClient />;
}
