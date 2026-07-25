import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, renderHook, act } from '@testing-library/react';
import Reveal from '@/components/motion/Reveal';
import TweenNumber from '@/components/motion/TweenNumber';
import useChangeFlash from '@/hooks/useChangeFlash';

// jsdom has no IntersectionObserver or matchMedia — the components must
// fall open (visible / instant) in that case, and these stubs let us test
// both the fallback and the motion path.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('reduce') ? false : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Reveal', () => {
  it('falls open without IntersectionObserver (jsdom)', () => {
    const { container } = render(<Reveal>hello</Reveal>);
    const el = container.firstChild;
    expect(el.textContent).toBe('hello');
    expect(el.className).toContain('reveal');
    expect(el.className).toContain('reveal--in');
  });

  it('merges className and renders a custom tag', () => {
    const { container } = render(
      <Reveal as="section" className="fc-door">
        x
      </Reveal>,
    );
    const el = container.firstChild;
    expect(el.tagName).toBe('SECTION');
    expect(el.className).toContain('fc-door');
  });

  it('applies stagger delay via inline style', () => {
    const { container } = render(<Reveal delay={120}>x</Reveal>);
    expect(container.firstChild.style.transitionDelay).toBe('120ms');
  });

  it('stays hidden until intersection when IO exists', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    window.IntersectionObserver = vi.fn(() => ({ observe, disconnect }));
    const { container } = render(<Reveal>lazy</Reveal>);
    expect(container.firstChild.className).toContain('reveal');
    expect(container.firstChild.className).not.toContain('reveal--in');
    expect(observe).toHaveBeenCalled();
    delete window.IntersectionObserver;
  });
});

describe('TweenNumber', () => {
  it('renders the initial value without rolling', () => {
    const { container } = render(<TweenNumber value={42} format={(v) => `${Math.round(v)}%`} />);
    expect(container.textContent).toBe('42%');
  });

  it('reaches the target after the roll completes', async () => {
    // Real timers + vitest's pretendToBeVisual rAF; short roll so the test
    // settles quickly without fake-clock gymnastics.
    const { container, rerender } = render(<TweenNumber value={10} duration={30} />);
    rerender(<TweenNumber value={20} duration={30} />);
    await vi.waitFor(() => expect(container.textContent).toBe('20'), { timeout: 2000 });
  });

  it('respects reduced motion by jumping instantly', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container, rerender } = render(<TweenNumber value={10} duration={100} />);
    rerender(<TweenNumber value={77} duration={100} />);
    expect(container.textContent).toBe('77');
  });
});

describe('useChangeFlash', () => {
  it('does not flash on initial render', () => {
    const { result } = renderHook(() => useChangeFlash('a'));
    expect(result.current).toBe(false);
  });

  it('flashes when the value changes, then settles', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useChangeFlash(v, 900), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe(false);
    rerender({ v: 'b' });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it('does not flash when the value stays the same', () => {
    const { result, rerender } = renderHook(({ v }) => useChangeFlash(v), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'a' });
    expect(result.current).toBe(false);
  });
});
