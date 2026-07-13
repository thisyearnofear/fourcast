'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';

/**
 * ThemeToggle — compact 3-state button for light/dark/auto theme.
 *
 * Renders as a small icon button that cycles: 🌙 dark → ☀️ light → 🔄 auto.
 * The current state is shown via the icon and a tooltip.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch — render a placeholder until mounted
  if (!mounted) {
    return (
      <button
        className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm ${className}`}
        aria-label="Toggle theme"
        disabled
      >
        🌙
      </button>
    );
  }

  const icons = { dark: '🌙', light: '☀️', auto: '🔄' };
  const labels = {
    dark: 'Dark mode (click for light)',
    light: 'Light mode (click for auto)',
    auto: 'Auto mode — follows time of day (click for dark)',
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all hover:scale-110 ${className}`}
      aria-label={labels[theme]}
      title={labels[theme]}
    >
      {icons[theme]}
    </button>
  );
}
