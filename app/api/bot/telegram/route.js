/**
 * Telegram Bot Webhook — receives updates from Telegram
 *
 * Telegram sends POST requests here when users message the bot.
 * We parse the command and reply via the Telegram API.
 *
 * Setup:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://fourcast.vercel.app/api/bot/telegram"
 *
 * Test locally:
 *   ngrok http 3000
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ngrok-id>.ngrok.io/api/bot/telegram"
 */

import { handleTelegramUpdate } from '@/services/telegramBot';

export async function POST(request) {
  try {
    const update = await request.json();

    // Health check (Telegram sends this sometimes)
    if (update.message?.text === '/health') {
      return Response.json({ ok: true, status: 'healthy' });
    }

    const result = await handleTelegramUpdate(update);

    // Always return 200 to acknowledge receipt (Telegram retries on non-200)
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 200 }); // 200 to prevent retry spam
  }
}

/**
 * GET — verify webhook is configured
 */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return Response.json({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN not set. Create a bot at @BotFather and add the token to .env.local',
      docs: 'https://core.telegram.org/bots#botfather',
    });
  }

  try {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
    const webhook = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json());

    return Response.json({
      configured: true,
      bot: me.ok ? me.result.username : null,
      webhook: webhook.ok ? webhook.result.url : null,
      pendingUpdates: webhook.ok ? webhook.result.pending_update_count : null,
      commands: ['/start — Welcome & instructions', '/edge <query> — AI analysis of a prediction market'],
    });
  } catch (err) {
    return Response.json({ configured: true, error: err.message });
  }
}
