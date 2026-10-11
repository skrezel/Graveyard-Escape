/*
  Graveyard Escape — the game: sneaking, sprinting, noise, ghosts, hiding, hazards,
  multiplayer and screens.
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r2 = (v) => Math.round(v * 100) / 100;
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
  // multiplayer
  const GHOST_TYPES = ['ghost', 'banshee', 'phantom'];
  const PERKS = ['runner', 'sneaker', 'trickster', 'medic'];
  const GHOST_PLAY = {
    ghost: { speed: 3.9, sight: 5.5, cooldown: 7, length: 0.5 },
    banshee: { speed: 3.5, cooldown: 14, length: 4, reveal: 8 },
    phantom: { speed: 2.8, sense: 6, cooldown: 16, length: 4 },
  };
  const VERSUS_CLOCK = 360;     // 6 minutes until midnight
  const RESCUE_TIME = 2;
  const SEND_EVERY = 1 / 12;    // how often each phone sends where its player is
  const WORLD_EVERY = 1 / 10;   // how often the host sends the computer ghosts and the score
  const STATE_CODES = ['patrol', 'investigate', 'search', 'chase', 'seize'];

  // ---------- saved progress ----------
  const SAVE_KEY = 'graveyard-escape-v2';
  const save = loadSave();
  function loadSave() {
    const base = {
      hero: { name: '', skin: 0, hair: 0, hairStyle: 0, outfit: 0, costume: 0 },
      unlocked: 1, stars: [], best: [], sound: true, madeHero: false,
      mp: { team: 'humans', perk: 0, gtype: 0, gcolor: 0 },
    };
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s) return { ...base, ...s, hero: { ...base.hero, ...s.hero }, mp: { ...base.mp, ...s.mp } };
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
  let P = null;          // this phone's player (a human, or in multiplayer maybe a ghost)
  let state = 'menu';    // menu | intro | play | paused | caught | won | lost | mpend
  let T = 0;
  const cam = { x: 0, y: 0 };
  let shakeT = 0, flashT = 0, caughtT = 0;
  let miniDirty = true, miniBig = false, miniRect = null;
  const particles = [];
  const tipsShown = new Set();
  let MP = null;                 // multiplayer session (null = playing alone)
  const remotes = new Map();     // the other players, by id
  const hideMarks = new Set();   // hiding spots this phone's ghost saw someone go into

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

  // opts: { demo, seed (same seed = same bats and hands on every phone), ai (false = no computer ghosts) }
  function loadLevel(idx, opts = {}) {
    const def = LEVELS[idx];
    const rows = def.map;
    const rnd = opts.seed != null ? Art.rng(opts.seed) : Math.random;
    const withAI = opts.ai !== false;
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    L = {
      idx, def, w, h, demo: !!opts.demo, grid: [], open: [], seen: new Uint8Array(w * h),
      start: { x: 1.5, y: 1.5 }, gate: null, spawns: [],
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
          case 'G': case 'W': case 'X': {
            const kind = ch === 'G' ? 'ghost' : ch === 'W' ? 'banshee' : 'phantom';
            L.spawns.push({ x: cx, y: cy, kind });
            if (withAI) L.ghosts.push(makeGhost(cx, cy, kind));
            ch = '.';
            break;
          }
          case 'k': L.items.push({ type: 'key', x: cx, y: cy, ph }); L.keysTotal++; ch = '.'; break;
          case 'c': L.items.push({ type: 'candy', x: cx, y: cy, ph }); L.candyTotal++; ch = '.'; break;
          case 's': L.items.push({ type: 'speed', x: cx, y: cy, ph }); ch = '.'; break;
          case 'o': L.items.push({ type: 'pebbles', x: cx, y: cy, ph }); ch = '.'; break;
          case 'h': L.hands.push({ x: cx, y: cy, phase: rnd() * HAND_CYCLE }); break;
          case 'b': L.bats.push({ x: cx, y: cy, ax: 1, ay: 0, dir: 1, t: rnd() * 6, rx: cx, ry: cy }); ch = '.'; break;
          case 'v': L.bats.push({ x: cx, y: cy, ax: 0, ay: 1, dir: 1, t: rnd() * 6, rx: cx, ry: cy }); ch = '.'; break;
          case 'B': case 'C': case 'M': L.spots.push({ type: ch, x: cx, y: cy, shake: 0 }); break;
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
    cam.x = opts.demo ? w / 2 : L.start.x;
    cam.y = opts.demo ? h / 2 : L.start.y;
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

  // Free squares near a point, closest first (for placing several players at the start)
  function openSquaresNear(x, y, n) {
    const out = [], seen = new Set();
    const q = [[Math.floor(x), Math.floor(y)]];
    seen.add(q[0].join(','));
    while (q.length && out.length < n) {
      const [cx, cy] = q.shift();
      if (!isSolid(cx, cy)) out.push({ x: cx + 0.5, y: cy + 0.5 });
      for (const [dx, dy] of DIRS4) {
        const k = (cx + dx) + ',' + (cy + dy);
        if (seen.has(k) || isSolid(cx + dx, cy + dy)) continue;
        seen.add(k);
        q.push([cx + dx, cy + dy]);
      }
    }
    return out;
  }

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
  //  PLAYERS
  // =====================================================================
  function makeHuman(x, y, o = {}) {
    const perk = o.perk || null;
    return {
      id: o.id || 'me', kind: 'human', name: o.name || '', hero: o.hero || save.hero, perk,
      x, y, hearts: MAX_HEARTS,
      walk: 0, moving: false, mode: 'idle', flip: false, back: false, side: false, fx: 1, fy: 0,
      hidden: false, spot: null, hideFrom: null, exitHold: 0,
      stuck: 0, stuckType: '', hazardCD: 0, invuln: 0, boost: 0,
      stamina: 1, exhausted: false, restT: 0, noiseT: 0,
      caged: false, escaped: false, rescue: 0, revealedUntil: 0, emote: null,
      pebbles: (L.def.pebbles != null ? L.def.pebbles : 2) + (perk === 'trickster' ? 3 : 0),
    };
  }
  function makeGhostPlayer(x, y, rec) {
    return {
      id: rec.id, kind: 'ghost', name: rec.name, gtype: GHOST_TYPES[rec.gtype] || 'ghost',
      color: GHOST_COLORS[rec.gcolor] || GHOST_COLORS[0],
      x, y, dir: Math.PI / 2, look: 0, moving: false, t: 0,
      abilityCD: 0, abilityT: 0, slowT: 0, cone: null, emote: null,
    };
  }

  function rest(p, dt) {
    if (p.restT > 0) p.restT -= dt;
    else p.stamina = Math.min(1, p.stamina + dt * (p.perk === 'runner' ? 0.32 : 0.22));
    if (p.exhausted && p.stamina > 0.35) p.exhausted = false;
  }

  function updatePlayer(dt) {
    const p = P;
    p.hazardCD = Math.max(0, p.hazardCD - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.boost = Math.max(0, p.boost - dt);
    p.mode = 'idle';
    if (p.caged || p.escaped) { p.moving = false; rest(p, dt); return; }
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
    let sp = mode === 'sneak' ? SPEED.sneak * clamp(v.mag / SNEAK_ZONE, 0.5, 1) * (p.perk === 'sneaker' ? 1.3 : 1) : SPEED[mode];
    if (p.boost > 0 && mode !== 'sneak') sp *= 1.3;
    if (tileAt(Math.floor(p.x), Math.floor(p.y)) === 'w') {
      sp *= 0.45;
      tip('web', '🕸️ Sticky web! It makes you slow.');
    }
    if (mode === 'sprint' && p.boost <= 0) {
      p.stamina -= dt * (p.perk === 'runner' ? 0.26 : 0.38);
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
      makeNoise(p.x, p.y, mode === 'run' && p.perk === 'sneaker' ? 1.5 : NOISE[mode], mode);
      p.noiseT = mode === 'sprint' ? 0.3 : 0.45;
    }
    if (mode === 'sprint' && Math.random() < dt * 20) {
      particles.push({ kind: 'dust', x: p.x - v.x * 0.2, y: p.y + 0.25, vx: -v.x * 0.6, vy: -0.25, life: 0.4, max: 0.4, size: 0.05 + Math.random() * 0.05 });
    }
  }

  // A ghost played by a person (multiplayer)
  function updateGhostPlayer(dt) {
    const p = P, cfg = GHOST_PLAY[p.gtype];
    p.t += dt;
    p.abilityCD = Math.max(0, p.abilityCD - dt);
    p.abilityT = Math.max(0, p.abilityT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    const v = inputVector();
    let sp = cfg.speed * clamp(v.mag / 0.6, 0.35, 1);
    if (p.gtype === 'ghost' && p.abilityT > 0) sp = 7;   // lunge!
    if (p.slowT > 0) sp *= 0.45;
    p.moving = v.mag > 0;
    if (p.moving) {
      turnToward(p, Math.atan2(v.y, v.x), 12, dt);
      const dx = v.x * sp * dt, dy = v.y * sp * dt;
      if (p.gtype === 'phantom') { p.x = clamp(p.x + dx, 0.6, L.w - 0.6); p.y = clamp(p.y + dy, 0.6, L.h - 0.6); }
      else moveBody(p, dx, dy, GHOST_R, true);
    }
    p.look = Math.cos(p.dir);
    if (p.gtype === 'ghost') computeCone(p, cfg.sight, FOV); else p.cone = null;
  }
  function useAbility() {
    if (state !== 'play' || !P || P.kind !== 'ghost' || P.abilityCD > 0) return;
    const cfg = GHOST_PLAY[P.gtype];
    P.abilityCD = cfg.cooldown;
    P.abilityT = cfg.length;
    if (P.gtype === 'banshee') { Sound.sfx('scream'); hostOrSend({ a: 'scream' }); }
    else if (P.gtype === 'phantom') { Sound.sfx('hide'); toast("🌫️ You faded! The humans can't see you for 4 seconds.", 2200); }
    else Sound.sfx('throw');
    updateButtons(true);
  }
  function ghostCheck() {
    if (state !== 'play' || !P || P.kind !== 'ghost' || P.slowT > 0) return;
    const s = nearestSpot();
    if (!s) return;
    const i = L.spots.indexOf(s);
    hideMarks.delete(i);
    s.shake = 0.6;
    hostOrSend({ a: 'check', spot: i });
  }

  function nearestSpot() {
    let best = null, bd = 1.5;   // next to it, diagonals included
    for (const s of L.spots) { const d = dist(P, s); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function toggleHide() {
    if (state !== 'play' || !P || P.kind !== 'human' || P.caged || P.escaped) return;
    if (P.hidden) { leaveHiding(true); return; }
    if (P.stuck > 0) return;
    const s = nearestSpot();
    if (!s) return;
    const watched = !MP || MP.host ? onHumanHid(P, s) : 0;
    P.hidden = true;
    P.spot = s;
    P.hideFrom = { x: P.x, y: P.y };
    s.shake = 0.8;
    Sound.sfx('hide');
    if (!watched) tip('hidden', `Shhh... you're in the ${SPOT_NAME[s.type]}. Ghosts can't find you unless they saw you go in. 🤫`);
    updateButtons(true);
  }
  // Someone just hid: any computer ghost watching saw them go in, and will come and get them
  function onHumanHid(h, spot) {
    const watchers = L.ghosts.filter((g) => ghostSees(g, h));
    for (const g of watchers) {
      Object.assign(g, { state: 'seize', seizeHuman: h, seizeSpot: spot, path: [], repath: 0, alertT: 1.2, sus: 1, lastSeen: { x: h.x, y: h.y } });
    }
    if (watchers.length) {
      L.spotted = true;
      if (h === P) {
        Sound.sfx('spotted');
        tip('seize', '👀 Uh oh, it SAW you hide! A ghost that watches you hide will find you. Get out and run!');
      }
    }
    return watchers.length;
  }
  function leaveHiding(sound) {
    if (!P.hidden) return;
    P.hidden = false;
    if (P.spot) P.spot.shake = 0.6;
    P.x = P.hideFrom.x; P.y = P.hideFrom.y;
    P.spot = null;
    P.exitHold = 0;
    if (sound) Sound.sfx('hide');
    updateButtons(true);
  }

  // Throw a pebble: it clatters where it lands and ghosts come to look
  function throwPebble() {
    if (state !== 'play' || !P || P.kind !== 'human' || P.pebbles <= 0 || P.stuck > 0 || P.caged || P.escaped) return;
    const from = P.hidden ? P.hideFrom : P;
    const v = inputVector();
    let fx = P.fx, fy = P.fy;
    if (v.mag > 0) { fx = v.x; fy = v.y; }
    else if (P.hidden) { fx = P.hideFrom.x - P.spot.x; fy = P.hideFrom.y - P.spot.y; }
    const l = Math.hypot(fx, fy) || 1;
    fx /= l; fy /= l;
    const range = P.perk === 'trickster' ? 7 : 5;
    let x = from.x, y = from.y, d = 0;
    while (d < range) {
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
  // A noise made by this phone's player
  function makeNoise(x, y, r, kind) {
    L.rings.push({ x, y, r, kind, t: 0 });
    if (MP) Net.send({ t: 'noise', x: r2(x), y: r2(y), r, k: kind });
    if (!MP || MP.host) aiHear(x, y, r, kind, true);
  }
  // The computer ghosts react to a noise
  function aiHear(x, y, r, kind, mine) {
    for (const g of L.ghosts) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (g.kind === 'ghost') {
        if (d <= r && g.state !== 'chase' && g.state !== 'seize') {
          investigate(g, x, y, false);
          if (mine && (kind === 'run' || kind === 'sprint')) tip('noise', '🔊 A ghost heard your footsteps! Drag just a little to sneak quietly.');
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
  //  COMPUTER GHOSTS, BANSHEES AND PHANTOMS
  // =====================================================================
  function humans() {
    const a = [];
    if (P && P.kind === 'human') a.push(P);
    for (const r of remotes.values()) if (r.kind === 'human') a.push(r);
    return a;
  }
  function ghostAvatars() {
    const a = [];
    if (P && P.kind === 'ghost') a.push(P);
    for (const r of remotes.values()) if (r.kind === 'ghost') a.push(r);
    return a;
  }
  const targetable = (h) => !!h && !h.hidden && !h.caged && !h.escaped;
  const isSafe = (h) => h.invuln > 0 || h.inv === true;

  function makeGhost(x, y, kind) {
    const dir = Math.random() * TAU;
    return {
      kind, x, y, sx: x, sy: y, state: 'patrol', path: [], repath: 0, wait: 1 + Math.random() * 2,
      dir, scanBase: dir, sus: 0, memory: 0, lastSeen: null, searchT: 0, urgent: false, target: null,
      alertT: 0, seizeHuman: null, seizeSpot: null, screamCD: 0, screamT: 0, hunting: false, wander: null, cone: null, look: 0,
      t: Math.random() * 10,
    };
  }
  function ghostSees(g, h) {
    if (!targetable(h) || L.demo || g.kind !== 'ghost') return false;
    const dx = h.x - g.x, dy = h.y - g.y, d = Math.hypot(dx, dy);
    if (d < 1.2) return true;   // right next to it: it can hear and feel you
    if (d > L.def.ghostSight) return false;
    const fov = g.state === 'chase' ? 2.6 : FOV;
    if (Math.abs(angDiff(g.dir, Math.atan2(dy, dx))) > fov / 2) return false;
    return clearLine(g.x, g.y, h.x, h.y);
  }
  function nearestSeen(g) {
    let best = null, bd = Infinity;
    for (const h of humans()) {
      if (!ghostSees(g, h)) continue;
      const d = dist(g, h);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
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
  function startChase(g, h) {
    Object.assign(g, { state: 'chase', target: h, sus: 1, alertT: 1.2, memory: 0.8, path: [], repath: 0 });
    L.spotted = true;
    if (h === P) {
      Sound.sfx('spotted');
      tip('spotted', `👻 ${cap(L.def.villain)} spotted you! Sprint ⚡, get out of sight, then hide!`);
    }
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
  function computeCone(g, R, fov) {
    R = R || L.def.ghostSight;
    const half = (fov || (g.state === 'chase' ? 2.6 : FOV)) / 2, n = 18, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = g.dir - half + (2 * half * i) / n, cx = Math.cos(a), cy = Math.sin(a);
      let d = 0.3;
      while (d < R && !isSolid(Math.floor(g.x + cx * d), Math.floor(g.y + cy * d))) d += 0.12;
      pts.push(g.x + cx * Math.min(d, R), g.y + cy * Math.min(d, R));
    }
    g.cone = pts;
    g.coneR = R;
  }
  function checkCatch(g) {
    if (L.demo || state !== 'play' || (MP && !MP.host)) return;
    for (const h of humans()) {
      if (targetable(h) && !isSafe(h) && dist(g, h) < 0.6) { catchHuman(h, g); return; }
    }
  }

  function updateGhost(g, dt) {
    g.t += dt;
    g.alertT = Math.max(0, g.alertT - dt);
    if (g.kind === 'banshee') return updateBanshee(g, dt);
    if (g.kind === 'phantom') return updatePhantom(g, dt);
    const speed = L.def.ghostSpeed || 3.6;
    const vis = state === 'play' ? nearestSeen(g) : null;

    // Suspicion: a ghost that sees you stops, stares and its "?" fills up. Full = chase!
    if (g.state !== 'chase' && g.state !== 'seize') {
      if (vis) {
        const d = dist(g, vis);
        let rate = d < 2 ? 6 : 1 + 2.2 * (1 - d / L.def.ghostSight);
        rate *= vis.mode === 'sprint' ? 1.6 : vis.mode === 'run' ? 1.25 : 0.8;
        if (g.sus === 0 && vis === P) {
          Sound.sfx('alert');
          tip('sus', '👁️ A ghost noticed you! Get out of its cone of light before the ? fills up!');
        }
        g.sus = Math.min(1, g.sus + rate * dt);
        g.lastSeen = { x: vis.x, y: vis.y };
        g.target = vis;
        turnToward(g, Math.atan2(vis.y - g.y, vis.x - g.x), 3.5, dt);
        if (g.sus < 1) { computeCone(g); return checkCatch(g); }
        startChase(g, vis);
      } else if (g.sus > 0) {
        g.sus = Math.max(0, g.sus - 0.6 * dt);
        if (g.sus === 0 && g.lastSeen) investigate(g, g.lastSeen.x, g.lastSeen.y, false);
        computeCone(g);
        return checkCatch(g);
      }
    }

    switch (g.state) {
      case 'chase': {
        let h = g.target;
        if (!ghostSees(g, h) && vis) { h = vis; g.target = vis; }
        if (ghostSees(g, h)) { g.lastSeen = { x: h.x, y: h.y }; g.memory = 0.8; } else g.memory -= dt;
        if (!targetable(h)) g.memory = 0;
        if (g.memory <= 0) toSearch(g, g.lastSeen);
        else chaseStep(g, h, speed, dt);
        break;
      }
      case 'seize': {   // it watched someone hide, so it's coming to drag them out
        const h = g.seizeHuman;
        if (!h || !h.hidden || h.spot !== g.seizeSpot || h.caged || h.escaped) { toSearch(g, g.lastSeen); break; }
        const from = h.hideFrom || h;
        if (dist(g, from) < 0.6) {
          if (g.seizeSpot) g.seizeSpot.shake = 1;
          pullOut(h);
          catchHuman(h, g);
          return;
        }
        g.repath -= dt;
        if (g.repath <= 0 || !g.path.length) { g.path = findPath(g, from); g.repath = 0.5; }
        followPath(g, speed * dt, dt);
        break;
      }
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
    let prey = null, pd = L.def.phantomSense || 8;
    if (!L.demo && state === 'play') for (const h of humans()) { const d = dist(f, h); if (targetable(h) && d < pd) { pd = d; prey = h; } }
    f.hunting = !!prey;
    if (prey === P && !was) tip('phantom', '🌫️ The phantom senses you through the walls! It is slow, so keep moving (or hide).');
    let tx, ty, sp;
    if (prey) { tx = prey.x; ty = prey.y; sp = L.def.phantomSpeed || 1.5; }
    else {
      if (!f.wander || dist(f, f.wander) < 0.3) {
        f.wander = { x: clamp(f.sx + (Math.random() - 0.5) * 12, 1.5, L.w - 1.5), y: clamp(f.sy + (Math.random() - 0.5) * 12, 1.5, L.h - 1.5) };
      }
      tx = f.wander.x; ty = f.wander.y; sp = 0.7;
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

  function pullOut(h) {
    if (h === P) leaveHiding(false);
    else { h.hidden = false; h.spot = null; }
  }
  function catchHuman(h, g) {
    if (!MP) caught(g);
    else hostCage(h, g);
  }

  // Single player: you lose a heart
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
      Object.assign(g, { x: g.sx, y: g.sy, state: 'patrol', path: [], wait: 2.5, memory: 0, sus: 0, wander: null });
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
    L.items.forEach((it, i) => {
      if (it.got || it.pending || dist(P, it) > 0.55) return;
      if (MP) {   // the host decides who got it first
        if (MP.host) hostAct(MP.myId, { a: 'pick', i });
        else { it.pending = true; Net.send({ t: 'act', to: MP.hostId, a: 'pick', i }); setTimeout(() => { it.pending = false; }, 1500); }
        return;
      }
      it.got = true;
      if (it.type === 'key') L.keys++;
      if (it.type === 'candy') L.candy++;
      itemEffects(it, true);
      if (it.type === 'key' && L.keys >= L.keysTotal) openGate();
      updateHUD();
      updateButtons(true);
    });
  }
  // Sounds, sparkles and bonuses when an item is picked up (mine = by this phone's player)
  function itemEffects(it, mine) {
    if (it.type === 'key') {
      Sound.sfx('key');
      burst(it.x, it.y, '#ffd84a', 18);
      floatText(it.x, it.y - 0.6, `🗝️ ${L.keys}/${L.keysTotal}`, '#ffe680');
      if (L.keys < L.keysTotal) toast(`🗝️ Key ${L.keys} of ${L.keysTotal}!`, 1600);
    } else if (it.type === 'candy') {
      if (mine) Sound.sfx('candy');
      burst(it.x, it.y, '#ff7ab8', 8);
      if (mine) floatText(it.x, it.y - 0.5, '+1 🍬', '#ffb3d9');
    } else if (it.type === 'pebbles') {
      if (!mine) return;
      P.pebbles += 2;
      Sound.sfx('candy');
      floatText(it.x, it.y - 0.5, '+2 🪨', '#e0dcef');
      tip('pebbles', '🪨 Pebbles! Tap THROW to toss one. Ghosts go to check the noise.');
    } else {
      if (!mine) return;
      P.boost = 6;
      P.stamina = 1;
      P.exhausted = false;
      Sound.sfx('speed');
      burst(it.x, it.y, '#7df9ff', 14);
      floatText(it.x, it.y - 0.6, 'Sugar rush! ⚡', '#a0ffff');
    }
  }
  function openGate() {
    L.gate.open = true;
    Sound.sfx('gate');
    if (!MP || MP.host) aiHear(L.gate.x, L.gate.y, NOISE.gate, 'gate', false);
    L.rings.push({ x: L.gate.x, y: L.gate.y, r: NOISE.gate, kind: 'gate', t: 0 });
    miniDirty = true;
    toast(P && P.kind === 'ghost' ? '🚪 The humans opened the gate! Guard the exit!' : '🚪 The gate creaked open, and the ghosts heard it! Run to the EXIT!', 3500);
  }

  // =====================================================================
  //  MAIN UPDATE
  // =====================================================================
  function update(dt) {
    L.time += dt;
    if (P.kind === 'human') updatePlayer(dt); else updateGhostPlayer(dt);
    if (P.kind === 'human' && !P.escaped) reveal(P);
    for (const b of L.bats) updateBat(b, dt);
    for (const hd of L.hands) hd.phase = (hd.phase + dt) % HAND_CYCLE;
    updateStones(dt);
    if (!MP || MP.host) {
      for (const g of L.ghosts) {
        updateGhost(g, dt);
        if (state !== 'play') return;
      }
    } else {
      for (const g of L.ghosts) smoothGhost(g, dt);
    }
    if (MP) mpUpdate(dt);
    if (state !== 'play') return;
    L.chasing = threatened();
    Sound.setMode(L.chasing ? 'chase' : 'calm');
    const free = P.kind === 'human' && !P.caged && !P.escaped;
    if (free) { checkHazards(); checkItems(); }
    for (const s of L.spots) {
      s.shake = Math.max(0, s.shake - dt * 2);
      // whoever's hiding trembles when a ghost floats past
      if (humans().some((h) => h.hidden && h.spot === s) && (L.ghosts.some((g) => dist(g, s) < 2) || ghostAvatars().some((g) => dist(g, s) < 2))) s.shake = Math.max(s.shake, 0.35);
    }
    if (free && !P.hidden && nearestSpot()) tip('spot', isTouch ? '🙈 Tap HIDE to hide, but only when no ghost is watching!' : '🙈 Press SPACE to hide, but only when no ghost is watching!');
    if (free && L.gate.open && dist(P, L.gate) < 0.7) {
      if (!MP) win();
      else if (!P.escapeSent) { P.escapeSent = true; hostOrSend({ a: 'escape' }); setTimeout(() => { if (P) P.escapeSent = false; }, 1500); }
    }
  }
  // Is this phone's player in danger (for the scary music and the red edges)?
  function threatened() {
    if (P.kind === 'ghost') return humans().some((h) => iSee(h) && !h.caged);
    if (P.caged || P.escaped) return false;
    if (!MP) return L.ghosts.some((g) => g.state === 'chase' || g.state === 'seize' || g.hunting);
    return L.ghosts.some((g) => (g.state === 'chase' || g.state === 'seize' || g.hunting) && dist(g, P) < 8) ||
      ghostAvatars().some((g) => dist(g, P) < 4);
  }

  function updateWorld(dt) {
    for (const f of L.fog) { f.x += f.v * dt; if (f.x - f.r > L.w) f.x = -f.r; }
    for (let i = L.rings.length - 1; i >= 0; i--) { L.rings[i].t += dt; if (L.rings[i].t > 0.8) L.rings.splice(i, 1); }
    for (const a of remotes.values()) if (a.emote && a.emote.until < T) a.emote = null;
    if (P && P.emote && P.emote.until < T) P.emote = null;
    if (state === 'menu') {
      for (const g of L.ghosts) updateGhost(g, dt);
      for (const b of L.bats) updateBat(b, dt);
      for (const hd of L.hands) hd.phase = (hd.phase + dt) % HAND_CYCLE;
    }
  }

  // ---------- minimap (humans only see places they've been; ghosts know the whole graveyard) ----------
  const MINI_COL = { '#': '#6b6585', T: '#475a45', t: '#7d8293', '+': '#7d8293', P: '#e0751c', B: '#3fbf5f', C: '#3fbf5f', M: '#3fbf5f', _: '#5e4b39', w: '#9a9aae', h: '#6a4a30', E: '#3a3a48' };
  function reveal(who) {
    const r = Math.ceil((L.def.light || 3.4) + 0.5), px = Math.floor(who.x), py = Math.floor(who.y);
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
    const dot = (o, color, r) => { ctx.fillStyle = color; Art.circle(ctx, x + o.x * s, y + o.y * s, Math.max(r, s * 0.55)); ctx.fill(); };
    if (seen(L.gate)) {
      ctx.fillStyle = L.gate.open ? '#6dff8a' : '#ff5a6a';
      ctx.fillRect(x + (L.gate.x - 0.5) * s, y + (L.gate.y - 0.5) * s, s, s);
    }
    for (const it of L.items) if (!it.got && it.type === 'key' && seen(it)) dot(it, '#ffd84a', 2.2);
    if (P.kind === 'ghost') {
      for (const g of ghostAvatars()) if (g !== P) dot(g, '#c9a8ff', 2.4);
      for (const h of humans()) if (iSee(h)) dot(h, h.caged ? '#9a7dff' : '#ff4a5a', 2.4);
    } else {
      for (const h of humans()) if (h !== P && !h.escaped) dot(h, h.caged ? '#ff4a5a' : '#7df9ff', 2.4);
    }
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
  const ghostView = () => !!P && P.kind === 'ghost' && !L.demo;
  // Can this phone's ghost player see human h right now? (Humans always see everything.)
  function iSee(h) {
    if (!ghostView()) return true;
    if (h.escaped || h.hidden) return false;
    if (h.caged || h.revealedUntil > T) return true;
    const d = dist(P, h);
    if (d < 1.5) return true;
    if (P.gtype !== 'ghost' || d > GHOST_PLAY.ghost.sight) return false;
    if (Math.abs(angDiff(P.dir, Math.atan2(h.y - P.y, h.x - P.x))) > FOV / 2) return false;
    return clearLine(P.x, P.y, h.x, h.y);
  }
  // A phantom player senses humans nearby, even through walls
  function iSense(h) {
    return ghostView() && P.gtype === 'phantom' && !h.escaped && !h.hidden && !h.caged && dist(P, h) < GHOST_PLAY.phantom.sense;
  }

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
    L.spots.forEach((s, i) => list.push([s.y + 0.3, () => drawSpot(s, i)]));
    for (const hd of L.hands) list.push([hd.y + 0.1, () => drawHand(hd)]);
    for (const it of L.items) if (!it.got) list.push([it.y, () => drawItem(it)]);
    list.push([L.gate.y - 1, () => Art.gate(ctx, L.gate.x, L.gate.y, L.gate.open, T)]);
    if (!L.demo) {
      for (const h of humans()) {
        if (h.hidden || h.escaped || !iSee(h)) continue;
        const blink = (h.invuln > 0 || h.inv) && Math.floor(T * 10) % 2 === 0;
        if (!blink || h.caged) list.push([h.y + 0.25, () => drawHuman(h)]);
      }
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of list) draw();
    for (const b of L.bats) Art.bat(ctx, b.rx, b.ry, b.t);
  }
  function drawSpot(s, i) {
    const fn = s.type === 'B' ? Art.bush : s.type === 'C' ? Art.coffin : Art.crypt;
    // ghosts never see who's hiding (only the 👀 marks of spots they saw someone go into)
    const occupied = !ghostView() && humans().some((h) => h.hidden && h.spot === s);
    fn(ctx, s.x, s.y, T, occupied, ghostView() ? 0 : s.shake);
    if (ghostView() && hideMarks.has(i)) Art.emoji(ctx, '👀', s.x, s.y - 0.75 + Math.sin(T * 4) * 0.05, 0.42, SC);
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
  function drawHuman(h) {
    const me = h === P;
    Art.hero(ctx, h.x, h.y - 0.05, me ? save.hero : h.hero, {
      t: T, walk: h.walk, moving: h.moving && !h.caged, flip: h.flip, back: h.back, side: h.side,
      scared: h.caged || (me && L.chasing), dizzy: me ? (h.stuck > 0 && h.stuckType === 'dizzy') : h.stuckType === 'dizzy',
      scale: 0.95, sneak: h.moving && h.mode === 'sneak', tired: me && h.exhausted,
    });
    if (me && h.boost > 0) Art.sparkle(ctx, h.x + Math.sin(T * 9) * 0.3, h.y - 0.5 + Math.cos(T * 7) * 0.2, 0.08, 0.9);
    if (h.caged) Art.cage(ctx, h.x, h.y, T, (h.rescue || 0) / RESCUE_TIME);
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
    if (g.kind === 'ghost' && g.id) return g.abilityT > 0 ? '255,70,70' : '200,150,255';   // a ghost player's cone
    if (g.state === 'chase' || g.state === 'seize') return '255,70,70';
    if (g.sus > 0 || g.state === 'investigate' || g.state === 'search') return '255,190,80';
    return '150,190,255';
  }
  function allCones() {
    const a = L.ghosts.filter((g) => g.cone);
    for (const g of ghostAvatars()) if (g.cone && !(g.fade && !ghostView())) a.push(g);
    return a;
  }
  function drawDarkness(ox, oy) {
    let a = L.def.darkness != null ? L.def.darkness : 0.75;
    if (ghostView()) a = P.gtype === 'banshee' ? 0.93 : 0.9;
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
    const coneLight = (g, inner, outer) => {
      dctx.setTransform(SC, 0, 0, SC, ox, oy);
      const R = g.coneR || L.def.ghostSight;
      const cg = dctx.createRadialGradient(g.x, g.y, 0.2, g.x, g.y, R);
      cg.addColorStop(0, `rgba(0,0,0,${inner})`);
      cg.addColorStop(1, `rgba(0,0,0,${outer})`);
      dctx.fillStyle = cg;
      conePath(dctx, g);
      dctx.fill();
      dctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    if (L.demo || !P) light((canvas.width / 2 - ox) / SC, (canvas.height / 2 - oy) / SC, 6, 0.5);
    else if (ghostView()) {
      light(P.x, P.y, 1.8, 0.85);
      if (P.cone) coneLight(P, 0.9, 0.5);
      for (const g of ghostAvatars()) if (g !== P) light(g.x, g.y, 1.2, 0.5);
      for (const h of humans()) if (h.caged || (iSee(h) && !h.escaped && !h.hidden)) light(h.x, h.y, 1.2, 0.6);
    } else {
      if (!P.escaped) light(P.x, P.y, P.hidden ? 1.4 : (L.def.light || 3.4) + Math.sin(T * 7) * 0.05, P.hidden ? 0.6 : 1);
      for (const h of humans()) if (h !== P && !h.hidden && !h.escaped) light(h.x, h.y, 2.6, 0.8);
    }
    for (const p of L.pumpkins) light(p.x, p.y, 1.7 + Math.sin(T * 8 + p.ph) * 0.1, 0.85);
    light(L.gate.x, L.gate.y, L.gate.open ? 2.6 : 1.3, L.gate.open ? 1 : 0.5);
    for (const it of L.items) if (!it.got) light(it.x, it.y, it.type === 'key' ? 0.9 : 0.5, 0.5);
    for (const g of L.ghosts) light(g.x, g.y, 1.3, g.kind === 'phantom' ? 0.15 : 0.35);
    // a ghost's cone of sight glows faintly, so you can always see where it is looking
    for (const g of allCones()) if (g !== P) coneLight(g, 0.45, 0.12);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
    if (P && P.kind === 'human' && !P.hidden && !P.escaped && !L.demo) {
      const sx = P.x * SC + ox, sy = P.y * SC + oy, rp = 2.5 * SC;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rp);
      g.addColorStop(0, 'rgba(255,170,70,0.13)');
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - rp, sy - rp, rp * 2, rp * 2);
    }
  }
  const RING = { run: ['255,255,255', 0.22], sprint: ['255,255,255', 0.4], pebble: ['255,220,120', 0.75], yell: ['255,160,90', 0.6], scream: ['225,160,255', 0.9], gate: ['140,255,150', 0.7], heard: ['255,90,90', 0.85] };
  // Things that glow, drawn on top of the darkness
  function drawGlowing() {
    for (const g of allCones()) {
      const col = coneColor(g), R = g.coneR || L.def.ghostSight;
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
      ctx.lineWidth = r.kind === 'scream' ? 0.14 : r.kind === 'heard' ? 0.08 : 0.05;
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
    // computer ghosts
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
    // ghosts played by people
    for (const g of ghostAvatars()) {
      const fading = g.gtype === 'phantom' && (g === P ? g.abilityT > 0 : g.fade);
      if (fading && !ghostView()) continue;
      ctx.globalAlpha = fading ? 0.35 : 1;
      if (g.gtype === 'banshee') Art.banshee(ctx, g.x, g.y, g.t || T, { scream: g === P ? g.abilityT > 0 : g.abilityT });
      else if (g.gtype === 'phantom') Art.phantom(ctx, g.x, g.y, g.t || T, { hunting: true, look: g.look });
      else Art.ghost(ctx, g.x, g.y, g.t || T, { color: g.color, mood: (g === P ? g.abilityT > 0 : g.abilityT) ? 'chase' : 'search', look: g.look });
      ctx.globalAlpha = 1;
      if (g.slowT > 0 || g.slow) Art.text(ctx, '💫', g.x, g.y - 0.9, 0.3, '#fff');
    }
    // what a phantom player senses through the walls
    if (ghostView() && P.gtype === 'phantom') for (const h of humans()) if (iSense(h) && !iSee(h)) Art.smoke(ctx, h.x, h.y, T);
    // names and emotes
    if (MP) {
      for (const a of [...humans(), ...ghostAvatars()]) {
        if (a === P || a.escaped) continue;
        if (a.kind === 'human' && (a.hidden || !iSee(a))) continue;
        if (a.kind === 'ghost' && a.fade && !ghostView()) continue;
        Art.nameTag(ctx, a.name, a.x, a.y - 1.05, a.kind === 'ghost' ? '#e4c8ff' : '#bff7ff');
      }
      for (const a of [P, ...remotes.values()]) {
        if (a && a.emote && !(a.kind === 'human' && a.hidden && a !== P)) Art.emoteBubble(ctx, a.x, a.y - 1.45, a.emote.icon, SC);
      }
    }
    drawParticles();
  }
  function drawScreenFx(ox, oy) {
    if (P && !L.demo) {
      if (L.chasing || state === 'caught') {
        const a = 0.28 + 0.12 * Math.sin(T * 8);
        const col = ghostView() ? '150,60,255' : '200,0,30';
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (state === 'play' || state === 'caught') {
        if (P.kind === 'human') {
          if (L.gate.open && !P.escaped) drawEdgeArrow(L.gate, ox, oy, '#6dff8a', '🚪');
          for (const h of humans()) if (h !== P && h.caged) drawEdgeArrow(h, ox, oy, '#ff6b7a', '🔒');
        }
        drawMinimap();
      }
      if (input.joy && state === 'play') drawJoystick();
      if (MP && !MP.host && state === 'play' && T - MP.lastWorld > 2.5) {
        Art.text(ctx, '⏳ Waiting for the host…', W / 2, H * 0.3, 24, '#fff', { stroke: '#1a0a26', strokeWidth: 8 });
      }
    }
    if (state === 'caught' || (P && P.caged && P.cagedFx > 0)) {
      const s = 1 + (1.4 - (state === 'caught' ? caughtT : P.cagedFx)) * 0.4;
      Art.text(ctx, 'BOO!', W / 2, H * 0.4, 84 * s, '#ffffff', { stroke: '#4a0a5a', strokeWidth: 9 });
    }
    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashT * 0.8})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // An arrow at the edge of the screen pointing at something off-screen
  function drawEdgeArrow(target, ox, oy, color, icon) {
    const sx = (target.x * SC + ox) / DPR, sy = (target.y * SC + oy) / DPR;
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
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(33, 0); ctx.lineTo(21, -9); ctx.lineTo(21, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(20,8,35,0.8)';
    Art.circle(ctx, 0, 0, 21); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    Art.emoji(ctx, icon, 0, 0, 26, DPR);
    ctx.restore();
  }
  function drawJoystick() {
    const j = input.joy, R = 56, S = 6 + SNEAK_ZONE * (R - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    Art.circle(ctx, j.ox, j.oy, R); ctx.fill(); ctx.stroke();
    const human = P && P.kind === 'human';
    if (human) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(160,220,255,0.45)';
      Art.circle(ctx, j.ox, j.oy, S); ctx.stroke();
      ctx.setLineDash([]);
    }
    const dx = j.x - j.ox, dy = j.y - j.oy, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    const sneaking = human && P.mode === 'sneak';
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
    const ghost = P && P.kind === 'ghost';
    switch (e.key) {
      case 'Shift': if (ghost) { if (!e.repeat) useAbility(); } else input.sprintKey = true; break;
      case 'x': case 'X': input.sneakKey = true; break;
      case ' ': case 'e': case 'E': e.preventDefault(); if (state === 'play') { if (ghost) ghostCheck(); else toggleHide(); } break;
      case 'f': case 'F': if (!e.repeat) throwPebble(); break;
      case 'm': case 'M': miniBig = !miniBig; break;
      case '1': case '2': case '3': case '4': if (MP && state === 'play') sendEmote(Number(e.key) - 1); break;
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
    if (screen) return { x: 0, y: 0, mag: 0 };
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
  //  SCREENS, HUD AND BUTTONS
  // =====================================================================
  const SCREENS = ['title', 'creator', 'levels', 'how', 'intro', 'pause', 'win', 'lose', 'mpMenu', 'lobby', 'results', 'mpPause'];
  let screen = 'title';
  let btnKey = '', lastRing = -1;
  let creatorReturn = 'title';
  let toastTimer = 0;

  function showScreen(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', !!id || !P);
    if (id) { $('toast').classList.add('hidden'); $('emotes').classList.add('hidden'); input.joy = null; }
    if (id !== 'win') $('rain').innerHTML = '';
    updateHUD();
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
    if (MP) {
      const hs = humans();
      const free = hs.filter((h) => !h.caged && !h.escaped).length, caged = hs.filter((h) => h.caged).length, esc = hs.filter((h) => h.escaped).length;
      $('hearts').textContent = `🧍${free} 🔒${caged} 🚪${esc}`;
    } else {
      const h = Math.max(0, P.hearts);
      $('hearts').textContent = '❤️'.repeat(h) + '🖤'.repeat(MAX_HEARTS - h);
    }
    $('keys').textContent = `🗝️ ${L.keys}/${L.keysTotal}`;
    $('candy').textContent = `🍬 ${L.candy}/${L.candyTotal}`;
    $('candy').classList.toggle('hidden', !!MP);   // no room for candy next to the clock, and it doesn't count in multiplayer
    const clock = MP && MP.clock && MP.phase === 'game';
    $('clock').classList.toggle('hidden', !clock);
    if (clock) $('clock').textContent = `🕛 ${fmtTime(MP.remain || 0)}`;
  }
  function updateButtons(force) {
    const show = state === 'play' && !!P && !screen;
    const ghost = !!P && P.kind === 'ghost';
    const out = !!P && P.kind === 'human' && (P.caged || P.escaped);
    let hide = '';
    if (show && !out) {
      if (ghost) hide = nearestSpot() && P.slowT <= 0 ? 'check' : '';
      else hide = P.hidden ? 'out' : (P.stuck <= 0 && nearestSpot() ? 'hide' : '');
    }
    const key = `${show}|${hide}|${P ? P.pebbles : 0}|${ghost}|${out}|${!!MP}`;
    if (key !== btnKey || force) {
      btnKey = key;
      $('controls').classList.toggle('hidden', !show);
      const b = $('hideBtn');
      b.classList.toggle('hidden', !hide);
      b.classList.toggle('out', hide === 'out');
      b.innerHTML = hide === 'check' ? '🔦<br>CHECK' : hide === 'out' ? '👀<br>OUT' : '🙈<br>HIDE';
      $('throwBtn').classList.toggle('hidden', ghost || out);
      $('sprintBtn').classList.toggle('hidden', out);
      $('emoteBtn').classList.toggle('hidden', !MP);
      if (P) {
        $('pebbleCount').textContent = P.pebbles;
        $('throwBtn').classList.toggle('empty', !(P.pebbles > 0));
        $('sprintBtn').innerHTML = ghost ? RULES.ghosts[GHOST_TYPES.indexOf(P.gtype)].button : '⚡<br>SPRINT';
      }
    }
    if (show && !out) {
      const ring = ghost ? (P.abilityT > 0 ? 3000 : P.abilityCD > 0 ? 1000 + Math.round((1 - P.abilityCD / GHOST_PLAY[P.gtype].cooldown) * 100) : 100)
        : Math.round(P.stamina * 100) + (P.exhausted ? 1000 : 0) + (P.boost > 0 ? 2000 : 0);
      if (ring !== lastRing) {
        lastRing = ring;
        const sb = $('sprintBtn');
        sb.style.setProperty('--st', (ring % 1000) + '%');
        sb.classList.toggle('tired', ring >= 1000 && ring < 2000);
        sb.classList.toggle('boost', ring >= 2000);
      }
    }
  }

  function goMenu() {
    P = null;
    remotes.clear();
    loadLevel(Math.min(save.unlocked, LEVELS.length) - 1, { demo: true });
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

  // ---------- character maker ----------
  const ROWS = [
    { key: 'costume', label: 'Costume', items: () => Art.COSTUMES, render: (b, c) => { b.textContent = c.icon; b.title = c.label; } },
    { key: 'hat', label: 'Hat', items: () => Art.HATS },
    { key: 'body', label: 'Clothes', items: () => Art.BODIES },
    { key: 'outfit', label: 'Top colour', items: () => Art.OUTFITS },
    { key: 'pattern', label: 'Pattern', items: () => Art.PATTERNS },
    { key: 'bottom', label: 'Trousers', items: () => Art.BOTTOMS, show: (h) => (h.body || 0) !== 0 },
    { key: 'tie', label: 'Tie', items: () => Art.TIES, show: (h) => h.body === 2 || h.body === 3 },
    { key: 'hairStyle', label: 'Hair style', items: () => Art.HAIR_STYLES, text: (s) => Art.HAIR_LABELS[s] },
    { key: 'hair', label: 'Hair colour', items: () => Art.HAIRS },
    { key: 'eyes', label: 'Eyes', items: () => Art.EYES },
    { key: 'glasses', label: 'Glasses', items: () => Art.GLASSES },
    { key: 'beard', label: 'Beard', items: () => Art.BEARDS },
    { key: 'beardColor', label: 'Beard colour', items: () => Art.HAIRS, show: (h) => (h.beard || 0) > 0, current: (h) => (h.beardColor != null ? h.beardColor : h.hair) },
    { key: 'skin', label: 'Skin', items: () => Art.SKINS },
    { key: 'necklace', label: 'Necklace', items: () => Art.NECKLACES },
  ];
  function openCreator() {
    buildPresets();
    buildCreator();
    showScreen('creator');
  }
  function buildPresets() {
    const strip = $('presets');
    strip.innerHTML = '';
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const add = (label, hero, onPick) => {
      const b = document.createElement('button');
      b.className = 'preset';
      const cv = document.createElement('canvas');
      cv.width = 64 * d; cv.height = 72 * d;
      const c = cv.getContext('2d');
      if (hero) { c.setTransform(52 * d, 0, 0, 52 * d, 32 * d, 0); Art.hero(c, 0, 1.06, hero, { t: 0.5 }); }
      else { c.font = `${40 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎲', 32 * d, 38 * d); }
      const s = document.createElement('span'); s.textContent = label;
      b.append(cv, s);
      b.addEventListener('click', () => { onPick(); writeSave(); Sound.sfx('click'); buildCreator(); });
      strip.appendChild(b);
    };
    add('Random', null, randomHero);
    for (const p of PRESETS) add(p.name, p.hero, () => { const name = save.hero.name; save.hero = { ...p.hero, name }; });
  }
  function randomHero() {
    const r = (n) => (Math.random() * n) | 0;
    const body = r(Art.BODIES.length);
    save.hero = {
      name: save.hero.name, body, costume: Math.random() < 0.45 ? r(5) : 5, hat: Math.random() < 0.2 ? 1 + r(2) : 0,
      outfit: r(Art.OUTFITS.length), pattern: Math.random() < 0.5 ? 0 : r(Art.PATTERNS.length), bottom: r(Art.BOTTOMS.length),
      tie: body >= 2 ? r(Art.TIES.length) : 0, hairStyle: r(Art.HAIR_STYLES.length), hair: r(Art.HAIRS.length), eyes: r(Art.EYES.length),
      glasses: Math.random() < 0.4 ? r(Art.GLASSES.length) : 0, beard: Math.random() < 0.15 ? 1 + r(3) : 0,
      skin: r(Art.SKINS.length), necklace: Math.random() < 0.25 ? 1 + r(2) : 0,
    };
  }
  function buildCreator() {
    const h = save.hero;
    const box = $('creatorRows');
    box.innerHTML = '';
    for (const row of ROWS) {
      if (row.show && !row.show(h)) continue;
      const wrap = document.createElement('div'); wrap.className = 'opt';
      const label = document.createElement('span'); label.textContent = row.label;
      const choices = document.createElement('div'); choices.className = 'choices';
      const cur = row.current ? row.current(h) : (h[row.key] != null ? h[row.key] : 0);
      row.items().forEach((item, i) => {
        const b = document.createElement('button');
        b.className = 'choice' + (cur === i ? ' on' : '');
        if (row.render) row.render(b, item);
        else if (typeof item === 'string' && item[0] === '#') { b.classList.add('swatch'); b.style.background = item; }
        else if (item === null) { b.classList.add('word'); b.textContent = 'None'; }
        else { b.classList.add('word'); b.textContent = row.text ? row.text(item) : item.label; }
        b.addEventListener('click', () => { h[row.key] = i; writeSave(); Sound.sfx('click'); buildCreator(); });
        choices.appendChild(b);
      });
      wrap.append(label, choices);
      box.appendChild(wrap);
    }
    $('heroName').value = h.name || '';
  }

  // ---------- single player ----------
  function startLevel(idx) {
    MP = null;
    remotes.clear();
    loadLevel(idx);
    const problems = validateLevel(L.def);
    if (problems.length) console.warn(`Level ${idx + 1} has map problems:\n- ${problems.join('\n- ')}`);
    P = makeHuman(L.start.x, L.start.y);
    particles.length = 0;
    state = 'intro';
    Sound.setMode('calm');
    const d = L.def, name = (save.hero.name || '').trim();
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
    input.joy = null;
    input.keys.clear();
    input.sprintBtn = false;
    if (MP) { showScreen('mpPause'); return; }   // the game keeps going for everyone else
    state = 'paused';
    Sound.setMode('off');
    showScreen('pause');
  }
  function resume() {
    if (!MP) state = 'play';
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
    const name = (save.hero.name || '').trim();
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

  // =====================================================================
  //  MULTIPLAYER
  //  The host's phone runs the computer ghosts, decides who caught whom, who
  //  picked up what, rescues, the clock and who won. Every phone moves its own
  //  player and tells the others where it is.
  // =====================================================================
  const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function randomCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_LETTERS[(Math.random() * CODE_LETTERS.length) | 0]; return s; }
  function myRecord() {
    const { name, ...hero } = save.hero;
    return { id: MP.myId, name: (name || '').trim().slice(0, 12) || 'Player', hero, team: save.mp.team, perk: save.mp.perk, gtype: save.mp.gtype, gcolor: save.mp.gcolor };
  }
  function mpStatus(msg) { const el = $('mpStatus'); el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
  function netError(reason) {
    return {
      noroom: "There's no game with that code. Check the code on the host's screen.",
      full: 'That game is full (8 players).',
      timeout: "Couldn't reach the game server. Check the internet and try again.",
      offline: "Couldn't reach the game server. Check the internet and try again.",
    }[reason] || 'Something went wrong. Please try again.';
  }
  function openMultiplayer() {
    if (!(save.hero.name || '').trim()) { creatorReturn = 'mpMenu'; openCreator(); toast('✏️ First, type your name so your friends know who you are!', 3000); return; }
    mpStatus('');
    showScreen('mpMenu');
  }
  async function mpCreate() {
    mpStatus('Making a room…');
    for (let i = 0; i < 4; i++) {
      const code = randomCode();
      try { const w = await Net.connect(code, true); startSession(w, code); return; }
      catch (e) { if (e.message !== 'taken') { mpStatus(netError(e.message)); return; } }
    }
    mpStatus(netError('busy'));
  }
  async function mpJoin() {
    const code = $('mpCode').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) { mpStatus("Type the 4-letter code from the host's screen."); return; }
    mpStatus('Joining…');
    try { startSession(await Net.connect(code, false), code); } catch (e) { mpStatus(netError(e.message)); }
  }
  function startSession(w, code) {
    MP = { code, myId: w.id, host: w.host, hostId: Net.hostId, phase: 'lobby', mode: 'coop', map: 0, ai: true, clock: 0, remain: 0, players: new Map(), stats: {}, sendT: 0, worldT: 0, lastWorld: T, endT: 0 };
    Net.onMessage = onNet;
    mpStatus('');
    if (MP.host) MP.players.set(MP.myId, myRecord());
    else Net.send({ t: 'hello', to: MP.hostId, p: myRecord() });
    renderLobby();
    showScreen('lobby');
  }
  function leaveGame(reason) {
    Net.onMessage = () => {};
    Net.close();
    MP = null;
    hideMarks.clear();
    goMenu();
    if (reason) { showScreen('mpMenu'); mpStatus(reason); }
  }

  function onNet(m) {
    if (!MP) return;
    switch (m.t) {
      case 'closed': leaveGame('Lost the connection to the game.'); break;
      case 'leave':
        if (m.id === MP.hostId) leaveGame('The host left the game.');
        else dropPlayer(m.id);
        break;
      case 'hello': if (MP.host) hostHello(m.from, m.p); break;
      case 'busy': leaveGame('That game has already started. Ask the host to go back to the lobby, then join again.'); break;
      case 'lobby': if (!MP.host) applyLobby(m); break;
      case 'pick': if (MP.host) hostPick(m.from, m); break;
      case 'start': if (!MP.host) beginMatch(m); break;
      case 'me': onMe(m.from, m); break;
      case 'world': if (!MP.host) applyWorld(m); break;
      case 'ev': if (!MP.host) onEv(m); break;
      case 'act': if (MP.host) hostAct(m.from, m); break;
      case 'noise': onRemoteNoise(m); break;
      case 'emote': onEmote(m.from, m); break;
      case 'end': if (!MP.host) showResults(m); break;
    }
  }

  // ---------- the lobby ----------
  function lobbyMessage() {
    return { t: 'lobby', phase: MP.phase, mode: MP.mode, map: MP.map, ai: MP.ai, players: [...MP.players.values()] };
  }
  function broadcastLobby() {
    if (MP.mode === 'coop') for (const p of MP.players.values()) p.team = 'humans';
    Net.send(lobbyMessage());
    renderLobby();
  }
  function hostHello(id, p) {
    if (MP.phase !== 'lobby') { Net.send({ t: 'busy', to: id }); return; }
    if (MP.players.size >= 8) return;
    MP.players.set(id, { ...p, id });
    broadcastLobby();
    Sound.sfx('candy');
  }
  function hostPick(id, m) {
    const p = MP.players.get(id);
    if (!p || MP.phase !== 'lobby') return;
    Object.assign(p, { team: m.team === 'ghosts' ? 'ghosts' : 'humans', perk: m.perk | 0, gtype: m.gtype | 0, gcolor: m.gcolor | 0, name: String(m.name || p.name).slice(0, 12), hero: m.hero || p.hero });
    broadcastLobby();
  }
  function applyLobby(m) {
    const back = m.phase === 'lobby' && MP.phase !== 'lobby';
    Object.assign(MP, { mode: m.mode, map: m.map, ai: m.ai, phase: m.phase });
    MP.players = new Map(m.players.map((p) => [p.id, p]));
    if (back) backToLobbyLocal();
    renderLobby();
  }
  function dropPlayer(id) {
    const p = MP.players.get(id);
    MP.players.delete(id);
    remotes.delete(id);
    if (MP.phase === 'lobby' && MP.host) broadcastLobby();
    else renderLobby();
    if (p && MP.phase === 'game') { toast(`👋 ${p.name} left the game.`, 2000); updateHUD(); }
  }
  // my choices in the lobby
  function pickRole(change) {
    Object.assign(save.mp, change);
    writeSave();
    const me = myRecord();
    if (MP.host) { MP.players.set(MP.myId, me); broadcastLobby(); }
    else { MP.players.set(MP.myId, me); Net.send({ t: 'pick', to: MP.hostId, ...me }); renderLobby(); }
    Sound.sfx('click');
  }
  function hostSetting(change) {
    if (!MP.host) return;
    Object.assign(MP, change);
    broadcastLobby();
    Sound.sfx('click');
  }
  function chip(label, on, onClick, cls) {
    const b = document.createElement('button');
    b.className = 'choice word' + (on ? ' on' : '') + (cls ? ' ' + cls : '');
    b.innerHTML = label;
    if (onClick) b.addEventListener('click', onClick); else b.disabled = true;
    return b;
  }
  function renderLobby() {
    if (!MP) return;
    $('lobbyCode').textContent = MP.code || '----';
    const me = MP.players.get(MP.myId) || myRecord();
    const mode = RULES.modes[MP.mode];
    // game settings (only the host can change them)
    const opts = $('lobbyOpts');
    opts.innerHTML = '';
    const row = (label, kids) => {
      const w = document.createElement('div'); w.className = 'opt';
      const s = document.createElement('span'); s.textContent = label;
      const c = document.createElement('div'); c.className = 'choices'; c.append(...kids);
      w.append(s, c); opts.appendChild(w);
    };
    const host = MP.host;
    row('Game', Object.entries(RULES.modes).map(([id, m]) => chip(`${m.icon} ${m.name}`, MP.mode === id, host ? () => hostSetting({ mode: id }) : null)));
    row('Map', LEVELS.map((d, i) => chip(`${i + 1}. ${d.name}`, MP.map === i, host ? () => hostSetting({ map: i }) : null)));
    if (MP.mode === 'versus') row('Extra ghosts', [chip('🤖 Computer ghosts too', MP.ai, host ? () => hostSetting({ ai: true }) : null), chip('Only players', !MP.ai, host ? () => hostSetting({ ai: false }) : null)]);
    $('lobbyModeText').textContent = mode.short;
    // my team and role
    const team = $('lobbyTeam');
    team.innerHTML = '';
    const versus = MP.mode === 'versus';
    team.append(
      chip('🧍 Humans', me.team !== 'ghosts' || !versus, () => pickRole({ team: 'humans' })),
      chip('👻 Ghosts', versus && me.team === 'ghosts', versus ? () => pickRole({ team: 'ghosts' }) : null),
    );
    const role = $('lobbyRole');
    role.innerHTML = '';
    let text;
    if (versus && me.team === 'ghosts') {
      RULES.ghosts.forEach((g, i) => role.appendChild(chip(`${g.icon} ${g.name}`, me.gtype === i, () => pickRole({ gtype: i }))));
      if (me.gtype === 0) GHOST_COLORS.forEach((c, i) => { const b = chip('', me.gcolor === i, () => pickRole({ gcolor: i }), 'swatch'); b.style.background = c; role.appendChild(b); });
      text = `${RULES.ghosts[me.gtype].text} ${RULES.allGhosts}`;
    } else {
      RULES.perks.forEach((p, i) => role.appendChild(chip(`${p.icon} ${p.name}`, me.perk === i, () => pickRole({ perk: i }))));
      text = `${RULES.perks[me.perk].text} ${RULES.humans}`;
    }
    $('lobbyRoleText').textContent = text;
    // players
    const list = $('lobbyPlayers');
    list.innerHTML = '';
    for (const p of MP.players.values()) {
      const li = document.createElement('li');
      const ghost = versus && p.team === 'ghosts';
      const roleTxt = ghost ? `${RULES.ghosts[p.gtype].icon} ${RULES.ghosts[p.gtype].name}` : `${RULES.perks[p.perk].icon} ${RULES.perks[p.perk].name}`;
      li.textContent = `${ghost ? '👻' : '🧍'} ${p.name}${p.id === MP.hostId ? ' 👑' : ''}${p.id === MP.myId ? ' (you)' : ''} · ${roleTxt}`;
      list.appendChild(li);
    }
    // rules
    const rules = $('lobbyRules');
    rules.innerHTML = '';
    for (const r of mode.rules) { const li = document.createElement('li'); li.textContent = r; rules.appendChild(li); }
    // start
    const players = [...MP.players.values()];
    const nHumans = players.filter((p) => !versus || p.team !== 'ghosts').length;
    const nGhosts = players.length - nHumans;
    let why = '';
    if (!nHumans) why = 'Someone needs to be a human.';
    else if (versus && !nGhosts && !MP.ai) why = 'Someone needs to be a ghost (or switch on computer ghosts).';
    $('lobbyStart').classList.toggle('hidden', !host);
    $('lobbyStart').disabled = !!why;
    $('lobbyWait').textContent = host ? (why || (players.length < 2 ? 'Tell your friends the code! You can also start on your own.' : 'Everyone ready? Press Start!')) : 'Waiting for the host to start…';
  }

  // ---------- starting a match ----------
  function hostStart() {
    if (!MP.host || MP.phase !== 'lobby') return;
    const versus = MP.mode === 'versus';
    loadLevel(MP.map, { ai: false });
    const players = [...MP.players.values()];
    const hs = players.filter((p) => !versus || p.team !== 'ghosts');
    const gs = players.filter((p) => versus && p.team === 'ghosts');
    const hSpots = openSquaresNear(L.start.x, L.start.y, hs.length);
    hs.forEach((p, i) => Object.assign(p, { team: 'humans', x: hSpots[i % hSpots.length].x, y: hSpots[i % hSpots.length].y }));
    gs.forEach((p, i) => {
      const base = L.spawns[i % Math.max(1, L.spawns.length)] || { x: L.w - 2.5, y: L.h - 2.5 };
      const near = openSquaresNear(base.x, base.y, 1 + Math.floor(i / Math.max(1, L.spawns.length)) + (MP.ai ? 1 : 0));
      const at = near[near.length - 1] || base;
      Object.assign(p, { x: at.x, y: at.y });
    });
    const start = { t: 'start', seed: (Math.random() * 1e9) | 0, mode: MP.mode, map: MP.map, ai: MP.ai, clock: versus ? VERSUS_CLOCK : 0, players };
    Net.send(start);
    beginMatch(start);
  }
  function makeRemote(p) {
    const ghost = p.team === 'ghosts';
    return {
      id: p.id, kind: ghost ? 'ghost' : 'human', name: p.name, hero: p.hero, perk: PERKS[p.perk],
      gtype: GHOST_TYPES[p.gtype] || 'ghost', color: GHOST_COLORS[p.gcolor] || GHOST_COLORS[0],
      x: p.x, y: p.y, tx: p.x, ty: p.y, dir: Math.PI / 2, look: 0, walk: 0, moving: false, mode: 'idle',
      flip: false, back: false, side: false, stuckType: '', inv: false, boost: false,
      hidden: false, spot: null, hideFrom: null, caged: false, escaped: false, rescue: 0, revealedUntil: 0,
      abilityT: false, slow: false, fade: false, emote: null, t: Math.random() * 10, cone: null,
    };
  }
  function beginMatch(s) {
    Object.assign(MP, { phase: 'game', mode: s.mode, map: s.map, ai: s.ai, clock: s.clock, remain: s.clock, endT: T + s.clock, stats: {}, lastWorld: T, sendT: 0, worldT: 0 });
    hideMarks.clear();
    remotes.clear();
    particles.length = 0;
    loadLevel(s.map, { seed: s.seed, ai: s.mode === 'coop' || s.ai });
    for (const p of s.players) {
      MP.players.set(p.id, p);
      MP.stats[p.id] = { keys: 0, candy: 0, rescues: 0, catches: 0, caught: 0, escaped: 0 };
      if (p.id === MP.myId) {
        P = p.team === 'ghosts' ? makeGhostPlayer(p.x, p.y, p) : makeHuman(p.x, p.y, { id: p.id, name: p.name, perk: PERKS[p.perk], hero: save.hero });
      } else remotes.set(p.id, makeRemote(p));
    }
    if (P.kind === 'ghost') { L.seen.fill(1); miniDirty = true; }
    cam.x = P.x; cam.y = P.y;
    state = 'play';
    Sound.setMode('calm');
    showScreen(null);
    if (document.activeElement) document.activeElement.blur();
    const role = P.kind === 'ghost' ? RULES.ghosts[GHOST_TYPES.indexOf(P.gtype)] : RULES.perks[PERKS.indexOf(P.perk)];
    const goal = P.kind === 'ghost' ? 'Catch the humans!' : (s.mode === 'versus' ? 'Find the keys and escape before midnight!' : 'Find the keys together and escape!');
    toast(`${role.icon} You're ${P.kind === 'ghost' ? 'a' : 'the'} ${role.name}. ${goal}`, 4000);
  }

  // ---------- keeping everyone in sync ----------
  function meMessage() {
    const p = P, m = { t: 'me', x: r2(p.x), y: r2(p.y), mv: p.moving ? 1 : 0 };
    if (p.kind === 'human') {
      Object.assign(m, { f: p.flip ? 1 : 0, b: p.back ? 1 : 0, s: p.side ? 1 : 0, m: p.mode, h: p.hidden ? L.spots.indexOf(p.spot) : -1, st: p.stuck > 0 ? p.stuckType : '', iv: p.invuln > 0 ? 1 : 0 });
    } else {
      Object.assign(m, { d: r2(p.dir), ab: p.abilityT > 0 ? 1 : 0, sl: p.slowT > 0 ? 1 : 0, fd: p.gtype === 'phantom' && p.abilityT > 0 ? 1 : 0 });
    }
    return m;
  }
  function onMe(id, m) {
    const r = remotes.get(id);
    if (!r || !MP || MP.phase !== 'game') return;
    r.tx = m.x; r.ty = m.y;
    r.moving = !!m.mv;
    if (r.kind === 'ghost') {
      r.dir = m.d; r.abilityT = !!m.ab; r.slow = !!m.sl; r.fade = !!m.fd;
      return;
    }
    Object.assign(r, { flip: !!m.f, back: !!m.b, side: !!m.s, mode: m.m, stuckType: m.st, inv: !!m.iv });
    const hiding = m.h >= 0;
    if (hiding && !r.hidden) {
      const spot = L.spots[m.h];
      r.x = r.tx; r.y = r.ty;
      r.hideFrom = { x: m.x, y: m.y };
      if (MP.host && spot) onHumanHid(r, spot);
      if (ghostView() && iSee(r)) { hideMarks.add(m.h); toast('👀 You saw someone hide!', 1500); }
      r.hidden = true;
      r.spot = spot;
    } else if (!hiding && r.hidden) {
      r.hidden = false;
      r.spot = null;
    }
  }
  function mpUpdate(dt) {
    for (const r of remotes.values()) {
      const d = Math.hypot(r.tx - r.x, r.ty - r.y);
      if (d > 3) { r.x = r.tx; r.y = r.ty; }
      else { const k = Math.min(1, dt * 12); r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; }
      r.t += dt;
      if (r.kind === 'ghost') {
        r.look = Math.cos(r.dir);
        if (r.gtype === 'ghost') computeCone(r, GHOST_PLAY.ghost.sight, FOV); else r.cone = null;
      } else if (r.moving) r.walk += dt * (r.mode === 'sneak' ? 7 : r.mode === 'sprint' ? 18 : 13);
    }
    if (P.cagedFx > 0) P.cagedFx -= dt;
    MP.sendT -= dt;
    if (MP.sendT <= 0) { MP.sendT = SEND_EVERY; Net.send(meMessage()); }
    if (MP.host) hostTick(dt);
    if (MP.clock && Math.ceil(MP.remain) !== MP.shownClock) { MP.shownClock = Math.ceil(MP.remain); updateHUD(); }
  }
  // computer ghosts on the other phones glide to where the host says they are
  function smoothGhost(g, dt) {
    if (g.tx == null) { g.tx = g.x; g.ty = g.y; }
    const k = Math.min(1, dt * 10);
    g.x += (g.tx - g.x) * k;
    g.y += (g.ty - g.y) * k;
    g.t += dt;
    g.look = Math.cos(g.dir);
    if (g.kind === 'ghost') computeCone(g); else g.cone = null;
  }
  function worldMessage() {
    return {
      t: 'world',
      ai: L.ghosts.map((g) => [r2(g.x), r2(g.y), r2(g.dir), STATE_CODES.indexOf(g.state), r2(g.sus), g.alertT > 0 ? 1 : 0, g.screamT > 0 ? 1 : 0, g.hunting ? 1 : 0]),
      k: L.keys, c: L.candy, g: L.gate.open ? 1 : 0,
      cg: humans().filter((h) => h.caged).map((h) => [h.id, r2(h.rescue || 0)]),
      cl: Math.ceil(MP.remain || 0),
    };
  }
  function applyWorld(m) {
    MP.lastWorld = T;
    m.ai.forEach((a, i) => {
      const g = L.ghosts[i];
      if (!g) return;
      const wasScream = g.screamT > 0;
      [g.tx, g.ty, g.dir] = a;
      g.state = STATE_CODES[a[3]] || 'patrol';
      g.sus = a[4];
      g.alertT = a[5] ? 0.5 : 0;
      g.screamT = a[6] ? 0.5 : 0;
      g.hunting = !!a[7];
      if (g.screamT && !wasScream && g.kind === 'banshee') { L.rings.push({ x: g.x, y: g.y, r: 10, kind: 'scream', t: 0 }); Sound.sfx('scream'); }
    });
    const keysChanged = L.keys !== m.k || L.candy !== m.c;
    L.keys = m.k; L.candy = m.c;
    if (m.g && !L.gate.open) openGate();
    const rescues = new Map(m.cg);
    for (const h of humans()) h.rescue = rescues.get(h.id) || 0;
    MP.remain = m.cl;
    if (keysChanged) updateHUD();
  }

  // ---------- what the host decides ----------
  function avatar(id) { return id === MP.myId ? P : remotes.get(id); }
  function stat(id) { return MP.stats[id] || (MP.stats[id] = { keys: 0, candy: 0, rescues: 0, catches: 0, caught: 0, escaped: 0 }); }
  function hostOrSend(act) {
    if (!MP) return;
    if (MP.host) hostAct(MP.myId, act);
    else Net.send({ t: 'act', to: MP.hostId, ...act });
  }
  function emitEv(ev) { Net.send({ t: 'ev', ...ev }); onEv(ev); }
  function hostAct(id, a) {
    const who = avatar(id);
    if (!who || !MP || MP.phase !== 'game') return;
    switch (a.a) {
      case 'pick': {
        const it = L.items[a.i];
        if (!it || it.got || who.kind !== 'human' || !targetable(who) || dist(who, it) > 1.4) return;
        if (it.type === 'key') stat(id).keys++;
        if (it.type === 'candy') stat(id).candy++;
        emitEv({ e: 'got', i: a.i, by: id });
        break;
      }
      case 'escape':
        if (who.kind === 'human' && L.gate.open && !who.escaped && !who.caged && dist(who, L.gate) < 1.6) { stat(id).escaped = 1; emitEv({ e: 'escaped', id }); }
        break;
      case 'check': {
        if (who.kind !== 'ghost') return;
        const s = L.spots[a.spot];
        if (!s) return;
        const h = humans().find((x) => x.hidden && x.spot === s);
        if (h) { pullOut(h); hostCage(h, who); } else emitEv({ e: 'empty', id });
        break;
      }
      case 'scream': {
        if (who.kind !== 'ghost' || who.gtype !== 'banshee') return;
        const ids = humans().filter((h) => !h.escaped && !h.hidden && !h.caged && dist(h, who) < GHOST_PLAY.banshee.reveal).map((h) => h.id);
        emitEv({ e: 'reveal', ids, x: r2(who.x), y: r2(who.y), by: id });
        for (const g of L.ghosts) if (g.kind === 'ghost' && g.state !== 'chase' && g.state !== 'seize' && dist(g, who) < 16) investigate(g, who.x, who.y, true);
        break;
      }
    }
  }
  function hostCage(h, g) {
    if (h.caged || h.escaped) return;
    stat(h.id).caught++;
    if (g.id) stat(g.id).catches++;
    else Object.assign(g, { state: 'patrol', path: [], wait: 2, sus: 0, memory: 0, target: null });   // a computer ghost goes back to patrolling
    emitEv({ e: 'caged', id: h.id, x: r2(h.x), y: r2(h.y), by: g.id || '' });
  }
  function hostTick(dt) {
    // ghost players catch humans by touching them (computer ghosts are handled in updateGhost)
    for (const a of ghostAvatars()) for (const h of humans()) if (targetable(h) && !isSafe(h) && dist(a, h) < 0.6) hostCage(h, a);
    // friends standing next to a cage free whoever's inside
    for (const c of humans()) {
      if (!c.caged) continue;
      const helpers = humans().filter((h) => targetable(h) && dist(h, c) < 1.15);
      if (helpers.length) {
        const medic = helpers.find((h) => h.perk === 'medic');
        c.rescue = (c.rescue || 0) + dt * (medic ? RESCUE_TIME : 1);
        if (c.rescue >= RESCUE_TIME) {
          const by = medic || helpers[0];
          c.rescue = 0;
          stat(by.id).rescues++;
          emitEv({ e: 'freed', id: c.id, by: by.id, medic: !!medic });
        }
      } else c.rescue = Math.max(0, (c.rescue || 0) - dt);
    }
    if (!L.gate.open && L.keys >= L.keysTotal) openGate();
    if (MP.clock) MP.remain = Math.max(0, MP.endT - T);
    hostCheckEnd();
    MP.worldT -= dt;
    if (MP.worldT <= 0) { MP.worldT = WORLD_EVERY; Net.send(worldMessage()); }
  }
  function hostCheckEnd() {
    if (MP.phase !== 'game' || L.time < 1) return;
    const hs = humans();
    if (!hs.length) return;
    const esc = hs.filter((h) => h.escaped).length, free = hs.filter((h) => !h.caged && !h.escaped).length;
    let winner = null;
    if (MP.mode === 'coop') { if (free === 0) winner = esc > 0 ? 'humans' : 'ghosts'; }
    else {
      const need = Math.ceil(hs.length / 2);
      if (esc >= need) winner = 'humans';
      else if (free === 0) winner = 'ghosts';
      else if (MP.clock && MP.remain <= 0) winner = 'ghosts';
    }
    if (!winner) return;
    const msg = { t: 'end', winner, stats: MP.stats, mode: MP.mode, time: Math.round(L.time) };
    Net.send(msg);
    showResults(msg);
  }

  // ---------- events everyone hears about ----------
  function onEv(ev) {
    if (!MP || MP.phase !== 'game') return;
    const who = avatar(ev.id);
    switch (ev.e) {
      case 'got': {
        const it = L.items[ev.i];
        if (!it || it.got) break;
        it.got = true;
        it.pending = false;
        if (it.type === 'key') L.keys = Math.min(L.keysTotal, L.keys + 1);
        if (it.type === 'candy') L.candy = Math.min(L.candyTotal, L.candy + 1);
        itemEffects(it, ev.by === MP.myId);
        updateHUD();
        updateButtons(true);
        break;
      }
      case 'caged':
        if (!who) break;
        if (who === P) {
          if (P.hidden) leaveHiding(false);
          Object.assign(P, { caged: true, x: ev.x, y: ev.y, stuck: 0, cagedFx: 1.4 });
          shakeT = 0.5; flashT = 0.5;
          input.joy = null;
          Sound.sfx('boo');
          toast("👻 BOO! You're caged! A teammate can free you by standing next to you.", 4000);
        } else {
          Object.assign(who, { caged: true, hidden: false, spot: null, x: ev.x, y: ev.y, tx: ev.x, ty: ev.y });
          if (P.kind === 'human') toast(`🔒 ${who.name} was caught! Go and free them!`, 2500);
        }
        if (ev.by === MP.myId) { toast(`👻 You caught ${who.name}!`, 1800); Sound.sfx('boo'); }
        poof(ev.x, ev.y);
        updateHUD();
        break;
      case 'freed':
        if (!who) break;
        who.caged = false;
        who.rescue = 0;
        if (who === P) { P.invuln = ev.medic ? 5 : 3; toast("🎉 You're free! Run!", 2000); Sound.sfx('key'); }
        else if (P.kind === 'human') toast(`🎉 ${who.name} is free!`, 1800);
        burst(who.x, who.y, '#7df9ff', 14);
        updateHUD();
        break;
      case 'escaped':
        if (!who) break;
        who.escaped = true;
        who.hidden = false;
        if (who === P) { toast('🚪 You escaped! Cheer on your team…', 3500); Sound.sfx('gate'); }
        else toast(`🚪 ${who.name} escaped!`, 2000);
        updateHUD();
        break;
      case 'empty':
        if (who === P) { P.slowT = 3; Sound.sfx('tired'); toast("🤔 Nobody's in there! You're confused for 3 seconds.", 2200); updateButtons(true); }
        break;
      case 'reveal':
        for (const id of ev.ids) { const h = avatar(id); if (h) h.revealedUntil = T + GHOST_PLAY.banshee.length; }
        L.rings.push({ x: ev.x, y: ev.y, r: GHOST_PLAY.banshee.reveal, kind: 'scream', t: 0 });
        if (P.kind === 'human') {
          Sound.sfx('scream');
          if (ev.ids.includes(MP.myId)) toast('😱 The banshee screamed: the ghosts can see you for 4 seconds!', 2600);
        } else if (ev.by !== MP.myId) Sound.sfx('scream');
        break;
    }
  }
  function onRemoteNoise(m) {
    if (!MP || MP.phase !== 'game' || !L) return;
    if (MP.host) aiHear(m.x, m.y, m.r, m.k, false);
    if (ghostView() && (P.gtype === 'banshee' || dist(P, m) <= 14)) L.rings.push({ x: m.x, y: m.y, r: m.r, kind: 'heard', t: 0 });
  }
  function sendEmote(i) {
    if (!MP || !P || MP.phase !== 'game') return;
    const e = RULES.emotes[i];
    if (!e) return;
    const team = P.kind === 'ghost' ? 'ghosts' : 'humans';
    P.emote = { icon: e.icon, until: T + 3 };
    Net.send({ t: 'emote', i, team });
    $('emotes').classList.add('hidden');
    Sound.sfx('click');
  }
  function onEmote(id, m) {
    const a = remotes.get(id), e = RULES.emotes[m.i];
    if (!a || !e || !P) return;
    if ((P.kind === 'ghost' ? 'ghosts' : 'humans') !== m.team) return;   // only your own team sees your emotes
    a.emote = { icon: e.icon, until: T + 3 };
    toast(`${e.icon} ${a.name}: ${e.text}`, 1800);
    Sound.sfx('alert');
  }

  // ---------- results ----------
  function showResults(m) {
    if (!MP) return;
    MP.phase = 'end';
    state = 'mpend';
    Sound.setMode('off');
    const mySide = P && P.kind === 'ghost' ? 'ghosts' : 'humans';
    Sound.sfx(m.winner === mySide ? 'win' : 'lose');
    $('resTitle').textContent = m.winner === 'humans' ? '🎉 The humans escaped!' : '👻 The ghosts win!';
    $('resText').textContent = `${RULES.modes[m.mode].name} · ⏱ ${fmtTime(m.time || 0)} · ${m.winner === mySide ? 'Your team won!' : 'Better luck next time!'}`;
    const list = $('resPlayers');
    list.innerHTML = '';
    for (const p of MP.players.values()) {
      const s = m.stats[p.id] || {};
      const ghost = m.mode === 'versus' && p.team === 'ghosts';
      const li = document.createElement('li');
      li.textContent = ghost
        ? `👻 ${p.name}: caught ${s.catches || 0}`
        : `🧍 ${p.name}: 🗝️ ${s.keys || 0} · 🍬 ${s.candy || 0} · 🤝 freed ${s.rescues || 0} · 🔒 caught ${s.caught || 0}x${s.escaped ? ' · 🚪 escaped' : ''}`;
      list.appendChild(li);
    }
    $('resLobby').textContent = MP.host ? '↻ Back to the lobby' : '⏳ Waiting for the host…';
    $('resLobby').disabled = !MP.host;
    showScreen('results');
  }
  function backToLobbyLocal() {
    P = null;
    remotes.clear();
    hideMarks.clear();
    loadLevel(MP.map, { demo: true });
    state = 'menu';
    Sound.setMode('calm');
    showScreen('lobby');
  }
  function hostBackToLobby() {
    if (!MP || !MP.host) return;
    MP.phase = 'lobby';
    backToLobbyLocal();
    broadcastLobby();
  }

  // =====================================================================
  //  BUTTONS
  // =====================================================================
  const on = (id, fn) => $(id).addEventListener('click', () => { Sound.init(); Sound.sfx('click'); fn(); });
  on('playBtn', () => { MP = null; if (!save.madeHero) { creatorReturn = 'levels'; openCreator(); } else openLevels(); });
  on('mpBtn', openMultiplayer);
  on('dressBtn', () => { creatorReturn = 'title'; openCreator(); });
  on('howBtn', () => showScreen('how'));
  on('howBack', () => showScreen('title'));
  on('creatorDone', () => {
    save.madeHero = true;
    writeSave();
    if (creatorReturn === 'levels') openLevels();
    else if (creatorReturn === 'mpMenu') openMultiplayer();
    else showScreen('title');
  });
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
  // multiplayer
  on('mpCreate', mpCreate);
  on('mpJoin', mpJoin);
  on('mpBack', () => showScreen('title'));
  on('lobbyStart', hostStart);
  on('lobbyLeave', () => leaveGame());
  on('resLobby', hostBackToLobby);
  on('resLeave', () => leaveGame());
  on('mpResume', () => showScreen(null));
  on('mpQuit', () => leaveGame());
  on('mpRulesBtn', () => {
    const box = $('mpPauseRules');
    box.innerHTML = '';
    for (const r of RULES.modes[MP ? MP.mode : 'coop'].rules) { const li = document.createElement('li'); li.textContent = r; box.appendChild(li); }
    box.classList.toggle('hidden');
  });
  $('mpCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('mpCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') mpJoin(); });

  const press = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.init(); fn(e); });
  press('hideBtn', () => { if (P && P.kind === 'ghost') ghostCheck(); else toggleHide(); });
  press('throwBtn', throwPebble);
  press('sprintBtn', (e) => {
    if (P && P.kind === 'ghost') { useAbility(); return; }
    input.sprintBtn = true;
    $('sprintBtn').classList.add('held');
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
  });
  const sprintUp = () => { input.sprintBtn = false; $('sprintBtn').classList.remove('held'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('sprintBtn').addEventListener(ev, sprintUp);
  press('emoteBtn', () => $('emotes').classList.toggle('hidden'));
  RULES.emotes.forEach((e, i) => {
    const b = document.createElement('button');
    b.className = 'ctl emote';
    b.textContent = e.icon;
    b.title = e.text;
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); sendEmote(i); });
    $('emotes').appendChild(b);
  });
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
      let tx, ty;
      if (P && !L.demo) {
        // escaped? watch a friend who's still in the graveyard
        const watch = P.escaped ? (humans().find((h) => !h.escaped && !h.caged) || humans().find((h) => !h.escaped) || P) : P;
        tx = watch.x; ty = watch.y;
      } else {
        tx = L.w / 2 + Math.sin(T * 0.07) * Math.max(0, L.w / 2 - 6);
        ty = L.h / 2 + Math.cos(T * 0.05) * Math.max(0, L.h / 2 - 5);
      }
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
    if (document.hidden) { if (!MP) pause(); Sound.suspend(); } else Sound.resume();
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
    get state() { return state; }, get level() { return L; }, get player() { return P; }, get mp() { return MP; },
    get miniBig() { return miniBig; }, get miniRect() { return miniRect; }, get screen() { return screen; }, remotes, input,
    startLevel, beginPlay, toggleHide, throwPebble, validateLevel, isSolid, findPath, ghostSees, useAbility, ghostCheck,
    sendEmote, iSee: (h) => iSee(h),
  };
})();
