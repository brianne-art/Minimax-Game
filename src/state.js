'use strict';

// ── State shape ───────────────────────────────────────────────────────────────
//
// board[1..24]  signed int — positive = human checkers, negative = AI checkers
// bar.human / bar.ai   checkers on the bar
// off.human / off.ai   checkers borne off
// dice         number[]  remaining usable die values this turn
// turn         'human' | 'ai'
//
// Movement direction:
//   human  24 → 1  (bears off past point 0)
//   ai      1 → 24 (bears off past point 25)

function createInitialState() {
  return {
    board: [
       0,   // index 0 (unused)
      -2,   // 1   AI
       0,   // 2
       0,   // 3
       0,   // 4
       0,   // 5
       5,   // 6   human
       0,   // 7
       3,   // 8   human
       0,   // 9
       0,   // 10
       0,   // 11
      -5,   // 12  AI
       5,   // 13  human
       0,   // 14
       0,   // 15
       0,   // 16
      -3,   // 17  AI
       0,   // 18
      -5,   // 19  AI
       0,   // 20
       0,   // 21
       0,   // 22
       0,   // 23
       2,   // 24  human
    ],
    bar:  { human: 0, ai: 0 },
    off:  { human: 0, ai: 0 },
    dice: [],
    turn: 'human',
  };
}

function cloneState(s) {
  return {
    board: s.board.slice(),
    bar:   { human: s.bar.human, ai: s.bar.ai },
    off:   { human: s.off.human, ai: s.off.ai },
    dice:  s.dice.slice(),
    turn:  s.turn,
  };
}

// Roll two dice; doubles yield four moves.
function rollDice() {
  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

// Total pips remaining for a player (lower = closer to winning).
function calcPipCount(s, player) {
  let pips = 0;
  if (player === 'human') {
    for (let p = 1; p <= 24; p++) if (s.board[p] > 0) pips += s.board[p] * p;
    pips += s.bar.human * 25;
  } else {
    for (let p = 1; p <= 24; p++) if (s.board[p] < 0) pips += (-s.board[p]) * (25 - p);
    pips += s.bar.ai * 25;
  }
  return pips;
}

// Returns 'human', 'ai', or null.
function getWinner(s) {
  if (s.off.human >= 15) return 'human';
  if (s.off.ai   >= 15) return 'ai';
  return null;
}

// True if every checker belonging to the current player is inside their home board.
// Human home: points 1–6.  AI home: points 19–24.
function allInHome(s) {
  const isHuman = s.turn === 'human';
  if (isHuman ? s.bar.human > 0 : s.bar.ai > 0) return false;
  if (isHuman) {
    for (let p = 7;  p <= 24; p++) if (s.board[p] > 0) return false;
  } else {
    for (let p = 1;  p <= 18; p++) if (s.board[p] < 0) return false;
  }
  return true;
}
