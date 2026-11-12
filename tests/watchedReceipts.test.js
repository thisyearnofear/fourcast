import { describe, expect, it } from 'vitest';
import { receiptPhrase } from '@/utils/watchedReceipts';

describe('receiptPhrase', () => {
  it('keeps an unresolved receipt sealed', () => {
    expect(receiptPhrase(null, false)).toMatch(/Still sealed/);
  });

  it('does not treat a mismatch as a clean resolution', () => {
    expect(receiptPhrase('onchain_mismatch', false)).toMatch(/disagree/);
  });

  it('marks a status change', () => {
    expect(receiptPhrase('reconciled', true)).toMatch(/^Updated/);
  });
});
