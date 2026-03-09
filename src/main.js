'use strict';

// ── Initial game state ────────────────────────────────────────────────────────
//
// board[1..24]: positive = human checkers, negative = AI checkers, 0 = empty
//
// Standard backgammon starting position:
//   Human: 2 on 24, 5 on 13, 3 on 8, 5 on 6
//   AI:    2 on 1,  5 on 12, 3 on 17, 5 on 19
//
// Human moves from point 24 → 1 (bearing off at point 0 direction).
// AI   moves from point 1  → 24 (bearing off at point 25 direction).

const state = {
  board: [
     0,   // index 0  (unused)
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
  humanBar: 0,
  aiBar:    0,
  humanOff: 0,
  aiOff:    0,
  turn:     'human',
  dice:     [],
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

drawBoard(state);
