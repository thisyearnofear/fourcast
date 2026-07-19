/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import OperatorMath from '@/components/OperatorMath';
import { BRAND } from '@/constants/brand';

// Mock next/dynamic to a synchronous wrapper that returns a Stub directly.
// This bypasses next/dynamic's `ssr: false` server-side check (which throws in
// vitest's non-Next.js context) AND short-circuits the loader, so the inner
// `@/components/PricingOverlay` module is never imported — only the Stub
// defined here is rendered. The Stub mimics PricingOverlay's `isOpen` prop
// contract: render `data-testid="pricing-overlay"` only when isOpen is true.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = ({ isOpen }) =>
      isOpen ? <div data-testid="pricing-overlay">OPEN</div> : null;
    Stub.displayName = 'PricingOverlayStub';
    return Stub;
  },
}));

// Use vitest's built-in matchers (textContent/.toContain, .toBeNull, .toBeTruthy)
// instead of @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent). Keeps the test suite hermetic without adding a new
// devDependency.

afterEach(() => cleanup());

describe('<OperatorMath />', () => {
  it('renders all 5 BRAND.positioning.operatorMath fields', () => {
    render(<OperatorMath />);
    const om = BRAND.positioning.operatorMath;
    expect(screen.getByTestId('operator-math-claim').textContent).toContain(om.claim);
    expect(screen.getByTestId('operator-math-formula').textContent).toContain(om.formula);
    expect(screen.getByTestId('operator-math-breakeven').textContent).toContain(om.breakeven);
    expect(screen.getByTestId('operator-math-digest').textContent).toContain(om.digest);
    expect(screen.getByTestId('operator-math-assumption').textContent).toContain(om.assumption);
  });

  it('renders the "Operator Math" eyebrow and Headline pill in default (non-compact) mode', () => {
    render(<OperatorMath />);
    expect(screen.getByText(/^Operator Math$/i)).toBeTruthy();
    expect(screen.getByText(/^Headline$/i)).toBeTruthy();
  });

  it('renders the Unlock Autopilot CTA as a <button>', () => {
    render(<OperatorMath />);
    const cta = screen.getByTestId('operator-math-cta');
    expect(cta).toBeTruthy();
    expect(cta.firstChild.textContent).toMatch(/^unlock autopilot$/i);
    expect(cta.tagName).toBe('BUTTON');
  });

  it('opens PricingOverlay when Unlock Autopilot is clicked', () => {
    render(<OperatorMath />);
    // Initially closed — PricingOverlay stub is not rendered
    expect(screen.queryByTestId('pricing-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('operator-math-cta'));
    // After click — stub PricingOverlay renders with isOpen=true
    expect(screen.queryByTestId('pricing-overlay')).toBeTruthy();
  });

  it('applies full spacing (p-5, mb-6) when compact is not set', () => {
    render(<OperatorMath />);
    const container = screen.getByTestId('operator-math-container');
    expect(container.className).toContain('p-5');
    expect(container.className).toContain('mb-6');
  });
});

describe('<OperatorMath compact />', () => {
  it('omits the "Operator Math" eyebrow and Headline pill', () => {
    render(<OperatorMath compact />);
    // queryByText returns null when no match — the eyebrow + pill should NOT be rendered
    expect(screen.queryByText(/^Operator Math$/i)).toBeNull();
    expect(screen.queryByText(/^Headline$/i)).toBeNull();
  });

  it('still renders all 5 BRAND.positioning.operatorMath fields', () => {
    render(<OperatorMath compact />);
    const om = BRAND.positioning.operatorMath;
    expect(screen.getByTestId('operator-math-claim').textContent).toContain(om.claim);
    expect(screen.getByTestId('operator-math-formula').textContent).toContain(om.formula);
    expect(screen.getByTestId('operator-math-breakeven').textContent).toContain(om.breakeven);
    expect(screen.getByTestId('operator-math-digest').textContent).toContain(om.digest);
    expect(screen.getByTestId('operator-math-assumption').textContent).toContain(om.assumption);
  });

  it('still opens PricingOverlay when Unlock Autopilot is clicked', () => {
    render(<OperatorMath compact />);
    expect(screen.queryByTestId('pricing-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('operator-math-cta'));
    expect(screen.queryByTestId('pricing-overlay')).toBeTruthy();
  });

  it('applies compact spacing (p-4, mb-4) when compact is set', () => {
    render(<OperatorMath compact />);
    const container = screen.getByTestId('operator-math-container');
    expect(container.className).toContain('p-4');
    expect(container.className).toContain('mb-4');
  });
});