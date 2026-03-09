# Backgammon — Minimax AI

A web-based backgammon game where you play against a computer opponent that uses a minimax algorithm with alpha-beta pruning and a custom heuristic evaluation function.

---

## Phased Implementation Plan

### Phase 1 — Project Scaffold & Board Rendering

**Goal:** Get a static, correctly laid-out backgammon board on screen with no logic yet.

- Set up a plain HTML/CSS/JS project (no framework, keep it portable)
- Design the board layout:
  - 24 points arranged in two rows of 12, with a bar in the center
  - Home boards in the bottom-right (human) and top-right (AI), outer boards on the left
  - Off/borne-off tray areas for both players
- Draw the board using SVG or Canvas — choose SVG for crisp scaling
- Render checkers (15 per player, two colors) at their starting positions
- Style the board deliberately: dark wood grain background, alternating spike colors, clear point numbering, a color palette that feels like a real backgammon set

**Deliverable:** A static board that looks correct and polished at any viewport size.

---

### Phase 2 — Game State Model & Rules Engine

**Goal:** A complete, tested representation of backgammon state and legal move generation.

- Define a `GameState` object:
  - `board[24]` — signed integer per point (positive = human checkers, negative = AI)
  - `bar` — checkers on the bar for each player
  - `borneOff` — checkers borne off for each player
  - `dice` — current roll (array of 1–4 usable die values, accounting for doubles)
  - `turn` — whose turn it is
- Implement dice rolling (two d6, doubles give four moves)
- Implement legal move generation:
  - Must use the bar first if any checker is on it
  - Can only land on open points or blots (single enemy checker → hit)
  - Bearing off rules (all checkers in home board, exact or overshoot on highest point)
  - If no legal moves exist, turn passes
- Write unit tests for edge cases: bearing off, being hit, doubles, forced passing

**Deliverable:** A rules engine that can enumerate all valid moves from any state, verified against known backgammon rules.

---

### Phase 3 — Human Player Interaction

**Goal:** Let the human play a full legal game via click/drag on the board.

- Click-to-move UI:
  - Click a source point (or bar) → highlight legal destinations using the current dice
  - Click a destination → execute the move, consume the die value
  - Visual feedback: highlighted valid targets, checker animations
- Handle the bar: if a checker is on the bar, only bar moves are offered
- After all dice are consumed (or no moves remain), present a "End Turn" confirmation and roll for the AI
- Show the dice visually (pip faces, used dice grayed out)
- Display whose turn it is, current pip count for each player (a standard backgammon metric)

**Deliverable:** A fully playable human side — the human can play a complete game against a do-nothing (random-move) placeholder AI.

---

### Phase 4 — Expectiminimax AI with Alpha-Beta Pruning

**Goal:** Replace the placeholder AI with a principled minimax opponent.

**Algorithm design:**

Backgammon has three node types in the game tree:
1. **Max nodes** — AI chooses the best move from its legal options
2. **Min nodes** — Human (opponent) chooses (from AI's perspective, the worst for AI)
3. **Chance nodes** — dice are rolled; value is the weighted average over all 21 distinct roll outcomes (each with known probability)

The search alternates: `Max → Chance → Min → Chance → Max → ...`

**Pruning:**
- Alpha-beta pruning applies at Max/Min nodes in the normal way
- At chance nodes, star-minimax (or shallow cutoffs based on bounds) can reduce computation
- Iterative deepening with a time budget (e.g., 1.5 seconds per turn) so depth adapts to position complexity

**Heuristic evaluation function** (called at leaf nodes or depth limit):

The evaluation function returns a score from the AI's perspective. Components:

| Feature | Rationale |
|---|---|
| **Pip count delta** | Raw race metric — fewer pips remaining is better |
| **Blot penalty** | Exposed single checkers are vulnerable; penalize by distance from safety |
| **Prime bonus** | Consecutive blocked points (primes) trap opponent checkers |
| **Home board coverage** | Points covered in home board increase hitting power |
| **Bar penalty** | Checkers on the bar are expensive; heavy penalty per checker |
| **Borne-off bonus** | Each checker borne off is permanent progress |
| **Anchor bonus** | Holding a point in opponent's home board provides a safe haven |

Weights are hand-tuned, with the option to adjust them via a config object for experimentation.

**Deliverable:** An AI that plays legal, strategic backgammon. Should beat a random player consistently and give a human intermediate player real competition.

---

### Phase 5 — UI Polish & Game Flow

**Goal:** Make the full game loop feel complete and visually excellent.

- Opening screen: title, "New Game" button, difficulty selector (controls search depth/time budget)
- Smooth checker animations (CSS transitions or requestAnimationFrame)
- Hit animation when a blot is sent to the bar
- Dice roll animation (brief tumble effect before showing result)
- Win/loss screen with pip count history or game summary
- Sound design consideration: subtle click sounds for checker placement (optional, off by default)
- Responsive layout that works at 1024px wide and above
- Accessibility: keyboard navigation fallback, high-contrast mode toggle

**Design choices to make deliberately (not AI defaults):**
- Color palette: deep mahogany board, cream and burgundy checkers, ivory dice
- Typography: a serif for labels (feels classic), monospace for pip counts
- Board orientation: human always plays from bottom, AI from top
- Point numbering: shown on hover to reduce clutter
- No generic "Player 1 / Player 2" — label them "You" and "Computer"

**Deliverable:** A polished, shippable game that feels intentional in every visual and interaction detail.

---

### Phase 6 — Testing, Tuning & Documentation

**Goal:** Verify correctness, tune the AI, and document the project.

- Play-test against the AI at all difficulty levels; fix any illegal-move bugs surfaced
- Profile the expectiminimax search: measure nodes evaluated per turn, optimize hot paths
- Tune heuristic weights by self-play comparison (higher-weight config vs. lower)
- Write a short design doc (in this README) explaining:
  - Key algorithm decisions and trade-offs
  - Heuristic feature choices and their backgammon strategic rationale
  - What was hardest to implement and what you would do differently

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | Vanilla JavaScript (ES2022) | No build step, runs anywhere, keeps focus on algorithms |
| Rendering | SVG (inline, JS-generated) | Crisp at all scales, easy hit-testing for clicks |
| Styling | Plain CSS with custom properties | Full control, no framework defaults to fight |
| Testing | Browser console + manual test harness | Lightweight; no test runner overhead |

---

## File Structure (planned)

```
/
├── index.html          # Shell, loads everything
├── style.css           # All visual design
├── src/
│   ├── board.js        # SVG board rendering
│   ├── state.js        # GameState model
│   ├── rules.js        # Legal move generation
│   ├── ai.js           # Expectiminimax + heuristic
│   ├── ui.js           # Click handling, animations
│   └── main.js         # Game loop, wires everything together
└── README.md
```

---

## AI Design Notes

### Why Expectiminimax, not plain Minimax?

Standard minimax assumes both players have perfect information and make deterministic choices. Backgammon dice introduce a chance element between every pair of player decisions. Expectiminimax handles this by inserting **chance nodes** whose value is the **expected value** over all possible dice outcomes — weighted by their probability (e.g., rolling 6-6 has probability 1/36, rolling 3-1 has probability 2/36 because it can come up two ways).

### Branching Factor Reality

After a dice roll, a player may have anywhere from 0 to ~20+ distinct move sequences. Over 21 possible roll outcomes, a single chance node fans out to potentially hundreds of states. This is why:
- The search depth is kept to 2–3 ply (one full round = one chance node + one player move)
- The heuristic must be accurate enough to evaluate mid-game positions reliably
- Alpha-beta pruning at Max/Min nodes is essential

### Heuristic Calibration

The pip count alone is a strong signal in racing positions. In contact positions (checkers still in each other's home boards), structural features (primes, anchors, blot exposure) dominate. The evaluation function detects which phase the game is in and shifts weights accordingly — a technique borrowed from competitive backgammon engines like GNU Backgammon.
