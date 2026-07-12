import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '@/services/notificationService.js';

export const runtime = 'nodejs';

// GET — list notifications or unread count
//   ?address=0x...              → list notifications (newest first)
//   ?address=0x...&type=unread  → just the unread count
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!address) {
      return Response.json(
        { success: false, error: 'address is required' },
        { status: 400 }
      );
    }

    if (type === 'unread') {
      const result = await getUnreadCount(address);
      return Response.json(result);
    }

    const result = await getNotifications(address, limit, offset);
    return Response.json(result);
  } catch (error) {
    console.error('[API/Notifications] GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — mark notification(s) as read
//   { id: "..." }             → mark one as read
//   { address: "...", all: true } → mark all as read
export async function PATCH(request) {
  try {
    const body = await request.json();

    if (body.all && body.address) {
      const result = await markAllAsRead(body.address);
      return Response.json(result);
    }

    if (body.id) {
      const result = await markAsRead(body.id);
      return Response.json(result);
    }

    return Response.json(
      { success: false, error: 'Provide { id } or { address, all: true }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API/Notifications] PATCH error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
