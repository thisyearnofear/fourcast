/**
 * Spectrum Multi-Platform Agent
 *
 * Uses Photon's Spectrum SDK to run the Fourcast bot across
 * iMessage, WhatsApp, and other messaging platforms.
 *
 * The same handleTelegramUpdate() function handles commands
 * regardless of platform — Spectrum routes messages to us.
 *
 * Setup:
 *   1. Sign up at https://app.photon.codes — get Project ID + Secret
 *   2. Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env
 *   3. Run: node bot/spectrum.js
 *
 * Telegram polling still runs alongside via pm2 (bot/index.js)
 * for the Telegram platform. Once Spectrum supports Telegram,
 * this can replace that.
 */

import { Spectrum } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { whatsapp } from 'spectrum-ts/providers/whatsapp';
import { terminal } from 'spectrum-ts/providers/terminal';
import { handleTelegramUpdate } from '../services/telegramBot.js';

const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

// ============================================================================
// Main
// ============================================================================

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;

  if (!projectId || !projectSecret) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║  Photon Spectrum — Not Configured                ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  To enable iMessage + WhatsApp:                   ║');
    console.log('║                                                   ║');
    console.log('║  1. Sign up at https://app.photon.codes           ║');
    console.log('║  2. Create a project → get ID + Secret           ║');
    console.log('║  3. Add to .env:                                  ║');
    console.log('║     PHOTON_PROJECT_ID=your_id                     ║');
    console.log('║     PHOTON_PROJECT_SECRET=your_secret             ║');
    console.log('║                                                   ║');
    console.log('║  Telegram bot continues running at @fourcasterbot ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    return;
  }

  console.log('[Spectrum] Starting Fourcast agent...');

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [
      imessage.config(),
      whatsapp.config(),
      terminal.config(),
    ],
  });

  console.log('[Spectrum] Agent running on iMessage + WhatsApp + Terminal');
  console.log(`[Spectrum] App URL: ${APP_URL}`);

  // Handle messages from any platform
  for await (const [space, message] of app.messages) {
    if (message.content.type === 'text') {
      const text = message.content.text.trim();
      const platform = message.platform || 'unknown';
      const senderId = message.sender?.id || 'unknown';
      console.log(`[Spectrum:${platform}] ${senderId}: ${text.slice(0, 100)}`);

      // Convert Spectrum message to a format handleTelegramUpdate can process
      const fakeUpdate = {
        message: {
          chat: { id: `${platform}:${senderId}` },
          from: {
            id: senderId,
            first_name: message.sender?.name || 'User',
          },
          text,
          message_id: Date.now(),
        },
      };

      // Send typing indicator
      await space.responding(async () => {
        await handleTelegramUpdate(fakeUpdate);
        // Note: handleTelegramUpdate uses sendMessage which posts to Telegram API.
        // For Spectrum, we need to instead use space.send().
        // This is a stub — real integration requires adapting the response path.
      });
    }
  }
}

main().catch((err) => {
  console.error('[Spectrum] Fatal error:', err);
  process.exit(1);
});
