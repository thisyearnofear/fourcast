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
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function WorldCupPage() {
  return <WorldCupClient />;
}
