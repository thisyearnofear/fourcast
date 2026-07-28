import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Diligence — Fourcast',
  description: BRAND.pages.positions,
  path: '/positions',
  ogType: 'route',
  ogName: 'diligence',
});

export default function PositionsLayout({ children }) {
  return children;
}
