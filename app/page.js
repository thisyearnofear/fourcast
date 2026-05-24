'use client';

import dynamic from 'next/dynamic';

const _SearchLanding = dynamic(() => import('@/components/SearchLanding'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 28, height: 28, border: '2px solid rgba(168,85,247,0.2)',
        borderTopColor: 'rgba(168,85,247,0.8)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
    </div>
  ),
});

export default function HomePage() {
  return <SearchLanding />;
}
