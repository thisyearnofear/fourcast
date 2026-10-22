'use client';

import { useRef } from 'react';

/**
 * useTabArrowKeys — WAI-ARIA tabs keyboard behavior for a tab strip.
 *
 * Attach `onKeyDown` to the `role="tablist"` container and spread
 * `tabProps(id)` on each `role="tab"` button. Arrow keys move selection and
 * focus together (selection follows focus), Home/End jump to the ends, and
 * focus roves so only the active tab stays in the Tab sequence.
 */
export default function useTabArrowKeys(ids, activeId, onChange) {
  const refs = useRef({});

  const onKeyDown = (event) => {
    const idx = ids.indexOf(activeId);
    if (idx === -1) return;
    let nextId;
    switch (event.key) {
      case 'ArrowRight':
        nextId = ids[(idx + 1) % ids.length];
        break;
      case 'ArrowLeft':
        nextId = ids[(idx - 1 + ids.length) % ids.length];
        break;
      case 'Home':
        nextId = ids[0];
        break;
      case 'End':
        nextId = ids[ids.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    if (nextId !== activeId) onChange(nextId);
    const el = refs.current[nextId];
    if (el) el.focus();
  };

  const tabProps = (id) => ({
    ref: (el) => {
      refs.current[id] = el;
    },
    tabIndex: id === activeId ? 0 : -1,
  });

  return { onKeyDown, tabProps };
}
