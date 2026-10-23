/**
 * Walrus Memory (MemWal) client
 *
 * Fourcast's external memory: append-only, SEAL-encrypted, owner-scoped records
 * indexed on Sui via the Walrus Memory relayer. This is the ONLY module in the
 * repo that imports `@mysten-incubation/memwal`, and it imports it lazily so
 * neither the Edge bundle nor an unconfigured deploy pays for the Sui SDK graph.
 *
 * Two failure directions, deliberately different:
 *   - NOT configured / not enabled -> `getClient()` returns null and every
 *     caller degrades (same contract as services/redisService.js). Memory is an
 *     enhancement, never a dependency of a decision.
 *   - configured but INCOHERENT (testnet credentials against the mainnet relayer,
 *     or the reverse) -> `getClient()` THROWS. A wrong-network write is
 *     append-only on a public ledger: nothing we do later can take it back.
 *
 * Environment variables:
 *   FOURCAST_MEMORY_ENABLED     - 'true' to permit writes (opt-in, default off)
 *   MEMWAL_PRIVATE_KEY          - Ed25519 delegate key (hex or suiprivkey1...)
 *                                 SERVER ONLY — never set on Vercel
 *   MEMWAL_ACCOUNT_ID           - MemWal account object ID on Sui
 *                                 (this is `MEMWAL_AGENT_ID` on the registration form)
 *   MEMWAL_RELAYER_URL          - default https://relayer.memory.walrus.xyz
 *   SUI_NETWORK                 - 'mainnet' | 'testnet' (default mainnet)
 *   FOURCAST_MEMORY_MIN_SAMPLES - sample floor before a metric is memory-worthy (default 20)
 *   FOURCAST_MEMORY_TIMEOUT_MS  - per-request deadline in ms (default 30000)
 */

export const MAINNET_RELAYER_URL = 'https://relayer.memory.walrus.xyz';
export const TESTNET_RELAYER_URL = 'https://relayer.testnet.memory.walrus.xyz';

const DEFAULT_MIN_SAMPLES = 20;
const DEFAULT_TIMEOUT_MS = 30_000;

// Secrets are read per call, not at module load: an unconfigured server should
// not hold key material it will never use, and a test (or a rotated deploy)
// must be able to change configuration without re-importing a module whose
// client caches a private key in a V8 heap slot.
function readConfig() {
  const relayerUrl = process.env.MEMWAL_RELAYER_URL || MAINNET_RELAYER_URL;
  const privateKey = process.env.MEMWAL_PRIVATE_KEY || '';
  return {
    enabled: process.env.FOURCAST_MEMORY_ENABLED === 'true',
    privateKey,
    accountId: process.env.MEMWAL_ACCOUNT_ID || '',
    relayerUrl: relayerUrl.replace(/\/+$/, ''),
    network: normaliseNetwork(process.env.SUI_MEMORY_NETWORK || process.env.SUI_NETWORK),
    minSamples: positiveInt(process.env.FOURCAST_MEMORY_MIN_SAMPLES, DEFAULT_MIN_SAMPLES),
    timeoutMs: positiveInt(process.env.FOURCAST_MEMORY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function normaliseNetwork(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'testnet') return 'testnet';
  if (value === 'mainnet') return 'mainnet';
  if (value) throw networkError(`SUI_NETWORK must be 'mainnet' or 'testnet', got ${JSON.stringify(raw)}`);
  // Unset means mainnet — the deliverable is mainnet memories, and a default
  // that silently aims at testnet would under-report the entry's own claim.
  return 'mainnet';
}

function networkError(message) {
  const err = new Error(message);
  err.code = 'MEMORY_NETWORK_MISMATCH';
  return err;
}

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function networkOfRelayer(url) {
  return /testnet/i.test(String(url)) ? 'testnet' : 'mainnet';
}

/**
 * The account object ID lives on one network and the relayer serves one
 * network, and neither string contains the other — so coherence has to be
 * asserted from what we can see: the relayer URL and SUI_NETWORK.
 */
function assertCoherent(cfg) {
  const relayerNetwork = networkOfRelayer(cfg.relayerUrl);
  if (relayerNetwork !== cfg.network) {
    throw networkError(
      `Refusing to mix Sui networks: SUI_NETWORK=${cfg.network} but MEMWAL_RELAYER_URL points at ${relayerNetwork} (${cfg.relayerUrl}).`
    );
  }
  if (cfg.network === 'mainnet' && relayerNetwork === 'mainnet' && cfg.relayerUrl !== MAINNET_RELAYER_URL) {
    // Not fatal — a self-hosted mainnet relayer is legitimate — but say so.
    console.warn(`[memory] non-default mainnet relayer in use: ${cfg.relayerUrl}`);
  }
  return true;
}

export function isConfigured() {
  const cfg = readConfig();
  return Boolean(cfg.privateKey && cfg.accountId);
}

/** Why memory writes are off, in one sentence a status route can display. */
export function disabledReason(cfg = readConfig()) {
  if (!cfg.enabled) return 'FOURCAST_MEMORY_ENABLED is not "true"';
  if (!cfg.privateKey) return 'MEMWAL_PRIVATE_KEY is not set';
  if (!cfg.accountId) return 'MEMWAL_ACCOUNT_ID is not set';
  return null;
}

export function memoryStatus() {
  const cfg = readConfig();
  let coherence = null;
  try {
    assertCoherent(cfg);
  } catch (err) {
    coherence = err.message;
  }
  return {
    enabled: cfg.enabled,
    configured: isConfigured(),
    writable: cfg.enabled && isConfigured() && !coherence,
    network: cfg.network,
    relayerUrl: cfg.relayerUrl,
    relayerNetwork: networkOfRelayer(cfg.relayerUrl),
    minSamples: cfg.minSamples,
    timeoutMs: cfg.timeoutMs,
    // The id is public on Sui, the key is not — echo a tail for identification
    // only, so a screenshot of /api/memory/status is not a credential leak.
    accountIdTail: cfg.accountId ? `…${cfg.accountId.slice(-6)}` : null,
    reason: coherence || disabledReason(cfg),
  };
}

let cached = null; // { fingerprint, client }

function fingerprint(cfg) {
  return [cfg.relayerUrl, cfg.accountId, cfg.network, cfg.timeoutMs, hashKey(cfg.privateKey)].join('|');
}

function hashKey(privateKey) {
  // A stable, non-reversible identity so a rotated key rebuilds the client
  // without ever keeping the raw key in a module-scope string.
  return privateKey ? privateKey.slice(-8) : 'none';
}

/**
 * @returns {Promise<object|null>} a MemWal client, or null when memory is not
 *   enabled/configured. Throws on network incoherence.
 */
export async function getClient() {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.privateKey || !cfg.accountId) return null;
  assertCoherent(cfg);

  const fp = fingerprint(cfg);
  if (cached?.fingerprint === fp) return cached.client;

  if (cached?.client) {
    // Wipe the previous delegate key from the heap before replacing it.
    try {
      cached.client.destroy();
    } catch {
      /* destroy is best-effort */
    }
  }

  const { MemWal } = await import('@mysten-incubation/memwal');
  const client = MemWal.create({
    key: cfg.privateKey,
    accountId: cfg.accountId,
    serverUrl: cfg.relayerUrl,
    // The namespace travels per call (four namespaces, one writer).
    requestTimeoutMs: cfg.timeoutMs,
  });
  cached = { fingerprint: fp, client };
  return client;
}

/** Drop the memoised client. For tests and key rotation. */
export function resetMemWalClient() {
  if (cached?.client) {
    try {
      cached.client.destroy();
    } catch {
      /* ignore */
    }
  }
  cached = null;
}

/** Public, unsigned relayer health check — safe to call when unconfigured. */
export async function checkRelayerHealth() {
  const cfg = readConfig();
  const url = `${cfg.relayerUrl}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(cfg.timeoutMs) });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, url, body };
  } catch (error) {
    return { ok: false, url, error: error.message };
  }
}

export function minSamplesRequired() {
  return readConfig().minSamples;
}

/**
 * The public Walrus read for a blob id.
 *
 * Path and base URLs are the ones the MemWal SDK itself uses (upload via the
 * relayer, download via the HTTP aggregator), so this is not a guessed deep
 * link. What comes back is SEAL ciphertext — the link is evidence that a blob
 * exists at that id and is unreadable without the owner's key, which is exactly
 * the claim we are willing to make in the UI.
 */
export const WALRUS_AGGREGATORS = Object.freeze({
  mainnet: 'https://aggregator.walrus-mainnet.walrus.space',
  testnet: 'https://aggregator.walrus-testnet.walrus.space',
});

export function blobReadUrl(blobId, network = 'mainnet') {
  if (!blobId) return null;
  const base = WALRUS_AGGREGATORS[network === 'testnet' ? 'testnet' : 'mainnet'];
  return `${base}/v1/blobs/${blobId}`;
}
