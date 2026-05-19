/**
 * Spectrum Multi-Platform Agent
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
  console.log(`[Spectrum] Loaded env from ${envPath}`);
  console.log(`[Spectrum] PHOTON_PROJECT_ID: ${!!process.env.PHOTON_PROJECT_ID}`);
  console.log(`[Spectrum] PHOTON_PROJECT_SECRET: ${!!process.env.PHOTON_PROJECT_SECRET}`);
} catch (err) {
  console.log(`[Spectrum] Cannot load env: ${err.message}`);
  console.log(`[Spectrum] Try path: ${envPath}`);
}

const projectId = process.env.PHOTON_PROJECT_ID;
const projectSecret = process.env.PHOTON_PROJECT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

if (!projectId || !projectSecret) {
  console.log('[Spectrum] PHOTON_PROJECT_ID or PHOTON_PROJECT_SECRET not set');
  console.log('[Spectrum] Exiting — Telegram bot continues at @fourcasterbot');
  process.exit(0);
}

const { Spectrum } = await import('spectrum-ts');
const { imessage } = await import('spectrum-ts/providers/imessage');
const { terminal } = await import('spectrum-ts/providers/terminal');
const { handleTelegramUpdate } = await import('../services/telegramBot.js');

const app = await Spectrum({
  projectId,
  projectSecret,
  providers: [imessage.config(), terminal.config()],
});

console.log(`[Spectrum] Running on iMessage + Terminal | ${APP_URL}`);

for await (const [space, message] of app.messages) {
  if (message.content.type === 'text') {
    const text = message.content.text.trim();
    const platform = message.platform || 'unknown';
    console.log(`[Spectrum:${platform}] ${text.slice(0, 100)}`);

    const fakeUpdate = {
      message: {
        chat: { id: `${platform}:${message.sender?.id}` },
        from: { id: message.sender?.id, first_name: message.sender?.name || 'User' },
        text,
        message_id: Date.now(),
      },
    };

    await space.responding(async () => {
      await handleTelegramUpdate(fakeUpdate);
    });
  }
}
