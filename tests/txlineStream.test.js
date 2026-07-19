/** Pure-data vitest for the TxLINE SSE helpers. No jsdom needed. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Set required env before importing the service
process.env.TXLINE_API_TOKEN = process.env.TXLINE_API_TOKEN || 'test-token';

const {
  parseStreamEvent,
  toStreamDelta,
  getStreamConfig,
  streamFixtureUpdates,
} = await import('@/services/txline/txlineService');

// Local helper — the service's internal sleep() is module-private. Mirrors the
// implementation exactly so the abort-timeout test can use it.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TxLINE SSE helpers', () => {
  describe('parseStreamEvent', () => {
    it('parses a single-line JSON object', () => {
      const raw = JSON.stringify({
        type: 'fixture',
        fixtureId: '18175981',
        patch: { status: 'live', home: { score: 1 } },
        timestamp: '2026-07-19T12:00:00Z',
      });
      const out = parseStreamEvent(raw);
      expect(out.type).toBe('fixture');
      expect(out.fixtureId).toBe('18175981');
      expect(out.patch.status).toBe('live');
      expect(out.patch.home.score).toBe(1);
      expect(out.timestamp).toBe('2026-07-19T12:00:00Z');
    });

    it('parses multi-line SSE data (last parseable line wins)', () => {
      const raw = [
        'heartbeat: keep-alive',
        JSON.stringify({ type: 'meta', kind: 'heartbeat' }),
        JSON.stringify({ type: 'fixture', fixtureId: 'abc', patch: { status: 'final' } }),
      ].join('\n');
      const out = parseStreamEvent(raw);
      expect(out.type).toBe('fixture');
      expect(out.fixtureId).toBe('abc');
      expect(out.patch.status).toBe('final');
    });

    it('falls back to { type: "raw", patch: { raw } } for non-JSON input', () => {
      const out = parseStreamEvent('event: score_update\njust some text');
      expect(out.type).toBe('raw');
      expect(out.patch.raw).toContain('just some text');
      expect(out.fixtureId).toBeNull();
    });

    it('returns null for empty / whitespace input', () => {
      expect(parseStreamEvent('')).toBeNull();
      expect(parseStreamEvent('   \n  ')).toBeNull();
      expect(parseStreamEvent(null)).toBeNull();
      expect(parseStreamEvent(undefined)).toBeNull();
    });

    it('treats "data" field as the patch when no explicit patch is given', () => {
      const raw = JSON.stringify({ type: 'score', fixtureId: 'x', data: { home: { score: 2 } } });
      const out = parseStreamEvent(raw);
      expect(out.patch).toEqual({ home: { score: 2 } });
    });
  });

  describe('toStreamDelta', () => {
    it('produces an envelope with type/fixtureId/patch/timestamp', () => {
      const d = toStreamDelta('123', { status: 'live' });
      expect(d.type).toBe('fixture');
      expect(d.fixtureId).toBe('123');
      expect(d.patch).toEqual({ status: 'live' });
      expect(typeof d.timestamp).toBe('string');
      // ISO string ending in Z
      expect(d.timestamp).toMatch(/T.*Z$/);
    });

    it('honors the kind override', () => {
      expect(toStreamDelta('x', { h: 0.5 }, 'odds').type).toBe('odds');
      expect(toStreamDelta('x', { score: 2 }, 'score').type).toBe('score');
      expect(toStreamDelta(null, { kind: 'heartbeat' }, 'meta').type).toBe('meta');
    });

    it('handles null fixtureId for meta-style deltas', () => {
      const d = toStreamDelta(null, { kind: 'stream-open' }, 'meta');
      expect(d.fixtureId).toBe('');
    });
  });

  describe('getStreamConfig', () => {
    beforeEach(() => {
      delete process.env.TXLINE_SSE_URL;
      delete process.env.TXLINE_STREAM_POLL_MS;
    });
    afterEach(() => {
      delete process.env.TXLINE_SSE_URL;
      delete process.env.TXLINE_STREAM_POLL_MS;
    });

    it('returns the configured SSE URL or null', () => {
      const cfg = getStreamConfig();
      expect(cfg).toHaveProperty('sseUrl');
      expect(cfg).toHaveProperty('pollIntervalMs');
      expect(cfg).toHaveProperty('mode');
      expect(typeof cfg.pollIntervalMs).toBe('number');
    });

    it('respects TXLINE_SSE_URL when set', () => {
      process.env.TXLINE_SSE_URL = 'https://txline.example.com/stream';
      const cfg = getStreamConfig();
      expect(cfg.sseUrl).toBe('https://txline.example.com/stream');
    });

    it('respects TXLINE_STREAM_POLL_MS override', () => {
      process.env.TXLINE_STREAM_POLL_MS = '5000';
      const cfg = getStreamConfig();
      expect(cfg.pollIntervalMs).toBe(5000);
    });

    it('defaults to 30s when no override is set', () => {
      delete process.env.TXLINE_STREAM_POLL_MS;
      const cfg = getStreamConfig();
      expect(cfg.pollIntervalMs).toBe(30_000);
    });
  });

  describe('streamFixtureUpdates async generator', () => {
    // Take helper: yield up to N items then close the upstream iterator.
    async function* take(iter, n) {
      let count = 0;
      for await (const item of iter) {
        yield item;
        count += 1;
        if (count >= n) return;
      }
    }

    const originalPollMs = process.env.TXLINE_STREAM_POLL_MS;
    beforeEach(() => {
      // Speed up the polling loop so the tests don't wait 30s per tick.
      process.env.TXLINE_STREAM_POLL_MS = '50';
    });
    afterEach(() => {
      if (originalPollMs === undefined) {
        delete process.env.TXLINE_STREAM_POLL_MS;
      } else {
        process.env.TXLINE_STREAM_POLL_MS = originalPollMs;
      }
    });

    it('emits an initial meta event with kind:stream-mode', async () => {
      const fetchFixtures = async () => ({ fixtures: [] });
      const controller = new AbortController();

      const events = [];
      for await (const evt of take(streamFixtureUpdates({ fetchFixtures, signal: controller.signal }), 1)) {
        events.push(evt);
      }
      controller.abort();

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('meta');
      expect(events[0].patch.kind).toBe('stream-mode');
    });

    it('emits a snapshot of all fixtures on the first poll', async () => {
      const fixtures = [
        { id: '1', status: 'live', home: { name: 'A', score: 0 }, away: { name: 'B', score: 0 }, updatedAt: 't1' },
        { id: '2', status: 'scheduled', home: { name: 'C', score: null }, away: { name: 'D', score: null }, updatedAt: 't1' },
      ];
      const fetchFixtures = async () => ({ fixtures });
      const controller = new AbortController();

      // Expect: 1 meta + 2 fixture events + 1 heartbeat = 4 events
      const events = [];
      for await (const evt of take(streamFixtureUpdates({ fetchFixtures, signal: controller.signal }), 4)) {
        events.push(evt);
      }
      controller.abort();

      expect(events[0].type).toBe('meta');
      const fixtureEvents = events.filter((e) => e.type === 'fixture');
      expect(fixtureEvents.length).toBe(2);
      expect(fixtureEvents[0].fixtureId).toBe('1');
      expect(fixtureEvents[1].fixtureId).toBe('2');
      expect(events[events.length - 1].type).toBe('meta');
      expect(events[events.length - 1].patch.kind).toBe('heartbeat');
    });

    it('only emits a fixture delta when the diff key changes between polls', async () => {
      let callCount = 0;
      const v1 = { id: '1', status: 'live', home: { name: 'A', score: 0 }, away: { name: 'B', score: 0 }, updatedAt: 't1' };
      const v2 = { ...v1, home: { ...v1.home, score: 1 }, updatedAt: 't2' };
      const fetchFixtures = async () => {
        callCount += 1;
        return { fixtures: callCount === 1 ? [v1] : [v2] };
      };

      const controller = new AbortController();
      const fixturePatches = [];
      // Iterate until we see the second fixture event with score=1, then stop.
      for await (const evt of streamFixtureUpdates({ fetchFixtures, signal: controller.signal })) {
        if (evt.type === 'fixture' && evt.patch.home?.score === 1) {
          fixturePatches.push(evt.patch);
          controller.abort();
          break;
        }
      }

      expect(fixturePatches.length).toBe(1);
      expect(fixturePatches[0].home.score).toBe(1);
    });

    it('stops cleanly when AbortSignal is triggered', async () => {
      let callCount = 0;
      const fetchFixtures = async () => {
        callCount += 1;
        return { fixtures: [] };
      };

      const controller = new AbortController();
      const events = [];
      let loopExited = false;
      let abortErrorSeen = false;

      // Single stream. Consume events and trigger abort after the first 2
      // (meta + initial-snapshot heartbeat). The polling loop's next sleep()
      // is short-circuited by the abort listener, so the generator exits
      // within ~one pollIntervalMs (50ms here) without yielding more.
      const streamPromise = (async () => {
        try {
          for await (const evt of streamFixtureUpdates({ fetchFixtures, signal: controller.signal })) {
            events.push(evt);
            if (events.length >= 2) controller.abort();
          }
          loopExited = true;
        } catch (err) {
          // AbortError propagating up is also acceptable — it still proves
          // the signal was honored and the generator stopped.
          if (err && (err.name === 'AbortError' || /abort/i.test(String(err.message)))) {
            abortErrorSeen = true;
          }
        }
      })();

      // Hard cap: if the stream doesn't terminate within 500ms (~10x the
      // 50ms poll interval), abort was ignored and we fail loudly.
      await Promise.race([
        streamPromise,
        sleep(500).then(() => {
          throw new Error('stream did not terminate within 500ms of abort');
        }),
      ]);

      // We yielded at least the initial meta + heartbeat before aborting.
      expect(events.length).toBeGreaterThanOrEqual(2);
      // The stream stopped shortly after abort rather than ticking forever.
      // With a 50ms poll interval and abort firing mid-iteration, we'd
      // expect ~3-5 trailing events max before the loop notices `stop`.
      expect(events.length).toBeLessThan(6);
      // fetchFixtures was actually called.
      expect(callCount).toBeGreaterThanOrEqual(1);
      // Generator exited cleanly OR threw AbortError — either proves abort
      // was honored. (NOT a vacuous assertion: both flags start false.)
      expect(loopExited || abortErrorSeen).toBe(true);
    });

    it('exits immediately when given an already-aborted signal', async () => {
      // streamFixtureUpdates checks `if (signal.aborted) stop = true;` before
      // entering the polling loop, so a pre-aborted signal must cause the
      // generator to yield just the meta + initial snapshot then return.
      const fixtures = [
        { id: '1', status: 'live', home: { name: 'A', score: 0 }, away: { name: 'B', score: 0 }, updatedAt: 't1' },
      ];
      const fetchFixtures = async () => ({ fixtures });

      const controller = new AbortController();
      controller.abort(); // pre-abort before iteration

      // Wrap the iteration in Promise.race with a hard timeout — if a future
      // refactor accidentally moves `await sleep(...)` above the `while
      // (!stop)` check, the generator would yield once then hang on sleep.
      // The timeout caps that hang at 500ms and fails loudly.
      const iterationPromise = (async () => {
        const events = [];
        for await (const evt of streamFixtureUpdates({ fetchFixtures, signal: controller.signal })) {
          events.push(evt);
        }
        return events;
      })();

      const events = await Promise.race([
        iterationPromise,
        sleep(500).then(() => {
          throw new Error('generator did not exit immediately on already-aborted signal');
        }),
      ]);

      // 1 meta + 1 fixture + 1 heartbeat = 3 events, then immediate exit.
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.length).toBeLessThan(6);
      expect(events[0].type).toBe('meta');
      expect(events[0].patch.kind).toBe('stream-mode');
    });
  });
});