/**
 * canton-package-fetch.mjs — READ-ONLY package discovery.
 *
 * Downloads all packages the participant knows about (GET /v2/packages/{id},
 * application/octet-stream protobuf dalfs) and identifies which ones carry the
 * CIP-56 token-standard modules — by scanning for the interned ASCII strings
 * ("Splice", "HoldingV1", etc.) embedded in every dalf.
 *
 * Output: /tmp/network-dalfs/<packageId>.dalf for every CIP-56-ish package,
 *         plus a mapping printed to stdout.
 *
 * Usage: node scripts/canton-package-fetch.mjs
 * Read-only: GET requests only.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.CANTON_JSON_API_URL.replace(/\/$/, '');
const MOD_MARKERS = ['Splice', 'Holding', 'Allocation', 'TransferInstruction', 'Token', 'Metadata'];
const PKG_MARKER = 'splice-';

async function getToken() {
  const p = new URLSearchParams();
  p.set('grant_type', 'password');
  p.set('client_id', process.env.CANTON_OIDC_CLIENT_ID);
  p.set('username', process.env.CANTON_OIDC_USERNAME);
  p.set('password', process.env.CANTON_OIDC_PASSWORD);
  p.set('scope', process.env.CANTON_OIDC_SCOPE || 'openid daml_ledger_api offline_access');
  if (process.env.CANTON_OIDC_AUDIENCE) p.set('audience', process.env.CANTON_OIDC_AUDIENCE);
  const r = await fetch(process.env.CANTON_OIDC_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token fetch failed: ${j.error_description || j.error}`);
  return j.access_token;
}

// Extract printable-ASCII runs (length >= 5) from a protobuf blob.
function strings(buf) {
  const out = [];
  let cur = [];
  for (const b of buf) {
    if (b >= 0x20 && b <= 0x7e) cur.push(b);
    else { if (cur.length >= 5) out.push(Buffer.from(cur).toString('latin1')); cur = []; }
  }
  if (cur.length >= 5) out.push(Buffer.from(cur).toString('latin1'));
  return out;
}

const token = await getToken();
const { packageIds } = await (await fetch(`${base}/v2/packages`, {
  headers: { Authorization: `Bearer ${token}` },
})).json();
console.log(`Scanning ${packageIds.length} packages for CIP-56 token-standard modules…`);

mkdirSync('/tmp/network-dalfs', { recursive: true });
const hits = [];
let done = 0;

async function scan(id) {
  const r = await fetch(`${base}/v2/packages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return;
  const buf = Buffer.from(await r.arrayBuffer());
  const strs = strings(buf);
  const pkgNames = strs.filter((s) => /^splice-[a-z0-9-]+$/i.test(s));
  const sliceMods = strs.filter((s) => MOD_MARKERS.some((m) => s.includes(m)) && strs.some((x) => x === 'Splice'));
  if (pkgNames.length || (strs.includes('Splice') && sliceMods.length)) {
    writeFileSync(`/tmp/network-dalfs/${id}.dalf`, buf);
    const modules = strs.filter((s) => /^(HoldingV1|HoldingV2|AllocationV1|AllocationV2|AllocationInstructionV1|AllocationInstructionV2|AllocationRequestV1|AllocationRequestV2|TransferInstructionV1|TransferInstructionV2|MetadataV1|TransferEventsV2)$/.test(s));
    hits.push({ id, size: buf.length, pkgNames: [...new Set(pkgNames)], modules: [...new Set(modules)] });
  }
  if (++done % 25 === 0) console.log(`  …${done}/${packageIds.length}`);
}

// modest concurrency
const CHUNK = 8;
for (let i = 0; i < packageIds.length; i += CHUNK) {
  await Promise.all(packageIds.slice(i, i + CHUNK).map(scan));
}

console.log(`\n=== ${hits.length} token-standard-ish package(s) on DevNet ===\n`);
for (const h of hits.sort((a, b) => (a.pkgNames[0] || '').localeCompare(b.pkgNames[0] || ''))) {
  console.log(`${h.pkgNames[0] || '(unnamed)'}`);
  console.log(`  id:      ${h.id}`);
  console.log(`  modules: ${h.modules.join(', ') || '—'}  (${h.size} bytes, saved /tmp/network-dalfs/${h.id}.dalf)`);
}
