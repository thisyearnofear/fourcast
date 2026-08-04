import { routeMetadata } from '@/lib/routeMetadata';
import ProofTheatreShell from './ProofTheatreShell';

export const metadata = routeMetadata({
  title: 'Private · Fourcast',
  description:
    'Stake and side hidden. Same ledger, two views — Canton privacy check and CBTC settlement receipts.',
  path: '/proof',
  ogType: 'route',
  ogName: 'proof',
});

export default function ProofPage() {
  return <ProofTheatreShell />;
}
