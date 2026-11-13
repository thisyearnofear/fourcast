const KEY = 'fourcast:client';

export function getClientId() {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(KEY, next);
    return next;
  } catch {
    return null;
  }
}
