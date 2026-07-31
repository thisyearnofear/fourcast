import { redirect } from 'next/navigation';

// /canton has been unified into Proof Theatre (/proof). The Canton
// atomic-settlement proof now lives at /proof?chain=canton, beside its
// Solana peer — one chain-agnostic audit trail instead of a chain-named
// product route. The operator console (create/resolve/settle) moved to /labs.
export default function CantonRedirect() {
  redirect('/proof?chain=canton');
}
