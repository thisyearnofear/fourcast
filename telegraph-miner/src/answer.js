/**
 * One answer, two shapes.
 *
 * A text scorer grades a sentence; a contract settles on scalars. Season I
 * scorers on GAME_RESULT were measured to credit "X beat Y 112-108" at 1.0
 * even when Y won, and the shapes of the answers that did score were plain
 * attributed sentences ("X beat Y 5-1 (final)"). So every answer carries:
 *
 *   summary / reason   an attributed sentence: who beat whom, by what, status
 *   scalars            home_team, away_team, home_score, away_score, status,
 *                      result, winner — for on_chain.fields
 *
 * Absent is never zero. A missing team name is null, not "Unknown"; a missing
 * score is null, not 0; a fixture we could not find is `answer: null` with a
 * reason, never a confident answer about something else.
 */

/** Result from two scores, or null when either is missing. */
export function resultFromScores(home, away) {
  if (home == null || away == null || home === '' || away === '') return null;
  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return 'home_win';
  if (a > h) return 'away_win';
  return 'draw';
}

/** Winner name for a result; null when the name is unknown rather than guessing. */
export function winnerFor(result, homeTeam, awayTeam) {
  if (result === 'draw') return 'draw';
  if (result === 'home_win') return homeTeam || null;
  if (result === 'away_win') return awayTeam || null;
  return null;
}

const side = (name, fallback) => name || fallback;

/** An attributed, human-readable sentence for the answer. */
export function describe(answer) {
  if (!answer || typeof answer !== 'object') return null;
  const home = side(answer.home_team, 'the home side');
  const away = side(answer.away_team, 'the away side');
  const h = answer.home_score;
  const a = answer.away_score;
  const haveScore = h != null && a != null;
  const result = answer.result ?? (answer.status === 'final' ? resultFromScores(h, a) : null);

  if (answer.status === 'final' && haveScore && result) {
    if (result === 'draw') return `${home} and ${away} drew ${h}-${a} (final)`;
    const [w, l, ws, ls] = result === 'home_win' ? [home, away, h, a] : [away, home, a, h];
    return `${w} beat ${l} ${ws}-${ls} (final)`;
  }
  if (answer.status === 'final') return `${home} vs ${away} finished, score not published`;
  if (answer.status === 'live' && haveScore) {
    const clock = answer.minute != null ? `, ${answer.minute}'` : answer.clock ? `, ${answer.clock}` : '';
    return `${home} ${h}-${a} ${away} (live${clock})`;
  }
  if (answer.status === 'live') return `${home} vs ${away} is in progress, score not published`;
  if (answer.status === 'postponed' || answer.status === 'cancelled') return `${home} vs ${away} was ${answer.status}`;
  return `${home} vs ${away} is scheduled${answer.kickoff ? ` for ${answer.kickoff}` : ''}`;
}

/**
 * Flat scalars for signal_mapping and on_chain.source_path. Strings, so a
 * missing fixture never breaks a mapping — but the label says `no_result`
 * rather than dressing an absence up as a status.
 */
export function signalFieldsFromAnswer(answer, noResultReason) {
  if (!answer || typeof answer !== 'object') {
    return {
      score: '',
      label: 'no_result',
      winner: '',
      reason: noResultReason || 'No matching fixture found',
      proof_available: false,
    };
  }

  const h = answer.home_score;
  const a = answer.away_score;
  const score = h != null && a != null && h !== '' && a !== '' ? `${h}-${a}` : '';

  let winner = typeof answer.winner === 'string' ? answer.winner : '';
  if (!winner && answer.status === 'final') {
    winner = winnerFor(answer.result ?? resultFromScores(h, a), answer.home_team, answer.away_team) || '';
  }

  return {
    score,
    label: answer.status || 'unknown',
    winner,
    reason: answer.summary || describe(answer) || 'No matching fixture found',
    proof_available: Boolean(answer.proof_available || answer.proof?.verifiable),
  };
}
