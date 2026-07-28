import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Signals — Fourcast',
  description: BRAND.pages.signals,
  path: '/signals',
});

export default function SignalsLayout({ children }) {
  return children;
}
