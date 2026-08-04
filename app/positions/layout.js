import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Positions — Fourcast',
  description: BRAND.pages.positions,
  path: '/positions',
  ogType: 'route',
  ogName: 'positions',
});

export default function PositionsLayout({ children }) {
  return children;
}
