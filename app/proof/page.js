import { routeMetadata } from '@/lib/routeMetadata';
import ProofTheatreShell from './ProofTheatreShell';

export const metadata = routeMetadata({
  title: 'Proof Theatre · Fourcast',
  description:
    'One audit trail across chains — Solana-anchored decision receipts and Canton atomic settlement, auditable side by side. The chain is a badge on each proof, not a section.',
  path: '/proof',
  ogType: 'route',
  ogName: 'proof',
});

export default function ProofPage() {
  return <ProofTheatreShell />;
}
