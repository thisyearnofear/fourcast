import { useEffect, useRef } from 'react';

/**
 * useFocusTrap — Traps keyboard focus inside a modal while `isOpen`.
 *
 * Behaviors:
 * - On open: saves the previously-focused element, then moves focus to the
 *   first focusable element inside the container (deferred via
 *   requestAnimationFrame so React has finished painting).
 * - Tab / Shift+Tab: cycle focus among the modal's focusable elements
 *   without escaping into the background page.
 * - Escape: invokes `onClose` (one-time registration per open).
 * - On close: restores focus to the element that triggered the modal.
 *
 * SSR-safe: no-ops when document is undefined so it can be imported by
 * components that render during static generation.
 *
 * @param {{ isOpen: boolean, onClose: () => void }} opts
 * @returns {React.MutableRefObject<HTMLElement|null>} containerRef — attach to the modal panel
 */
export function useFocusTrap({ isOpen, onClose }) {
  const containerRef = useRef(null);
  const previousFocus = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep onClose fresh without re-triggering the trap effect on every render.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    previousFocus.current = document.activeElement;

    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]),' +
      ' input:not([disabled]):not([type="hidden"]), select:not([disabled]),' +
      ' [tabindex]:not([tabindex="-1"])';
    const getFocusables = () =>
      Array.from(container.querySelectorAll(selector)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0,
      );

    // Defer initial focus past React's commit so the focusables exist.
    const rafId = requestAnimationFrame(() => {
      const focusables = getFocusables();
      if (focusables.length > 0) focusables[0].focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
        previousFocus.current.focus();
      }
    };
  }, [isOpen]);

  return containerRef;
}

export default useFocusTrap;