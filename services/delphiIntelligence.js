/**
 * Delphi Intelligence Layer — routes market questions to appropriate
 * intelligence sources and returns probability estimates.
 *
 * Intelligence routing:
 * - Sports markets → TxLINE/TxOdds professional odds (primary), LLM fallback
 * - Politics/economics → LLM reasoning
 * - Crypto/technology → LLM reasoning (+ SynthData ML when available)
 * - Current events → LLM reasoning
 *
 * LLM access goes through services/llmRouter.js — an OpenAI-compatible
 * provider chain (default openrouter → nvidia → venice) with failover.
 */

if (typeof window !== 'undefined') {
  throw new Error('delphiIntelligence is server-only');
}

import { chatCompletion } from './llmRouter.js';
import { estimateFromDataFeed } from './delphiDataFeeds.js';
import { retrieveEvidence } from './evidenceRetriever.js';

// ─── Market Classification ──────────────────────────────────────────────────

const SPORTS_KEYWORDS = [
  // General sports terms
  'win', 'beat', 'score', 'goal', 'match', 'game', 'championship', 'league',
  'premier league', 'mls', 'nfl', 'nba', 'mlb', 'la liga', 'champions league',
  'world cup', 'tournament', 'playoff', 'finals', 'team', 'player',
  // Premier League clubs
  'liverpool', 'arsenal', 'manchester', 'chelsea', 'tottenham', 'spurs',
  'aston villa', 'newcastle', 'brighton', 'fulham', 'brentford', 'bournemouth',
  'crystal palace', 'everton', 'nottingham forest', 'west ham',
  'coventry', 'hull city', 'ipswich', 'leeds',
  // MLS clubs (matched to TxLINE Participant names)
  'inter miami', 'lafc', 'atlanta united', 'la galaxy', 'seattle sounders',
  'portland timbers', 'nashville', 'columbus crew', 'fc cincinnati',
  'philadelphia union', 'new york city', 'ny red bulls', 'orlando city',
  'charlotte fc', 'dc united', 'toronto fc', 'montreal', 'new england',
  'chicago fire', 'houston dynamo', 'austin fc', 'real salt lake',
  'sporting kansas city', 'colorado rapids', 'minnesota united',
  'san jose earthquakes', 'vancouver whitecaps', 'st. louis city',
  // La Liga / European
  'barcelona', 'real madrid',
];

const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'price', 'crypto',
  'token', 'defi', 'nft', 'blockchain', 'market cap', 'trading', 'halving',
  'altcoin', 'xrp', 'cardano', 'dogecoin', 'doge', 'bnb',
];

const POLITICS_KEYWORDS = [
  'election', 'president', 'vote', 'poll', 'congress', 'senate', 'party',
  'democrat', 'republican', 'biden', 'trump', 'governor', 'legislation',
  'policy', 'government', 'supreme court', 'fed', 'federal',
];

const ECONOMICS_KEYWORDS = [
  'gdp', 'inflation', 'interest rate', 'unemployment', 'recession', 'fed',
  'federal reserve', 'cpi', 'jobs', 'treasury', 'yield', 'bond', 'stock',
  's&p', 'nasdaq', 'dow', 'trade deficit', 'tariff',
];

/**
 * Classify a Delphi market into a category for intelligence routing.
 * @param {Object} market - Normalized market from delphiService
 * @returns {{ category: string, keywords: string[], confidence: string }}
 */
export function classifyMarket(market) {
  const text = `${market.question} ${market.description}`.toLowerCase();

  // Use the Delphi-provided category as a hint
  const delphiCategory = (market.category || '').toLowerCase();

  // Score each category
  const scores = {
    sports: countMatches(text, SPORTS_KEYWORDS) + (delphiCategory === 'sports' ? 5 : 0),
    crypto: countMatches(text, CRYPTO_KEYWORDS) + (delphiCategory === 'crypto' ? 5 : 0),
    politics: countMatches(text, POLITICS_KEYWORDS) + (delphiCategory === 'politics' ? 5 : 0),
    economics: countMatches(text, ECONOMICS_KEYWORDS) + (delphiCategory === 'economics' ? 5 : 0),
  };

  const topCategory = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];

  const category = topCategory[1] > 0 ? topCategory[0] : 'general';
  const confidence = topCategory[1] >= 5 ? 'HIGH' : topCategory[1] >= 2 ? 'MEDIUM' : 'LOW';

  return { category, score: topCategory[1], confidence };
}

function countMatches(text, keywords) {
  return keywords.filter((kw) => text.includes(kw)).length;
}

// ─── Probability Estimation ─────────────────────────────────────────────────

/**
 * Estimate probabilities for each outcome in a market.
 * Routes to the best available intelligence source based on classification.
 *
 * @param {Object} market - Normalized market from delphiService
 * @param {Object} classification - From classifyMarket()
 * @returns {Promise<{probabilities: number[], confidence: string, source: string, reasoning: string}>}
 */
export async function estimateProbabilities(market, classification) {
  // Deterministic public-data feeds beat every model when they match —
  // near resolution the answer is often already public while the market
  // still prices it below certainty.
  const feed = await estimateFromDataFeed(market).catch(() => null);
  if (feed?.probabilities) return feed;

  // Route based on category
  switch (classification.category) {
    case 'sports':
      return estimateSportsProbabilities(market, classification);
    case 'crypto':
      return estimateCryptoProbabilities(market, classification);
    case 'politics':
    case 'economics':
    case 'general':
    default:
      return estimateWithLLM(market, classification);
  }
}

// ─── Sports Intelligence (TxLINE + Venice AI) ───────────────────────────────

/**
 * For sports markets, attempt to use TxLINE professional odds as fair-value anchor.
 * Falls back to Venice AI if no TxLINE match is found.
 */
async function estimateSportsProbabilities(market, classification) {
  // 1. Paid TxLINE consensus first (when configured/mainnet odds exist).
  const txlineEstimate = await matchTxLineOdds(market);
  if (txlineEstimate) {
    return txlineEstimate;
  }

  // 2. Free ESPN consensus odds (no key / no subscription) — the cost-constrained
  //    sports anchor. Null when no ESPN line is posted or no league match.
  const espnEstimate = await matchEspnOdds(market);
  if (espnEstimate) {
    return espnEstimate;
  }

  // 3. Fall back to the blind LLM for sports markets without any free odds.
  return estimateWithLLM(market, classification);
}

/**
 * Attempt to match a Delphi sports market to TxLINE odds data.
 * TxLINE provides professional bookmaker consensus — the sharpest odds available.
 *
 * Routes to competition-specific fixture fetching when keywords suggest MLS or PL,
 * falling back to all-fixtures scan for ambiguous markets.
 */
async function matchTxLineOdds(market) {
  try {
    // Dynamic import to avoid breaking if TxLINE is not configured.
    // NOTE: txlineService is the module's default export — a named import
    // would be undefined and silently disable sports matching.
    const mod = await import('./txline/txlineService.js');
    const txlineService = mod.txlineService || mod.default;
    // NB: don't gate on txlineService.isConfigured() — it requires live mode,
    // but the agent reads fixtures/odds via getAllFixtures({forceLive:true})
    // regardless of the World Cup demo's replay mode. Missing credentials
    // surface as a fetch error below and return null anyway.

    // Detect competition from market question for efficient routing
    const questionLower = (market.question || '').toLowerCase();
    const descLower = (market.description || '').toLowerCase();
    const text = `${questionLower} ${descLower}`;

    let fixtures = null;
    const COMPETITIONS = txlineService.KNOWN_COMPETITIONS;

    // Route to competition-specific fetch when we can identify the league
    if (COMPETITIONS && txlineService.getFixturesByCompetition) {
      if (text.includes('mls') || MLS_TEAM_HINTS.some(t => text.includes(t))) {
        if (COMPETITIONS.mls?.id) {
          fixtures = await txlineService.getFixturesByCompetition(COMPETITIONS.mls.id);
        }
      } else if (text.includes('premier league') || PL_TEAM_HINTS.some(t => text.includes(t))) {
        if (COMPETITIONS.premierLeague?.id) {
          fixtures = await txlineService.getFixturesByCompetition(COMPETITIONS.premierLeague.id);
        }
      } else if (text.includes('nfl') || NFL_TEAM_HINTS.some(t => text.includes(t))) {
        if (COMPETITIONS.nfl?.id) {
          fixtures = await txlineService.getFixturesByCompetition(COMPETITIONS.nfl.id);
        }
      }
    }

    // Fallback: fetch all competitions
    if (!fixtures || fixtures.length === 0) {
      fixtures = await txlineService.getAllFixtures?.({ forceLive: true });
    }
    if (!fixtures || fixtures.length === 0) return null;

    // Fuzzy team-name matching first; simple substring fallback
    let matchedFixture = txlineService.matchFixtureToQuestion?.(market.question, fixtures)?.fixture || null;
    if (!matchedFixture) {
      matchedFixture = fixtures.find((f) => {
        const home = (f.home?.name || f.homeName || '').toLowerCase();
        const away = (f.away?.name || f.awayName || '').toLowerCase();
        return home && away && (questionLower.includes(home) || questionLower.includes(away));
      });
    }

    if (!matchedFixture) return null;

    // Get odds for the matched fixture.
    // getLiveOdds returns { canonical: { home, draw, away, implied: {...} }, markets }
    // where `implied` is already margin-normalized to sum to 1.
    const odds = await txlineService.getLiveOdds?.(matchedFixture.fixtureId || matchedFixture.id);
    const implied = odds?.canonical?.implied;
    if (!implied) return null;

    const homeProb = implied.home || 0;
    const drawProb = implied.draw || 0;
    const awayProb = implied.away || 0;
    const total = homeProb + drawProb + awayProb;
    if (total <= 0) return null;

    // Binary (2-way) sports forms — e.g. "Will X win / beat Y?" with [Yes, No] —
    // can't be mapped label-by-label to home/away/draw. Parse the question and
    // anchor Yes to the subject team's share of the 1X2 consensus. If we can't
    // parse it confidently we fall through to the LLM rather than guessing.
    const outcomeList = Array.isArray(market.outcomes) ? market.outcomes : [];
    if (outcomeList.length === 2) {
      const binary = mapBinarySportsOutcomes({
        question: market.question,
        outcomes: outcomeList,
        fixture: matchedFixture,
        homeProb, awayProb, drawProb,
      });
      if (binary) {
        const tag = matchedFixture.competition || matchedFixture.competitionId || '';
        return {
          probabilities: binary,
          confidence: 'HIGH',
          source: `txline${tag ? `_${String(tag).toLowerCase().replace(/\s+/g, '')}` : ''}`,
          reasoning: `Professional bookmaker consensus (TxLINE${tag ? ` / ${tag}` : ''}): ${matchedFixture.home?.name || matchedFixture.homeName} vs ${matchedFixture.away?.name || matchedFixture.awayName}. Binary Yes/No form mapped from normalized 1X2 consensus.`,
        };
      }
      // Generic Yes/No form we couldn't parse — don't emit an equal-split guess.
      if (isGenericBinaryOutcomes(outcomeList)) return null;
    }

    // Map consensus probabilities to the Delphi market's outcome labels.
    // Outcomes that match neither team nor 'draw' get an equal share of the
    // residual (multi-outcome team-labelled forms; generic binary Yes/No forms
    // are handled above and never reach this branch).
    const probabilities = market.outcomes.map((outcome) => {
      const outcomeLower = (typeof outcome === 'string' ? outcome : outcome.name || '').toLowerCase();
      const home = (matchedFixture.home?.name || matchedFixture.homeName || '').toLowerCase();
      const away = (matchedFixture.away?.name || matchedFixture.awayName || '').toLowerCase();

      if (outcomeLower.includes(home) || outcomeLower.includes('home')) {
        return homeProb / total;
      }
      if (outcomeLower.includes(away) || outcomeLower.includes('away')) {
        return awayProb / total;
      }
      if (outcomeLower.includes('draw') || outcomeLower.includes('tie')) {
        return drawProb / total;
      }
      // Default: equal split of remaining probability
      return 1 / market.outcomes.length;
    });

    // Include competition context in reasoning for transparency
    const competitionTag = matchedFixture.competition || matchedFixture.competitionId || '';

    return {
      probabilities,
      confidence: 'HIGH',
      source: `txline${competitionTag ? `_${String(competitionTag).toLowerCase().replace(/\s+/g, '')}` : ''}`,
      reasoning: `Professional bookmaker consensus (TxLINE${competitionTag ? ` / ${competitionTag}` : ''}): ${matchedFixture.home?.name || matchedFixture.homeName} vs ${matchedFixture.away?.name || matchedFixture.awayName}. Consensus odds normalized to true probabilities.`,
    };
  } catch (err) {
    // TxLINE not available — fall through
    return null;
  }
}

// ─── Free ESPN odds anchor ────────────────────────────────────────────────────

/**
 * Build a probability estimate from a matched fixture + normalized 1X2 consensus.
 * Handles generic binary (Yes/No) forms via predicate parsing and other outcome
 * shapes via label mapping. Returns null for unparseable generic binary forms so
 * the caller can fall through to the LLM instead of guessing.
 */
export function buildOddsEstimate({ market, fixture, homeProb, awayProb, drawProb, source, league }) {
  const total = (homeProb || 0) + (drawProb || 0) + (awayProb || 0);
  if (!(total > 0)) return null;

  const outcomeList = Array.isArray(market.outcomes) ? market.outcomes : [];

  if (outcomeList.length === 2) {
    const binary = mapBinarySportsOutcomes({
      question: market.question,
      outcomes: outcomeList,
      fixture,
      homeProb, awayProb, drawProb,
    });
    if (binary) {
      return {
        probabilities: binary,
        confidence: 'HIGH',
        source,
        reasoning: `Free consensus odds (${source}${league ? ` / ${league}` : ''}): ${fixture.home?.name} vs ${fixture.away?.name}. Binary Yes/No mapped from normalized 1X2.`,
      };
    }
    if (isGenericBinaryOutcomes(outcomeList)) return null;
  }

  const home = (fixture.home?.name || '').toLowerCase();
  const away = (fixture.away?.name || '').toLowerCase();
  const probabilities = outcomeList.map((outcome) => {
    const label = (typeof outcome === 'string' ? outcome : outcome.name || '').toLowerCase();
    if (label.includes(home) || label.includes('home')) return homeProb / total;
    if (label.includes(away) || label.includes('away')) return awayProb / total;
    if (label.includes('draw') || label.includes('tie')) return drawProb / total;
    return 1 / (outcomeList.length || 1);
  });

  return {
    probabilities,
    confidence: 'HIGH',
    source,
    reasoning: `Free consensus odds (${source}${league ? ` / ${league}` : ''}): ${fixture.home?.name} vs ${fixture.away?.name}. Normalized, de-vigged 1X2 mapped to market outcomes.`,
  };
}

/**
 * Match a sports market to free ESPN public odds — the cost-constrained sports
 * anchor (no subscription). Returns null when no ESPN line is posted or no
 * league fixture matches, so the caller falls through to the blind LLM.
 */
async function matchEspnOdds(market) {
  try {
    const mod = await import('./txline/espnProvider.js');
    const espn = mod.default || mod;
    const game = await espn.getConsensusGame({
      question: market.question,
      description: market.description,
      resolvesAt: market.resolvesAt,
    });
    if (!game) return null;
    return buildOddsEstimate({
      market,
      fixture: game.fixture,
      homeProb: game.homeProb,
      awayProb: game.awayProb,
      drawProb: game.drawProb,
      source: 'espn',
      league: game.league,
    });
  } catch (err) {
    return null;
  }
}

// ─── Binary Yes/No sports form mapping ───────────────────────────────────────

/**
 * Detect generic Yes/No binary outcome labels (e.g. ["Yes", "No"]).
 * True only when one side reads as 'yes' and the other as 'no', so
 * team-labelled binary markets stay on the label-mapping path.
 * @param {Array} outcomes - Delphi market outcomes
 * @returns {boolean}
 */
export function isGenericBinaryOutcomes(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length !== 2) return false;
  let yes = false;
  let no = false;
  for (const o of outcomes) {
    const label = (typeof o === 'string' ? o : o.name || '').toLowerCase().trim();
    if (/^yes\b/.test(label)) yes = true;
    else if (/^no\b/.test(label)) no = true;
  }
  return yes && no;
}

/**
 * Map a binary (2-way) generic Yes/No sports market to TxLINE 1X2 consensus.
 * Parses the question for a subject team ("Will X beat Y?", "Will X win?") and
 * maps Yes = P(subject wins) from the fixture's home/away share; No = 1 − That.
 * Returns null when the form can't be parsed confidently so the caller can fall
 * through to the LLM instead of emitting a guess.
 *
 * @returns {number[] | null} two probabilities aligned to market.outcomes
 */
export function mapBinarySportsOutcomes({ question, outcomes, fixture, homeProb, awayProb, drawProb }) {
  if (!isGenericBinaryOutcomes(outcomes) || !fixture) return null;

  const home = (fixture.home?.name || fixture.homeName || '').toLowerCase();
  const away = (fixture.away?.name || fixture.awayName || '').toLowerCase();
  if (!home || !away) return null;

  const q = (question || '').toLowerCase();

  // Identify the subject — the team the question is about.
  let subject = null;
  // "will {subject} beat/defeat/top {opponent}"
  const beat = q.match(/will\s+(.+?)\s+(?:beat|defeats?|take\s+down|tops?)\s+.+?(?:\?|\.|,|$)/);
  if (beat) subject = beat[1].trim();
  else {
    const win = q.match(/will\s+(.+?)\s+win/);
    if (win) subject = win[1].trim();
  }
  if (!subject) return null;

  const s = subject.toLowerCase();
  const total = (homeProb || 0) + (drawProb || 0) + (awayProb || 0);
  if (total <= 0) return null;

  const subIsHome = home.includes(s) || s.includes(home);
  const subIsAway = away.includes(s) || s.includes(away);
  if (!subIsHome && !subIsAway) return null;

  const subWin = (subIsHome ? homeProb : awayProb) || 0;
  const yesProb = subWin / total;
  const noProb = 1 - yesProb;
  if (!Number.isFinite(yesProb)) return null;

  return outcomes.map((o) => {
    const label = (typeof o === 'string' ? o : o.name || '').toLowerCase().trim();
    return /^yes\b/.test(label) ? yesProb : noProb;
  });
}

// Lightweight team-name hints for competition routing (not for matching — that
// uses the full TEAM_ALIAS_REGISTRY in crossVenueEdge.js). These just help the
// intelligence layer pick the right competition ID before doing the full scan.
const MLS_TEAM_HINTS = [
  'inter miami', 'lafc', 'atlanta united', 'la galaxy', 'seattle sounders',
  'portland timbers', 'nashville sc', 'columbus crew', 'fc cincinnati',
  'philadelphia union', 'new york city fc', 'ny red bulls', 'orlando city',
  'charlotte fc', 'dc united', 'toronto fc', 'montreal', 'new england',
  'chicago fire', 'houston dynamo', 'austin fc', 'real salt lake',
  'sporting kansas city', 'colorado rapids', 'minnesota united',
  'san jose earthquakes', 'vancouver whitecaps', 'st. louis city',
];

const PL_TEAM_HINTS = [
  'arsenal', 'liverpool', 'manchester city', 'man city', 'manchester united',
  'man united', 'chelsea', 'tottenham', 'spurs', 'aston villa', 'newcastle',
  'brighton', 'fulham', 'brentford', 'bournemouth', 'crystal palace',
  'everton', 'nottingham forest', 'west ham', 'coventry', 'hull city',
  'ipswich', 'leeds',
];

const NFL_TEAM_HINTS = [
  'chiefs', 'eagles', 'bills', '49ers', 'cowboys', 'ravens', 'lions',
  'dolphins', 'packers', 'rams', 'bengals', 'seahawks', 'jets', 'texans',
  'steelers', 'giants', 'bears', 'raiders', 'broncos', 'chargers',
  'patriots', 'saints', 'vikings', 'cardinals', 'colts', 'jaguars',
  'titans', 'commanders', 'falcons', 'panthers', 'buccaneers', 'browns',
];

// ─── Crypto Intelligence ────────────────────────────────────────────────────

async function estimateCryptoProbabilities(market, classification) {
  // TODO: integrate SynthData ML models for crypto price forecasting
  // For now, use the LLM router with crypto-specific prompting
  return estimateWithLLM(market, classification);
}

// ─── Venice AI (General Intelligence) ───────────────────────────────────────

const CATEGORY_PROMPTS = {
  sports: `You are a sports analyst with access to professional odds data. Assess match/event probabilities based on team form, head-to-head records, injuries, and market conditions.`,

  crypto: `You are a quantitative crypto analyst. Assess probability based on current price action, technical levels, historical volatility, on-chain metrics, and macro conditions. Be calibrated — extreme moves are less likely than markets sometimes imply.`,

  politics: `You are a political analyst specializing in election forecasting. Assess probability based on polling data, demographic trends, historical precedent, and current political dynamics. Be well-calibrated — incumbency advantage, polling errors, and base rates matter.`,

  economics: `You are a macroeconomic analyst. Assess probability based on leading indicators, central bank policy, historical base rates, and current economic conditions. Consider that economic predictions have wide error bars.`,

  general: `You are a forecasting analyst. Assess probability of real-world events using base rates, current evidence, and calibrated reasoning. Avoid overconfidence — consider historical accuracy of similar predictions.`,
};

/**
 * Estimate outcome probabilities via the LLM router — an ordered
 * OpenAI-compatible provider chain (default openrouter → nvidia → venice)
 * with automatic failover on auth/billing/rate-limit/network errors.
 * Returns calibrated probability distribution across all outcomes, or null
 * when every configured provider fails.
 */
async function estimateWithLLM(market, classification) {
  const categoryPrompt = CATEGORY_PROMPTS[classification.category] || CATEGORY_PROMPTS.general;

  // Blind pass: deliberately exclude current market prices so the LLM's
  // estimate is not anchored to the market. Edge is computed afterwards
  // against observed prices in the agent loop.
  const outcomesStr = market.outcomes
    .map((o, i) => `[${i}] "${typeof o === 'string' ? o : o.name || `Outcome ${i}`}"`)
    .join('\n');

  const WEB_ENABLED = process.env.DELPHI_AGENT_WEB_SEARCH !== 'false';

  // Grounding: retrieve web evidence and inject it into the prompt — works
  // with ANY model (no provider plugin billing) and yields visible citations.
  const evidence = await retrieveEvidence(market.question).catch(() => null);
  const snippets = evidence?.snippets || [];

  const system = `${categoryPrompt}

You MUST respond with ONLY valid JSON. Your probability estimates must sum to 1.0 across all outcomes. Be calibrated — prefer base rates over narrative. If you are uncertain, your probabilities should reflect that uncertainty (closer to uniform distribution).

IMPORTANT: You are intentionally NOT shown current market prices, so that your estimate is independent. Estimate from fundamentals — do not try to guess the market price. Your estimate will be compared against market prices afterwards to detect mispricing.${snippets.length ? '\n\nGround every load-bearing claim in the web evidence provided below and cite sources by number like [2]. Use ONLY the provided sources — do NOT invent citations or claim searches you did not perform. If the evidence does not answer the question, say so in reasoning and use base rates with LOW confidence.' : WEB_ENABLED ? '\n\nYou have web search available and you MUST use it before answering: your training data is outdated relative to today, and these questions resolve on current facts (schedules, announcements, results). Ground every load-bearing claim in retrieved evidence — cite the specific dated facts you found. If search is not actually available to you or returns nothing relevant, say so explicitly in reasoning — do NOT fabricate citations — and fall back to base rates with LOW confidence.' : ''}`;

  const user = `Prediction market question: "${market.question}"

${market.description ? `Description: ${market.description}\n` : ''}Category: ${classification.category}
Resolves: ${market.resolvesAt || 'Unknown'}

Outcomes:
${outcomesStr}
${snippets.length ? `\nCurrent web evidence:\n${snippets.map((s, i) => `[${i + 1}] "${s.title}" — ${s.url}${s.publishedDate ? ` (${s.publishedDate.slice(0, 10)})` : ''}\n${s.text}`).join('\n\n')}\n` : ''}
Estimate the TRUE probability of each outcome. Consider:
1. Base rates and historical precedent
2. Any relevant knowledge you have about the teams, entities, or phenomena involved
3. Time until resolution
4. Your honest uncertainty — if the question depends on events after your knowledge cutoff, say so in the reasoning and stay near base rates rather than guessing a direction

Output ONLY valid JSON:
{
  "probabilities": [0.XX, 0.XX, ...],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Brief explanation of your probability estimate from fundamentals",
  "evidence": [{"claim": "specific dated fact behind the estimate", "source": "[n] or url"}]
}${snippets.length || WEB_ENABLED ? '\n\nThe evidence array is MANDATORY when relevant current facts were provided or found — a strong probability claim without dated evidence behind it will be distrusted.' : ''}`;

  try {
    const result = await chatCompletion({ system, user, temperature: 0.3, maxTokens: 500, webSearch: WEB_ENABLED });
    if (!result) return null; // every configured provider failed

    let content = result.content;

    // Strip reasoning/thinking tags (venice §THINK, deepseek-style <think>)
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (content.includes('§THINK_OPEN§')) {
      const thinkEnd = content.lastIndexOf('§THINK_CLOSE§');
      if (thinkEnd !== -1) content = content.substring(thinkEnd + 14).trim();
    }
    // Strip markdown code fences
    if (content.startsWith('```')) {
      content = content.replace(/```json\n?|\n?```/g, '').trim();
    }
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content);
    const evidenceCount = Array.isArray(parsed.evidence) ? parsed.evidence.length : 0;

    // Validate probabilities sum to ~1
    const probs = parsed.probabilities;
    if (!Array.isArray(probs) || probs.length !== market.outcomes.length) {
      return null;
    }

    const sum = probs.reduce((s, p) => s + p, 0);
    // Normalize if not exactly 1
    const normalized = probs.map((p) => Math.max(0, p) / sum);

    return {
      probabilities: normalized,
      confidence: parsed.confidence || 'LOW',
      source: `${result.provider}:${result.model}${result.webSearchUsed ? '+web' : ''}_${classification.category}${snippets.length ? `[exa:${snippets.length}/ev:${evidenceCount}]` : ''}`,
      reasoning: parsed.reasoning || null,
      evidence: parsed.evidence || null,
    };
  } catch (err) {
    console.error('LLM forecast failed:', err.message);
    return null;
  }
}

export default { classifyMarket, estimateProbabilities };
