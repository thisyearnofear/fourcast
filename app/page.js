'use client';

import dynamic from 'next/dynamic';

const CarouselLanding = dynamic(() => import('@/components/CarouselLanding'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0a0f',
      display: 'grid', placeItems: 'center',
      zIndex: 100,
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: 'rgba(168,85,247,0.8)',
        animation: 'carousel-spin 1s linear infinite',
      }} />
      <style>{`@keyframes carousel-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function HomePage() {
  return <CarouselLanding />;
}
