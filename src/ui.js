'use strict';

// ── Game & UI state ───────────────────────────────────────────────────────────

let gameState = null;

const ui = {
  selected:          null,   // 'bar' | 1–24 | null  — currently selected source
  turnDice:          [],     // original dice rolled this turn (for grayed display)
  animating:         false,  // true while AI is moving (blocks human input)
  listenersAttached: false,
};

// ── Pip positions (column, row) on a 3×3 grid ─────────────────────────────────
const PIPS = {
  1: [[1,1]],
  2: [[0,0],[2,2]],
  3: [[0,0],[1,1],[2,2]],
  4: [[0,0],[2,0],[0,2],[2,2]],
  5: [[0,0],[2,0],[1,1],[0,2],[2,2]],
  6: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]],
};

function makeDieEl(value, used) {
  const die = document.createElement('div');
  die.className = 'die' + (used ? ' used' : '');
  for (const [c, r] of PIPS[value]) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    pip.style.left = [25, 50, 75][c] + '%';
    pip.style.top  = [25, 50, 75][r] + '%';
    die.appendChild(pip);
  }
  return die;
}

// Show dice in the footer, graying out consumed ones.
function renderDice(currentDice) {
  const area = document.getElementById('dice-area');
  area.innerHTML = '';
  if (ui.turnDice.length === 0) return;

  const remaining = [...currentDice];
  for (const v of ui.turnDice) {
    const idx  = remaining.indexOf(v);
    const used = idx === -1;
    if (!used) remaining.splice(idx, 1);
    area.appendChild(makeDieEl(v, used));
  }
}

// ── Header helpers ────────────────────────────────────────────────────────────

function setTurnText(msg) {
  document.getElementById('turn-text').textContent = msg;
}

function updateHeader() {
  document.getElementById('human-pips').textContent = calcPipCount(gameState, 'human');
  document.getElementById('ai-pips').textContent    = calcPipCount(gameState, 'ai');
  setTurnText(gameState.turn === 'human' ? 'Your Turn' : 'Computer');
}

function setRollButtonActive(active) {
  const btn = document.getElementById('roll-btn');
  btn.disabled = !active;
  btn.style.opacity = active ? '' : '0.35';
  btn.classList.toggle('btn-primary', active);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const canInteract = gameState.turn === 'human' && !ui.animating && gameState.dice.length > 0;
  const moves       = canInteract ? getLegalMoves(gameState) : [];

  const sources    = new Set(moves.map(m => m.from));
  const targetMvs  = ui.selected !== null ? moves.filter(m => m.from === ui.selected) : [];
  const targets    = new Set(targetMvs.map(m => m.to));
  const hitTargets = new Set(targetMvs.filter(m => m.hit).map(m => m.to));

  drawBoard(gameState, { selected: ui.selected, sources, targets, hitTargets });
}

// ── Move execution ────────────────────────────────────────────────────────────

function doMove(move) {
  gameState      = applyMove(gameState, move);
  ui.selected    = null;
  renderDice(gameState.dice);
  updateHeader();
  render();

  const winner = getWinner(gameState);
  if (winner) { handleWin(winner); return; }

  if (getLegalMoves(gameState).length === 0) {
    setTimeout(endHumanTurn, 350);
  }
}

// ── Click handling ────────────────────────────────────────────────────────────

function handlePointClick(ptStr) {
  if (gameState.turn !== 'human' || ui.animating || gameState.dice.length === 0) return;

  // Map SVG data-point values to move from/to semantics
  let pt;
  if      (ptStr === 'bar-human') pt = 'bar';
  else if (ptStr === 'tray')      pt = 'off';
  else                            pt = parseInt(ptStr, 10);

  const moves = getLegalMoves(gameState);

  if (ui.selected === null) {
    // Try to select this as a source
    if (moves.some(m => m.from === pt)) {
      ui.selected = pt;
      render();
    }
  } else if (pt === ui.selected) {
    // Deselect
    ui.selected = null;
    render();
  } else {
    const move = moves.find(m => m.from === ui.selected && m.to === pt);
    if (move) {
      doMove(move);
    } else if (moves.some(m => m.from === pt)) {
      // Switch to a different source
      ui.selected = pt;
      render();
    } else {
      // Click on neutral area — deselect
      ui.selected = null;
      render();
    }
  }
}

// ── Turn management ───────────────────────────────────────────────────────────

function handleRollClick() {
  if (gameState.turn !== 'human' || gameState.dice.length > 0 || ui.animating) return;

  gameState.dice = rollDice();
  ui.turnDice    = [...gameState.dice];
  setRollButtonActive(false);
  renderDice(gameState.dice);

  const moves = getLegalMoves(gameState);
  if (moves.length === 0) {
    setTurnText('No moves — passing');
    setTimeout(endHumanTurn, 1400);
    return;
  }
  render();
}

function endHumanTurn() {
  ui.selected  = null;
  gameState.dice = [];
  ui.turnDice  = [];
  renderDice([]);
  setTurnText('Computer…');
  setTimeout(runAiTurn, 700);
}

function runAiTurn() {
  gameState.turn = 'ai';
  gameState.dice = rollDice();
  ui.turnDice    = [...gameState.dice];
  ui.animating   = true;
  renderDice(gameState.dice);
  updateHeader();
  render();

  function step() {
    const moves = getLegalMoves(gameState);
    if (moves.length === 0) {
      gameState.dice = [];
      ui.turnDice    = [];
      ui.animating   = false;
      renderDice([]);
      setTimeout(startHumanTurn, 400);
      return;
    }
    // Pick a random legal move
    const move = moves[Math.floor(Math.random() * moves.length)];
    gameState = applyMove(gameState, move);
    renderDice(gameState.dice);
    updateHeader();
    render();

    const winner = getWinner(gameState);
    if (winner) { handleWin(winner); return; }

    setTimeout(step, 480);
  }

  setTimeout(step, 700);
}

function startHumanTurn() {
  gameState.turn = 'human';
  gameState.dice = [];
  ui.turnDice    = [];
  ui.selected    = null;
  ui.animating   = false;
  updateHeader();
  renderDice([]);
  setRollButtonActive(true);
  render();
}

// ── Win / reset ───────────────────────────────────────────────────────────────

function handleWin(winner) {
  ui.animating = true;
  setTurnText(winner === 'human' ? 'You win!' : 'Computer wins');
  renderDice([]);
  render();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function startGame() {
  gameState      = createInitialState();
  ui.selected    = null;
  ui.turnDice    = [];
  ui.animating   = false;
  updateHeader();
  renderDice([]);
  setRollButtonActive(true);
  render();

  if (!ui.listenersAttached) {
    document.getElementById('roll-btn').addEventListener('click', handleRollClick);
    document.getElementById('new-game-btn').addEventListener('click', startGame);
    document.getElementById('board').addEventListener('click', e => {
      const target = e.target.closest('[data-point]');
      if (target) handlePointClick(target.dataset.point);
    });
    ui.listenersAttached = true;
  }
}
