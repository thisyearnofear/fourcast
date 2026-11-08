'use client';

/**
 * requestWallet — ask the header wallet panel to open with a specific rail
 * spotlighted. Any surface that hits a "connect X first" dead-end calls this
 * instead of just showing an error: the panel opens and marks that chain
 * "required for this action".
 */
export function requestWallet(chain) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fc:wallet-needed', { detail: { chain } }));
}
