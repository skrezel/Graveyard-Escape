/*
  Graveyard Escape — the game: sneaking, sprinting, noise, ghosts, hiding, hazards and screens.
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ---------- tuning ----------
  const SPEED = { sneak: 1.9, run: 3.7, sprint: 5.6 };                     // squares per second
  const NOISE = { run: 2.5, sprint: 5, pebble: 6, yell: 4.5, gate: 8 };   // how far each sound carries
  const PLAYER_R = 0.28;
  const GHOST_R = 0.3;
  const MAX_HEARTS = 3;
  const HAND_CYCLE = 3.6;      // seconds for a zombie hand to go down and come back up
  const FOV = 1.75;            // a ghost's cone of sight (about 100°)
  const SNEAK_ZONE = 0.55;     // dragging less than this much of the joystick = sneaking
  const SOLID = new Set(['#', 'T', 't', '+', 'P', 'B', 'C', 'M']);
  const HIDE_SPOTS = new Set(['B', 'C', 'M']);
  const KNOWN = new Set('#Tt+PBCM._whbvkcso@GWXE'.split(''));
  const SPOT_NAME = { B: 'bush', C: 'coffin', M: 'crypt' };
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // ---------- saved progress ----------
  const SAVE_KEY = 'graveyard-escape-v2';
  const save = loadSave();
  function loadSave() {
    const base = { hero: { name: '', skin: 0, hair: 0, hairStyle: 0, outfit: 0, costume: 0 }, unlocked: 1, stars: [], best: [], sound: true, madeHero: false };
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s) return { ...base, ...s, hero: { ...base.hero, ...s.hero } };
      const old = JSON.parse(localStorage.getItem('graveyard-escape-v1') || 'null');   // keep her character from the first version
      if (old && old.hero) return { ...base, hero: { ...base.hero, ...old.hero }, madeHero: !!old.madeHero, sound: old.sound !== false };
    } catch (e) { /* ignore broken saves */ }
    return base;
  }
  function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private browsing */ } }
  if (/[?&]unlock/.test(location.search)) save.unlocked = LEVELS.length;

  // ---------- canvas ----------
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  const dctx = dark.getContext('2d');
  const mapCanvas = document.createElement('canvas');
  const mini = document.createElement('canvas');
  let W = 0, H = 0, DPR = 1, TS = 48, SC = 48;   // TS = CSS pixels per square, SC = device pixels per square
  let TOP = 62;                                   // space kept free at the top for the hearts and keys

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    dark.width = canvas.width;
    dark.height = canvas.height;
    TOP = 62 + $('sat').offsetHeight;   // + the iPhone notch
    if (L) { computeScale(); buildMap(); }
  }
  // Zoom so the map always fills the screen (and leaves room for the hearts and keys at the top)
  function computeScale() {
    const fill = L ? Math.max(W / L.w, (H - TOP) / L.h) : 0;
    TS = clamp(Math.max(Math.min(W, H) / 8.5, fill), 34, 80);
    SC = TS * DPR;
  }

  // ---------- game state ----------
  let L = null;          // the level being played
  let P = null;          // the player
  let state = 'menu';    // menu | intro | play | paused | caught | won | lost
  let T = 0;
  const cam = { x: 0, y: 0 };
  let shakeT = 0, flashT = 0, caughtT = 0;
  let miniDirty = true, miniBig = false, miniRect = null;
  const particles = [];
  const tipsShown = new Set();

  // =====================================================================
  //  LEVELS
  // =====================================================================
  // Checks a map for mistakes and explains them in plain words.
  function validateLevel(def) {
    const problems = [];
    const rows = def.map || [];
    if (!rows.length) return ['the map is empty'];
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((r, y) => { if (r.length !== w) problems.push(`row ${y + 1} has ${r.length} letters but should have ${w}`); });
    const at = (x, y) => (y < 0 || y >= rows.length || x < 0 || x >= w) ? '#' : (rows[y][x] || '#');
    let start = null, exits = 0;
    const unknown = new Set();
    rows.forEach((r, y) => r.split('').forEach((ch, x) => {
      if (ch === '@') { if (start) problems.push('there is more than one @ (start)'); start = { x, y }; }
      if (ch === 'E') exits++;
      if (!KNOWN.has(ch)) unknown.add(ch);
    }));
    if (unknown.size) problems.push(`unknown letters: ${[...unknown].join(' ')}`);
    if (!start) { problems.push('there is no @ (where you start)'); return problems; }
    if (exits !== 1) problems.push(`there should be exactly one exit gate E (found ${exits})`);
    // flood fill from the start (the gate counts as open)
    const seen = new Set([start.x + ',' + start.y]);
    const q = [start];
    while (q.length) {
      const { x, y } = q.pop();
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
        if (seen.has(key) || SOLID.has(at(nx, ny))) continue;
        seen.add(key);
        q.push({ x: nx, y: ny });
      }
    }
    const names = { k: 'key', c: 'candy', s: 'lollipop', o: 'pebbles', E: 'exit gate', G: 'ghost', W: 'banshee' };
    rows.forEach((r, y) => r.split('').forEach((ch, x) => {
      if (names[ch] && !seen.has(x + ',' + y)) problems.push(`the ${names[ch]} at column ${x + 1}, row ${y + 1} can't be reached`);
      if (HIDE_SPOTS.has(ch) && !DIRS4.some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)))) {
        problems.push(`the ${SPOT_NAME[ch]} at column ${x + 1}, row ${y + 1} can't be reached`);
      }
    }));
    return problems;
  }

  function loadLevel(idx, demo) {
    const def = LEVELS[idx];
    const rows = def.map;
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    L = {
      idx, def, w, h, demo: !!demo, grid: [], open: [], seen: new Uint8Array(w * h),
      start: { x: 1.5, y: 1.5 }, gate: null,
      keys: 0, keysTotal: 0, candy: 0, candyTotal: 0,
      items: [], hands: [], bats: [], ghosts: [], spots: [], pumpkins: [], fog: [], flies: [], rings: [], stones: [],
      time: 0, heartsLost: 0, spotted: false, chasing: false, caughtBy: null,
    };
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        let ch = rows[y][x] || '#';
        if (!KNOWN.has(ch)) ch = '.';
        const cx = x + 0.5, cy = y + 0.5, ph = Math.random() * 6;
        switch (ch) {
          case '@': L.start = { x: cx, y: cy }; ch = '.'; break;
          case 'G': L.ghosts.push(makeGhost(cx, cy, 'ghost')); ch = '.'; break;
          case 'W': L.ghosts.push(makeGhost(cx, cy, 'banshee')); ch = '.'; break;
          case 'X': L.ghosts.push(makeGhost(cx, cy, 'phantom')); ch = '.'; break;
          case 'k': L.items.push({ type: 'key', x: cx, y: cy, ph }); L.keysTotal++; ch = '.'; break;
          case 'c': L.items.push({ type: 'candy', x: cx, y: cy, ph }); L.candyTotal++; ch = '.'; break;
          case 's': L.items.push({ type: 'speed', x: cx, y: cy, ph }); ch = '.'; break;
          case 'o': L.items.push({ type: 'pebbles', x: cx, y: cy, ph }); ch = '.'; break;
          case 'h': L.hands.push({ x: cx, y: cy, phase: Math.random() * HAND_CYCLE }); break;
          case 'b': L.bats.push({ x: cx, y: cy, ax: 1, ay: 0, dir: 1, t: ph, rx: cx, ry: cy }); ch = '.'; break;
          case 'v': L.bats.push({ x: cx, y: cy, ax: 0, ay: 1, dir: 1, t: ph, rx: cx, ry: cy }); ch = '.'; break;
          case 'B': case 'C': case 'M': L.spots.push({ type: ch, x: cx, y: cy, occupied: false, shake: 0 }); break;
          case 'E': L.gate = { x: cx, y: cy, open: false }; break;
          case 'P': L.pumpkins.push({ x: cx, y: cy, ph }); break;
        }
        row.push(ch);
      }
      L.grid.push(row);
    }
    if (!L.gate) L.gate = { x: L.start.x, y: L.start.y, open: false };
    if (L.keysTotal === 0) L.gate.open = true;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!isSolid(x, y) && L.grid[y][x] !== 'E') L.open.push({ x, y });
    for (let i = 0; i < Math.ceil(w * h / 70); i++) {
      L.fog.push({ x: Math.random() * w, y: Math.random() * h, r: 1.5 + Math.random() * 2.5, v: 0.12 + Math.random() * 0.2 });
    }
    for (let i = 0; i < Math.ceil(w * h / 40); i++) {
      const o = L.open[(Math.random() * L.open.length) | 0];
      L.flies.push({ x: o.x + 0.5, y: o.y + 0.5, ph: Math.random() * 10 });
    }
    miniDirty = true;
    miniBig = false;
    computeScale();
    buildMap();
    cam.x = demo ? w / 2 : L.start.x;
    cam.y = demo ? h / 2 : L.start.y;
  }

  function buildMap() {
    // Paint the map once into its own canvas (keeping it under ~9 million pixels for iPhone memory)
    const px = Math.max(16, Math.min(Math.round(SC), Math.floor(Math.sqrt(9e6 / (L.w * L.h)))));
    mapCanvas.width = L.w * px;
    mapCanvas.height = L.h * px;
    const m = mapCanvas.getContext('2d');
    m.setTransform(px, 0, 0, px, 0, 0);
    Art.paintMap(m, L.grid, Art.rng(L.idx * 7919 + 13));
  }

  function tileAt(x, y) { return (y < 0 || y >= L.h || x < 0 || x >= L.w) ? '#' : L.grid[y][x]; }
  function isSolid(x, y) { const c = tileAt(x, y); return c === 'E' ? !L.gate.open : SOLID.has(c); }

  // =====================================================================
  //  MOVEMENT, SIGHT AND PATHS
  // =====================================================================
  function hitsSolid(x, y, r) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tx, ty)) return true;
    return false;
  }
  function moveAxis(b, d, r, axis) {
    if (!d) return false;
    const nx = axis === 'x' ? b.x + d : b.x, ny = axis === 'y' ? b.y + d : b.y;
    if (!hitsSolid(nx, ny, r)) { b.x = nx; b.y = ny; return false; }
    // slide up flush against whatever we bumped into
    if (axis === 'x') {
      const edge = d > 0 ? Math.floor(nx + r) - r - 0.001 : Math.floor(nx - r) + 1 + r + 0.001;
      if ((edge - b.x) * d > 0 && !hitsSolid(edge, b.y, r)) b.x = edge;
    } else {
      const edge = d > 0 ? Math.floor(ny + r) - r - 0.001 : Math.floor(ny - r) + 1 + r + 0.001;
      if ((edge - b.y) * d > 0 && !hitsSolid(b.x, edge, r)) b.y = edge;
    }
    return true;
  }
  // assist = gently steer round corners so you don't get stuck on the edge of a tombstone
  function moveBody(b, dx, dy, r, assist) {
    const bx = moveAxis(b, dx, r, 'x');
    const by = moveAxis(b, dy, r, 'y');
    if (!assist) return;
    if (bx && Math.abs(dy) < Math.abs(dx) * 0.6) {
      const row = Math.floor(b.y);
      if (!isSolid(Math.floor(b.x + Math.sign(dx) * (r + 0.05)), row)) {
        const off = row + 0.5 - b.y;
        moveAxis(b, Math.sign(off) * Math.min(Math.abs(off), Math.abs(dx)), r, 'y');
      }
    }
    if (by && Math.abs(dx) < Math.abs(dy) * 0.6) {
      const col = Math.floor(b.x);
      if (!isSolid(col, Math.floor(b.y + Math.sign(dy) * (r + 0.05)))) {
        const off = col + 0.5 - b.x;
        moveAxis(b, Math.sign(off) * Math.min(Math.abs(off), Math.abs(dy)), r, 'x');
      }
    }
  }
  function clearLine(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (isSolid(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t))) return false;
    }
    return true;
  }
  function openNear(x, y) {
    if (!isSolid(Math.floor(x), Math.floor(y))) return { x, y };
    for (const [dx, dy] of DIRS8) {
      const nx = Math.floor(x) + dx, ny = Math.floor(y) + dy;
      if (!isSolid(nx, ny)) return { x: nx + 0.5, y: ny + 0.5 };
    }
    return { x, y };
  }
  // Shortest way through the graveyard (ghosts use this to find you)
  function findPath(from, to) {
    const w = L.w, h = L.h;
    const sx = Math.floor(from.x), sy = Math.floor(from.y), tx = Math.floor(to.x), ty = Math.floor(to.y);
    if (sx === tx && sy === ty) return [{ x: to.x, y: to.y }];
    if (isSolid(tx, ty)) return [];
    const prev = new Int32Array(w * h).fill(-1);
    const start = sy * w + sx, goal = ty * w + tx;
    prev[start] = start;
    const q = [start];
    for (let head = 0; head < q.length; head++) {
      const cur = q[head];
      if (cur === goal) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (prev[ni] !== -1 || isSolid(nx, ny)) continue;
        if (dx && dy && (isSolid(cx + dx, cy) || isSolid(cx, cy + dy))) continue;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    if (prev[goal] === -1) return [];
    const path = [];
    for (let cur = goal; cur !== start; cur = prev[cur]) path.push({ x: (cur % w) + 0.5, y: ((cur / w) | 0) + 0.5 });
    path.reverse();
    path[path.length - 1] = { x: to.x, y: to.y };
    return path;
  }

  // =====================================================================
  //  THE PLAYER
  // =====================================================================
  function makePlayer() {
    return {
      x: L.start.x, y: L.start.y, hearts: MAX_HEARTS,
      walk: 0, moving: false, mode: 'idle', flip: false, back: false, side: false, fx: 1, fy: 0,
      hidden: false, spot: null, hideFrom: null, exitHold: 0,
      stuck: 0, stuckType: '', hazardCD: 0, invuln: 0, boost: 0,
      stamina: 1, exhausted: false, restT: 0, noiseT: 0,
      pebbles: L.def.pebbles != null ? L.def.pebbles : 2,
    };
  }

  function rest(p, dt) {
    if (p.restT > 0) p.restT -= dt;
    else p.stamina = Math.min(1, p.stamina + dt * 0.22);
    if (p.exhausted && p.stamina > 0.35) p.exhausted = false;
  }

  function updatePlayer(dt) {
    const p = P;
    p.hazardCD = Math.max(0, p.hazardCD - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.boost = Math.max(0, p.boost - dt);
    p.mode = 'idle';
    const v = inputVector();
    if (p.hidden) {
      p.moving = false;
      rest(p, dt);
      // pushing the joystick hard for a moment climbs out (a small drag only aims your pebbles)
      if (v.mag >= SNEAK_ZONE) { p.exitHold += dt; if (p.exitHold > 0.3) leaveHiding(true); } else p.exitHold = 0;
      return;
    }
    if (p.stuck > 0) { p.stuck -= dt; p.moving = false; rest(p, dt); return; }
    if (v.mag <= 0) { p.moving = false; rest(p, dt); return; }

    let mode = input.sneakKey || v.mag < SNEAK_ZONE ? 'sneak' : 'run';
    if ((input.sprintBtn || input.sprintKey) && !p.exhausted && (p.stamina > 0 || p.boost > 0)) mode = 'sprint';
    let sp = mode === 'sneak' ? SPEED.sneak * clamp(v.mag / SNEAK_ZONE, 0.5, 1) : SPEED[mode];
    if (p.boost > 0 && mode !== 'sneak') sp *= 1.3;
    if (tileAt(Math.floor(p.x), Math.floor(p.y)) === 'w') {
      sp *= 0.45;
      tip('web', '🕸️ Sticky web! It makes you slow.');
    }
    if (mode === 'sprint' && p.boost <= 0) {
      p.stamina -= dt * 0.38;
      p.restT = 0.7;
      if (p.stamina <= 0) {
        p.stamina = 0;
        p.exhausted = true;
        Sound.sfx('tired');
        floatText(p.x, p.y - 1, 'Out of breath!', '#9fd7ff');
        tip('tired', '😮‍💨 Out of breath! Your sprint recharges when you stop sprinting.');
      }
    } else rest(p, dt);

    moveBody(p, v.x * sp * dt, v.y * sp * dt, PLAYER_R, true);
    p.moving = true;
    p.mode = mode;
    p.fx = v.x; p.fy = v.y;
    p.walk += dt * (mode === 'sneak' ? 7 : mode === 'sprint' ? 18 : 13);
    if (Math.abs(v.x) > 0.25) p.flip = v.x < 0;
    p.back = v.y < -0.6 && Math.abs(v.y) > Math.abs(v.x);
    p.side = Math.abs(v.x) > Math.abs(v.y) * 0.8;
    // footsteps make noise unless you're sneaking
    p.noiseT -= dt;
    if (mode !== 'sneak' && p.noiseT <= 0) {
      makeNoise(p.x, p.y, NOISE[mode], mode);
      p.noiseT = mode === 'sprint' ? 0.3 : 0.45;
    }
    if (mode === 'sprint' && Math.random() < dt * 20) {
      particles.push({ kind: 'dust', x: p.x - v.x * 0.2, y: p.y + 0.25, vx: -v.x * 0.6, vy: -0.25, life: 0.4, max: 0.4, size: 0.05 + Math.random() * 0.05 });
    }
  }

  function nearestSpot() {
    let best = null, bd = 1.5;   // next to it, diagonals included
    for (const s of L.spots) { const d = dist(P, s); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function toggleHide() {
    if (state !== 'play' || !P) return;
    if (P.hidden) { leaveHiding(true); return; }
    if (P.stuck > 0) return;
    const s = nearestSpot();
    if (!s) return;
    // any ghost watching right now saw you go in, and will come and get you
    const watchers = L.ghosts.filter((g) => ghostSees(g));
    P.hidden = true;
    P.spot = s;
    P.hideFrom = { x: P.x, y: P.y };
    s.occupied = true;
    s.shake = 0.8;
    Sound.sfx('hide');
    for (const g of watchers) {
      Object.assign(g, { state: 'seize', seizeSpot: s, path: [], repath: 0, alertT: 1.2, sus: 1, lastSeen: { ...P.hideFrom } });
      L.spotted = true;
    }
    if (watchers.length) {
      Sound.sfx('spotted');
      tip('seize', '👀 Uh oh, it SAW you hide! A ghost that watches you hide will find you. Get out and run!');
    } else {
      tip('hidden', `Shhh... you're in the ${SPOT_NAME[s.type]}. Ghosts can't find you unless they saw you go in. 🤫`);
    }
    updateButtons(true);
  }
  function leaveHiding(sound) {
    P.hidden = false;
    P.spot.occupied = false;
    P.spot.shake = 0.6;
    P.x = P.hideFrom.x; P.y = P.hideFrom.y;
    P.spot = null;
    P.exitHold = 0;
    if (sound) Sound.sfx('hide');
    updateButtons(true);
  }

  // Throw a pebble: it clatters where it lands and ghosts come to look
  function throwPebble() {
    if (state !== 'play' || !P || P.pebbles <= 0 || P.stuck > 0) return;
    const from = P.hidden ? P.hideFrom : P;
    const v = inputVector();
    let fx = P.fx, fy = P.fy;
    if (v.mag > 0) { fx = v.x; fy = v.y; }
    else if (P.hidden) { fx = P.hideFrom.x - P.spot.x; fy = P.hideFrom.y - P.spot.y; }
    const l = Math.hypot(fx, fy) || 1;
    fx /= l; fy /= l;
    let x = from.x, y = from.y, d = 0;
    while (d < 5) {
      const nx = x + fx * 0.15, ny = y + fy * 0.15;
      if (isSolid(Math.floor(nx), Math.floor(ny))) break;
      x = nx; y = ny; d += 0.15;
    }
    P.pebbles--;
    L.stones.push({ x0: from.x, y0: from.y, x1: x, y1: y, t: 0, dur: Math.max(0.25, d / 8) });
    Sound.sfx('throw');
    updateButtons(true);
  }
  function updateStones(dt) {
    for (let i = L.stones.length - 1; i >= 0; i--) {
      const s = L.stones[i];
      s.t += dt;
      if (s.t < s.dur) continue;
      L.stones.splice(i, 1);
      Sound.sfx('clack');
      burst(s.x1, s.y1, '#c9c4d6', 6);
      makeNoise(s.x1, s.y1, NOISE.pebble, 'pebble');
    }
  }

  // =====================================================================
  //  NOISE
  // =====================================================================
  function makeNoise(x, y, r, kind) {
    L.rings.push({ x, y, r, kind, t: 0 });
    for (const g of L.ghosts) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (g.kind === 'ghost') {
        if (d <= r && g.state !== 'chase' && g.state !== 'seize') {
          investigate(g, x, y, false);
          if (kind === 'run' || kind === 'sprint') tip('noise', '🔊 A ghost heard your footsteps! Drag just a little to sneak quietly.');
        }
      } else if (g.kind === 'banshee' && kind !== 'scream' && d <= r * 1.8 && g.screamCD <= 0) {
        scream(g, x, y);
      }
    }
  }
  function investigate(g, x, y, urgent) {
    g.state = 'investigate';
    g.urgent = urgent;
    g.sus = 0;
    g.path = findPath(g, openNear(x, y));
    if (!g.path.length) { g.state = 'search'; g.searchT = 2; }
  }
  function scream(b, x, y) {
    b.screamCD = 5;
    b.screamT = 1.3;
    L.spotted = true;
    L.rings.push({ x: b.x, y: b.y, r: 10, kind: 'scream', t: 0 });
    shakeT = Math.max(shakeT, 0.25);
    Sound.sfx('scream');
    floatText(b.x, b.y - 1.1, 'AAAAAH!', '#e3b8ff');
    for (const g of L.ghosts) {
      if (g.kind === 'ghost' && g.state !== 'chase' && g.state !== 'seize' && dist(g, b) < 16) investigate(g, x, y, true);
    }
    tip('banshee', '😱 The banshee heard you and screamed for the ghosts! Sneak when you are near her.');
  }

  // =====================================================================
  //  GHOSTS, BANSHEES AND PHANTOMS
  // =====================================================================
  function makeGhost(x, y, kind) {
    const dir = Math.random() * TAU;
    return {
      kind, x, y, sx: x, sy: y, state: 'patrol', path: [], repath: 0, wait: 1 + Math.random() * 2,
      dir, scanBase: dir, sus: 0, memory: 0, lastSeen: null, searchT: 0, urgent: false,
      alertT: 0, seizeSpot: null, screamCD: 0, screamT: 0, hunting: false, target: null, cone: null, look: 0,
      t: Math.random() * 10,
    };
  }
  function ghostSees(g) {
    if (!P || P.hidden || L.demo || g.kind !== 'ghost') return false;
    const dx = P.x - g.x, dy = P.y - g.y, d = Math.hypot(dx, dy);
    if (d < 1.2) return true;   // right next to it: it can hear and feel you
    if (d > L.def.ghostSight) return false;
    const fov = g.state === 'chase' ? 2.6 : FOV;
    if (Math.abs(angDiff(g.dir, Math.atan2(dy, dx))) > fov / 2) return false;
    return clearLine(g.x, g.y, P.x, P.y);
  }
  function turnToward(g, a, rate, dt) { g.dir += clamp(angDiff(g.dir, a), -rate * dt, rate * dt); }
  function followPath(g, step, dt) {
    while (step > 0 && g.path.length) {
      const wp = g.path[0];
      const dx = wp.x - g.x, dy = wp.y - g.y, d = Math.hypot(dx, dy);
      if (d > 0.05) turnToward(g, Math.atan2(dy, dx), 7, dt);
      if (d <= step) { g.x = wp.x; g.y = wp.y; g.path.shift(); step -= d; }
      else { g.x += dx / d * step; g.y += dy / d * step; step = 0; }
    }
  }
  function patrolSpot(g) {
    const R = L.def.patrolRange || 7;
    for (let i = 0; i < 25; i++) {
      const o = L.open[(Math.random() * L.open.length) | 0];
      const x = o.x + 0.5, y = o.y + 0.5;
      if (Math.hypot(x - g.sx, y - g.sy) < R && Math.hypot(x - g.x, y - g.y) > 2) return { x, y };
    }
    return { x: g.sx, y: g.sy };
  }
  function toSearch(g, at) {
    g.state = 'search';
    g.path = at ? findPath(g, at) : [];
    g.searchT = 3.5;
    g.sus = 0;
  }
  function startChase(g) {
    Object.assign(g, { state: 'chase', sus: 1, alertT: 1.2, memory: 0.8, path: [], repath: 0 });
    L.spotted = true;
    Sound.sfx('spotted');
    tip('spotted', `👻 ${cap(L.def.villain)} spotted you! Sprint ⚡, get out of sight, then hide!`);
  }
  function chaseStep(g, t, speed, dt) {
    const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy) || 1, step = speed * dt;
    turnToward(g, Math.atan2(dy, dx), 8, dt);
    if (d < 2.5 && clearLine(g.x, g.y, t.x, t.y)) {
      const bx = g.x, by = g.y;
      moveBody(g, dx / d * step, dy / d * step, GHOST_R, true);
      if (Math.hypot(g.x - bx, g.y - by) >= step * 0.3) { g.path = []; return; }
      // snagged on a corner: go round it instead
      g.path = findPath(g, t);
      g.repath = 0.3;
    } else {
      g.repath -= dt;
      if (g.repath <= 0 || !g.path.length) { g.path = findPath(g, t); g.repath = 0.3; }
    }
    followPath(g, step, dt);
  }
  function computeCone(g) {
    const R = L.def.ghostSight, half = (g.state === 'chase' ? 2.6 : FOV) / 2, n = 18, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = g.dir - half + (2 * half * i) / n, cx = Math.cos(a), cy = Math.sin(a);
      let d = 0.3;
      while (d < R && !isSolid(Math.floor(g.x + cx * d), Math.floor(g.y + cy * d))) d += 0.12;
      pts.push(g.x + cx * Math.min(d, R), g.y + cy * Math.min(d, R));
    }
    g.cone = pts;
  }
  function checkCatch(g) {
    if (!L.demo && P && state === 'play' && !P.hidden && P.invuln <= 0 && dist(g, P) < 0.6) caught(g);
  }

  function updateGhost(g, dt) {
    g.t += dt;
    g.alertT = Math.max(0, g.alertT - dt);
    if (g.kind === 'banshee') return updateBanshee(g, dt);
    if (g.kind === 'phantom') return updatePhantom(g, dt);
    const speed = L.def.ghostSpeed || 3.6;
    const sees = state === 'play' && ghostSees(g);

    // Suspicion: a ghost that sees you stops, stares and its "?" fills up. Full = chase!
    if (g.state !== 'chase' && g.state !== 'seize') {
      if (sees) {
        const d = dist(g, P);
        let rate = d < 2 ? 6 : 1 + 2.2 * (1 - d / L.def.ghostSight);
        rate *= P.mode === 'sprint' ? 1.6 : P.mode === 'run' ? 1.25 : 0.8;
        if (g.sus === 0) {
          Sound.sfx('alert');
          tip('sus', "👁️ A ghost noticed you! Get out of its cone of light before the ? fills up!");
        }
        g.sus = Math.min(1, g.sus + rate * dt);
        g.lastSeen = { x: P.x, y: P.y };
        turnToward(g, Math.atan2(P.y - g.y, P.x - g.x), 3.5, dt);
        if (g.sus < 1) { computeCone(g); return checkCatch(g); }
        startChase(g);
      } else if (g.sus > 0) {
        g.sus = Math.max(0, g.sus - 0.6 * dt);
        if (g.sus === 0 && g.lastSeen) investigate(g, g.lastSeen.x, g.lastSeen.y, false);
        computeCone(g);
        return checkCatch(g);
      }
    }

    switch (g.state) {
      case 'chase':
        if (sees) { g.lastSeen = { x: P.x, y: P.y }; g.memory = 0.8; } else g.memory -= dt;
        if (P.hidden) g.memory = 0;
        if (g.memory <= 0) toSearch(g, g.lastSeen);
        else chaseStep(g, P, speed, dt);
        break;
      case 'seize':   // it watched you hide, so it's coming to drag you out
        if (!P || !P.hidden || P.spot !== g.seizeSpot) { toSearch(g, g.lastSeen); break; }
        if (dist(g, P.hideFrom) < 0.6) {
          const s = P.spot;
          leaveHiding(false);
          s.shake = 1;
          caught(g);
          return;
        }
        g.repath -= dt;
        if (g.repath <= 0 || !g.path.length) { g.path = findPath(g, P.hideFrom); g.repath = 0.5; }
        followPath(g, speed * dt, dt);
        break;
      case 'investigate':
        if (g.path.length) followPath(g, speed * (g.urgent ? 0.85 : 0.6) * dt, dt);
        else { g.state = 'search'; g.searchT = 3; }
        break;
      case 'search':
        if (g.path.length) followPath(g, speed * 0.6 * dt, dt);
        else {
          g.dir += 2.2 * dt;   // looking all around
          g.searchT -= dt;
          if (g.searchT <= 0) { g.state = 'patrol'; g.wait = 0.5; g.scanBase = g.dir; }
        }
        break;
      default:   // patrol near home
        if (g.wait > 0) { g.wait -= dt; g.dir = g.scanBase + Math.sin(g.t * 1.3) * 0.9; }
        else if (!g.path.length) { g.path = findPath(g, patrolSpot(g)); if (!g.path.length) g.wait = 0.5; }
        else {
          followPath(g, speed * 0.4 * dt, dt);
          if (!g.path.length) { g.wait = 1 + Math.random() * 2; g.scanBase = g.dir; }
        }
    }
    g.look = Math.cos(g.dir);
    computeCone(g);
    checkCatch(g);
  }

  function updateBanshee(b, dt) {
    b.screamCD = Math.max(0, b.screamCD - dt);
    b.screamT = Math.max(0, b.screamT - dt);
    b.x = b.sx + Math.cos(b.t * 0.4) * 0.3;
    b.y = b.sy + Math.sin(b.t * 0.55) * 0.2;
    checkCatch(b);
  }

  function updatePhantom(f, dt) {
    const was = f.hunting;
    f.hunting = !!(P && !L.demo && !P.hidden && state === 'play' && dist(f, P) < (L.def.phantomSense || 8));
    if (f.hunting && !was) tip('phantom', '🌫️ The phantom senses you through the walls! It is slow, so keep moving (or hide).');
    let tx, ty, sp;
    if (f.hunting) { tx = P.x; ty = P.y; sp = L.def.phantomSpeed || 1.5; }
    else {
      if (!f.target || dist(f, f.target) < 0.3) {
        f.target = { x: clamp(f.sx + (Math.random() - 0.5) * 12, 1.5, L.w - 1.5), y: clamp(f.sy + (Math.random() - 0.5) * 12, 1.5, L.h - 1.5) };
      }
      tx = f.target.x; ty = f.target.y; sp = 0.7;
    }
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const s = Math.min(d, sp * dt);
      f.x += dx / d * s;
      f.y += dy / d * s;
      f.look = clamp(dx, -1, 1);
    }
    checkCatch(f);
  }

  function caught(g) {
    state = 'caught';
    caughtT = 1.4;
    L.caughtBy = g;
    P.hearts--;
    L.heartsLost++;
    shakeT = 0.5;
    flashT = 0.5;
    input.joy = null;
    Sound.sfx('boo');
    Sound.setMode('off');
    updateHUD();
  }
  function updateCaught(dt) {
    caughtT -= dt;
    if (caughtT > 0) return;
    if (P.hearts <= 0) { lose(); return; }
    const g = L.caughtBy;
    if (g.kind !== 'banshee') {
      poof(g.x, g.y);
      Object.assign(g, { x: g.sx, y: g.sy, state: 'patrol', path: [], wait: 2.5, memory: 0, sus: 0, target: null });
    }
    // the BOO gives the other ghosts a fright too, so they lose track of you
    for (const o of L.ghosts) if (o.state === 'chase' || o.state === 'seize') toSearch(o, o.lastSeen);
    P.invuln = 3;
    P.stuck = 0;
    state = 'play';
    toast(`Phew! ${P.hearts} ${P.hearts === 1 ? 'heart' : 'hearts'} left. Run! 💨`);
  }

  // =====================================================================
  //  BATS, ZOMBIE HANDS, ITEMS
  // =====================================================================
  function updateBat(b, dt) {
    b.t += dt;
    const step = 2.4 * dt * b.dir;
    const nx = b.x + b.ax * step, ny = b.y + b.ay * step;
    if (isSolid(Math.floor(nx + b.ax * b.dir * 0.45), Math.floor(ny + b.ay * b.dir * 0.45))) b.dir = -b.dir;
    else { b.x = nx; b.y = ny; }
    const wob = Math.sin(b.t * 5) * 0.12;
    b.rx = b.x + b.ay * wob;
    b.ry = b.y + b.ax * wob - 0.15;
  }
  function handHeight(hd) {
    const p = hd.phase;
    if (p < 2.0) return 0;
    if (p < 2.25) return (p - 2.0) / 0.25;
    if (p < 3.3) return 1;
    return Math.max(0, 1 - (p - 3.3) / 0.3);
  }
  function checkHazards() {
    if (P.hidden || P.hazardCD > 0) return;
    for (const hd of L.hands) {
      if (handHeight(hd) > 0.5 && dist(P, hd) < 0.45) {
        P.stuck = 1.1; P.stuckType = 'grab'; P.hazardCD = 2.3;
        hd.phase = 2.3;   // keep holding on
        Sound.sfx('grab');
        floatText(P.x, P.y - 1, 'Eek! Grabbed!', '#a8ff86');
        makeNoise(P.x, P.y, NOISE.yell, 'yell');
        tip('hand', '🖐️ A zombie hand grabbed you, and you yelled! Watch out for wobbly dirt.');
        return;
      }
    }
    for (const b of L.bats) {
      const dx = P.x - b.rx, dy = P.y - b.ry, d = Math.hypot(dx, dy);
      if (d < 0.5) {
        P.stuck = 0.9; P.stuckType = 'dizzy'; P.hazardCD = 2;
        moveBody(P, dx / (d || 1) * 0.5, dy / (d || 1) * 0.5, PLAYER_R);
        Sound.sfx('bat');
        floatText(P.x, P.y - 1, 'Dizzy!', '#ffe14d');
        makeNoise(P.x, P.y, 3, 'yell');
        tip('bat', '🦇 Bats make you dizzy (and you squealed!). Wait for them to fly past.');
        return;
      }
    }
  }
  function checkItems() {
    if (P.hidden) return;
    for (const it of L.items) {
      if (it.got || dist(P, it) > 0.55) continue;
      it.got = true;
      if (it.type === 'key') {
        L.keys++;
        Sound.sfx('key');
        burst(it.x, it.y, '#ffd84a', 18);
        floatText(it.x, it.y - 0.6, `🗝️ ${L.keys}/${L.keysTotal}`, '#ffe680');
        if (L.keys >= L.keysTotal) {
          L.gate.open = true;
          Sound.sfx('gate');
          makeNoise(L.gate.x, L.gate.y, NOISE.gate, 'gate');
          miniDirty = true;
          toast('🚪 The gate creaked open, and the ghosts heard it! Run to the EXIT!', 3500);
        } else toast(`🗝️ Key ${L.keys} of ${L.keysTotal}!`, 1600);
      } else if (it.type === 'candy') {
        L.candy++;
        Sound.sfx('candy');
        burst(it.x, it.y, '#ff7ab8', 8);
        floatText(it.x, it.y - 0.5, '+1 🍬', '#ffb3d9');
      } else if (it.type === 'pebbles') {
        P.pebbles += 2;
        Sound.sfx('candy');
        floatText(it.x, it.y - 0.5, '+2 🪨', '#e0dcef');
        tip('pebbles', '🪨 Pebbles! Tap THROW to toss one. Ghosts go to check the noise.');
      } else {
        P.boost = 6;
        P.stamina = 1;
        P.exhausted = false;
        Sound.sfx('speed');
        burst(it.x, it.y, '#7df9ff', 14);
        floatText(it.x, it.y - 0.6, 'Sugar rush! ⚡', '#a0ffff');
      }
      updateHUD();
      updateButtons(true);
    }
  }

  // =====================================================================
  //  MAIN UPDATE
  // =====================================================================
  function update(dt) {
    L.time += dt;
    updatePlayer(dt);
    reveal();
    for (const b of L.bats) updateBat(b, dt);
    for (const hd of L.hands) hd.phase = (hd.phase + dt) % HAND_CYCLE;
    updateStones(dt);
    for (const g of L.ghosts) {
      updateGhost(g, dt);
      if (state !== 'play') return;
    }
    L.chasing = L.ghosts.some((g) => g.state === 'chase' || g.state === 'seize' || g.hunting);
    Sound.setMode(L.chasing ? 'chase' : 'calm');
    checkHazards();
    checkItems();
    for (const s of L.spots) {
      s.shake = Math.max(0, s.shake - dt * 2);
      // she trembles when a ghost floats past her hiding spot
      if (s.occupied && L.ghosts.some((g) => dist(g, s) < 2)) s.shake = Math.max(s.shake, 0.35);
    }
    if (!P.hidden && nearestSpot()) tip('spot', isTouch ? '🙈 Tap HIDE to hide, but only when no ghost is watching!' : '🙈 Press SPACE to hide, but only when no ghost is watching!');
    if (L.gate.open && dist(P, L.gate) < 0.7) win();
  }

  function updateWorld(dt) {
    for (const f of L.fog) { f.x += f.v * dt; if (f.x - f.r > L.w) f.x = -f.r; }
    for (let i = L.rings.length - 1; i >= 0; i--) { L.rings[i].t += dt; if (L.rings[i].t > 0.8) L.rings.splice(i, 1); }
    if (state === 'menu') {
      for (const g of L.ghosts) updateGhost(g, dt);
      for (const b of L.bats) updateBat(b, dt);
      for (const hd of L.hands) hd.phase = (hd.phase + dt) % HAND_CYCLE;
    }
  }

  // ---------- minimap (only shows places you've been) ----------
  const MINI_COL = { '#': '#6b6585', T: '#475a45', t: '#7d8293', '+': '#7d8293', P: '#e0751c', B: '#3fbf5f', C: '#3fbf5f', M: '#3fbf5f', _: '#5e4b39', w: '#9a9aae', h: '#6a4a30', E: '#3a3a48' };
  function reveal() {
    const r = Math.ceil((L.def.light || 3.4) + 0.5), px = Math.floor(P.x), py = Math.floor(P.y);
    for (let y = py - r; y <= py + r; y++) {
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || y < 0 || x >= L.w || y >= L.h || (x - px) ** 2 + (y - py) ** 2 > r * r) continue;
        const i = y * L.w + x;
        if (!L.seen[i]) { L.seen[i] = 1; miniDirty = true; }
      }
    }
  }
  function paintMini() {
    const k = 4;
    mini.width = L.w * k;
    mini.height = L.h * k;
    const m = mini.getContext('2d');
    for (let y = 0; y < L.h; y++) {
      for (let x = 0; x < L.w; x++) {
        if (!L.seen[y * L.w + x]) continue;
        m.fillStyle = MINI_COL[L.grid[y][x]] || '#2b3b2f';
        m.fillRect(x * k, y * k, k, k);
      }
    }
    miniDirty = false;
  }
  function drawMinimap() {
    if (miniDirty) paintMini();
    const mw = miniBig ? Math.min(W - 24, 440) : Math.min(116, W * 0.3), mh = mw * L.h / L.w;
    const x = W - mw - 12, y = TOP + 2;
    miniRect = { x: x - 6, y: y - 6, w: mw + 12, h: mh + 12 };
    ctx.fillStyle = 'rgba(10,5,20,0.72)';
    Art.roundRect(ctx, x - 5, y - 5, mw + 10, mh + 10, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mini, x, y, mw, mh);
    ctx.imageSmoothingEnabled = true;
    const s = mw / L.w;
    const seen = (o) => L.seen[Math.floor(o.y) * L.w + Math.floor(o.x)];
    if (seen(L.gate)) {
      ctx.fillStyle = L.gate.open ? '#6dff8a' : '#ff5a6a';
      ctx.fillRect(x + (L.gate.x - 0.5) * s, y + (L.gate.y - 0.5) * s, s, s);
    }
    ctx.fillStyle = '#ffd84a';
    for (const it of L.items) if (!it.got && it.type === 'key' && seen(it)) { Art.circle(ctx, x + it.x * s, y + it.y * s, Math.max(2.2, s * 0.55)); ctx.fill(); }
    ctx.fillStyle = Math.floor(T * 3) % 2 ? '#ffffff' : '#ffb347';
    Art.circle(ctx, x + P.x * s, y + P.y * s, Math.max(2.5, s * 0.6)); ctx.fill();
  }

  // =====================================================================
  //  PARTICLES
  // =====================================================================
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 1 + Math.random() * 2.5;
      particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 0.7, max: 0.7, color, size: 0.04 + Math.random() * 0.05 });
    }
  }
  function poof(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU, s = 0.5 + Math.random() * 1.2;
      particles.push({ kind: 'poof', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, max: 0.8, size: 0.12 + Math.random() * 0.15 });
    }
  }
  function floatText(x, y, text, color) {
    particles.push({ kind: 'text', x, y, vx: 0, vy: -0.7, life: 1.4, max: 1.4, text, color });
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 3 * dt;
      if (p.kind === 'poof') { p.vx *= 0.95; p.vy *= 0.95; }
    }
  }
  function drawParticles() {
    for (const p of particles) {
      const a = p.life / p.max;
      if (p.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        Art.circle(ctx, p.x, p.y, p.size); ctx.fill();
      } else if (p.kind === 'poof' || p.kind === 'dust') {
        ctx.globalAlpha = a * (p.kind === 'dust' ? 0.5 : 0.6);
        ctx.fillStyle = p.kind === 'dust' ? '#a08a70' : '#dfe6ff';
        Art.circle(ctx, p.x, p.y, p.size * (2 - a)); ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, a * 2);
        Art.text(ctx, p.text, p.x, p.y, 0.32, p.color, { stroke: '#1a0a26', strokeWidth: 8 });
      }
    }
    ctx.globalAlpha = 1;
  }

  // =====================================================================
  //  DRAWING
  // =====================================================================
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0612';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!L) return;
    const halfW = W / 2 / TS, halfH = H / 2 / TS, top = TOP / TS;
    const cx = L.w <= halfW * 2 ? L.w / 2 : clamp(cam.x, halfW, L.w - halfW);
    const cy = L.h + top <= halfH * 2 ? (L.h - top) / 2 : clamp(cam.y, halfH - top, L.h - halfH);
    let ox = canvas.width / 2 - cx * SC, oy = canvas.height / 2 - cy * SC;
    if (shakeT > 0) { ox += (Math.random() - 0.5) * 30 * DPR * shakeT; oy += (Math.random() - 0.5) * 30 * DPR * shakeT; }

    ctx.setTransform(SC, 0, 0, SC, ox, oy);
    ctx.drawImage(mapCanvas, 0, 0, L.w, L.h);
    drawObjects();
    drawFog();
    drawDarkness(ox, oy);
    ctx.setTransform(SC, 0, 0, SC, ox, oy);
    drawGlowing();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawScreenFx(ox, oy);
  }

  function drawObjects() {
    const list = [];
    for (const s of L.spots) list.push([s.y + 0.3, () => drawSpot(s)]);
    for (const hd of L.hands) list.push([hd.y + 0.1, () => drawHand(hd)]);
    for (const it of L.items) if (!it.got) list.push([it.y, () => drawItem(it)]);
    list.push([L.gate.y - 1, () => Art.gate(ctx, L.gate.x, L.gate.y, L.gate.open, T)]);
    const blink = P && P.invuln > 0 && Math.floor(T * 10) % 2 === 0;
    if (P && !L.demo && !P.hidden && !blink) list.push([P.y + 0.25, drawPlayer]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of list) draw();
    for (const b of L.bats) Art.bat(ctx, b.rx, b.ry, b.t);
  }
  function drawSpot(s) {
    const fn = s.type === 'B' ? Art.bush : s.type === 'C' ? Art.coffin : Art.crypt;
    fn(ctx, s.x, s.y, T, s.occupied, s.shake);
  }
  function drawHand(hd) {
    if (hd.phase > 1.4 && hd.phase < 2.0) Art.dirt(ctx, hd.x, hd.y, T);
    Art.hand(ctx, hd.x, hd.y, handHeight(hd), T);
  }
  const ITEM_ICON = { key: ['🗝️', 0.62], candy: ['🍬', 0.46], speed: ['🍭', 0.56], pebbles: ['🪨', 0.5] };
  function drawItem(it) {
    const bob = Math.sin(T * 3 + it.ph) * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    Art.circle(ctx, it.x, it.y + 0.28, 0.12); ctx.fill();
    const [icon, size] = ITEM_ICON[it.type];
    Art.emoji(ctx, icon, it.x, it.y - 0.05 + bob, size, SC);
  }
  function drawPlayer() {
    Art.hero(ctx, P.x, P.y - 0.05, save.hero, {
      t: T, walk: P.walk, moving: P.moving, flip: P.flip, back: P.back, side: P.side,
      scared: L.chasing, dizzy: P.stuck > 0 && P.stuckType === 'dizzy', scale: 0.95,
      sneak: P.moving && P.mode === 'sneak', tired: P.exhausted,
    });
    if (P.boost > 0) Art.sparkle(ctx, P.x + Math.sin(T * 9) * 0.3, P.y - 0.5 + Math.cos(T * 7) * 0.2, 0.08, 0.9);
  }
  function drawFog() {
    for (const f of L.fog) {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(190,200,240,0.09)');
      g.addColorStop(1, 'rgba(190,200,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
  }
  function conePath(c, g) {
    const p = g.cone;
    c.beginPath();
    c.moveTo(g.x, g.y);
    for (let i = 0; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
    c.closePath();
  }
  function coneColor(g) {
    if (g.state === 'chase' || g.state === 'seize') return '255,70,70';
    if (g.sus > 0 || g.state === 'investigate' || g.state === 'search') return '255,190,80';
    return '150,190,255';
  }
  function drawDarkness(ox, oy) {
    const a = L.def.darkness != null ? L.def.darkness : 0.75;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = `rgba(8,3,20,${a})`;
    dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, s) => {
      const sx = x * SC + ox, sy = y * SC + oy, rp = r * SC;
      if (sx < -rp || sy < -rp || sx > dark.width + rp || sy > dark.height + rp) return;
      const g = dctx.createRadialGradient(sx, sy, 0, sx, sy, rp);
      g.addColorStop(0, `rgba(0,0,0,${s})`);
      g.addColorStop(0.5, `rgba(0,0,0,${s * 0.75})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(sx - rp, sy - rp, rp * 2, rp * 2);
    };
    if (P && !L.demo) light(P.x, P.y, P.hidden ? 1.4 : (L.def.light || 3.4) + Math.sin(T * 7) * 0.05, P.hidden ? 0.6 : 1);
    else light((canvas.width / 2 - ox) / SC, (canvas.height / 2 - oy) / SC, 6, 0.5);
    for (const p of L.pumpkins) light(p.x, p.y, 1.7 + Math.sin(T * 8 + p.ph) * 0.1, 0.85);
    light(L.gate.x, L.gate.y, L.gate.open ? 2.6 : 1.3, L.gate.open ? 1 : 0.5);
    for (const it of L.items) if (!it.got) light(it.x, it.y, it.type === 'key' ? 0.9 : 0.5, 0.5);
    for (const g of L.ghosts) {
      light(g.x, g.y, 1.3, g.kind === 'phantom' ? 0.15 : 0.35);
      if (!g.cone) continue;
      // a ghost's cone of sight glows faintly, so you can always see where it is looking
      dctx.setTransform(SC, 0, 0, SC, ox, oy);
      const R = L.def.ghostSight;
      const cg = dctx.createRadialGradient(g.x, g.y, 0.2, g.x, g.y, R);
      cg.addColorStop(0, 'rgba(0,0,0,0.45)');
      cg.addColorStop(1, 'rgba(0,0,0,0.12)');
      dctx.fillStyle = cg;
      conePath(dctx, g);
      dctx.fill();
      dctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
    if (P && !P.hidden && !L.demo) {
      const sx = P.x * SC + ox, sy = P.y * SC + oy, rp = 2.5 * SC;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rp);
      g.addColorStop(0, 'rgba(255,170,70,0.13)');
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - rp, sy - rp, rp * 2, rp * 2);
    }
  }
  const RING = { run: ['255,255,255', 0.22], sprint: ['255,255,255', 0.4], pebble: ['255,220,120', 0.75], yell: ['255,160,90', 0.6], scream: ['225,160,255', 0.9], gate: ['140,255,150', 0.7] };
  // Things that glow, drawn on top of the darkness
  function drawGlowing() {
    for (const g of L.ghosts) {
      if (!g.cone) continue;
      const col = coneColor(g), R = L.def.ghostSight;
      const cg = ctx.createRadialGradient(g.x, g.y, 0.2, g.x, g.y, R);
      cg.addColorStop(0, `rgba(${col},0.24)`);
      cg.addColorStop(1, `rgba(${col},0.05)`);
      ctx.fillStyle = cg;
      conePath(ctx, g);
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.3)`;
      ctx.lineWidth = 0.03;
      ctx.stroke();
    }
    for (const r of L.rings) {
      const p = r.t / 0.8, [col, a] = RING[r.kind] || RING.run;
      ctx.strokeStyle = `rgba(${col},${(1 - p) * a})`;
      ctx.lineWidth = r.kind === 'scream' ? 0.14 : 0.05;
      Art.circle(ctx, r.x, r.y, r.r * (1 - (1 - p) * (1 - p))); ctx.stroke();
    }
    for (const it of L.items) if (!it.got && it.type === 'key') Art.sparkle(ctx, it.x + 0.22, it.y - 0.28, 0.1 + 0.06 * Math.sin(T * 5 + it.ph), 0.9);
    for (const f of L.flies) {
      const x = f.x + Math.sin(T * 0.6 + f.ph) * 0.8, y = f.y + Math.cos(T * 0.45 + f.ph * 1.3) * 0.6;
      const a = 0.3 + 0.3 * Math.sin(T * 3 + f.ph);
      ctx.fillStyle = `rgba(220,255,120,${a * 0.3})`; Art.circle(ctx, x, y, 0.13); ctx.fill();
      ctx.fillStyle = `rgba(230,255,150,${a + 0.2})`; Art.circle(ctx, x, y, 0.04); ctx.fill();
    }
    for (const b of L.bats) Art.batEyes(ctx, b.rx, b.ry);
    for (const s of L.stones) {
      const p = s.t / s.dur, x = s.x0 + (s.x1 - s.x0) * p, y = s.y0 + (s.y1 - s.y0) * p, h = Math.sin(Math.PI * p) * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; Art.circle(ctx, x, y + 0.2, 0.06); ctx.fill();
      ctx.fillStyle = '#d4cfe2'; Art.circle(ctx, x, y - h, 0.075); ctx.fill();
    }
    for (const g of L.ghosts) {
      if (g.kind === 'banshee') Art.banshee(ctx, g.x, g.y, g.t, { scream: g.screamT > 0 });
      else if (g.kind === 'phantom') Art.phantom(ctx, g.x, g.y, g.t, { hunting: g.hunting, look: g.look });
      else {
        const mood = g.state === 'chase' || g.state === 'seize' ? 'chase' : g.state === 'patrol' && g.sus === 0 ? 'calm' : 'search';
        Art.ghost(ctx, g.x, g.y, g.t, { color: L.def.ghostColor, mood, look: g.look });
      }
    }
    for (const g of L.ghosts) {
      if (g.kind !== 'ghost') continue;
      const by = g.y - 0.95;
      if ((g.state === 'chase' || g.state === 'seize') && g.alertT > 0) Art.bubble(ctx, g.x, by, '!', '#e0182d');
      else if (g.sus > 0 && g.state !== 'chase' && g.state !== 'seize') Art.meter(ctx, g.x, by, g.sus);
      else if (g.state === 'investigate' || g.state === 'search') Art.bubble(ctx, g.x, by, '?', '#5a3fa0');
    }
    drawParticles();
  }
  function drawScreenFx(ox, oy) {
    if (P && !L.demo) {
      if (L.chasing || state === 'caught') {
        const a = 0.28 + 0.12 * Math.sin(T * 8);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(200,0,30,0)');
        g.addColorStop(1, `rgba(200,0,30,${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (state === 'play' || state === 'caught') {
        if (L.gate.open) drawGateArrow(ox, oy);
        drawMinimap();
      }
      if (input.joy && state === 'play') drawJoystick();
    }
    if (state === 'caught') {
      const s = 1 + (1.4 - caughtT) * 0.4;
      Art.text(ctx, 'BOO!', W / 2, H * 0.4, 84 * s, '#ffffff', { stroke: '#4a0a5a', strokeWidth: 9 });
    }
    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashT * 0.8})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // Once the gate is open, an arrow at the edge of the screen points the way out
  function drawGateArrow(ox, oy) {
    const sx = (L.gate.x * SC + ox) / DPR, sy = (L.gate.y * SC + oy) / DPR;
    const m = 36, top = TOP + 30, bottom = 40;
    if (sx > m && sx < W - m && sy > top && sy < H - bottom) return;
    const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((W / 2 - m) / Math.max(Math.abs(dx), 1e-6), (dy < 0 ? H / 2 - top : H / 2 - bottom) / Math.max(Math.abs(dy), 1e-6));
    ctx.save();
    ctx.translate(cx + dx * k, cy + dy * k);
    const pulse = 1 + Math.sin(T * 6) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.save();
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#6dff8a';
    ctx.beginPath(); ctx.moveTo(33, 0); ctx.lineTo(21, -9); ctx.lineTo(21, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(20,8,35,0.8)';
    Art.circle(ctx, 0, 0, 21); ctx.fill();
    ctx.strokeStyle = '#6dff8a'; ctx.lineWidth = 2.5; ctx.stroke();
    Art.emoji(ctx, '🚪', 0, 0, 26, DPR);
    ctx.restore();
  }
  function drawJoystick() {
    const j = input.joy, R = 56, S = 6 + SNEAK_ZONE * (R - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    Art.circle(ctx, j.ox, j.oy, R); ctx.fill(); ctx.stroke();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(160,220,255,0.45)';
    Art.circle(ctx, j.ox, j.oy, S); ctx.stroke();
    ctx.setLineDash([]);
    const dx = j.x - j.ox, dy = j.y - j.oy, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    const sneaking = P && P.mode === 'sneak';
    ctx.fillStyle = sneaking ? 'rgba(160,220,255,0.55)' : 'rgba(255,255,255,0.45)';
    Art.circle(ctx, j.ox + dx * k, j.oy + dy * k, 22); ctx.fill();
    if (sneaking) Art.text(ctx, '🤫', j.ox + dx * k, j.oy + dy * k, 20, '#fff');
  }

  // Little title-screen animation: you running, a ghost chasing
  const titleCanvas = $('titleHero'), tctx = titleCanvas.getContext('2d');
  const previewCanvas = $('heroPreview'), pctx = previewCanvas.getContext('2d');
  function fitCanvas(cv) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function drawTitleHero() {
    if (!titleCanvas.clientWidth) return;
    fitCanvas(titleCanvas);
    const s = titleCanvas.height / 1.5, tw = titleCanvas.width / s;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    tctx.setTransform(s, 0, 0, s, 0, 0);
    Art.hero(tctx, tw * 0.66, 1.0, save.hero, { t: T, walk: T * 12, moving: true, side: true, scared: true });
    Art.ghost(tctx, tw * 0.3 + Math.sin(T * 1.3) * 0.15, 0.95, T, { mood: 'chase', look: 1 });
  }
  function drawPreview() {
    if (!previewCanvas.clientWidth) return;
    fitCanvas(previewCanvas);
    const s = previewCanvas.height / 1.45;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.setTransform(s, 0, 0, s, previewCanvas.width / 2, 0);
    Art.hero(pctx, 0, 1.08, save.hero, { t: T });
  }

  // =====================================================================
  //  INPUT
  // =====================================================================
  const input = { keys: new Set(), joy: null, sprintBtn: false, sprintKey: false, sneakKey: false };
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    const r = miniRect;
    if (r && e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) { miniBig = !miniBig; return; }
    if (input.joy) return;
    input.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    const j = input.joy;
    if (j && e.pointerId === j.id) { j.x = e.clientX; j.y = e.clientY; }
  });
  const endJoy = (e) => { if (input.joy && e.pointerId === input.joy.id) input.joy = null; };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);

  const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = KEYMAP[e.key];
    if (k) { input.keys.add(k); e.preventDefault(); return; }
    switch (e.key) {
      case 'Shift': input.sprintKey = true; break;
      case 'x': case 'X': input.sneakKey = true; break;
      case ' ': case 'e': case 'E': e.preventDefault(); if (state === 'play') toggleHide(); break;
      case 'f': case 'F': if (!e.repeat) throwPebble(); break;
      case 'm': case 'M': miniBig = !miniBig; break;
      case 'Escape': case 'p': case 'P': if (state === 'play') pause(); else if (state === 'paused') resume(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) input.keys.delete(k);
    if (e.key === 'Shift') input.sprintKey = false;
    if (e.key === 'x' || e.key === 'X') input.sneakKey = false;
  });
  window.addEventListener('blur', () => { input.keys.clear(); input.sprintKey = input.sneakKey = input.sprintBtn = false; });

  function inputVector() {
    let x = 0, y = 0;
    if (input.keys.has('l')) x -= 1;
    if (input.keys.has('r')) x += 1;
    if (input.keys.has('u')) y -= 1;
    if (input.keys.has('d')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l, mag: 1 }; }
    const j = input.joy;
    if (j) {
      const dx = j.x - j.ox, dy = j.y - j.oy, l = Math.hypot(dx, dy), R = 56;
      if (l > R) { j.ox = j.x - dx / l * R; j.oy = j.y - dy / l * R; }   // the joystick follows your finger
      if (l < 6) return { x: 0, y: 0, mag: 0 };
      return { x: dx / l, y: dy / l, mag: clamp((l - 6) / (R - 6), 0, 1) };
    }
    return { x: 0, y: 0, mag: 0 };
  }

  // =====================================================================
  //  SCREENS AND BUTTONS
  // =====================================================================
  const SCREENS = ['title', 'creator', 'levels', 'how', 'intro', 'pause', 'win', 'lose'];
  let screen = 'title';
  let btnKey = '', lastStamina = -1;
  let creatorReturn = 'title';
  let toastTimer = 0;

  function showScreen(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !!id || !P);
    if (id) $('toast').classList.add('hidden');
    if (id !== 'win') $('rain').innerHTML = '';
    updateButtons(true);
  }
  function toast(msg, ms = 2800) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }
  function tip(id, msg) {
    if (tipsShown.has(id)) return;
    tipsShown.add(id);
    toast(msg, 3800);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function updateHUD() {
    if (!P || !L) return;
    const h = Math.max(0, P.hearts);
    $('hearts').textContent = '❤️'.repeat(h) + '🖤'.repeat(MAX_HEARTS - h);
    $('keys').textContent = `🗝️ ${L.keys}/${L.keysTotal}`;
    $('candy').textContent = `🍬 ${L.candy}/${L.candyTotal}`;
  }
  function updateButtons(force) {
    const show = state === 'play' && !!P && !screen;
    let hide = '';
    if (show) hide = P.hidden ? 'out' : (P.stuck <= 0 && nearestSpot() ? 'hide' : '');
    const key = `${show}|${hide}|${P ? P.pebbles : 0}`;
    if (key !== btnKey || force) {
      btnKey = key;
      $('controls').classList.toggle('hidden', !show);
      const b = $('hideBtn');
      b.classList.toggle('hidden', !hide);
      b.classList.toggle('out', hide === 'out');
      b.innerHTML = hide === 'out' ? '👀<br>OUT' : '🙈<br>HIDE';
      if (P) {
        $('pebbleCount').textContent = P.pebbles;
        $('throwBtn').classList.toggle('empty', P.pebbles <= 0);
      }
    }
    if (show) {
      const st = Math.round(P.stamina * 100) + (P.exhausted ? 1000 : 0) + (P.boost > 0 ? 2000 : 0);
      if (st !== lastStamina) {
        lastStamina = st;
        const sb = $('sprintBtn');
        sb.style.setProperty('--st', Math.round(P.stamina * 100) + '%');
        sb.classList.toggle('tired', P.exhausted);
        sb.classList.toggle('boost', P.boost > 0);
      }
    }
  }

  function goMenu() {
    P = null;
    loadLevel(Math.min(save.unlocked, LEVELS.length) - 1, true);
    state = 'menu';
    Sound.setMode('calm');
    showScreen('title');
  }
  function openLevels() {
    const list = $('levelList');
    list.innerHTML = '';
    LEVELS.forEach((def, i) => {
      const locked = i >= save.unlocked;
      const stars = save.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'level-btn' + (locked ? ' locked' : '');
      b.disabled = locked;
      const num = document.createElement('span'); num.className = 'lv-num'; num.textContent = locked ? '🔒' : String(i + 1);
      const name = document.createElement('span'); name.className = 'lv-name'; name.textContent = def.name;
      const st = document.createElement('span'); st.className = 'lv-stars';
      st.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      if (save.best[i]) { const bt = document.createElement('small'); bt.textContent = `⏱ ${fmtTime(save.best[i])}`; st.appendChild(bt); }
      b.append(num, name, st);
      b.addEventListener('click', () => { Sound.init(); Sound.sfx('click'); startLevel(i); });
      list.appendChild(b);
    });
    showScreen('levels');
  }
  function openCreator() {
    buildCreator();
    showScreen('creator');
  }
  function buildCreator() {
    const h = save.hero;
    const make = (el, items, key, render) => {
      el.innerHTML = '';
      items.forEach((item, i) => {
        const b = document.createElement('button');
        b.className = 'choice' + (h[key] === i ? ' on' : '');
        render(b, item);
        b.addEventListener('click', () => { h[key] = i; writeSave(); Sound.sfx('click'); buildCreator(); });
        el.appendChild(b);
      });
    };
    const swatch = (b, color) => { b.classList.add('swatch'); b.style.background = color; };
    make($('optCostume'), Art.COSTUMES, 'costume', (b, c) => { b.textContent = c.icon; b.title = c.label; });
    make($('optHair'), Art.HAIRS, 'hair', swatch);
    make($('optStyle'), Art.HAIR_STYLES, 'hairStyle', (b, s) => { b.classList.add('word'); b.textContent = { long: 'Long', pigtails: 'Pigtails', short: 'Short' }[s]; });
    make($('optSkin'), Art.SKINS, 'skin', swatch);
    make($('optOutfit'), Art.OUTFITS, 'outfit', swatch);
    $('heroName').value = h.name;
  }

  function startLevel(idx) {
    loadLevel(idx, false);
    const problems = validateLevel(L.def);
    if (problems.length) console.warn(`Level ${idx + 1} has map problems:\n- ${problems.join('\n- ')}`);
    P = makePlayer();
    particles.length = 0;
    state = 'intro';
    Sound.setMode('calm');
    const d = L.def, name = save.hero.name.trim();
    const count = (k) => L.ghosts.filter((g) => g.kind === k).length;
    const foes = [['👻', count('ghost')], ['😱', count('banshee')], ['🌫️', count('phantom')]].filter(([, n]) => n).map(([e, n]) => `${e}×${n}`).join('   ');
    $('introNum').textContent = `Level ${idx + 1}`;
    $('introName').textContent = d.name;
    $('introGoal').textContent = `Find ${L.keysTotal} ${L.keysTotal === 1 ? 'key' : 'keys'} 🗝️ to open the gate 🚪`;
    $('introVillain').textContent = `Watch out for ${d.villain}!\n${foes}`;
    $('introTip').textContent = d.tip || '';
    $('introWarn').textContent = problems.length ? `⚠️ Map problem: ${problems.join('; ')}` : '';
    $('introWarn').classList.toggle('hidden', !problems.length);
    $('introBest').textContent = save.best[idx] ? `Your best: ⏱ ${fmtTime(save.best[idx])}  ${'⭐'.repeat(save.stars[idx] || 0)}` : '⭐ Escape  ⭐ Get all the candy  ⭐ Never get spotted';
    $('introGo').textContent = name ? `Run, ${name}, run! 🏃‍♀️` : "Let's go! 🏃‍♀️";
    updateHUD();
    showScreen('intro');
  }
  function beginPlay() {
    state = 'play';
    showScreen(null);
    if (document.activeElement) document.activeElement.blur();
    if (L.idx === 0) toast(isTouch ? '👆 Drag to move. A small drag sneaks quietly 🤫, a big drag runs.' : '⌨️ Arrows to run · hold X to sneak · Shift to sprint · Space to hide · F to throw', 4500);
  }
  function pause() {
    if (state !== 'play') return;
    state = 'paused';
    input.joy = null;
    input.keys.clear();
    input.sprintBtn = false;
    Sound.setMode('off');
    showScreen('pause');
  }
  function resume() {
    state = 'play';
    showScreen(null);
  }
  function win() {
    state = 'won';
    Sound.setMode('off');
    Sound.sfx('win');
    const got = [true, L.candy === L.candyTotal, !L.spotted];
    const stars = got.filter(Boolean).length;
    const prevBest = save.best[L.idx];
    const newBest = !prevBest || L.time < prevBest;
    save.stars[L.idx] = Math.max(save.stars[L.idx] || 0, stars);
    if (newBest) save.best[L.idx] = L.time;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, L.idx + 2));
    writeSave();
    const last = L.idx === LEVELS.length - 1;
    const name = save.hero.name.trim();
    $('winTitle').textContent = last ? 'You escaped the whole graveyard! 🏆' : `${name || 'You'} escaped!`;
    const box = $('winStars');
    box.innerHTML = '';
    ['Escaped', 'All candy', 'Never spotted'].forEach((label, i) => {
      const d = document.createElement('div');
      d.className = 'star' + (got[i] ? ' on' : '');
      const b = document.createElement('b'); b.textContent = got[i] ? '⭐' : '☆';
      const s = document.createElement('small'); s.textContent = label;
      d.append(b, s);
      box.appendChild(d);
    });
    $('winStats').textContent = `🍬 ${L.candy}/${L.candyTotal} candy · ⏱ ${fmtTime(L.time)}` + (newBest && prevBest ? ' · 🏆 New best time!' : '');
    $('nextBtn').classList.toggle('hidden', last);
    showScreen('win');
    rain();
  }
  function lose() {
    state = 'lost';
    Sound.setMode('off');
    Sound.sfx('lose');
    $('loseText').textContent = `${cap(L.def.villain)} caught you! Remember: stay out of the cones, sneak when they're close, and never hide while one is watching. 💪`;
    showScreen('lose');
  }
  function rain() {
    const box = $('rain');
    box.innerHTML = '';
    const things = ['🍬', '🍭', '⭐', '🎃', '🍫', '👻'];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span');
      s.textContent = things[i % things.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
      s.style.animationDelay = Math.random() * 2 + 's';
      box.appendChild(s);
    }
  }
  function toggleSound() {
    save.sound = !save.sound;
    writeSave();
    Sound.setEnabled(save.sound);
    updateSoundButtons();
  }
  function updateSoundButtons() {
    $('soundBtn').textContent = save.sound ? '🔊' : '🔇';
    $('pauseSoundBtn').textContent = save.sound ? '🔊 Sound: on' : '🔇 Sound: off';
  }

  const on = (id, fn) => $(id).addEventListener('click', () => { Sound.init(); Sound.sfx('click'); fn(); });
  on('playBtn', () => { if (!save.madeHero) { creatorReturn = 'levels'; openCreator(); } else openLevels(); });
  on('dressBtn', () => { creatorReturn = 'title'; openCreator(); });
  on('howBtn', () => showScreen('how'));
  on('howBack', () => showScreen('title'));
  on('creatorDone', () => { save.madeHero = true; writeSave(); if (creatorReturn === 'levels') openLevels(); else showScreen('title'); });
  on('levelsBack', () => showScreen('title'));
  on('introGo', beginPlay);
  on('pauseBtn', pause);
  on('resumeBtn', resume);
  on('restartBtn', () => startLevel(L.idx));
  on('quitBtn', goMenu);
  on('nextBtn', () => startLevel(L.idx + 1));
  on('replayBtn', () => startLevel(L.idx));
  on('winMenuBtn', goMenu);
  on('retryBtn', () => startLevel(L.idx));
  on('loseMenuBtn', goMenu);
  on('soundBtn', toggleSound);
  on('pauseSoundBtn', toggleSound);
  const press = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); fn(e); });
  press('hideBtn', toggleHide);
  press('throwBtn', throwPebble);
  press('sprintBtn', (e) => {
    input.sprintBtn = true;
    $('sprintBtn').classList.add('held');
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
  });
  const sprintUp = () => { input.sprintBtn = false; $('sprintBtn').classList.remove('held'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('sprintBtn').addEventListener(ev, sprintUp);
  $('heroName').addEventListener('input', (e) => { save.hero.name = e.target.value.slice(0, 12); writeSave(); });
  $('heroName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  // =====================================================================
  //  START
  // =====================================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (state === 'play') update(dt);
    else if (state === 'caught') updateCaught(dt);
    if (L) {
      updateWorld(dt);
      const tx = P && !L.demo ? P.x : L.w / 2 + Math.sin(T * 0.07) * Math.max(0, L.w / 2 - 6);
      const ty = P && !L.demo ? P.y : L.h / 2 + Math.cos(T * 0.05) * Math.max(0, L.h / 2 - 5);
      cam.x += (tx - cam.x) * Math.min(1, dt * 5);
      cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    }
    updateParticles(dt);
    shakeT = Math.max(0, shakeT - dt);
    flashT = Math.max(0, flashT - dt);
    render();
    updateButtons();
    if (screen === 'title') drawTitleHero();
    if (screen === 'creator') drawPreview();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume();
  });
  // browsers only allow sound after the first tap or key press
  for (const ev of ['pointerup', 'touchend', 'keydown']) document.addEventListener(ev, () => Sound.init(), { passive: true });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  Sound.setEnabled(save.sound);
  updateSoundButtons();
  goMenu();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // handy for testing from the browser console
  window.GE = {
    get state() { return state; }, get level() { return L; }, get player() { return P; }, get miniBig() { return miniBig; }, get miniRect() { return miniRect; }, input,
    startLevel, beginPlay, toggleHide, throwPebble, validateLevel, isSolid, findPath, ghostSees,
  };
})();
