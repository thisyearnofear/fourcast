/**
 * Browser- and server-safe canonical JSON serialization for decision receipts.
 * Hashing lives in the Node-only receipt module; this stays pure so a browser
 * can independently recompute the exact same receipt payload.
 */
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
