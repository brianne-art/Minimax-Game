'use strict';

// ── Low-level helpers ─────────────────────────────────────────────────────────

// Can the current player land on point `to`?
//   Can land on: empty (0), own checkers, or opponent blot (exactly 1 checker).
function canLand(board, to, isHuman) {
  const v = board[to];
  return isHuman ? v >= -1 : v <= 1;
}

// True if there is a current-player checker on a point "farther" from bearing
// off than `p` within the home board.  Used to enforce overshoot-bearing-off.
//   Human home 1–6: farther = larger point number.
//   AI    home 19–24: farther = smaller point number.
function hasHigherHomeChecker(board, p, isHuman) {
  if (isHuman) {
    for (let q = p + 1; q <= 6;  q++) if (board[q] > 0) return true;
  } else {
    for (let q = p - 1; q >= 19; q--) if (board[q] < 0) return true;
  }
  return false;
}

// ── Single-step legal move generation ────────────────────────────────────────
//
// Returns every distinct (from → to) move the current player may make using
// one die value.  The `die` field records which value was consumed.
// If the player has any checker on the bar, ONLY bar-entry moves are returned.

function singleLegalMoves(s) {
  if (s.dice.length === 0) return [];

  const isHuman  = s.turn === 'human';
  const { board, bar, dice } = s;
  const diceVals = [...new Set(dice)];   // unique values → avoid duplicate moves
  const moves    = [];

  // ── Bar entry ──────────────────────────────────────────────────────────────
  if ((isHuman ? bar.human : bar.ai) > 0) {
    for (const die of diceVals) {
      const to = isHuman ? 25 - die : die;   // human: 25-d; AI: d
      if (to < 1 || to > 24) continue;
      if (canLand(board, to, isHuman)) {
        moves.push({
          from: 'bar',
          to,
          die,
          hit: board[to] === (isHuman ? -1 : 1),
        });
      }
    }
    return moves;  // bar must be cleared before any other move
  }

  const bearing = allInHome(s);

  for (const die of diceVals) {
    for (let p = 1; p <= 24; p++) {
      if (isHuman ? board[p] <= 0 : board[p] >= 0) continue;  // no own checker

      const to = isHuman ? p - die : p + die;

      if (bearing && (isHuman ? to <= 0 : to >= 25)) {
        // ── Bearing off ─────────────────────────────────────────────────────
        const exact = isHuman ? to === 0 : to === 25;
        if (exact || !hasHigherHomeChecker(board, p, isHuman)) {
          moves.push({ from: p, to: 'off', die, hit: false });
        }
      } else if (to >= 1 && to <= 24 && canLand(board, to, isHuman)) {
        // ── Normal move ─────────────────────────────────────────────────────
        moves.push({
          from: p,
          to,
          die,
          hit: board[to] === (isHuman ? -1 : 1),
        });
      }
    }
  }

  return moves;
}

// ── State transition ──────────────────────────────────────────────────────────

// Returns a new state with `move` applied.  Does NOT advance the turn —
// the caller decides when the turn ends (when getLegalMoves returns []).
function applyMove(s, move) {
  const next    = cloneState(s);
  const isHuman = s.turn === 'human';
  const sign    = isHuman ? 1 : -1;   // board polarity

  // Remove checker from source
  if (move.from === 'bar') {
    if (isHuman) next.bar.human--;
    else         next.bar.ai--;
  } else {
    next.board[move.from] -= sign;
  }

  // Send blot to bar
  if (move.hit) {
    next.board[move.to] = 0;
    if (isHuman) next.bar.ai++;
    else         next.bar.human++;
  }

  // Place checker at destination
  if (move.to === 'off') {
    if (isHuman) next.off.human++;
    else         next.off.ai++;
  } else {
    next.board[move.to] += sign;
  }

  // Consume one instance of the used die value
  const idx = next.dice.indexOf(move.die);
  next.dice.splice(idx, 1);

  return next;
}

// ── Full-turn move sequences ──────────────────────────────────────────────────
//
// Returns all maximal-length sequences of single moves reachable from `s`.
// "Maximal" means using as many dice as possible (required by backgammon rules).

function allMoveSequences(s) {
  const singles = singleLegalMoves(s);
  if (singles.length === 0) return [[]];   // terminal node

  let best    = [];
  let bestLen = 0;

  for (const move of singles) {
    const subSeqs = allMoveSequences(applyMove(s, move));
    for (const sub of subSeqs) {
      const seq = [move, ...sub];
      if (seq.length > bestLen) {
        bestLen = seq.length;
        best    = [seq];
      } else if (seq.length === bestLen) {
        best.push(seq);
      }
    }
  }

  return best;
}

// ── Public API ────────────────────────────────────────────────────────────────
//
// Returns the set of legal FIRST moves for the current player, enforcing:
//   (a) Must use as many dice as possible.
//   (b) With exactly two different dice remaining, if only one die can be
//       played, it must be the higher-valued one (standard backgammon rule).

function getLegalMoves(s) {
  if (s.dice.length === 0) return [];

  const sequences = allMoveSequences(s);
  if (!sequences[0] || sequences[0].length === 0) return [];   // forced pass

  const maxLen = sequences[0].length;

  // Collect unique first moves (deduplicate on from+to)
  const seen   = new Set();
  const result = [];
  for (const seq of sequences) {
    const m   = seq[0];
    const key = `${m.from}:${m.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(m);
    }
  }

  // "Must use higher die" rule: applies only when exactly 2 different dice
  // remain and only 1 move is achievable (maxLen === 1).
  if (maxLen === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const higher      = Math.max(...s.dice);
    const withHigher  = result.filter(m => m.die === higher);
    if (withHigher.length > 0) return withHigher;
    // Higher die cannot be played; fall through and use the lower die.
  }

  return result;
}
