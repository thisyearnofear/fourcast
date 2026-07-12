'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * useTheme — manages light/dark/auto theme with localStorage persistence.
 *
 * - 'auto': uses time-of-day (6:00–18:00 = light, otherwise dark)
 * - 'dark': always dark
 * - 'light': always light
 *
 * The preference is stored in localStorage under 'fourcast_theme'.
 * On first visit (no stored preference), defaults to 'auto'.
 *
 * @returns {{
 *   theme: 'light' | 'dark' | 'auto',
 *   isNight: boolean,
 *   setTheme: (t: 'light' | 'dark' | 'auto') => void,
 *   toggle: () => void,
 * }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState('auto');
  const [isNight, setIsNight] = useState(true);

  // Load saved preference on mount + listen for cross-instance changes
  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? localStorage.getItem('fourcast_theme')
      : null;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      setThemeState(saved);
    }

    // Sync across useTheme instances in the same tab (e.g. ThemeToggle → useWeather)
    function handleThemeChange(e) {
      const next = e.detail || (typeof window !== 'undefined'
        ? localStorage.getItem('fourcast_theme')
        : null);
      if (next === 'light' || next === 'dark' || next === 'auto') {
        setThemeState(next);
      }
    }
    window.addEventListener('fourcast-theme-change', handleThemeChange);
    return () => window.removeEventListener('fourcast-theme-change', handleThemeChange);
  }, []);

  // Compute isNight whenever theme changes or time advances
  useEffect(() => {
    function computeNight() {
      if (theme === 'dark') return true;
      if (theme === 'light') return false;
      // auto: use time-of-day
      const hour = new Date().getHours();
      return hour < 6 || hour >= 18;
    }

    setIsNight(computeNight());

    // Re-check every 5 minutes in case the user leaves the tab open
    // across a 6am/6pm boundary
    const interval = setInterval(() => {
      if (theme === 'auto') {
        setIsNight(computeNight());
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fourcast_theme', next);
      // Notify other useTheme instances in the same tab
      window.dispatchEvent(new CustomEvent('fourcast-theme-change', { detail: next }));
    }
  }, []);

  // Quick toggle: dark → light → auto → dark
  const toggle = useCallback(() => {
    setThemeState(prev => {
      const order = ['dark', 'light', 'auto'];
      const idx = order.indexOf(prev);
      const next = order[(idx + 1) % order.length];
      if (typeof window !== 'undefined') {
        localStorage.setItem('fourcast_theme', next);
        // Notify other useTheme instances in the same tab
        window.dispatchEvent(new CustomEvent('fourcast-theme-change', { detail: next }));
      }
      return next;
    });
  }, []);

  return { theme, isNight, setTheme, toggle };
}
