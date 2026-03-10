'use strict';

// ── All 21 distinct dice outcomes with probabilities ──────────────────────────
const DICE_OUTCOMES = (function () {
  const out = [];
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = d1; d2 <= 6; d2++) {
      out.push({
        dice: d1 === d2 ? [d1, d1, d1, d1] : [d1, d2],
        prob: d1 === d2 ? 1 / 36 : 2 / 36,
      });
    }
  }
  return out;
}());

// ── State fingerprint for deduplication ──────────────────────────────────────
function stateKey(s) {
  return s.board.join(',') + '|' +
    s.bar.human + ',' + s.bar.ai + '|' +
    s.off.human + ',' + s.off.ai;
}

// Max distinct final positions to consider per dice outcome at depth ≥ 2.
// Prevents branching explosion on doubles in deep searches.
const MAX_STATES = 20;

// All distinct board positions reachable from `s` (dice must be set).
function distinctFinalStates(s) {
  const seqs = allMoveSequences(s);
  if (!seqs[0] || seqs[0].length === 0) return [s];

  const seen = new Set();
  const out  = [];
  for (const seq of seqs) {
    if (AI_DEPTH >= 2 && out.length >= MAX_STATES) break;
    let st = s;
    for (const mv of seq) st = applyMove(st, mv);
    const k = stateKey(st);
    if (!seen.has(k)) { seen.add(k); out.push(st); }
  }
  return out;
}

// ── Heuristic evaluation ──────────────────────────────────────────────────────
// Returns a score from the AI's perspective.  Higher = better for AI.
//
// Components:
//   pip count delta   — raw race metric
//   blot penalty      — exposed checkers are vulnerable
//   bar penalty       — checkers on the bar are expensive
//   borne-off bonus   — permanent progress
//   prime bonus       — consecutive blocked points trap opponent
//   home coverage     — secured home-board points increase hitting power
//   anchor bonus      — holding a point in opponent's home board

function longestPrime(board, aiSide) {
  let max = 0, cur = 0;
  for (let p = 1; p <= 24; p++) {
    const owned = aiSide ? board[p] <= -2 : board[p] >= 2;
    cur = owned ? cur + 1 : 0;
    if (cur > max) max = cur;
  }
  return max;
}

function evaluate(s) {
  const winner = getWinner(s);
  if (winner === 'ai')    return  1000000;
  if (winner === 'human') return -1000000;

  const { board, bar, off } = s;
  let score = 0;

  // 1. Pip count delta (AI wants fewer pips remaining than human)
  score += (calcPipCount(s, 'human') - calcPipCount(s, 'ai')) * 1.5;

  // 2. Blot exposure
  for (let p = 1; p <= 24; p++) {
    if (board[p] === -1) score -= 8;   // AI blot is bad
    if (board[p] ===  1) score += 4;   // Human blot is a target for AI
  }

  // 3. Bar penalties
  score -= bar.ai    * 16;
  score += bar.human * 12;

  // 4. Borne-off bonus
  score += off.ai    * 2;
  score -= off.human * 2;

  // 5. Prime length
  score += longestPrime(board, true)  * 5;
  score -= longestPrime(board, false) * 4;

  // 6. Home board coverage (secured points = 2+ own checkers)
  for (let p = 19; p <= 24; p++) if (board[p] <= -2) score += 2;   // AI home
  for (let p = 1;  p <= 6;  p++) if (board[p] >=  2) score -= 1.5; // human home

  // 7. Anchors in opponent's home board (2+ own checkers)
  for (let p = 1;  p <= 6;  p++) if (board[p] <= -2) score += 10;  // AI anchor
  for (let p = 19; p <= 24; p++) if (board[p] >=  2) score -= 8;   // human anchor

  return score;
}

// ── Expectiminimax with alpha-beta pruning ────────────────────────────────────
//
// Node types:
//   Chance nodes   — dice are rolled; value = weighted average over 21 outcomes
//   Max nodes      — AI selects among final positions (maximises score)
//   Min nodes      — Human selects among final positions (minimises score)
//
// The tree alternates:  Chance → Max/Min → Chance → Min/Max → …
//
// `s.dice` must be empty on entry (dice will be rolled inside the chance node).
// `depth` counts remaining chance+move pairs; at 0 we call the heuristic.

function expectiminimax(s, depth, alpha, beta) {
  if (depth === 0 || getWinner(s)) return evaluate(s);

  const isMax   = s.turn === 'ai';
  const oppTurn = isMax ? 'human' : 'ai';
  let expected  = 0;

  for (const { dice, prob } of DICE_OUTCOMES) {
    // ── Chance node: try this dice outcome ────────────────────────────────
    const withDice = cloneState(s);
    withDice.dice  = dice.slice();

    const finals = distinctFinalStates(withDice);
    let best = isMax ? -Infinity : Infinity;

    // ── Max / Min node: best move for the current player ──────────────────
    for (const fs of finals) {
      const next = cloneState(fs);
      next.turn  = oppTurn;
      next.dice  = [];
      const val  = expectiminimax(next, depth - 1, alpha, beta);

      if (isMax) {
        if (val > best)   best  = val;
        if (best > alpha) alpha = best;
      } else {
        if (val < best)   best  = val;
        if (best < beta)  beta  = best;
      }
      if (alpha >= beta) break;  // alpha-beta cut within this dice outcome
    }

    expected += prob * best;
  }

  return expected;
}

// ── Public API ────────────────────────────────────────────────────────────────
//
// AI_DEPTH controls lookahead.
//   -1 → Beginner: random legal move (no search)
//    1 → Medium: look at human's response (2-ply)
//    2 → Hard: look at human + AI response (4-ply, uses MAX_STATES cap)

let AI_DEPTH = 1;

function setAiDepth(d) { AI_DEPTH = d; }

// Returns the best full move sequence for the AI given the current dice.
// `s.dice` must already be set.  Returns [] if no legal moves exist.
function getBestMoveSequence(s) {
  const seqs = allMoveSequences(s);
  if (!seqs[0] || seqs[0].length === 0) return [];

  // Beginner: pick a random maximal-length sequence
  if (AI_DEPTH < 0) return seqs[Math.floor(Math.random() * seqs.length)];

  let bestSeq = seqs[0];
  let bestVal = -Infinity;
  const seen  = new Set();

  for (const seq of seqs) {
    let state = s;
    for (const mv of seq) state = applyMove(state, mv);

    const k = stateKey(state);
    if (seen.has(k)) continue;
    seen.add(k);

    const next = cloneState(state);
    next.turn  = 'human';
    next.dice  = [];
    const val  = expectiminimax(next, AI_DEPTH, -Infinity, Infinity);

    if (val > bestVal) {
      bestVal = val;
      bestSeq = seq;
    }
  }

  return bestSeq;
}
