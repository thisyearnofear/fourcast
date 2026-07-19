// Locks the API-boundary case-insensitivity contract for the /api/* canonicalization sweep.
// Mirrors services/db.js on insert: any address-shaped read at the API boundary is canonicalized
// to lowercase before the downstream service is called, so callers using checksummed or
// mixed-case addresses hit the same payload as their lowercase equivalents.
import { describe, it, expect, vi } from 'vitest';

const { getSignalCountByAuthor } = vi.hoisted(() => ({
  getSignalCountByAuthor: vi.fn().mockResolvedValue({ success: true, count: 7 }),
}));

vi.mock('@/services/db.js', () => ({ getSignalCountByAuthor }));

const { GET } = await import('@/app/api/signals/route.js');

const CASES = [
  ['lowercase',  '0xabcdef0123456789abcdef0123456789abcdef01'],
  ['uppercase',  '0xABCDEF0123456789ABCDEF0123456789ABCDEF01'],
  ['mixed-case', '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'],
];

describe('API boundary canonicalization sweep', () => {
  it.each(CASES)('signals GET ?author=%s canonicalizes before DB call', async (_label, addr) => {
    getSignalCountByAuthor.mockClear();
    const res = await GET({ url: `https://x/api/signals?author=${addr}&countOnly=1`, headers: new Map() });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(7);
    expect(getSignalCountByAuthor).toHaveBeenCalledTimes(1);
    expect(getSignalCountByAuthor).toHaveBeenCalledWith(addr.toLowerCase());
  });
});