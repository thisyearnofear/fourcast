import { BRAND } from '@/constants/brand';
import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Labs — Fourcast',
  description: BRAND.pages.labs,
  path: '/labs',
});

export default function LabsLayout({ children }) {
  return children;
}
