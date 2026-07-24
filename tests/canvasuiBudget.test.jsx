import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import Ripple from '@/components/canvasui/Ripple';
import Glass from '@/components/canvasui/Glass';
import Liquid from '@/components/canvasui/Liquid';
import ParticleReveal from '@/components/canvasui/ParticleReveal';
import Magnify from '@/components/canvasui/Magnify';

afterEach(() => {
  cleanup();
});

// jsdom does not expose html-in-canvas (no drawElementImage / requestPaint
// on canvas contexts), so all canvas-ui components mount in their plain
// HTML fallback. The tests below verify the budget integration does not
// crash and that opt-out works; the registry policy itself is covered by
// useMotionBudget.test.jsx.

describe('canvas-ui + useMotionBudget integration', () => {
  const cases = [
    { name: 'Ripple', Component: Ripple, defaultPriority: 5 },
    { name: 'Glass', Component: Glass, defaultPriority: 7 },
    { name: 'Liquid', Component: Liquid, defaultPriority: 8 },
    { name: 'ParticleReveal', Component: ParticleReveal, defaultPriority: 6 },
    { name: 'Magnify', Component: Magnify, defaultPriority: 6 },
  ];

  for (const { name, Component, defaultPriority } of cases) {
    it(`${name} mounts cleanly with the budget enabled`, () => {
      const { container, unmount } = render(
        <Component>
          <button>x</button>
        </Component>,
      );
      const child = container.querySelector('button');
      expect(child).toBeTruthy();
      expect(child?.textContent).toBe('x');
      unmount();
    });

    it(`${name} mounts cleanly with motionBudget={false}`, () => {
      const { container, unmount } = render(
        <Component motionBudget={false}>
          <button>y</button>
        </Component>,
      );
      const child = container.querySelector('button');
      expect(child).toBeTruthy();
      unmount();
    });

    it(`${name} accepts a custom priority prop without crashing`, () => {
      const { container, unmount } = render(
        <Component priority={defaultPriority + 10}>
          <button>z</button>
        </Component>,
      );
      const child = container.querySelector('button');
      expect(child).toBeTruthy();
      unmount();
    });
  }

  it('multiple canvas-ui effects at the same priority still render', () => {
    // Even though the budget is max=1, components that fall back to plain
    // HTML (jsdom) still render their children. The visible budget effect
    // is tested in useMotionBudget.test.jsx.
    const { container } = render(
      <>
        <Ripple>
          <a href="#1">one</a>
        </Ripple>
        <Glass>
          <a href="#2">two</a>
        </Glass>
        <Liquid>
          <a href="#3">three</a>
        </Liquid>
        <ParticleReveal>
          <a href="#4">four</a>
        </ParticleReveal>
        <Magnify>
          <a href="#5">five</a>
        </Magnify>
      </>,
    );
    expect(container.querySelectorAll('a').length).toBe(5);
  });
});

// Stub console.error for cleaner test output (canvas-ui components log
// shader errors when WebGL is unavailable in jsdom).
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalError;
});

import { beforeAll, afterAll } from 'vitest';
