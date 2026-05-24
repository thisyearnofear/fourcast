'use client';
import useHUDStore from '@/hooks/useHUDStore';

export default function HUDFooterWrapper({ children }) {
  const { isHUDVisible } = useHUDStore();
  return (
    <div className={`transition-opacity duration-500 ${isHUDVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {children}
    </div>
  );
}
