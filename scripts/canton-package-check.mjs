/**
 * canton-package-check.mjs — READ-ONLY diagnostic.
 *
 * Answers: do the CIP-56 interface package IDs that fourcast-2.0.0.dar was built
 * against already exist on the NODERS DevNet participant? If yes, the v2 DAR
 * interoperates with whatever implements them (incl. cBTC/cETH). If no, the
 * network runs different interface builds and we must rebuild against theirs.
 *
 * Usage: node scripts/canton-package-check.mjs
 * Only performs GET /v2/packages (and prints shapes). Never submits commands.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LEDGER_API_URL = (process.env.CANTON_JSON_API_URL || '').replace(/\/$/, '');
const TOKEN_URL = process.env.CANTON_OIDC_TOKEN_URL || '';
const CLIENT_ID = process.env.CANTON_OIDC_CLIENT_ID || '';
const USERNAME = process.env.CANTON_OIDC_USERNAME || '';
const PASSWORD = process.env.CANTON_OIDC_PASSWORD || '';
const AUDIENCE = process.env.CANTON_OIDC_AUDIENCE || '';
const SCOPE = process.env.CANTON_OIDC_SCOPE || 'openid daml_ledger_api offline_access';

// Package IDs our fourcast-2.0.0.dar references — the NETWORK's vetted CIP-56
// interface builds (vendor/network-cip-0056/manifest.json). After the rebuild,
// ALL of these must be PRESENT on the DevNet.
const MINE = {
  'metadata-v1':               '4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f',
  'holding-v1':                '718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b',
  'transfer-instruction-v1':   '55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281',
  'allocation-v1':             '93c942ae2b4c2ba674fb152fe38473c507bda4e82b4e4c5da55a552a9d8cce1d',
  'allocation-instruction-v1': '275064aacfe99cea72ee0c80563936129563776f67415ef9f13e4297eecbc520',
  'allocation-request-v1':     '6fe848530b2404017c4a12874c956ad7d5c8a419ee9b040f96b5c13172d2e193',
  'fourcast-2.0.0 (main)':       '550828d219effd88bc03fadd856403ab42795e33c185cbea4ff2e055a2ed930a',
};
const V1_MAIN = '1fdf1b33676d9025e48da98baece72818feee5e0efaf60b4788daa547560b784'; // from docs/CANTON.md

function missing(name, v) { if (!v) { console.error(`MISSING ENV: ${name}`); process.exit(2); } }
missing('CANTON_JSON_API_URL', LEDGER_API_URL);
missing('CANTON_OIDC_TOKEN_URL', TOKEN_URL);
missing('CANTON_OIDC_CLIENT_ID', CLIENT_ID);
missing('CANTON_OIDC_USERNAME', USERNAME);
missing('CANTON_OIDC_PASSWORD', PASSWORD);

async function getToken() {
  const params = new URLSearchParams();
  params.set('grant_type', 'password');
  params.set('client_id', CLIENT_ID);
  params.set('username', USERNAME);
  params.set('password', PASSWORD);
  params.set('scope', SCOPE);
  if (AUDIENCE) params.set('audience', AUDIENCE);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OIDC token fetch failed: ${data.error_description || data.error || res.statusText}`);
  }
  return data.access_token;
}

// Pull every 64-hex package id out of whatever shape the API returns.
function extractIds(json) {
  const ids = new Set();
  const walk = (x) => {
    if (typeof x === 'string') { if (/^[0-9a-f]{64}$/.test(x)) ids.add(x); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x && typeof x === 'object') { Object.values(x).forEach(walk); }
  };
  walk(json);
  return [...ids];
}

const token = await getToken();
console.log(`Authenticated to ${LEDGER_API_URL} (token len ${token.length}, redacted)\n`);

const res = await fetch(`${LEDGER_API_URL}/v2/packages`, {
  headers: { Authorization: `Bearer ${token}` },
});
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch { json = text; }

if (!res.ok) {
  console.error(`GET /v2/packages -> HTTP ${res.status}`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

console.log('Response top-level keys:', Array.isArray(json) ? '(array)' : Object.keys(json));
const onLedger = extractIds(json);
console.log(`Packages known to participant: ${onLedger.length}\n`);
const have = new Set(onLedger);

console.log('=== Our interface package IDs vs the DevNet ===');
let allPresent = true;
for (const [name, id] of Object.entries(MINE)) {
  const present = have.has(id);
  if (name !== 'fourcast-2.0.0 (main)' && !present) allPresent = false;
  console.log(`  [${present ? 'PRESENT' : 'absent '}] ${name.padEnd(28)} ${id.slice(0, 12)}…`);
}
console.log(`  [${have.has(V1_MAIN) ? 'PRESENT' : 'absent '}] v1 canton main (sanity)      ${V1_MAIN.slice(0, 12)}…`);
const envPkg = process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID || '';
if (envPkg) console.log(`  [${have.has(envPkg) ? 'PRESENT' : 'absent '}] NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID ${envPkg.slice(0, 12)}…`);

console.log('\n=== VERDICT ===');
if (allPresent) {
  console.log('MATCH: all six CIP-56 interface package IDs we built against are already');
  console.log('vetted on the DevNet. fourcast-2.0.0.dar should interoperate with the real');
  console.log('cBTC/cETH registries (they implement these same interface IDs).');
} else {
  console.log('MISMATCH: the DevNet runs different builds of one or more CIP-56 interface');
  console.log('packages. fourcast-2.0.0.dar will upload and its reference-registry demo will');
  console.log('run, but it will NOT execute real cBTC/cETH allocations until rebuilt against');
  console.log('the network\'s interface DARs. Next step: download the network packages and');
  console.log('identify theirs (scripts/canton-package-fetch.mjs).');
}
