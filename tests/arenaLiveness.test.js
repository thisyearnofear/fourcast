import { describe, it, expect } from 'vitest';
import { CYCLE_STALE_AFTER_MS, cycleLiveness, railLamp, shouldOpenTxlineStream } from '@/utils/arenaUi';

/**
 * Honest-liveness grammar (design.md motion policy; AgentRail consumes it).
 * The rail's lamp may pulse ONLY while a cycle is genuinely fresh — a stalled
 * or snapshot-served feed keeps the sealed-amber lamp and stops animating.
 * Regression guard: `/positions` was showing a pulsing green lamp next to
 * "STALLED" for a 35-day-old cycle.
 */

const NOW = Date.parse('2026-09-29T12:00:00Z');
const at = (ms) => new Date(NOW - ms).toISOString();

describe('cycleLiveness', () => {
  it('reports a fresh cycle as live and animated', () => {
    const l = cycleLiveness({ timestamp: at(5 * 60 * 1000), now: NOW });
    expect(l.stalled).toBe(false);
    expect(l.stale).toBe(false);
    expect(l.animated).toBe(true);
    expect(l.ageMs).toBe(5 * 60 * 1000);
  });

  it('marks a cycle at the threshold boundary as stalled only past 30 min', () => {
    expect(cycleLiveness({ timestamp: at(CYCLE_STALE_AFTER_MS), now: NOW }).stalled).toBe(false);
    expect(cycleLiveness({ timestamp: at(CYCLE_STALE_AFTER_MS + 1), now: NOW }).stalled).toBe(true);
  });

  it('treats a 35-day-old cycle as stalled and not animated', () => {
    const l = cycleLiveness({ timestamp: at(35 * 24 * 60 * 60 * 1000), now: NOW });
    expect(l.stalled).toBe(true);
    expect(l.stale).toBe(true);
    expect(l.animated).toBe(false);
  });

  it('never animates a snapshot-served feed, even with a recent timestamp', () => {
    const l = cycleLiveness({ timestamp: at(60 * 1000), staleFlag: true, now: NOW });
    expect(l.stalled).toBe(false);
    expect(l.stale).toBe(true);
    expect(l.animated).toBe(false);
  });

  it('does not animate when there is no cycle at all', () => {
    const l = cycleLiveness({ now: NOW });
    expect(l.ageMs).toBeNull();
    expect(l.stale).toBe(false);
    expect(l.animated).toBe(false);
  });
});

describe('railLamp', () => {
  it('is emerald LIVE for a fresh live cycle', () => {
    const lamp = railLamp({ timestamp: at(60 * 1000), now: NOW });
    expect(lamp.label).toBe('LIVE');
    expect(lamp.color).toBe('var(--color-accent)');
    expect(lamp.animated).toBe(true);
  });

  it('is sealed-amber STALLED for an aged cycle and stops pulsing', () => {
    const lamp = railLamp({ timestamp: at(35 * 24 * 60 * 60 * 1000), now: NOW });
    expect(lamp.label).toBe('STALLED');
    expect(lamp.color).toBe('var(--color-sealed)');
    expect(lamp.animated).toBe(false);
  });

  it('distinguishes STALE (snapshot) from STALLED (age)', () => {
    const lamp = railLamp({ timestamp: at(60 * 1000), staleFlag: true, now: NOW });
    expect(lamp.label).toBe('STALE');
    expect(lamp.animated).toBe(false);
  });

  it('reads PAPER for a dry-run cycle and still pulses (the lane is running)', () => {
    const lamp = railLamp({ timestamp: at(60 * 1000), dryRun: true, now: NOW });
    expect(lamp.label).toBe('PAPER');
    expect(lamp.color).toBe('var(--color-sealed)');
    expect(lamp.animated).toBe(true);
  });

  it('stops the pulse for a stale paper cycle too', () => {
    const lamp = railLamp({ timestamp: at(3 * 24 * 60 * 60 * 1000), dryRun: true, now: NOW });
    expect(lamp.label).toBe('STALLED');
    expect(lamp.color).toBe('var(--color-sealed)');
    expect(lamp.animated).toBe(false);
  });

  it('keeps a stalled real cycle STALLED rather than PAPER', () => {
    const lamp = railLamp({ timestamp: at(2 * 24 * 60 * 60 * 1000), dryRun: true, now: NOW });
    expect(lamp.label).toBe('STALLED');
  });

  it('reads PAUSED in paused lane mode regardless of cycle age', () => {
    const old = railLamp({ timestamp: at(35 * 24 * 60 * 60 * 1000), now: NOW, laneMode: 'paused' });
    expect(old.label).toBe('PAUSED');
    expect(old.color).toBe('var(--color-sealed)');
    expect(old.animated).toBe(false);
    expect(old.laneMode).toBe('paused');
    const fresh = railLamp({ timestamp: at(60 * 1000), now: NOW, laneMode: 'paused' });
    expect(fresh.label).toBe('PAUSED');
    expect(fresh.animated).toBe(false);
  });

  it('defaults to live lane mode', () => {
    expect(railLamp({ timestamp: at(60 * 1000), now: NOW }).laneMode).toBe('live');
  });
});

describe('shouldOpenTxlineStream', () => {
  it('stays off by default so the page settles', () => {
    expect(shouldOpenTxlineStream()).toBe(false);
    expect(shouldOpenTxlineStream({})).toBe(false);
    expect(shouldOpenTxlineStream({ liveEnabled: false })).toBe(false);
  });

  it('opens only on explicit opt-in', () => {
    expect(shouldOpenTxlineStream({ liveEnabled: true })).toBe(true);
  });

  it('treats truthy non-boolean input as off (explicit true only)', () => {
    expect(shouldOpenTxlineStream({ liveEnabled: 1 })).toBe(false);
    expect(shouldOpenTxlineStream({ liveEnabled: 'yes' })).toBe(false);
  });
});
