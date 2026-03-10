'use strict';

// ── Layout constants ──────────────────────────────────────────────────────────
const C = {
  W:       900,   // total SVG width
  H:       560,   // total SVG height
  FRAME:    16,   // frame/border thickness
  BAR:      50,   // center bar width
  TRAY:     74,   // borne-off tray width (right side)
  PW:       62,   // point (spike) width
  SPIKE_H: 220,   // spike height
  CR:       24,   // checker radius

  // Colors
  FRAME_C:  '#3A1A08',   // mahogany frame
  SURFACE:  '#1D3A28',   // dark green felt
  BAR_C:    '#28100A',   // bar (darker mahogany)
  TRAY_C:   '#140C06',   // borne-off tray
  SPIKE_A:  '#C8A84B',   // golden spike
  SPIKE_B:  '#8B1C1C',   // burgundy spike
  HUMAN_F:  '#F0E6D0',   // human checker fill (ivory)
  HUMAN_S:  '#C8A070',   // human checker stroke
  AI_F:     '#1C0E05',   // AI checker fill (near-black)
  AI_S:     '#5A3018',   // AI checker stroke
  LABEL:    '#7A6A58',   // point numbers, misc labels
  MIDLINE:  'rgba(0,0,0,0.2)',
};

// ── SVG helpers ───────────────────────────────────────────────────────────────

function el(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function txt(content, attrs = {}) {
  const node = el('text', attrs);
  node.textContent = content;
  return node;
}

// ── Point geometry ────────────────────────────────────────────────────────────

// x of the left edge of point p's spike (p = 1–24)
function pointLeft(p) {
  const { FRAME, BAR, PW } = C;
  const half = 6 * PW;
  if (p >= 1  && p <= 6)  return FRAME + half + BAR + (6  - p) * PW;
  if (p >= 7  && p <= 12) return FRAME +              (12 - p) * PW;
  if (p >= 13 && p <= 18) return FRAME +              (p - 13) * PW;
  if (p >= 19 && p <= 24) return FRAME + half + BAR + (p - 19) * PW;
}

// points 1–12 are on the bottom row; 13–24 on the top
function isBottom(p) { return p >= 1 && p <= 12; }

// Visual column 0–11 for spike color alternation
// (col 0 = left edge of board; top and bottom columns align)
function visualCol(p) {
  return p <= 12 ? 12 - p : p - 13;
}

// y-coordinate for the i-th checker (0-indexed) on point p, given total count
function checkerY(p, i, count) {
  const { H, FRAME, CR, SPIKE_H } = C;
  const bottom  = isBottom(p);
  const baseY   = bottom ? H - FRAME : FRAME;
  const maxOff  = SPIKE_H - CR - 8;               // keep top checker inside spike
  const spacing = count <= 1
    ? 0
    : Math.min(CR * 2, (maxOff - CR) / (count - 1));
  const offset  = CR + i * spacing;
  return bottom ? baseY - offset : baseY + offset;
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function appendSpike(parent, p) {
  const col   = visualCol(p);
  const color = col % 2 === 0 ? C.SPIKE_A : C.SPIKE_B;
  const x     = pointLeft(p);
  const cx    = x + C.PW / 2;
  const bot   = isBottom(p);
  const baseY = bot ? C.H - C.FRAME : C.FRAME;
  const tipY  = bot ? baseY - C.SPIKE_H : baseY + C.SPIKE_H;

  parent.appendChild(el('polygon', {
    points:  `${x},${baseY} ${x + C.PW},${baseY} ${cx},${tipY}`,
    fill:    color,
    opacity: 0.84,
  }));
}

function appendChecker(parent, cx, cy, isHuman, label) {
  const r      = C.CR;
  const fill   = isHuman ? C.HUMAN_F : C.AI_F;
  const stroke = isHuman ? C.HUMAN_S : C.AI_S;

  // Drop shadow
  parent.appendChild(el('circle', {
    cx: cx + 1.5, cy: cy + 2.5, r,
    fill: 'rgba(0,0,0,0.38)',
  }));
  // Body
  parent.appendChild(el('circle', {
    cx, cy, r, fill, stroke, 'stroke-width': 2,
  }));
  // Inner decorative ring
  parent.appendChild(el('circle', {
    cx, cy, r: r * 0.68, fill: 'none',
    stroke, 'stroke-width': 1.2, opacity: 0.4,
  }));
  // Specular highlight
  parent.appendChild(el('ellipse', {
    cx: cx - r * 0.22, cy: cy - r * 0.28,
    rx: r * 0.38, ry: r * 0.22,
    fill: isHuman ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.10)',
  }));
  // Stack-overflow count label
  if (label) {
    parent.appendChild(txt(label, {
      x: cx, y: cy,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill:         isHuman ? '#2A1A08' : '#D0B898',
      'font-size':  11, 'font-weight': 'bold',
      'font-family': 'Georgia, serif',
    }));
  }
}

// ── Spike overlay (for highlights) ───────────────────────────────────────────

function drawOverlay(parent, p, color) {
  const x     = pointLeft(p);
  const cx    = x + C.PW / 2;
  const bot   = isBottom(p);
  const baseY = bot ? C.H - C.FRAME : C.FRAME;
  const tipY  = bot ? baseY - C.SPIKE_H : baseY + C.SPIKE_H;
  parent.appendChild(el('polygon', {
    points: `${x},${baseY} ${x + C.PW},${baseY} ${cx},${tipY}`,
    fill:   color,
  }));
}

// ── Click-target rectangles ───────────────────────────────────────────────────

function drawClickAreas(parent, highlights) {
  const { W, H, FRAME, BAR, PW, TRAY } = C;
  const halfW = 6 * PW;
  const midY  = H / 2;
  const halfH = midY - FRAME;   // 264 px
  const { sources, targets } = highlights;

  for (let p = 1; p <= 24; p++) {
    const bot = isBottom(p);
    const r   = el('rect', {
      x: pointLeft(p), y: bot ? midY : FRAME,
      width: PW, height: halfH,
      fill: 'transparent', 'data-point': p,
    });
    if (sources.has(p) || targets.has(p)) r.style.cursor = 'pointer';
    parent.appendChild(r);
  }

  // Bar — human side (bottom half)
  const barR = el('rect', {
    x: FRAME + halfW, y: midY, width: BAR, height: halfH,
    fill: 'transparent', 'data-point': 'bar-human',
  });
  if (sources.has('bar')) barR.style.cursor = 'pointer';
  parent.appendChild(barR);

  // Tray — bearing-off target (bottom half)
  const trayR = el('rect', {
    x: W - TRAY, y: midY, width: TRAY, height: halfH,
    fill: 'transparent', 'data-point': 'tray',
  });
  if (targets.has('off')) trayR.style.cursor = 'pointer';
  parent.appendChild(trayR);
}

// ── Main render function ──────────────────────────────────────────────────────

function drawBoard(state, highlights = {}) {
  const { selected    = null,
          sources     = new Set(),
          targets     = new Set(),
          hitTargets  = new Set(),
          aiFrom      = new Set(),
          aiTo        = new Set() } = highlights;

  const svg = document.getElementById('board');
  const { W, H, FRAME, BAR, PW, TRAY, CR } = C;
  const halfW = 6 * PW;     // 372 — width of one six-point half
  const trayX = W - TRAY;   // 826 — x where tray begins
  const trayCX = trayX + TRAY / 2;  // 863 — tray center x
  const midY  = H / 2;      // 280 — vertical midpoint

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.innerHTML = '';

  // ── Background & frame ──────────────────────────────────────────────
  // Full board frame (mahogany)
  svg.appendChild(el('rect', {
    x: 0, y: 0, width: W - TRAY, height: H, fill: C.FRAME_C,
  }));
  // Tray background
  svg.appendChild(el('rect', {
    x: trayX, y: 0, width: TRAY, height: H, fill: C.TRAY_C,
  }));
  // Thin separator between board and tray
  svg.appendChild(el('line', {
    x1: trayX, y1: 0, x2: trayX, y2: H,
    stroke: 'rgba(200,168,75,0.18)', 'stroke-width': 1,
  }));

  // ── Playing surfaces ─────────────────────────────────────────────────
  const sY = FRAME, sH = H - 2 * FRAME;

  svg.appendChild(el('rect', {   // left half
    x: FRAME, y: sY, width: halfW, height: sH, fill: C.SURFACE,
  }));
  svg.appendChild(el('rect', {   // bar
    x: FRAME + halfW, y: sY, width: BAR, height: sH, fill: C.BAR_C,
  }));
  svg.appendChild(el('rect', {   // right half
    x: FRAME + halfW + BAR, y: sY, width: halfW, height: sH, fill: C.SURFACE,
  }));

  // Subtle mid-board divider (separates top & bottom territory)
  svg.appendChild(el('line', {
    x1: FRAME, y1: midY, x2: FRAME + 2 * halfW + BAR, y2: midY,
    stroke: C.MIDLINE, 'stroke-width': 1,
  }));

  // ── Spikes ──────────────────────────────────────────────────────────
  for (let p = 1; p <= 24; p++) appendSpike(svg, p);

  // ── AI move highlights ───────────────────────────────────────────────
  // Drawn under player highlights so they don't interfere with interaction.
  for (const p of aiFrom) {
    if (typeof p === 'number') drawOverlay(svg, p, 'rgba(255,150,40,0.32)');
  }
  for (const p of aiTo) {
    if (typeof p === 'number') drawOverlay(svg, p, 'rgba(70,160,255,0.38)');
  }

  // ── Highlights ──────────────────────────────────────────────────────
  // Faint source indicators (selectable source points)
  for (const p of sources) {
    if (typeof p === 'number') drawOverlay(svg, p, 'rgba(200,168,75,0.20)');
  }
  // Selected spike or bar
  if (selected !== null) {
    if (typeof selected === 'number') {
      drawOverlay(svg, selected, 'rgba(220,185,0,0.58)');
    } else if (selected === 'bar') {
      svg.appendChild(el('rect', {
        x: FRAME + halfW + 3, y: midY + 3,
        width: BAR - 6, height: midY - FRAME - 6,
        fill: 'rgba(220,185,0,0.48)', rx: 3,
      }));
    }
  }
  // Target overlays
  for (const t of targets) {
    if (typeof t === 'number') {
      drawOverlay(svg, t, hitTargets.has(t)
        ? 'rgba(240,130,30,0.52)'
        : 'rgba(50,210,110,0.44)');
    }
  }
  // Bearing-off tray target
  if (targets.has('off')) {
    svg.appendChild(el('rect', {
      x: trayX + 5, y: midY + 3,
      width: TRAY - 10, height: midY - FRAME - 6,
      fill: 'rgba(50,210,110,0.38)', rx: 3,
    }));
  }
  // Source bar indicator (faint, when bar has selectable checker)
  if (sources.has('bar') && selected !== 'bar') {
    svg.appendChild(el('rect', {
      x: FRAME + halfW + 3, y: midY + 3,
      width: BAR - 6, height: midY - FRAME - 6,
      fill: 'rgba(200,168,75,0.20)', rx: 3,
    }));
  }

  // ── Point number labels ──────────────────────────────────────────────
  for (let p = 1; p <= 24; p++) {
    const cx  = pointLeft(p) + PW / 2;
    const bot = isBottom(p);
    svg.appendChild(txt(p, {
      x: cx,
      y: bot ? H - 4 : 12,
      'text-anchor':       'middle',
      'dominant-baseline': bot ? 'auto' : 'hanging',
      fill:                C.LABEL,
      'font-size':         10,
      'font-family':       'Georgia, serif',
    }));
  }

  // ── Board checkers ───────────────────────────────────────────────────
  for (let p = 1; p <= 24; p++) {
    const n = state.board[p];
    if (n === 0) continue;
    const count    = Math.abs(n);
    const isHuman  = n > 0;
    const cx       = pointLeft(p) + PW / 2;
    const drawN    = Math.min(count, 5);   // show at most 5 physical circles
    for (let i = 0; i < drawN; i++) {
      const cy    = checkerY(p, i, drawN);
      const label = (i === drawN - 1 && count > 5) ? String(count) : null;
      appendChecker(svg, cx, cy, isHuman, label);
    }
  }

  // ── Bar checkers ─────────────────────────────────────────────────────
  const barCX = FRAME + halfW + BAR / 2;
  for (let i = 0; i < state.bar.human; i++) {
    appendChecker(svg, barCX, H - FRAME - CR - i * (CR * 2 + 3), true, null);
  }
  for (let i = 0; i < state.bar.ai; i++) {
    appendChecker(svg, barCX, FRAME + CR + i * (CR * 2 + 3), false, null);
  }

  // ── Borne-off tray ───────────────────────────────────────────────────
  const offR  = 9;
  const offSp = 17;   // spacing between borne-off checker centers

  // Tray divider line & "OFF" label
  svg.appendChild(el('line', {
    x1: trayX + 10, y1: midY, x2: W - 10, y2: midY,
    stroke: C.LABEL, 'stroke-width': 0.7, opacity: 0.4,
  }));
  svg.appendChild(txt('OFF', {
    x: trayCX, y: midY,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    fill: C.LABEL, 'font-size': 9,
    'font-family': 'Georgia, serif', 'letter-spacing': '0.12em',
  }));

  // Human borne-off — stacks upward from bottom edge
  for (let i = 0; i < state.off.human; i++) {
    svg.appendChild(el('circle', {
      cx: trayCX, cy: H - FRAME - offR - i * offSp, r: offR,
      fill: C.HUMAN_F, stroke: C.HUMAN_S, 'stroke-width': 1.5,
    }));
  }
  // AI borne-off — stacks downward from top edge
  for (let i = 0; i < state.off.ai; i++) {
    svg.appendChild(el('circle', {
      cx: trayCX, cy: FRAME + offR + i * offSp, r: offR,
      fill: C.AI_F, stroke: C.AI_S, 'stroke-width': 1.5,
    }));
  }

  // ── Click areas (transparent, on top for event detection) ───────────
  drawClickAreas(svg, { sources, targets });
}
