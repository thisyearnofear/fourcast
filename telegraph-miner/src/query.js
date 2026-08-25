/**
 * Normalize Telegraph /query bodies.
 *
 * Direct callers send { intent, params, request_id }.
 * Auto-routed /engine/v1/ask may send a flatter body (query, team, context, …)
 * with no intent — the node forwards that payload verbatim.
 */

export const SUPPORTED_INTENTS = ['SPORTS_SCORE', 'GAME_RESULT'];

const PARAM_KEYS = [
  'fixture_id',
  'team',
  'competition',
  'league',
  'date',
  'home_team',
  'away_team',
];

const RESULT_RE =
  /\b(who\s+won|winner|final(?:e)?|full[- ]?time|result|finished|completed|final score)\b/i;

function firstString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Strip question filler so "What is the Inter Miami score?" → "Inter Miami".
 */
export function teamFromQuery(q) {
  if (!q) return '';
  const vsSplit = String(q).split(/\s+vs\.?\s+/i);
  const focus = vsSplit[0];
  return focus
    .replace(/[?!.,:;'"]/g, ' ')
    .replace(
      /\b(what|whats|what'?s|who|whos|who'?s|can|could|would|should|you|your|yours|the|a|an|is|are|was|were|did|does|current|live|latest|final|score|scores|result|results|of|for|win|won|winner|game|match|between|please|tell|me|give|this|that|these|those|last|next|past|current|upcoming|recent|yesterday|tomorrow|today|tonight|evening|morning|afternoon|night|weekend|day|week|month|year|offer|information|info|details|check|about|using|use|with|and|or)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse natural-language sports queries into structured params.
 * Handles queries like:
 *   "who won Manchester City this weekend"
 *   "Premier League scores today"
 *   "Did Liverpool win?"
 */
export function parseNaturalLanguage(queryText) {
  if (!queryText) return {};

  const q = queryText.toLowerCase();

  // Competition extraction
  let competition = null;
  if (/\b(premier league|pl|epl|english premier)\b/.test(q)) competition = 'Premier League';
  else if (/\b(mls|major league soccer)\b/.test(q)) competition = 'MLS';
  else if (/\b(laliga|la liga|la liga)\b/.test(q)) competition = 'La Liga';
  else if (/\b(bundesliga)\b/.test(q)) competition = 'Bundesliga';
  else if (/\b(nfl|national football league)\b/.test(q)) competition = 'NFL';
  else if (/\b(serie a|serie)\b/.test(q)) competition = 'Serie A';
  else if (/\b(champions league|ucl)\b/.test(q)) competition = 'Champions League';

  // Date reference resolution
  let date = null;
  if (/\b(this weekend|last weekend|past weekend)\b/.test(q)) {
    // Most recent weekend (Sat-Sun)
    const now = new Date();
    const dow = now.getDay(); // 0=Sun, 6=Sat
    const daysToSat = (dow + 6) % 7; // days since last Saturday
    const lastSat = new Date(now);
    lastSat.setDate(now.getDate() - daysToSat - (dow === 6 ? 7 : 0) - (dow === 0 ? 1 : 0) - (dow === 1 ? 2 : 0));
    lastSat.setHours(0, 0, 0, 0);
    if (dow === 0 || dow === 1) lastSat.setDate(lastSat.getDate() - 7); // if Mon/Tue, go to prior weekend
    if (dow === 6) lastSat.setDate(lastSat.getDate() - 7); // if Sat, go to last Sat not future
    date = lastSat.toISOString().slice(0, 10);
  } else if (/\b(last night|yesterday)\b/.test(q)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  } else if (/\b(today)\b/.test(q)) {
    date = new Date().toISOString().slice(0, 10);
  }

  // Result/winner indicator
  const wantsResult = RESULT_RE.test(q);

  return { competition, date, wantsResult };
}

export function inferIntent(queryText, params = {}) {
  const blob = [queryText, params.team, params.fixture_id]
    .filter(Boolean)
    .join(' ');
  return RESULT_RE.test(blob) ? 'GAME_RESULT' : 'SPORTS_SCORE';
}

/**
 * @returns {{ ok: true, intent: string, params: object, request_id: * } | { ok: false, status: number, error: string, message: string, extra?: object }}
 */
export function normalizeQueryRequest(body) {
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const params = {
    ...(raw.params && typeof raw.params === 'object' && !Array.isArray(raw.params)
      ? raw.params
      : {}),
  };

  for (const key of PARAM_KEYS) {
    if (raw[key] != null && raw[key] !== '' && params[key] == null) {
      params[key] = raw[key];
    }
  }

  const queryText = firstString(raw.query, raw.q, raw.question, raw.text);

  // Enrich params with NL parsing — this lets the intent handlers resolve
  // natural-language asks ("who won Man City this weekend") without needing
  // the auto-router to have already classified them.
  if (queryText) {
    const nl = parseNaturalLanguage(queryText);
    if (!params.competition && !params.league && nl.competition) {
      params.competition = nl.competition;
    }
    if (!params.date && nl.date) {
      params.date = nl.date;
    }
    if (!params.team && !params.fixture_id) {
      const extracted = teamFromQuery(queryText);
      if (extracted) params.team = extracted;
    }
  }
  if (params.home_team && !params.team) {
    params.team = params.home_team;
  }

  const request_id = raw.request_id ?? null;
  const declared = typeof raw.intent === 'string' ? raw.intent.trim() : '';

  if (declared) {
    if (!SUPPORTED_INTENTS.includes(declared)) {
      // Auto-router sometimes sends a declared intent the classifier couldn't
      // map. Try inferring from the query text before rejecting — the query
      // often contains enough signal even when the routing layer misfires.
      const inferredIntent = inferIntent(queryText, params);
      // Require a plausible lookup key — single filler words ("offer", "info")
      // aren't real team/fixture references even if they survive stopword stripping.
      const hasRealLookup =
        (params.team && params.team.length >= 3) ||
        params.fixture_id ||
        params.competition;
      if (inferredIntent && hasRealLookup) {
        return { ok: true, intent: inferredIntent, params, request_id };
      }
      // Graceful 200 so the caller doesn't get a 400 on an otherwise valid ask.
      return {
        ok: false,
        status: 200,
        error: 'unsupported_intent',
        message: `This miner serves SPORTS_SCORE and GAME_RESULT intents. Try asking about a specific team, fixture, or competition — e.g. "What was the Manchester City score?"`,
        extra: { supported_intents: SUPPORTED_INTENTS },
      };
    }
    return { ok: true, intent: declared, params, request_id };
  }

  const hasLookup =
    Boolean(queryText) ||
    PARAM_KEYS.some((k) => params[k] != null && params[k] !== '');

  if (!hasLookup) {
    return {
      ok: false,
      status: 400,
      error: 'missing_intent',
      message:
        'Request must include an "intent" field, or a query/team/fixture_id the miner can resolve',
    };
  }

  return {
    ok: true,
    intent: inferIntent(queryText, params),
    params,
    request_id,
  };
}

/**
 * Flat scalars for signal_mapping and on_chain.source_path.
 * Always strings so a missing fixture does not break the mapping.
 */
export function signalFieldsFromAnswer(answer) {
  if (!answer || typeof answer !== 'object') {
    return {
      score: '',
      label: 'unknown',
      winner: '',
      reason: 'No matching fixture',
      proof_available: false,
    };
  }

  const home = answer.home_score;
  const away = answer.away_score;
  const score =
    home != null && away != null && home !== '' && away !== ''
      ? `${home}-${away}`
      : '';

  let winner = typeof answer.winner === 'string' ? answer.winner : '';
  if (!winner && answer.result === 'home_win') winner = answer.home_team || '';
  else if (!winner && answer.result === 'away_win') winner = answer.away_team || '';
  else if (!winner && answer.result === 'draw') winner = 'draw';
  else if (
    !winner &&
    answer.status === 'final' &&
    home != null &&
    away != null
  ) {
    const h = Number(home);
    const a = Number(away);
    if (h > a) winner = answer.home_team || '';
    else if (a > h) winner = answer.away_team || '';
    else winner = 'draw';
  }

  const teams =
    answer.home_team && answer.away_team
      ? `${answer.home_team} vs ${answer.away_team}`
      : answer.home_team || answer.away_team || '';
  const reason = [teams, score && `(${score})`, winner && winner !== 'draw' ? `winner: ${winner}` : winner === 'draw' ? 'draw' : answer.status]
    .filter(Boolean)
    .join(' — ');

  return {
    score,
    label: answer.status || 'unknown',
    winner: winner || '',
    reason: reason || 'No matching fixture',
    proof_available: Boolean(
      answer.proof_available || answer.proof?.verifiable
    ),
  };
}
