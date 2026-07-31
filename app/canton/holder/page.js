import { redirect } from 'next/navigation';

// /canton/holder dissolved into /positions as the "Private (Canton)" view —
// all of a user's positions (public Arc + private Canton) in one diligence
// surface, the chain a property not a page. The stale "dispute unsettled
// obligations" framing is gone: v2 atomic settlement removed obligations.
export default function CantonHolderRedirect() {
  redirect('/positions?view=private');
}
