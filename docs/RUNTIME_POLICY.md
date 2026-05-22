# Runtime Policy

Fourcast uses Next.js runtime configurations to optimize for performance and compatibility. This document defines the rules for choosing between Edge and Node runtimes.

## Quick Reference

| Runtime | Use When | Avoid When |
|---------|----------|------------|
| `edge` | Read-only JSON responses, simple transformations, lightweight I/O | DB writes, large SDKs, WASM, native bindings |
| `nodejs` | DB writes, `@vercel/og`, SDKs with native bindings, streaming | Simple read-only endpoints |

## Rules

### ✅ Use Edge Runtime (`export const runtime = 'edge'`)

- Returning read-only JSON from external APIs
- Lightweight data transformation/processing
- Simple authentication checks (JWT verification)
- Rate limiting middleware
- A/B testing assignments
- Geolocation-based routing

### ❌ Use Node.js Runtime (`export const runtime = 'nodejs'`)

- **Database operations**: Any read/write to Turso/SQLite
- **Large SDKs**: 
  - `@vercel/og` (image generation)
  - `@polymarket/clob-client`
  - `better-sqlite3`
  - `@aptos-labs/ts-sdk`
  - `ethers` v6
- **WASM modules**: Any module loading WebAssembly
- **Native bindings**: Modules compiled as native addons
- **Streaming responses**: SSE with complex backends
- **File system access**: Reading/writing local files
- **Child processes**: `spawn`, `exec`, `fork`

## Enforcement

### ESLint Rule

Every API route file (`app/api/**/route.{js,ts}`) MUST declare its runtime:

```javascript
// ✅ Correct
export const runtime = 'edge';

export async function GET(request) {
  return Response.json({ ok: true });
}
```

```javascript
// ❌ Incorrect - will fail CI
export async function GET(request) {
  return Response.json({ ok: true });
}
```

### CI Bundle Size Budget

| Route Type | Warn At | Fail At |
|------------|---------|---------|
| Edge routes | 750 KB | 900 KB |
| Node routes | No limit | No limit |

## Adding New Routes

When creating a new API route:

1. **Choose runtime first** based on the rules above
2. **Add explicit declaration** at the top of the file
3. **Document if uncertain** - add a comment explaining why you chose that runtime

## Common Patterns

### Edge-compatible fetch wrapper
```javascript
export const runtime = 'edge';

export async function GET(request) {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }
  }).then(r => r.json());
  
  return Response.json(data);
}
```

### Node.js for database access
```javascript
export const runtime = 'nodejs';

import { getUserPositions } from '@/services/db';

export async function GET(request) {
  const address = request.headers.get('x-user-address');
  const positions = await getUserPositions(address);
  
  return Response.json(positions);
}
```

## Migration Guide

To convert an Edge route to Node.js (or vice versa):

1. Change `export const runtime = 'edge'` to `'nodejs'` (or remove for default)
2. Update any incompatible dependencies
3. Test locally with `npm run dev`
4. Verify bundle size with `npm run build`

## Exceptions

If you need an exception to this policy, document it in the route file:

```javascript
// Exception: Using Node runtime for streaming SSE
// Rationale: Complex backpressure handling requires Node streams
export const runtime = 'nodejs';
```