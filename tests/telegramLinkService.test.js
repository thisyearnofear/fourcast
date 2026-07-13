import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createLinkCode,
  consumeLinkCode,
  getLinkStatus,
  unlinkTelegram,
  getTelegramChatIds,
} from '../services/telegramLinkService.js';
import { db, migrationsReady, execute } from '../services/db.js';

const WALLET = '0xAbCd000000000000000000000000000000001234';
const CHAT = '987654321';

describe('telegramLinkService', () => {
  beforeAll(async () => {
    await migrationsReady;
  });

  afterAll(() => {
    try { db.close(); } catch (_) { /* ignore */ }
  });

  it('creates a code and consumes it to bind a chat', async () => {
    const created = await createLinkCode(WALLET);
    expect(created.success).toBe(true);
    expect(created.code).toMatch(/^[0-9a-f]{16}$/);

    const consumed = await consumeLinkCode(created.code, CHAT);
    expect(consumed.success).toBe(true);
    expect(consumed.walletAddress).toBe(WALLET.toLowerCase());

    const status = await getLinkStatus(WALLET);
    expect(status.success).toBe(true);
    expect(status.linked).toBe(true);
  });

  it('rejects reuse of a consumed code', async () => {
    const created = await createLinkCode(WALLET);
    await consumeLinkCode(created.code, CHAT);
    const second = await consumeLinkCode(created.code, 'other-chat');
    expect(second.success).toBe(false);
    expect(second.error).toMatch(/invalid|used/i);
  });

  it('rejects an unknown code', async () => {
    const result = await consumeLinkCode('deadbeefdeadbeef', CHAT);
    expect(result.success).toBe(false);
  });

  it('rejects an expired code', async () => {
    const created = await createLinkCode(WALLET);
    // Age the code past the 15-minute TTL
    await execute(
      `UPDATE telegram_link_codes SET created_at = ? WHERE code = ?`,
      [Date.now() - 16 * 60 * 1000, created.code]
    );
    const result = await consumeLinkCode(created.code, CHAT);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('rebinding replaces the chat id (one chat per wallet)', async () => {
    const first = await createLinkCode(WALLET);
    await consumeLinkCode(first.code, 'chat-1');
    const second = await createLinkCode(WALLET);
    await consumeLinkCode(second.code, 'chat-2');

    const links = await getTelegramChatIds([WALLET]);
    expect(links).toHaveLength(1);
    expect(links[0].chat_id).toBe('chat-2');
  });

  it('resolves chat ids only for linked wallets', async () => {
    const created = await createLinkCode(WALLET);
    await consumeLinkCode(created.code, CHAT);

    const links = await getTelegramChatIds([WALLET, '0x0000000000000000000000000000000000000001']);
    expect(links).toHaveLength(1);
    expect(links[0].wallet_address).toBe(WALLET.toLowerCase());
  });

  it('unlink removes the binding', async () => {
    const created = await createLinkCode(WALLET);
    await consumeLinkCode(created.code, CHAT);
    const result = await unlinkTelegram(WALLET);
    expect(result.success).toBe(true);

    const status = await getLinkStatus(WALLET);
    expect(status.linked).toBe(false);
  });

  it('getTelegramChatIds returns empty for empty input', async () => {
    expect(await getTelegramChatIds([])).toEqual([]);
    expect(await getTelegramChatIds(null)).toEqual([]);
  });
});
