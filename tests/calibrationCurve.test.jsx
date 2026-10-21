/** @vitest-environment jsdom */
/**
 * The calibration curve is where the snake_case/camelCase break showed up:
 * `b.hitRate` was undefined, so every bucket plotted at y = baseline — a curve
 * that looked like "0% hit rate everywhere" while the ledger said otherwise.
 * These tests pin the dot geometry and the printed hit rate to the API shape.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CalibrationCurve } from '@/components/CalibrationCurve';

const PAYLOAD = {
  success: true,
  schema: 'calibration/v2',
  summary: {
    totalResolved: 6, avgBrier: 0.205, avgLogLoss: 0.5512,
    minBucket: 'HIGH', maxBucket: 'HIGH',
    total_resolved: 6, avg_brier: 0.205, avg_log_loss: 0.5512,
    min_bucket: 'HIGH', max_bucket: 'HIGH',
  },
  buckets: [
    {
      bucket: 'HIGH', count: 6, hitRate: 0.5, avgBrier: 0.205, avgLogLoss: 0.5512,
      avgProbability: 0.9, midpointConfidence: 0.875,
      hit_rate: 0.5, avg_brier: 0.205, avg_log_loss: 0.5512, avg_probability: 0.9,
    },
  ],
  trend: [{ month: '2026-10', count: 6, avgBrier: 0.205, avgLogLoss: 0.5512 }],
  sourceCal: [],
};

function mockFetch(payload) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<CalibrationCurve />', () => {
  it('plots a 50% bucket at half the plot height, not on the baseline', async () => {
    mockFetch(PAYLOAD);
    const { container } = render(<CalibrationCurve />);

    await screen.findByText('n=6');

    // Geometry is read off the rendered diagonal (y1 = hit rate 0, y2 = hit
    // rate 1) rather than hardcoded paddings, so the assertion says "halfway
    // up the plot" instead of re-stating the component's constants.
    const plot = container.querySelector('svg[aria-label="Calibration plot"]');
    const diagonal = [...plot.querySelectorAll('line')].find((l) =>
      (l.getAttribute('stroke-dasharray') || '').length > 0
    );
    const baselineY = Number(diagonal.getAttribute('y1'));
    const topY = Number(diagonal.getAttribute('y2'));

    // Scoped to the plot: lucide icons render their own <circle> elements.
    const circles = [...plot.querySelectorAll('circle')];
    expect(circles.length).toBe(2);
    for (const dot of circles) {
      const cy = Number(dot.getAttribute('cy'));
      expect(cy).toBeCloseTo((baselineY + topY) / 2, 5);
      expect(cy).toBeLessThan(baselineY);
    }
  });

  it('prints the observed hit rate, Brier and log loss per bucket', async () => {
    mockFetch(PAYLOAD);
    const { container } = render(<CalibrationCurve />);
    await screen.findByText('n=6');

    const text = container.textContent;
    expect(text).toContain('50%');
    expect(text).toContain('n=6');
    expect(text).toContain('brier=0.205');
    expect(text).toContain('logloss=0.551');
  });

  it('shows the summary strip from camelCase metrics', async () => {
    mockFetch(PAYLOAD);
    const { container } = render(<CalibrationCurve />);
    await screen.findByText('n=6');

    const text = container.textContent;
    // 4 decimals here, 3 in the bucket row — the strip is the summary, not the table.
    expect(text).toContain('0.2050');
    expect(text).toContain('0.5512');
    expect(text).toContain('HIGH → HIGH');
  });

  it('renders the building-the-curve state when nothing is resolved yet', async () => {
    mockFetch({ ...PAYLOAD, summary: { ...PAYLOAD.summary, totalResolved: 0, total_resolved: 0 }, buckets: [] });
    const { container } = render(<CalibrationCurve />);
    await screen.findByText('0 resolved');
    expect(container.textContent).toContain('0 resolved');
  });
});
