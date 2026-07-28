import { routeMetadata } from '@/lib/routeMetadata';

export const metadata = routeMetadata({
  title: 'Private Markets — Fourcast',
  description:
    'Canton private settlement — hidden-size positions via Daml smart contracts with sub-cent gas.',
  path: '/canton',
  ogType: 'route',
  ogName: 'canton',
});

export default function CantonLayout({ children }) {
  return children;
}
