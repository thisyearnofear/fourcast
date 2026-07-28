import { BRAND } from '@/constants/brand';

/**
 * Build a per-route metadata object that inherits the root layout's
 * metadataBase and OG image, overriding only title/description.
 * Used by client-component routes that can't export `metadata` directly.
 */
export function routeMetadata({ title, description, path }) {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: path,
      siteName: BRAND.name,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
