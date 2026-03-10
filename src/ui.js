'use strict';

// ── Game & UI state ───────────────────────────────────────────────────────────

let gameState = null;

const ui = {
  selected:          null,   // 'bar' | 1–24 | null  — currently selected source
  turnDice:          [],     // original dice rolled this turn (for grayed display)
  animating:         false,  // true while AI is moving (blocks human input)
  listenersAttached: false,
  aiHighlightFrom:   new Set(),  // points AI moved FROM (shown until human rolls)
  aiHighlightTo:     new Set(),  // points AI moved TO
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
// Fresh (unused) dice get the roll animation.
function renderDice(currentDice) {
  const area = document.getElementById('dice-area');
  area.innerHTML = '';
  if (ui.turnDice.length === 0) return;

  const remaining = [...currentDice];
  let delay = 0;
  for (const v of ui.turnDice) {
    const idx  = remaining.indexOf(v);
    const used = idx === -1;
    if (!used) remaining.splice(idx, 1);
    const dieEl = makeDieEl(v, used);
    if (!used) {
      dieEl.classList.add('rolling');
      dieEl.style.animationDelay = delay + 'ms';
      delay += 55;
    }
    area.appendChild(dieEl);
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

// ── Overlay helpers ───────────────────────────────────────────────────────────

function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}

function showIntroOverlay() {
  setRollButtonActive(false);
  showOverlay('intro-overlay');
}

function showResultOverlay(winner) {
  document.getElementById('result-text').textContent =
    winner === 'human' ? 'You win!' : 'Computer wins';
  showOverlay('result-overlay');
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const canInteract = gameState.turn === 'human' && !ui.animating && gameState.dice.length > 0;
  const moves       = canInteract ? getLegalMoves(gameState) : [];

  const sources    = new Set(moves.map(m => m.from));
  const targetMvs  = ui.selected !== null ? moves.filter(m => m.from === ui.selected) : [];
  const targets    = new Set(targetMvs.map(m => m.to));
  const hitTargets = new Set(targetMvs.filter(m => m.hit).map(m => m.to));

  drawBoard(gameState, {
    selected: ui.selected,
    sources,
    targets,
    hitTargets,
    aiFrom: ui.aiHighlightFrom,
    aiTo:   ui.aiHighlightTo,
  });
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

  let pt;
  if      (ptStr === 'bar-human') pt = 'bar';
  else if (ptStr === 'tray')      pt = 'off';
  else                            pt = parseInt(ptStr, 10);

  const moves = getLegalMoves(gameState);

  if (ui.selected === null) {
    if (moves.some(m => m.from === pt)) {
      ui.selected = pt;
      render();
    }
  } else if (pt === ui.selected) {
    ui.selected = null;
    render();
  } else {
    const move = moves.find(m => m.from === ui.selected && m.to === pt);
    if (move) {
      doMove(move);
    } else if (moves.some(m => m.from === pt)) {
      ui.selected = pt;
      render();
    } else {
      ui.selected = null;
      render();
    }
  }
}

// ── Turn management ───────────────────────────────────────────────────────────

function handleRollClick() {
  if (gameState.turn !== 'human' || gameState.dice.length > 0 || ui.animating) return;

  // Clear AI move highlights as soon as the human picks up their dice
  ui.aiHighlightFrom = new Set();
  ui.aiHighlightTo   = new Set();

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

  // Reset AI highlights for this turn
  ui.aiHighlightFrom = new Set();
  ui.aiHighlightTo   = new Set();

  renderDice(gameState.dice);
  updateHeader();
  setTurnText('Computer thinking…');
  render();

  // Defer the (potentially slow) search so the UI renders the dice first.
  setTimeout(() => {
    const sequence = getBestMoveSequence(gameState);
    let idx = 0;

    function step() {
      if (idx >= sequence.length) {
        gameState.dice = [];
        ui.turnDice    = [];
        ui.animating   = false;
        renderDice([]);
        setTurnText('Computer');
        setTimeout(startHumanTurn, 400);
        return;
      }

      const move = sequence[idx++];

      // Record for AI highlight display
      if (typeof move.from === 'number') ui.aiHighlightFrom.add(move.from);
      if (typeof move.to   === 'number') ui.aiHighlightTo.add(move.to);

      gameState = applyMove(gameState, move);
      renderDice(gameState.dice);
      updateHeader();
      render();

      const winner = getWinner(gameState);
      if (winner) { handleWin(winner); return; }

      setTimeout(step, 480);
    }

    setTimeout(step, 300);
  }, 50);
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
  renderDice([]);
  render();
  // Brief pause so the final board position is visible before the overlay
  setTimeout(() => showResultOverlay(winner), 700);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function startGame() {
  gameState             = createInitialState();
  ui.selected           = null;
  ui.turnDice           = [];
  ui.animating          = false;
  ui.aiHighlightFrom    = new Set();
  ui.aiHighlightTo      = new Set();
  updateHeader();
  renderDice([]);
  setRollButtonActive(true);
  render();
}

function initListeners() {
  document.getElementById('roll-btn').addEventListener('click', handleRollClick);

  document.getElementById('board').addEventListener('click', e => {
    const target = e.target.closest('[data-point]');
    if (target) handlePointClick(target.dataset.point);
  });

  document.getElementById('new-game-btn').addEventListener('click', () => {
    hideOverlay('result-overlay');
    showIntroOverlay();
  });

  document.getElementById('play-btn').addEventListener('click', () => {
    const checked = document.querySelector('input[name=difficulty]:checked');
    const depthMap = { beginner: -1, medium: 1, hard: 2 };
    setAiDepth(depthMap[checked.value] ?? 1);
    hideOverlay('intro-overlay');
    startGame();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    hideOverlay('result-overlay');
    showIntroOverlay();
  });
}
