'use client';
import { useEffect } from 'react';
import useHUDStore from '@/hooks/useHUDStore';

export default function HUDToggle() {
  const { isHUDVisible, toggleHUD } = useHUDStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'h' &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA' &&
        !e.target.isContentEditable
      ) {
        toggleHUD();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  return (
    <button
      onClick={toggleHUD}
      className="fixed bottom-20 md:bottom-4 right-4 z-50 glass-subtle rounded-full p-3 transition-all duration-300 hover:scale-110 active:scale-95"
      aria-label={isHUDVisible ? 'Hide UI overlay' : 'Show UI overlay'}
      title={`${isHUDVisible ? 'Hide' : 'Show'} overlay (press 'h')`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/70"
      >
        {isHUDVisible ? (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ) : (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="m1 1 22 22" />
          </>
        )}
      </svg>
    </button>
  );
}
