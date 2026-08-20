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
      /\b(what|whats|what'?s|who|whos|who'?s|the|a|an|is|are|was|were|did|does|current|live|latest|final|score|scores|result|results|of|for|win|won|winner|game|match|between|please|tell|me|give)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
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
  if (queryText && !params.team && !params.fixture_id) {
    const extracted = teamFromQuery(queryText);
    if (extracted) params.team = extracted;
  }
  if (params.home_team && !params.team) {
    params.team = params.home_team;
  }

  const request_id = raw.request_id ?? null;
  const declared = typeof raw.intent === 'string' ? raw.intent.trim() : '';

  if (declared) {
    if (!SUPPORTED_INTENTS.includes(declared)) {
      return {
        ok: false,
        status: 400,
        error: 'unsupported_intent',
        message: `This miner serves SPORTS_SCORE and GAME_RESULT intents. Received: ${declared}`,
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
