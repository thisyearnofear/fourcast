/** @vitest-environment jsdom */
/**
 * Surface contract — gates G2, G3 and G5 of the quality bar
 * (docs/EXECUTION_PLAN.md → "Surface quality bar", docs/SURFACES.md).
 *
 * WHAT THIS IS
 * A ratchet. It mounts every real surface in jsdom — inside the app's own
 * Providers, with the app's own router semantics — and collects findings:
 *
 *   G2  one <h1> per route
 *   G3  a truthful loading / empty / error state
 *   G5  an accessible name on every control, and an announced error
 *
 * The first run prints the debt. The count is then frozen as the budget
 * below, and the suite fails only when the number of findings goes UP. Fixes
 * bank permanently; the bar can only rise. When a surface is fixed, lower
 * its budget in the same commit — that is the whole point of the ratchet.
 *
 * It also checks the REGISTRY against the app: a route the registry calls a
 * surface must render, and a route the app redirects must be recorded as a
 * redirect. The registry cannot quietly become a lie.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { Providers } from '@/app/providers.js';
import { AppShell } from '@/app/components/PageNav.js';

// Next's redirect() and notFound() throw. We keep that behaviour: a stub
// that returns would let a page walk past its own missing-signal guard and
// crash on the next line, which is exactly the bug the test is here to find.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  redirect: (url) => {
    const err = new Error(`redirect:${url}`);
    err.name = 'NextRedirect';
    throw err;
  },
  notFound: () => {
    const err = new Error('notFound');
    err.name = 'NextNotFound';
    throw err;
  },
  permanentRedirect: (url) => {
    const err = new Error(`permanentRedirect:${url}`);
    err.name = 'NextRedirect';
    throw err;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}));

// ─── jsdom gaps ─────────────────────────────────────────────────────────────
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
global.ResizeObserver = global.ResizeObserver || NoopObserver;
global.IntersectionObserver = global.IntersectionObserver || NoopObserver;
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  });
}

// ─── the routes ─────────────────────────────────────────────────────────────

/** Every route that could be a surface. Which of these are real is decided
 *  by the app, not by this list — see the redirect check below. */
const ROUTES = [
  { route: '/', load: () => import('@/app/page.js') },
  { route: '/arena', load: () => import('@/app/arena/page.js') },
  { route: '/signals', load: () => import('@/app/signals/page.js') },
  { route: '/signal/[id]', load: () => import('@/app/signal/[id]/page.js'), props: { params: { id: 'no-such-signal' } } },
  { route: '/positions', load: () => import('@/app/positions/page.js') },
  { route: '/status', load: () => import('@/app/status/page.js') },
  { route: '/markets', load: () => import('@/app/markets/page.js') },
  { route: '/proof', load: () => import('@/app/proof/page.js') },
  { route: '/labs', load: () => import('@/app/labs/page.js') },
  { route: '/labs/autopilot', load: () => import('@/app/labs/autopilot/page.js') },
  { route: '/labs/builder', load: () => import('@/app/labs/builder/page.js') },
  { route: '/labs/canton', load: () => import('@/app/labs/canton/page.js') },
  { route: '/canton', load: () => import('@/app/canton/page.js') },
  { route: '/canton/holder', load: () => import('@/app/canton/holder/page.js') },
  { route: '/agent', load: () => import('@/app/agent/page.js') },
  { route: '/agent/[operatorId]', load: () => import('@/app/agent/[operatorId]/page.js'), props: { params: { operatorId: 'no-such-operator' } } },
];

/**
 * Routes that cannot be mounted here, and why. Each one is a gap in the
 * mechanical check, written down instead of hidden.
 */
const NOT_MOUNTABLE = [
  { route: '/labs/weather', reason: 'three.js scene — jsdom has no WebGL context' },
];

// ─── the app's own routing truth ────────────────────────────────────────────

/** `next.config.mjs` redirects, read as text — the app's own declaration. */
function configRedirects() {
  const file = path.join(process.cwd(), 'next.config.mjs');
  const source = fs.readFileSync(file, 'utf8');
  const routes = new Set();
  const re = /source:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(source)) !== null) routes.add(match[1]);
  return routes;
}

/** The registry's "Renders" column — so the registry is checked, not trusted. */
function registryRows() {
  const file = path.join(process.cwd(), 'docs', 'SURFACES.md');
  if (!fs.existsSync(file)) return null;
  const markdown = fs.readFileSync(file, 'utf8');

  // Only the registry table. The file also carries an audit table whose first
  // column is a route, and a route in the audit table is not a registry row.
  const start = markdown.indexOf('## The registry');
  const end = start === -1 ? -1 : markdown.indexOf('\n## ', start + 1);
  const section = start === -1
    ? markdown
    : markdown.slice(start, end === -1 ? undefined : end);

  const rows = new Map();
  for (const line of section.split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|(.*)$/);
    if (!match) continue;
    const cells = match[2].split('|').map((cell) => cell.trim());
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    rows.set(match[1], { renders: cells[0] || '' });
  }
  return rows;
}

// ─── fetch mocks ────────────────────────────────────────────────────────────

/** A payload that satisfies most surfaces with "nothing yet". */
const EMPTY = {
  success: true,
  signals: [],
  leaderboard: [],
  stats: {},
  positions: [],
  runs: [],
  decisions: [],
  executions: [],
  buckets: [],
  summary: {},
  latest: null,
  balances: null,
  providers: [],
  items: [],
  data: [],
  results: [],
  total: 0,
  count: 0,
};

function stubFetch(handler) {
  vi.stubGlobal('fetch', vi.fn(handler));
}

function jsonResponse(payload, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => payload, text: async () => JSON.stringify(payload) };
}

/**
 * The endpoints the app chrome itself calls (the status lamp, the operator
 * pulse). Every page fetches these, so they cannot be used to tell a data
 * surface from a static one. Measured, not guessed: the chrome is rendered
 * on its own and its calls are recorded.
 */
const CHROME_ENDPOINTS = new Set();
async function measureChromeEndpoints() {
  stubFetch(async () => jsonResponse(EMPTY));
  // The chrome is the AppShell (the status lamp, the operator pulse), not
  // the Providers — measure the thing that actually makes the calls.
  await act(async () => {
    render(<Providers><AppShell title="chrome probe" /></Providers>);
  });
  for (const call of global.fetch?.mock?.calls ?? []) CHROME_ENDPOINTS.add(String(call[0]));
  cleanup();
}

// ─── the checks ─────────────────────────────────────────────────────────────

/** The distinctive string every mocked failure carries. A surface must show
 *  the error it was given — not a blank, not a stale empty state. */
const ERROR_TEXT = 'mock failure 9f2a';

function collectFindings(container, { route, state, states = {}, dataSurface = true }) {
  const findings = [];
  const add = (gate, message) => findings.push({ route, state, gate, message });
  const text = (container.textContent || '').trim();

  // ── G2: exactly one <h1>
  const h1s = container.querySelectorAll('h1');
  if (h1s.length === 0) add('G2', 'no <h1>');
  if (h1s.length > 1) add('G2', `${h1s.length} <h1> elements`);

  // ── G3: a data surface must SAY something about its state
  if (!dataSurface) {
    // Not a data surface — no states to be honest about. The heading and the
    // accessible names still matter, and they are checked above and below.
  } else if (state === 'loading' && text.length === 0) {
    add('G3', 'renders nothing while the request is in flight');
  } else if (state === 'empty' && text.length === 0) {
    add('G3', 'renders nothing when the result is empty');
  } else if (state === 'error') {
    // The sharpest question a surface can be asked: if the request failed,
    // can a reader tell it apart from "there is nothing here"? If the error
    // render is the same text as the empty render, the failure never reached
    // the reader — and "did it fail, or is it just empty?" gets answered
    // wrongly, in a product whose whole claim is that it is auditable.
    const emptyText = states.empty || '';
    if (text.length === 0) {
      add('G3', 'renders nothing when the request fails');
    } else if (text === emptyText) {
      add('G3', 'the failure is indistinguishable from an empty result (same text)');
    }
  }

  // ── G5: every control needs an accessible name
  const controls = container.querySelectorAll('button, a[href], [role="button"]');
  for (const el of controls) {
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const name = (
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el.textContent || '').trim()
    ).trim();
    if (!name) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.getAttribute('class') || '').split(' ').slice(0, 2).join('.');
      add('G5', `control without an accessible name: ${tag}${cls ? `.${cls}` : ''}`);
    }
  }

  return findings;
}

// ─── the budget (frozen after the first run) ────────────────────────────────

/**
 * What each surface is allowed to still get wrong. Every number here was a
 * real finding on 21 Oct; the list of findings is printed by the test run.
 * Lower a number in the same commit that fixes the finding.
 */
const BUDGET = {
  // The surfaces that distinguish a failure from an empty result already.
  '/arena': 0,
  '/signals': 0,
  '/status': 0,
  '/proof': 0,
  '/labs/autopilot': 0,
  '/agent': 0,
  // The surfaces that render byte-identical text on failure and on empty.
  // A reader cannot tell "it failed" from "there is nothing here yet".
  '/': 1,
  '/positions': 1,
  '/markets': 1,
  '/labs': 1,
  '/labs/builder': 1,
  '/labs/canton': 1,
  '/agent/[operatorId]': 1,
};

const allFindings = [];

/**
 * Mount a route. Returns one of:
 *   { kind: 'surface', container }
 *   { kind: 'redirect' }   — the route is not a surface
 *   { kind: 'notFound' }   — the route correctly refuses a missing record
 */
async function mountRoute(definition) {
  const mod = await definition.load();
  const Page = mod.default;
  const props = { params: {}, searchParams: {}, ...(definition.props || {}) };
  const isAsync = Boolean(Page?.constructor && Page.constructor.name === 'AsyncFunction');

  // A redirect stub throws when it is CALLED, not when it is rendered — and
  // inside act() the throw is deferred, so it would slip past a try/catch
  // around render(). Call the component first, outside React, to find out
  // what it wants to do. (A client component called outside React throws an
  // "invalid hook call" instead, which is not a redirect — ignore that.)
  let ui = null;
  try {
    if (isAsync) ui = await Page(props);
    else Page(props);
  } catch (err) {
    if (err?.name === 'NextRedirect') return { kind: 'redirect' };
    if (err?.name === 'NextNotFound') return { kind: 'notFound' };
    if (isAsync) throw err;
  }

  // Mounted inside the app's real Providers, because that is how the route
  // is served: a page that only works without its providers is a page that
  // breaks the moment the chrome is added.
  const container = isAsync
    ? render(<Providers>{ui}</Providers>).container
    : render(<Providers><Page {...props} /></Providers>).container;
  return { kind: 'surface', container };
}

/**
 * Does this route redirect on its own? Some redirects live in the component
 * (`app/canton/page.js` calls `redirect('/proof?chain=canton')`) rather than
 * in next.config.mjs, and a registry that misses them is a registry that
 * sends people to audit a page nobody can reach.
 */
async function redirectsItself(definition) {
  const mod = await definition.load();
  const Page = mod.default;
  const props = { params: {}, searchParams: {}, ...(definition.props || {}) };
  const isAsync = Boolean(Page?.constructor && Page.constructor.name === 'AsyncFunction');
  try {
    if (isAsync) await Page(props);
    else Page(props);
    return false;
  } catch (err) {
    if (err?.name === 'NextRedirect') return true;
    if (err?.name === 'NextNotFound') return false;
    if (isAsync) return false;
    return false; // a client component called outside React throws a hook error
  }
}

describe('surface contract', () => {
  beforeAll(async () => {
    await measureChromeEndpoints();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  for (const definition of ROUTES) {
    // Three states × a full page mount is slow, and the whole suite runs in
    // parallel — the default 5s is not enough when the machine is busy.
    it(`${definition.route} holds its contract`, async () => {
      const findings = [];
      const kinds = new Set();
      const texts = {};

      for (const [state, handler] of [
        // Empty FIRST: the error check compares the failure render against
        // the empty render, so the empty text has to exist before it.
        ['empty', async () => jsonResponse(EMPTY)],
        ['error', async () => jsonResponse({ success: false, error: ERROR_TEXT }, false)],
        ['loading', () => new Promise(() => {})],
      ]) {
        stubFetch(handler);
        let mounted;
        await act(async () => {
          mounted = await mountRoute(definition);
        });
        kinds.add(mounted.kind);
        if (mounted.kind === 'surface') {
          texts[state] = (mounted.container.textContent || '').trim();
          // A surface that never asks for anything has no states to be honest
          // about: the labs hub is a directory, not a data surface. G3 applies
          // to surfaces that fetch something of their own (the chrome's
          // endpoints do not count).
          const calls = (global.fetch?.mock?.calls ?? []).map((c) => String(c[0]));
          const ownCalls = calls.filter((url) => !CHROME_ENDPOINTS.has(url));
          findings.push(
            ...collectFindings(mounted.container, {
              route: definition.route,
              state,
              states: texts,
              dataSurface: ownCalls.length > 0,
            })
          );
        }
        cleanup();
      }

      // A route that redirects or correctly refuses a missing record is not a
      // surface: it has no states of its own to be honest about.
      if (kinds.has('redirect')) {
        expect(findings.length).toBe(0);
        return;
      }
      if (kinds.has('notFound')) {
        expect(findings.length).toBe(0);
        return;
      }

      allFindings.push(...findings);

      if (findings.length > 0) {
        console.log(
          `\n  ${definition.route} — ${findings.length} finding(s)\n` +
          findings.map((f) => `      [${f.gate}] ${f.state}: ${f.message}`).join('\n')
        );
      }

      const budget = BUDGET[definition.route];
      if (budget === undefined) {
        throw new Error(
          `No budget for ${definition.route}. A new surface needs a budget entry ` +
          `in tests/surfaceContract.test.jsx — that is the point of the ratchet.`
        );
      }
      if (findings.length > budget) {
        const report = findings
          .map((f) => `      [${f.gate}] ${f.state}: ${f.message}`)
          .join('\n');
        throw new Error(
          `Surface contract regression on ${definition.route}: ${findings.length} findings, budget ${budget}.\n${report}\n` +
          `      (fix the surface, or lower the budget if the finding is not a finding)`
        );
      }
      expect(findings.length).toBeLessThanOrEqual(budget);
    }, 30_000);
  }

  it('agrees with the registry about which routes are surfaces', async () => {
    const redirects = configRedirects();
    const rows = registryRows();
    expect(rows, 'docs/SURFACES.md is missing — the registry is the quality ledger').not.toBeNull();

    const problems = [];
    for (const definition of ROUTES) {
      const row = rows.get(definition.route);
      if (!row) {
        problems.push(`${definition.route} has no registry row`);
        continue;
      }
      const registrySaysSurface = row.renders.startsWith('yes');
      const selfRedirect = await redirectsItself(definition);
      const appRedirects = redirects.has(definition.route) || selfRedirect;
      if (registrySaysSurface && appRedirects) {
        problems.push(
          `${definition.route} is registered as a surface, but the app redirects it — the page can never render`
        );
      }
      if (!registrySaysSurface && !appRedirects && !row.renders.includes('redirect')) {
        problems.push(
          `${definition.route} is registered as "${row.renders}" but the app does not redirect it`
        );
      }
    }

    if (problems.length > 0) {
      throw new Error(`The registry and the app disagree:\n${problems.map((p) => `      ${p}`).join('\n')}`);
    }
  });

  it('lists the routes it cannot mount, so the gap is written down', () => {
    expect(NOT_MOUNTABLE.length).toBeGreaterThan(0);
    for (const entry of NOT_MOUNTABLE) {
      expect(entry.route).toMatch(/^\//);
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });
});
