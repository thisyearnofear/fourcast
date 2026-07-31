/**
 * canton-package-analyze.mjs — READ-ONLY dependency-graph analysis.
 *
 * For every package the participant knows:
 *   - download its dalf (once, cached under /tmp/network-dalfs-all/)
 *   - record byte size
 *   - extract embedded 64-hex strings (= its data-dependency package IDs)
 *   - record token-standard markers (substring matches for splice-api-token-*
 *     names and the CIP-56 module names)
 *
 * Then rank packages by IN-DEGREE (how many other packages depend on them).
 * The CIP-56 *interface definition* packages are: (a) small, (b) referenced by
 * almost every splice package on the network, (c) containing the module names.
 *
 * Usage: node scripts/canton-package-analyze.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const base = process.env.CANTON_JSON_API_URL.replace(/\/$/, '');
const DIR = '/tmp/network-dalfs-all';
const TS_MODULES = ['HoldingV1','HoldingV2','AllocationV1','AllocationV2','AllocationInstructionV1','AllocationInstructionV2','AllocationRequestV1','AllocationRequestV2','TransferInstructionV1','TransferInstructionV2','MetadataV1'];

async function getToken() {
  const p = new URLSearchParams();
  p.set('grant_type', 'password');
  p.set('client_id', process.env.CANTON_OIDC_CLIENT_ID);
  p.set('username', process.env.CANTON_OIDC_USERNAME);
  p.set('password', process.env.CANTON_OIDC_PASSWORD);
  p.set('scope', process.env.CANTON_OIDC_SCOPE || 'openid daml_ledger_api offline_access');
  if (process.env.CANTON_OIDC_AUDIENCE) p.set('audience', process.env.CANTON_OIDC_AUDIENCE);
  const r = await fetch(process.env.CANTON_OIDC_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token fetch failed');
  return j.access_token;
}

function hexStrings(buf) {
  const out = new Set();
  let run = [];
  for (const b of buf) {
    const isHex = (b >= 0x30 && b <= 0x39) || (b >= 0x61 && b <= 0x66);
    if (isHex) run.push(b);
    else {
      if (run.length === 64) out.add(Buffer.from(run).toString('latin1'));
      run = [];
    }
  }
  if (run.length === 64) out.add(Buffer.from(run).toString('latin1'));
  return out;
}

function asciiRuns(buf, min = 5) {
  const out = [];
  let cur = [];
  for (const b of buf) {
    if (b >= 0x20 && b <= 0x7e) cur.push(b);
    else { if (cur.length >= min) out.push(Buffer.from(cur).toString('latin1')); cur = []; }
  }
  if (cur.length >= min) out.push(Buffer.from(cur).toString('latin1'));
  return out;
}

const token = await getToken();
const { packageIds } = await (await fetch(`${base}/v2/packages`, { headers: { Authorization: `Bearer ${token}` } })).json();
mkdirSync(DIR, { recursive: true });
console.log(`Analyzing ${packageIds.length} packages…`);

const meta = new Map(); // id -> {size, deps:Set, tsModules:Set, names:Set}
async function get(id) {
  const path = `${DIR}/${id}.dalf`;
  let buf;
  if (existsSync(path)) buf = readFileSync(path);
  else {
    const r = await fetch(`${base}/v2/packages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`GET ${id} -> ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(path, buf);
  }
  const strs = asciiRuns(buf);
  const deps = hexStrings(buf);
  deps.delete(id); // self-reference (own id appears in metadata)
  const tsModules = new Set();
  const names = new Set();
  for (const s of strs) {
    if (TS_MODULES.includes(s)) tsModules.add(s);
    if (s.includes('splice-api-token')) names.add(s.length > 60 ? s.slice(0, 60) + '…' : s);
  }
  meta.set(id, { size: buf.length, deps, tsModules, names });
}

let done = 0;
const CHUNK = 8;
for (let i = 0; i < packageIds.length; i += CHUNK) {
  await Promise.all(packageIds.slice(i, i + CHUNK).map(get));
  done += Math.min(CHUNK, packageIds.length - i);
  if (done % 32 === 0) console.log(`  …${done}/${packageIds.length}`);
}

// in-degree: how many packages reference each id
const inDegree = new Map();
for (const [, m] of meta) for (const d of m.deps) inDegree.set(d, (inDegree.get(d) || 0) + 1);

// candidates: contain at least one TS module name AND size < 150KB
const cands = [...meta.entries()]
  .filter(([, m]) => m.tsModules.size > 0 && m.size < 150_000)
  .map(([id, m]) => ({ id, size: m.size, inDegree: inDegree.get(id) || 0, tsModules: [...m.tsModules], names: [...m.names] }))
  .sort((a, b) => b.inDegree - a.inDegree);

console.log(`\n=== small packages containing CIP-56 module names, by in-degree ===`);
for (const c of cands.slice(0, 30)) {
  console.log(`  in-deg ${String(c.inDegree).padStart(3)}  ${(c.size / 1024).toFixed(1).padStart(7)}KB  ${c.id.slice(0, 16)}…`);
  console.log(`          mods: ${c.tsModules.join(',')}${c.names.length ? '  names: ' + c.names.join(' | ') : ''}`);
}

// The 6 interface packages to rebuild against: for each TS V1 module family,
// the highest-in-degree (prefer V1 over V2 per module type) candidate.
const wanted = ['MetadataV1','HoldingV1','TransferInstructionV1','AllocationV1','AllocationInstructionV1','AllocationRequestV1'];
console.log('\n=== proposed interface package for each CIP-56 V1 module ===');
for (const w of wanted) {
  const pick = cands.find((c) => c.tsModules.includes(w));
  if (pick) console.log(`  ${w.padEnd(28)} ${pick.id}  (in-deg ${pick.inDegree}, ${(pick.size/1024).toFixed(1)}KB)`);
  else console.log(`  ${w.padEnd(28)} NOT FOUND`);
}
