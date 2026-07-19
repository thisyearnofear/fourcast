import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, getFollowerCount } from '@/services/followService.js';
import { requireWalletAuth } from '@/services/walletAuth.js';

export const runtime = 'nodejs';

// POST — follow an analyst (requires wallet-signature auth as the follower)
export async function POST(request) {
  try {
    const body = await request.json();
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const followerAddress = body.followerAddress?.toLowerCase();
    const followingAddress = body.followingAddress?.toLowerCase();

    if (!followerAddress || !followingAddress) {
      return Response.json(
        { success: false, error: 'followerAddress and followingAddress are required' },
        { status: 400 }
      );
    }

    const denied = await requireWalletAuth(request, followerAddress);
    if (denied) return denied;

    const result = await followUser(followerAddress, followingAddress);
    if (!result.success) {
      return Response.json(result, { status: 400 });
    }
    return Response.json(result);
  } catch (error) {
    console.error('[API/Follow] POST error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — unfollow an analyst (requires wallet-signature auth as the follower)
export async function DELETE(request) {
  try {
    const body = await request.json();
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const followerAddress = body.followerAddress?.toLowerCase();
    const followingAddress = body.followingAddress?.toLowerCase();

    if (!followerAddress || !followingAddress) {
      return Response.json(
        { success: false, error: 'followerAddress and followingAddress are required' },
        { status: 400 }
      );
    }

    const denied = await requireWalletAuth(request, followerAddress);
    if (denied) return denied;

    const result = await unfollowUser(followerAddress, followingAddress);
    if (!result.success) {
      return Response.json(result, { status: 400 });
    }
    return Response.json(result);
  } catch (error) {
    console.error('[API/Follow] DELETE error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET — check follow status, list followers, or list following
//   ?follower=0x...&following=0x...  → isFollowing check
//   ?address=0x...&type=followers     → list followers
//   ?address=0x...&type=following     → list following
//   ?address=0x...&type=count         → follower count
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // Canonicalize to lowercase — mirrors services/db.js on insert.
    const follower = searchParams.get('follower')?.toLowerCase();
    const following = searchParams.get('following')?.toLowerCase();
    const address = searchParams.get('address')?.toLowerCase();
    const type = searchParams.get('type') || 'followers';

    // Follow-status check
    if (follower && following) {
      const result = await isFollowing(follower, following);
      return Response.json(result);
    }

    // Per-address queries
    if (address) {
      if (type === 'following') {
        const result = await getFollowing(address);
        return Response.json(result);
      } else if (type === 'count') {
        const result = await getFollowerCount(address);
        return Response.json(result);
      } else {
        const result = await getFollowers(address);
        return Response.json(result);
      }
    }

    return Response.json(
      { success: false, error: 'Provide ?follower=&following= for status check, or ?address=&type=followers|following|count' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API/Follow] GET error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
