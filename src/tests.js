'use strict';

// ── Minimal test harness ──────────────────────────────────────────────────────

let _passed = 0, _failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓  ${msg}`);
    _passed++;
  } else {
    console.error(`  ✗  ${msg}`);
    _failed++;
  }
}

function eq(a, b, msg) {
  assert(a === b, `${msg}  (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}

// Build a minimal state for ad-hoc tests
function makeState(overrides = {}) {
  return Object.assign({
    board: new Array(25).fill(0),
    bar:   { human: 0, ai: 0 },
    off:   { human: 0, ai: 0 },
    dice:  [],
    turn:  'human',
  }, overrides);
}

// ── Test suites ───────────────────────────────────────────────────────────────

function testInitialState() {
  console.group('Initial state');
  const s = createInitialState();

  let hCount = 0, aCount = 0;
  for (let p = 1; p <= 24; p++) {
    if (s.board[p] > 0) hCount += s.board[p];
    if (s.board[p] < 0) aCount -= s.board[p];
  }
  eq(hCount, 15, 'Human has 15 checkers on board');
  eq(aCount, 15, 'AI has 15 checkers on board');
  eq(calcPipCount(s, 'human'), 167, 'Human pip count = 167');
  eq(calcPipCount(s, 'ai'),    167, 'AI pip count = 167');
  eq(getWinner(s), null, 'No winner at start');
  assert(!allInHome(s), 'Human not in home at start');
  console.groupEnd();
}

function testAllInHome() {
  console.group('allInHome');

  // Human all in home
  const s1 = makeState({ board: new Array(25).fill(0), turn: 'human' });
  s1.board[1] = 5; s1.board[3] = 5; s1.board[6] = 5;
  assert(allInHome(s1), 'Human in home when all checkers on 1–6');

  s1.board[7] = 1;
  assert(!allInHome(s1), 'Human NOT in home when checker on 7');

  // Bar blocks home
  const s2 = makeState({ board: new Array(25).fill(0), turn: 'human' });
  s2.board[1] = 15; s2.bar.human = 1;
  assert(!allInHome(s2), 'Human NOT in home when checker on bar');

  // AI all in home (19–24)
  const s3 = makeState({ board: new Array(25).fill(0), turn: 'ai' });
  s3.board[19] = -5; s3.board[22] = -5; s3.board[24] = -5;
  assert(allInHome(s3), 'AI in home when all checkers on 19–24');

  s3.board[18] = -1;
  assert(!allInHome(s3), 'AI NOT in home when checker on 18');

  console.groupEnd();
}

function testBarEntry() {
  console.group('Bar entry');

  // Human entering: 25 - die = target point
  const s = makeState({ dice: [3, 5], turn: 'human' });
  s.bar.human = 1;
  const moves = singleLegalMoves(s);

  assert(moves.every(m => m.from === 'bar'), 'All moves come from bar');
  assert(moves.some(m => m.to === 22), 'Can enter on 22 with die 3  (25-3)');
  assert(moves.some(m => m.to === 20), 'Can enter on 20 with die 5  (25-5)');

  // Blocked entry
  const s2 = makeState({ dice: [3, 5], turn: 'human' });
  s2.bar.human  = 1;
  s2.board[22]  = -2;   // AI blocks point 22
  const m2 = singleLegalMoves(s2);
  assert(!m2.some(m => m.to === 22), 'Cannot enter on 22 when blocked by AI');
  assert(m2.some(m => m.to === 20),  'Can still enter on 20');

  // AI entering: die = target point
  const s3 = makeState({ dice: [1, 4], turn: 'ai' });
  s3.bar.ai = 1;
  const m3 = singleLegalMoves(s3);
  assert(m3.every(m => m.from === 'bar'), 'AI bar moves come from bar');
  assert(m3.some(m => m.to === 1), 'AI enters on 1 with die 1');
  assert(m3.some(m => m.to === 4), 'AI enters on 4 with die 4');

  // All AI entry points blocked → no legal moves
  const s4 = makeState({ dice: [2, 3], turn: 'ai' });
  s4.bar.ai = 1;
  s4.board[2] = 2; s4.board[3] = 2;   // human blocks both entry points
  eq(singleLegalMoves(s4).length, 0, 'No entry when both points blocked');

  console.groupEnd();
}

function testHitAndApplyMove() {
  console.group('Hit detection & applyMove');

  const s = makeState({ dice: [3], turn: 'human' });
  s.board[8] =  1;   // human on 8
  s.board[5] = -1;   // AI blot on 5

  const moves   = singleLegalMoves(s);
  const hitMove = moves.find(m => m.from === 8 && m.to === 5);
  assert(!!hitMove,          'Move from 8→5 exists');
  assert(hitMove.hit,        'Move is flagged as hit');

  const s2 = applyMove(s, hitMove);
  eq(s2.board[8],    0, 'Point 8 empty after move');
  eq(s2.board[5],    1, 'Human checker now on 5');
  eq(s2.bar.ai,      1, 'AI blot sent to bar');
  eq(s2.bar.human,   0, 'Human bar unchanged');
  eq(s2.dice.length, 0, 'Die consumed');

  // Hit by AI
  const s3 = makeState({ dice: [4], turn: 'ai' });
  s3.board[15] = -1;   // AI on 15
  s3.board[19] =  1;   // human blot on 19
  const aiHit = singleLegalMoves(s3).find(m => m.from === 15 && m.to === 19);
  assert(!!aiHit && aiHit.hit, 'AI can hit human blot on 19');
  const s4 = applyMove(s3, aiHit);
  eq(s4.board[19],    -1, 'AI checker on 19');
  eq(s4.bar.human,     1, 'Human blot sent to bar');

  console.groupEnd();
}

function testBearingOff() {
  console.group('Bearing off');

  // Exact bear-off
  const s1 = makeState({ dice: [3], turn: 'human' });
  s1.board[3] = 1; s1.board[1] = 1;
  const m1 = singleLegalMoves(s1);
  assert(m1.some(m => m.from === 3 && m.to === 'off'), 'Exact bear-off from 3 with die 3');

  // Overshoot blocked by higher checker
  assert(!m1.some(m => m.from === 1 && m.to === 'off'),
    'Cannot overshoot from 1 when higher checker on 3');

  // Overshoot allowed when no higher checker
  const s2 = makeState({ dice: [5], turn: 'human' });
  s2.board[2] = 1;
  const m2 = singleLegalMoves(s2);
  assert(m2.some(m => m.from === 2 && m.to === 'off'),
    'Overshoot from 2 with die 5 when no higher checker');

  // applyMove: bear off increments off count
  const s3 = makeState({ dice: [4], turn: 'human' });
  s3.board[4] = 2;
  const bm = singleLegalMoves(s3).find(m => m.to === 'off');
  const s4 = applyMove(s3, bm);
  eq(s4.off.human, 1, 'off.human incremented after bear-off');
  eq(s4.board[4],  1, 'One checker remains on point 4');

  // AI exact bear-off (home 19–24, exits past 25)
  const s5 = makeState({ dice: [6], turn: 'ai' });
  s5.board[19] = -1;   // 19+6=25 → exact
  const aiMoves = singleLegalMoves(s5);
  assert(aiMoves.some(m => m.from === 19 && m.to === 'off'),
    'AI exact bear-off from 19 with die 6');

  // AI overshoot blocked
  const s6 = makeState({ dice: [2], turn: 'ai' });
  s6.board[24] = -1; s6.board[19] = -1;  // checker further from edge on 19
  const aiMoves2 = singleLegalMoves(s6);
  assert(!aiMoves2.some(m => m.from === 24 && m.to === 'off'),
    'AI cannot overshoot from 24 when checker on 19');

  console.groupEnd();
}

function testForcedPass() {
  console.group('Forced pass');

  // Human on bar, all entry points blocked
  const s = makeState({ dice: [1, 2], turn: 'human' });
  s.bar.human   = 1;
  s.board[24]   = -2;   // blocks 25-1=24
  s.board[23]   = -2;   // blocks 25-2=23
  eq(getLegalMoves(s).length, 0, 'No legal moves → forced pass');

  console.groupEnd();
}

function testMustUseHigherDie() {
  console.group('Must use higher die');

  // Human on 5, AI blocks 2 (die 3 blocked), die 5 → exact bear-off
  const s = makeState({ dice: [3, 5], turn: 'human' });
  s.board[5]  =  1;
  s.board[2]  = -2;   // AI blocks point 2 (5-3)
  // die 3: 5-3=2, blocked.  die 5: 5-5=0, exact bear-off. ✓

  const legal = getLegalMoves(s);
  assert(legal.length === 1, 'Exactly one legal move');
  assert(legal[0].die === 5, 'Must use the higher die (5)');
  assert(legal[0].to === 'off', 'Move is a bear-off');

  console.groupEnd();
}

function testDoubles() {
  console.group('Doubles');

  // Doubles give 4 moves
  let doublesRolled = false;
  for (let i = 0; i < 200; i++) {
    const d = rollDice();
    if (d.length === 4) { doublesRolled = true; break; }
  }
  assert(doublesRolled, 'rollDice() eventually returns 4 dice (doubles)');

  // Each die value must be 1–6
  for (let i = 0; i < 50; i++) {
    const d = rollDice();
    assert(d.every(v => v >= 1 && v <= 6), `rollDice() values in [1,6]: [${d}]`);
  }

  // With [4,4,4,4] all four can be used
  const s = makeState({ dice: [4, 4, 4, 4], turn: 'human' });
  s.board[24] = 4;   // 4 checkers on 24; 24-4=20 (empty)
  const seqs = allMoveSequences(s);
  eq(seqs[0].length, 4, 'Can use all 4 dice with doubles');

  console.groupEnd();
}

function testGetLegalMovesStart() {
  console.group('getLegalMoves — starting position');

  const s = createInitialState();
  s.dice = [3, 1];

  const legal = getLegalMoves(s);
  assert(legal.length > 0, 'Has legal moves with [3,1] at start');
  assert(legal.every(m => m.from !== 'bar'), 'No bar moves at start');
  assert(legal.some(m => m.from === 8 && m.to === 5),  'Can move 8→5 (die 3)');
  assert(legal.some(m => m.from === 6 && m.to === 5),  'Can move 6→5 (die 1)');
  assert(legal.some(m => m.from === 24 && m.to === 23),'Can move 24→23 (die 1)');

  console.groupEnd();
}

// ── Runner ────────────────────────────────────────────────────────────────────

function runTests() {
  _passed = 0; _failed = 0;
  console.group('=== Backgammon Rules Tests ===');

  testInitialState();
  testAllInHome();
  testBarEntry();
  testHitAndApplyMove();
  testBearingOff();
  testForcedPass();
  testMustUseHigherDie();
  testDoubles();
  testGetLegalMovesStart();

  console.groupEnd();
  const status = _failed === 0 ? '✓ All tests passed' : `✗ ${_failed} test(s) failed`;
  console.log(`\n${status}  (${_passed} passed, ${_failed} failed)`);
  return _failed === 0;
}

// Auto-run on page load
runTests();
