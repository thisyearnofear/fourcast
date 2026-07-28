import { BRAND } from '@/constants/brand';

/**
 * Build a per-route metadata object that inherits the root layout's
 * metadataBase and OG image, overriding only title/description.
 * Used by client-component routes that can't export `metadata` directly.
 */
export function routeMetadata({ title, description, path, ogType, ogName }) {
  const ogImage = ogType === 'route'
    ? `/api/og?type=route&name=${encodeURIComponent(ogName || 'markets')}`
    : ogType ??
      '/api/og?type=landing';
  const ogUrl = ogImage.startsWith('/') ? ogImage : `/api/og?type=${ogType}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: BRAND.name,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${title} — Fourcast` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}
