import { createLinkCode, getLinkStatus, unlinkTelegram } from '@/services/telegramLinkService.js';
import { requireWalletAuth } from '@/services/walletAuth.js';

export const runtime = 'nodejs';

// GET — is this wallet linked to a Telegram chat? (auth required)
//   ?address=0x...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const address = searchParams.get('address')?.toLowerCase();
    if (!address) {
      return Response.json({ success: false, error: 'address is required' }, { status: 400 });
    }

    const denied = await requireWalletAuth(request, address);
    if (denied) return denied;

    return Response.json(await getLinkStatus(address));
  } catch (error) {
    console.error('[API/Notifications/Telegram] GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — generate a one-time deep-link code for this wallet (auth required)
//   { address }
export async function POST(request) {
  try {
    const body = await request.json();
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const address = body.address?.toLowerCase();
    if (!address) {
      return Response.json({ success: false, error: 'address is required' }, { status: 400 });
    }

    const denied = await requireWalletAuth(request, address);
    if (denied) return denied;

    return Response.json(await createLinkCode(address));
  } catch (error) {
    console.error('[API/Notifications/Telegram] POST error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — unlink this wallet's Telegram chat (auth required)
//   { address }
export async function DELETE(request) {
  try {
    const body = await request.json();
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const address = body.address?.toLowerCase();
    if (!address) {
      return Response.json({ success: false, error: 'address is required' }, { status: 400 });
    }

    const denied = await requireWalletAuth(request, address);
    if (denied) return denied;

    return Response.json(await unlinkTelegram(address));
  } catch (error) {
    console.error('[API/Notifications/Telegram] DELETE error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
