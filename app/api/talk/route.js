import { migrationsReady, saveOperatorLead } from '@/services/db';
import { sendTelegramMessage } from '@/services/telegramLinkService';

export const runtime = 'nodejs';

const recent = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > RATE_MAX;
}

/**
 * POST /api/talk — operator "Talk to us" capture.
 * Body: { email, sizes?, note?, source?, website? }
 * `website` is a honeypot — bots fill it; humans leave it empty.
 */
export async function POST(request) {
  try {
    await migrationsReady;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (rateLimited(ip)) {
      return Response.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.website) {
      // Honeypot tripped — pretend success so scrapers leave.
      return Response.json({ success: true });
    }

    const result = await saveOperatorLead({
      email: body.email,
      sizes: Boolean(body.sizes),
      note: body.note,
      source: body.source || 'privacy',
    });

    if (!result.success) {
      return Response.json(result, { status: 400 });
    }

    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
      const sizes = body.sizes ? 'yes' : 'no';
      const note = body.note ? String(body.note).trim().slice(0, 200) : '—';
      try {
        await sendTelegramMessage(
          chatId,
          `Talk to us\n\`${result.email}\`\nSizes: ${sizes}\n${note}`
        );
      } catch (err) {
        console.error('[api/talk] telegram notify failed:', err.message);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/talk] POST error:', error);
    return Response.json({ success: false, error: 'Could not save' }, { status: 500 });
  }
}
