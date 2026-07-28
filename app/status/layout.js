import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Status — Fourcast',
  description: 'Live provider health, latency, and system status for Fourcast.',
  path: '/status',
});

export default function StatusLayout({ children }) {
  return children;
}
