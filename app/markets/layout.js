import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Markets — Fourcast',
  description: BRAND.pages.markets,
  path: '/markets',
});

export default function MarketsLayout({ children }) {
  return children;
}
