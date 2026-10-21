/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';

import { MemoryDelta } from '@/components/MemoryDelta.jsx';

/**
 * The Memory lane's two jobs: tell the truth when there is nothing to show,
 * and show the numbers without recomputing them when there is. Fetch is mocked
 * at the boundary — the lane must not own any sizing math, so every figure it
 * prints here is one the API handed it.
 */

const LADDER_URL = '/api/memory/status?ladder=1&kind=window&key=2026-10';

function statusBody({ writable = false, rows = [] } = {}) {
  return {
    success: true,
    schema: 'memory-status/v1',
    memory: {
      enabled: writable,
      configured: writable,
      writable,
      network: 'mainnet',
      relayerUrl: 'https://relayer.memory.walrus.xyz',
      reason: writable ? null : 'FOURCAST_MEMORY_ENABLED is not "true"',
    },
    ledger: { byNetwork: [], byKind: [], confirmed: rows.length, mainnetConfirmed: rows.length },
    rows,
    chains: { memory: 'mainnet', settlement: 'sui:testnet', rpc: 'mainnet', aligned: false },
    notes: ['Memory reads are unavailable: FOURCAST_MEMORY_ENABLED is not "true".'],
  };
}

const RUNGS = [
  {
    key: '2026-10',
    version: 3,
    asOf: '2026-10-20',
    blobId: 'blob-rung-3',
    blobUrl: 'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-rung-3',
    header: 'window 2026-10 v=3 as_of=2026-10-20 buckets=HIGH:0.450',
    fields: { v: '3', as_of: '2026-10-20', buckets: 'HIGH:0.450/MEDIUM:0.520', bucket_n: 'HIGH:20/MEDIUM:14' },
  },
  {
    key: '2026-10',
    version: 2,
    asOf: '2026-10-12',
    blobId: 'blob-rung-2',
    blobUrl: 'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-rung-2',
    header: 'window 2026-10 v=2 as_of=2026-10-12 buckets=HIGH:0.610',
    fields: { v: '2', as_of: '2026-10-12', buckets: 'HIGH:0.610', bucket_n: 'HIGH:11' },
  },
];

function whatifBody({ withMemory = false } = {}) {
  const scenarios = [
    { key: 'uncalibrated', label: 'No calibration', buckets: null, bucketField: 'NA', sampleSize: 0, sizePct: 0.15, kellyPct: 0.3, calibrationFactor: null, deltaVsUncalibrated: 0, droppedBuckets: [], blobId: null },
    { key: 'ledger', label: 'Scored ledger (db)', buckets: null, bucketField: 'NA', sampleSize: 0, sizePct: 0.15, kellyPct: 0.3, calibrationFactor: null, deltaVsUncalibrated: 0, droppedBuckets: [], blobId: null },
  ];
  if (withMemory) {
    scenarios.push({
      key: 'memory',
      label: 'Walrus Memory rung',
      buckets: { HIGH: 0.45 },
      bucketField: 'HIGH:0.450',
      sampleSize: 34,
      sizePct: 0.09,
      kellyPct: 0.3,
      calibrationFactor: 0.6,
      deltaVsUncalibrated: -0.06,
      droppedBuckets: [],
      blobId: 'blob-rung-3',
      provenance: {
        key: '2026-10', version: 3, asOf: '2026-10-20', textHash: 'c'.repeat(64),
        how: 'relayer-recall',
      },
    });
  }
  return {
    success: true,
    schema: 'whatif/v1',
    input: {
      origin: 'forecast',
      forecastId: 'fourcast-txline-9',
      question: 'FC Heidenheim vs Borussia Mönchengladbach',
      probability: 0.72,
      odds: 0.6,
      bucket: 'HIGH',
      settled: { outcome: 1, brierScore: 0.0784, logLoss: 0.3285, sizedAs: 0.15 },
    },
    scenarios,
    applied: withMemory
      ? { key: 'memory', reason: 'No usable bucket on the live curve, so the memory-derived rung sizes this decision — the cold-deployment path.' }
      : { key: 'uncalibrated', reason: 'No usable calibration evidence anywhere, so sizing runs unshrunk and says so.' },
    notes: [],
  };
}

function mockFetch(handler) {
  global.fetch = vi.fn(async (url) => {
    const body = handler(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  });
}

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('/arena Memory lane', () => {
  it('names both chains and says it has nothing appended, without inventing either', async () => {
    mockFetch((url) => {
      if (url.includes('/api/decision/whatif')) {
        return { success: true, schema: 'whatif/v1', input: null, scenarios: [], applied: null, notes: ['No settled forecast on this host yet.'] };
      }
      return statusBody();
    });

    render(<MemoryDelta />);

    const state = await screen.findByLabelText('Memory state');
    expect(state.textContent).toContain('not writable here');
    // The chip labels are uppercased by CSS text-transform, not by the text, so
    // the assertion reads case-insensitively or it tests the stylesheet.
    expect(state.textContent).toMatch(/memory\s*mainnet/i);
    expect(state.textContent).toMatch(/settlement\s*sui:testnet/i);
    expect(state.textContent).toMatch(/aligned\s*no/i);

    expect(screen.getByText(/Nothing appended yet/i)).toBeTruthy();
    // A relayer read costs a recall(), so it stays a deliberate click — and the
    // click is unavailable until the writer is configured.
    expect(screen.getByRole('button', { name: /read the ladder from the relayer/i }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /prove on chain via tatum/i }).disabled).toBe(true);
  });

  it('renders the ladder with a public blob link, then the size the memory made smaller', async () => {
    mockFetch((url) => {
      if (url === LADDER_URL) return { ...statusBody({ writable: true, rows: [] }), rungs: RUNGS };
      if (url.includes('/api/decision/whatif')) return whatifBody({ withMemory: url.includes('memory=1') });
      return statusBody({
        writable: true,
        rows: [{
          kind: 'window', memkey: '2026-10', version: 3, blob_id: 'blob-rung-3',
          blobUrl: 'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-rung-3',
          trigger_receipt: 'a'.repeat(64), text_sha256: 'b'.repeat(64),
        }],
      });
    });

    render(<MemoryDelta />);

    // Before the ladder read, the lane shows the local intent ledger row.
    await screen.findByText(/window:2026-10/);
    expect(screen.getByText(/receipt a+…a+/)).toBeTruthy();
    // ...and once the free sizing read lands, the memory column is honestly
    // absent rather than zeroed out.
    await screen.findByText(/No rung in this comparison yet/i);
    expect(screen.queryByText('Walrus Memory rung')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /read the ladder from the relayer/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(LADDER_URL));

    // Three columns, one decision: 15% uncalibrated, 9% sized on the rung.
    const sizes = await screen.findAllByText(/15\.0%|9\.0%/);
    expect(sizes.map((el) => el.textContent)).toContain('9.0%');
    expect(screen.getByText('0.600×')).toBeTruthy();
    expect(screen.getByText(/-6\.0 pp/)).toBeTruthy();

    // The blob link lives in the ladder section; the memory column prints the
    // same id as text, so an unscoped query finds two nodes and proves nothing.
    const ladder = within(screen.getByLabelText('Memory version ladder'));
    const blobLink = ladder.getByRole('link', { name: /blob-rung-3/ });
    expect(blobLink.href).toContain('aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-rung-3');
    expect(screen.getByText(/cold-deployment path/i)).toBeTruthy();
  });

  it('asks the route to read the rung, rather than pasting rates into the query string', async () => {
    mockFetch((url) => {
      if (url === LADDER_URL) return { ...statusBody({ writable: true, rows: [] }), rungs: RUNGS };
      if (url.includes('/api/decision/whatif')) return whatifBody({ withMemory: url.includes('memory=1') });
      return statusBody({ writable: true, rows: [] });
    });

    render(<MemoryDelta />);
    await screen.findByLabelText('Memory state');
    fireEvent.click(screen.getByRole('button', { name: /read the ladder from the relayer/i }));

    // A rate the page typed is not evidence about the blob it names, so the
    // request the lane makes must carry the ask, not the numbers.
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/decision/whatif?memory=1'));
    const whatifCalls = global.fetch.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/api/decision/whatif'));
    expect(whatifCalls.every((u) => !u.includes('buckets='))).toBe(true);

    // And the column says where its numbers came from.
    expect(await screen.findByText(/fetched by this route, not typed in/i)).toBeTruthy();
  });

  it('surfaces a failed read instead of leaving the panel on "Recomputing…"', async () => {
    mockFetch((url) => {
      if (url.includes('/api/decision/whatif')) return { success: false, error: 'whatif route blew up' };
      return statusBody();
    });

    render(<MemoryDelta />);

    expect(await screen.findByText(/whatif route blew up/)).toBeTruthy();
    expect(screen.getByText(/Sizing comparison unavailable/i)).toBeTruthy();
  });
});
