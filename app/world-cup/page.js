import { promises as fs } from 'fs';
import path from 'path';
import WorldCupClient from './WorldCupClient';

const TITLE = 'Decision receipts · Fourcast';
const DESCRIPTION =
  'Archived World Cup 2026 fixture set: sealed decision receipts, TxLINE-Merkle proofs, and on-chain settlement — all auditable on Solana.';

const STATIC_METADATA = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/world-cup',
    siteName: 'Fourcast',
    images: [{ url: '/api/og?type=route&name=proof', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/api/og?type=route&name=proof'],
  },
};

// Participant names that arrived unresolved from TxLINE ("Team 3095") — the
// scores endpoint drops display names for older fixtures (see README friction
// notes). Canonical fixtures are named here so share cards read correctly.
const KNOWN_FIXTURE_NAMES = {
  18175981: { home: 'France', away: 'Sweden' },
};

/** Best-effort OG facts for a fixture deep link, from the cached replay. */
async function loadFixtureOg(fixtureId) {
  try {
    const file = path.join(process.cwd(), 'cache', 'txline', 'replays', `${fixtureId}.json`);
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    const fx = data.fixture || {};
    const unresolved = (n) => !n || /^Team \d+$/i.test(n);
    const known = KNOWN_FIXTURE_NAMES[String(fixtureId)] || {};
    const home = known.home || (unresolved(fx.Participant1) ? null : fx.Participant1) || 'Home';
    const away = known.away || (unresolved(fx.Participant2) ? null : fx.Participant2) || 'Away';
    const score =
      data.finalScore && data.finalScore.homeGoals != null
        ? `${data.finalScore.homeGoals}–${data.finalScore.awayGoals}`
        : null;
    const stage = fx.Competition || null;
    return { home, away, score, stage };
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const fixtureId = params?.fixture;
  if (!fixtureId) return STATIC_METADATA;

  const og = await loadFixtureOg(fixtureId);
  if (!og) return STATIC_METADATA;

  const imageParams = new URLSearchParams({ type: 'receipt', home: og.home, away: og.away });
  if (og.score) imageParams.set('score', og.score);
  if (og.stage) imageParams.set('stage', og.stage);
  const image = `/api/og?${imageParams.toString()}`;

  const title = `${og.home} v ${og.away} — sealed decision receipt · Fourcast`;
  const description = `A mandate decision sealed before the outcome${og.score ? `, reconciled against the verified ${og.score} result` : ''}. Walk the full proof chain: evidence, policy gates, receipt hash, Solana anchor.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/world-cup?fixture=${fixtureId}`,
      siteName: 'Fourcast',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function WorldCupPage() {
  return <WorldCupClient />;
}
