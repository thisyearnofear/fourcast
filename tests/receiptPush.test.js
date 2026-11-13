import { describe, expect, it } from 'vitest';
import { cleanSubscription, cleanWatches, pushableChange, pushPromptState } from '@/utils/receiptPush';

describe('receipt push rules', () => {
  it('does not announce the first status a watch has ever seen', () => {
    expect(pushableChange(null, 'reconciled')).toBe(false);
    expect(pushableChange('', 'reconciled')).toBe(false);
  });

  it('announces a later change', () => {
    expect(pushableChange('sealed', 'reconciled')).toBe(true);
    expect(pushableChange('reconciled', 'reconciled')).toBe(false);
  });

  it('asks an iPhone in a normal tab to install before prompting', () => {
    expect(pushPromptState({ pushManager: false, ios: true, standalone: false })).toBe('install');
    expect(pushPromptState({ pushManager: true, ios: true, standalone: true })).toBe('ready');
    expect(pushPromptState({ pushManager: false, ios: false, standalone: false })).toBe('unsupported');
  });

  it('rejects a subscription that is not an https push endpoint', () => {
    expect(cleanSubscription({ endpoint: 'http://evil.example', keys: { p256dh: 'a'.repeat(20), auth: 'b'.repeat(16) } })).toBeNull();
    const ok = cleanSubscription({
      endpoint: 'https://push.example/sub/1',
      keys: { p256dh: 'a'.repeat(20), auth: 'b'.repeat(16) },
    });
    expect(ok.endpoint).toMatch(/^https:/);
  });

  it('keeps at most five numeric fixtures', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ fixtureId: String(i + 1), home: 'A', away: 'B' }));
    rows.push({ fixtureId: 'nope' });
    expect(cleanWatches(rows)).toHaveLength(5);
    expect(cleanWatches(rows)[0].fixtureId).toBe('1');
  });
});
