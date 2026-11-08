'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

const subscribeToNothing = () => () => {};
const hydrated = () => true;
const notHydrated = () => false;

const FOCUSABLE =
  '[role="menuitem"], [role="menuitemradio"], a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * useAnchoredMenu — shared open/position/dismiss logic for portaled menus
 * (nav More menu, mobile hamburger, audience switcher, wallet panel,
 * share menu, info tips, system health).
 *
 * Menus are portal-mounted to document.body so they escape sticky-header
 * stacking contexts and overflow clipping; this hook measures the anchor
 * (rootRef), repositions on scroll/resize, and closes on outside click,
 * Escape, or navigation. Attach menuRef to the portaled panel so clicks
 * inside it don't count as "outside".
 *
 * `mounted` is a hydration-safe flag (false during SSR + first client
 * render, true after) — suitable for gating portals and SSR skeletons.
 *
 * Options:
 *  - arrowNav: enable WAI menu keyboard behaviour — first item focused on
 *    open, ArrowUp/ArrowDown/Home/End cycle items, Escape returns focus to
 *    the trigger. Use for role="menu" panels, not dialogs/tooltips.
 *
 * coords returns { top, right, center } — right-anchored panels use
 * top/right as today; center-anchored panels (e.g. tips) subtract half
 * their own width from `center`.
 */
export default function useAnchoredMenu({ arrowNav = false } = {}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const pathname = usePathname();

  const mounted = useSyncExternalStore(subscribeToNothing, hydrated, notHydrated);

  // Close on navigation — adjusting derived state during render is the
  // React-blessed alternative to a pathname-change effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  const placeMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: Math.round(r.bottom + 6),
      right: Math.round(Math.max(8, window.innerWidth - r.right)),
      center: Math.round(r.left + r.width / 2),
    });
  }, []);

  const menuItems = useCallback(() => {
    return menuRef.current ? Array.from(menuRef.current.querySelectorAll(FOCUSABLE)) : [];
  }, []);

  const focusTrigger = useCallback(() => {
    rootRef.current?.querySelector('button, a')?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, placeMenu]);

  // Move focus to the first item once the menu is open and positioned.
  // Runs in an effect (not during the layout placement) so the portaled
  // panel is in the DOM by the time we look for items.
  useEffect(() => {
    if (!open || !arrowNav) return;
    const raf = requestAnimationFrame(() => menuItems()[0]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, arrowNav, menuItems]);

  useEffect(() => {
    if (!open) return undefined;
    // Use click (not mousedown): mousedown-outside closes + unmounts the
    // menu before the link's click fires — items look dead.
    const onDocClick = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // Escape is a keyboard dismissal — return focus to the trigger so
        // the user's place in the tab order is preserved. Outside clicks
        // deliberately don't restore focus: the click target owns it.
        focusTrigger();
        return;
      }
      if (!arrowNav) return;
      const items = menuItems();
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement);
      let next = null;
      if (e.key === 'ArrowDown') next = items[(idx + 1) % items.length];
      else if (e.key === 'ArrowUp') next = items[(idx - 1 + items.length) % items.length];
      else if (e.key === 'Home') next = items[0];
      else if (e.key === 'End') next = items[items.length - 1];
      if (next) {
        e.preventDefault();
        next.focus();
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, arrowNav, menuItems, focusTrigger]);

  return { open, setOpen, mounted, coords, rootRef, menuRef };
}
