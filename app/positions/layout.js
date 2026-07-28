import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Diligence — Fourcast',
  description: BRAND.pages.positions,
  path: '/positions',
});

export default function PositionsLayout({ children }) {
  return children;
}
