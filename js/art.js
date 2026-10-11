/*
  Graveyard Escape — all the drawings.
  Everything is drawn with code (no image files). Sizes are in map squares:
  1 = one square of the map.
*/
const Art = (() => {
  'use strict';

  // ---------- character choices ----------
  // New options are always added at the END of a list, so saved characters keep their look.
  const SKINS = ['#ffe0c4', '#f1c48f', '#c68642', '#8d5524', '#fde9db'];
  const HAIRS = ['#6b3e26', '#231c28', '#f2cb5e', '#d2622f', '#ff7ab8', '#9b5cff',
    '#a9824f', '#4a2e1f', '#8f8f94', '#efe0b0', '#b5532a', '#7a5a42'];
  const OUTFITS = ['#8a4dff', '#ff7f1f', '#2fbf71', '#ff5fa2', '#3d8bff', '#e0323a',
    '#1f2a4d', '#f1efe9', '#1c1a22', '#a38f78', '#43464f', '#4f6b2e'];
  const BOTTOMS = ['#2f4778', '#1c1a22', '#55575e', '#1f2a4d', '#a38f78'];   // jeans, black, grey, navy, beige
  const TIES = [null, '#c0623a', '#7a1e2b', '#1f2a4d', '#d8b24a'];          // none, copper, burgundy, navy, gold
  const EYES = ['#3b2a20', '#3f78c8', '#3c8a52', '#6f7f8f'];                // brown, blue, green, grey
  const NECKLACES = [null, '#e8c14d', '#c9ccd4'];                            // none, gold, silver
  const HAIR_STYLES = ['long', 'pigtails', 'short', 'ponytail', 'bun', 'curly', 'bob', 'messy', 'neat', 'receding'];
  const HAIR_LABELS = { long: 'Long', pigtails: 'Pigtails', short: 'Short', ponytail: 'Ponytail', bun: 'Bun', curly: 'Curly', bob: 'Bob', messy: 'Messy', neat: 'Neat', receding: 'Thin on top' };
  const BODIES = [
    { id: 'dress', label: 'Dress' }, { id: 'casual', label: 'Jumper & trousers' },
    { id: 'suit', label: 'Suit' }, { id: 'waistcoat', label: 'Waistcoat' },
  ];
  const PATTERNS = [
    { id: 'none', label: 'Plain' }, { id: 'flowers', label: 'Flowers' }, { id: 'check', label: 'Check' },
    { id: 'lace', label: 'Lace' }, { id: 'knit', label: 'Knitted' },
  ];
  const GLASSES = [
    { id: 'none', label: 'None' }, { id: 'round', label: 'Round' }, { id: 'oval', label: 'Oval' },
    { id: 'square', label: 'Square' }, { id: 'sporty', label: 'Red arms' }, { id: 'chunky', label: 'Chunky' },
    { id: 'shades', label: 'Sunglasses' },
  ];
  const BEARDS = [{ id: 'none', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'goatee', label: 'Goatee' }, { id: 'full', label: 'Big beard' }];
  const HATS = [{ id: 'none', label: 'None' }, { id: 'cap', label: 'Flat cap' }, { id: 'flowers', label: 'Flower crown' }];
  const COSTUMES = [
    { id: 'witch', label: 'Witch', icon: '🧙‍♀️' },
    { id: 'cat', label: 'Cat', icon: '🐱' },
    { id: 'princess', label: 'Princess', icon: '👑' },
    { id: 'vampire', label: 'Vampire', icon: '🧛‍♀️' },
    { id: 'fairy', label: 'Fairy', icon: '🧚‍♀️' },
    { id: 'none', label: 'No costume', icon: '🙂' },
  ];
  const FONT = '"Chalkboard SE", "Comic Sans MS", "Trebuchet MS", sans-serif';
  const TAU = Math.PI * 2;

  // ---------- little helpers ----------
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(hex, amt) {
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    const [r, g, b] = rgb(hex);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function alpha(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(rx, 1e-4), Math.max(ry, 1e-4), rot, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(r, 1e-4), 0, TAU); }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function tri(c, ax, ay, bx, by, cx, cy) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.closePath(); c.fill(); }
  function text(c, str, x, y, size, color, o = {}) {
    c.save();
    c.translate(x, y);
    const k = size / 40;
    c.scale(k, k);
    c.font = `bold 40px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (o.stroke) { c.lineWidth = o.strokeWidth || 6; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(str, 0, 0); }
    c.fillStyle = color;
    c.fillText(str, 0, 0);
    c.restore();
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Emoji are drawn once into a small canvas and reused (much faster).
  const emojiCache = new Map();
  function emoji(c, ch, x, y, size, pxPerUnit) {
    const px = Math.max(8, Math.round(size * pxPerUnit));
    const key = ch + '|' + px;
    let img = emojiCache.get(key);
    if (!img) {
      img = document.createElement('canvas');
      img.width = img.height = px;
      const g = img.getContext('2d');
      g.font = `${Math.round(px * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, px / 2, px * 0.54);
      emojiCache.set(key, img);
    }
    c.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  // =====================================================================
  //  THE HERO (that's you!)
  // =====================================================================
  const choose = (arr, i, d) => (i != null && arr[i] !== undefined ? arr[i] : d);
  function resolveHero(h) {
    const hair = choose(HAIRS, h.hair, HAIRS[0]);
    return {
      skin: choose(SKINS, h.skin, SKINS[0]),
      hair,
      style: choose(HAIR_STYLES, h.hairStyle, 'long'),
      outfit: choose(OUTFITS, h.outfit, OUTFITS[0]),
      costume: choose(COSTUMES, h.costume, COSTUMES[0]).id,
      body: choose(BODIES, h.body, BODIES[0]).id,
      bottom: choose(BOTTOMS, h.bottom, BOTTOMS[0]),
      tie: choose(TIES, h.tie, null),
      pattern: choose(PATTERNS, h.pattern, PATTERNS[0]).id,
      eyes: choose(EYES, h.eyes, EYES[0]),
      glasses: choose(GLASSES, h.glasses, GLASSES[0]).id,
      beard: choose(BEARDS, h.beard, BEARDS[0]).id,
      beardColor: choose(HAIRS, h.beardColor, hair),
      hat: choose(HATS, h.hat, HATS[0]).id,
      necklace: choose(NECKLACES, h.necklace, null),
    };
  }
  function isLight(hex) { const [r, g, b] = rgb(hex); return r * 0.3 + g * 0.59 + b * 0.11 > 170; }

  // x, y = where the feet are. o = { t, walk, moving, flip, back, side, scared, dizzy, sneak, tired, scale }
  function hero(c, x, y, h, o = {}) {
    const k = resolveHero(h);
    const t = o.t || 0;
    const moving = !!o.moving;
    const sw = moving ? Math.sin(o.walk || 0) : 0;
    const bob = moving ? -Math.abs(Math.sin(o.walk || 0)) * 0.045 : Math.sin(t * 2.5) * 0.008;
    const trousers = k.body !== 'dress';
    c.save();
    c.translate(x, y);
    if (o.scale) c.scale(o.scale, o.scale);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, 0, 0.3, 0.24, 0.075); c.fill();
    if (o.flip) c.scale(-1, 1);
    if (o.sneak) { c.translate(0, 0.03); c.scale(1.04, 0.9); }   // crouching while sneaking

    // legs (tights or trousers) and shoes
    c.fillStyle = trousers ? k.bottom : (k.costume === 'vampire' ? '#1b1522' : '#3a2a4a');
    const lw = trousers ? 0.09 : 0.07, top = trousers ? 0.06 : 0.1;
    rrect(c, trousers ? -0.11 : -0.1, top + sw * 0.04, lw, 0.28 - top, 0.03); c.fill();
    rrect(c, trousers ? 0.02 : 0.03, top - sw * 0.04, lw, 0.28 - top, 0.03); c.fill();
    c.fillStyle = '#120d18';
    ell(c, -0.065, 0.285 + sw * 0.04, 0.055, 0.032); c.fill();
    ell(c, 0.065, 0.285 - sw * 0.04, 0.055, 0.032); c.fill();

    c.translate(0, bob);
    if (k.costume === 'fairy') fairyWings(c, t);
    if (k.costume === 'vampire') vampireCape(c, sw);
    if (k.costume === 'cat') catTail(c, t);
    if (!o.back) hairBack(c, k);
    outfit(c, k);

    // arms
    const as = moving ? Math.sin(o.walk || 0) * 0.05 : 0;
    c.fillStyle = k.body === 'waistcoat' ? '#f4f2ee' : k.outfit;
    ell(c, -0.14, -0.08, 0.06, 0.05); c.fill();
    ell(c, 0.14, -0.08, 0.06, 0.05); c.fill();
    c.fillStyle = k.skin;
    circ(c, -0.18, as, 0.045); c.fill();
    circ(c, 0.18, -as, 0.045); c.fill();

    // head
    c.fillStyle = k.skin;
    circ(c, 0, -0.35, 0.22); c.fill();
    const fx = o.side ? 0.05 : 0;
    if (o.back) hairFromBehind(c, k);
    else {
      eyes(c, k, o, fx);
      beard(c, k, fx);
      mouth(c, k, o, fx);
      fringe(c, k);
      glasses(c, k, fx);
    }
    headwear(c, k);
    hat(c, k);
    if (o.dizzy) dizzyStars(c, t);
    if (o.tired) {   // a drop of sweat
      c.fillStyle = '#8fd3ff';
      c.beginPath(); c.moveTo(0.25, -0.56); c.quadraticCurveTo(0.31, -0.46, 0.25, -0.44); c.quadraticCurveTo(0.19, -0.46, 0.25, -0.56); c.fill();
    }
    c.restore();
  }

  // ---------- hair ----------
  const CURLS_BACK = [[-0.3, -0.46, 0.11], [-0.34, -0.31, 0.11], [-0.35, -0.16, 0.11], [-0.31, -0.02, 0.1], [-0.22, 0.06, 0.09],
    [0.3, -0.46, 0.11], [0.34, -0.31, 0.11], [0.35, -0.16, 0.11], [0.31, -0.02, 0.1], [0.22, 0.06, 0.09],
    [-0.17, -0.58, 0.11], [0, -0.62, 0.11], [0.17, -0.58, 0.11]];
  const CURLS_FRONT = [[-0.18, -0.5, 0.075], [-0.07, -0.56, 0.08], [0.06, -0.56, 0.08], [0.18, -0.5, 0.075], [-0.225, -0.39, 0.06], [0.225, -0.39, 0.06]];
  function pigtails(c, k) {
    c.fillStyle = k.hair;
    circ(c, -0.27, -0.27, 0.095); c.fill();
    circ(c, 0.27, -0.27, 0.095); c.fill();
    ell(c, -0.29, -0.15, 0.06, 0.09); c.fill();
    ell(c, 0.29, -0.15, 0.06, 0.09); c.fill();
    c.fillStyle = k.outfit;
    circ(c, -0.22, -0.33, 0.035); c.fill();
    circ(c, 0.22, -0.33, 0.035); c.fill();
  }
  function curls(c, k, list) {
    c.fillStyle = shade(k.hair, -0.25);
    for (const [x, y, r] of list) { circ(c, x + 0.01, y + 0.01, r); c.fill(); }
    c.fillStyle = k.hair;
    for (const [x, y, r] of list) { circ(c, x, y, r * 0.92); c.fill(); }
  }
  function hairBack(c, k) {
    c.fillStyle = k.hair;
    switch (k.style) {
      case 'long': rrect(c, -0.25, -0.5, 0.5, 0.5, 0.16); c.fill(); break;
      case 'pigtails': pigtails(c, k); break;
      case 'ponytail':
        ell(c, 0, -0.38, 0.24, 0.2); c.fill();
        ell(c, 0.25, -0.25, 0.065, 0.15, 0.35); c.fill();
        break;
      case 'curly': curls(c, k, CURLS_BACK); break;
      case 'bob':
        rrect(c, -0.27, -0.52, 0.54, 0.38, 0.15); c.fill();
        for (let i = 0; i < 6; i++) { circ(c, -0.25 + i * 0.1, -0.15, 0.055); c.fill(); }
        break;
      default: ell(c, 0, -0.34, 0.24, 0.19); c.fill();
    }
  }
  function hairFromBehind(c, k) {
    c.fillStyle = k.hair;
    if (k.style === 'curly') { curls(c, k, CURLS_BACK); return; }
    if (k.style === 'receding') { ell(c, 0, -0.33, 0.235, 0.17); c.fill(); return; }
    circ(c, 0, -0.36, 0.235); c.fill();
    if (k.style === 'long') { rrect(c, -0.24, -0.4, 0.48, 0.42, 0.14); c.fill(); }
    if (k.style === 'pigtails') pigtails(c, k);
    if (k.style === 'ponytail') { ell(c, 0, -0.2, 0.07, 0.16); c.fill(); }
    if (k.style === 'bun') { circ(c, 0, -0.58, 0.095); c.fill(); }
    if (k.style === 'bob') { rrect(c, -0.26, -0.45, 0.52, 0.3, 0.14); c.fill(); }
  }
  function fringe(c, k) {
    c.fillStyle = k.hair;
    switch (k.style) {
      case 'receding':
        ell(c, -0.215, -0.37, 0.045, 0.085); c.fill();
        ell(c, 0.215, -0.37, 0.045, 0.085); c.fill();
        c.globalAlpha = 0.35; ell(c, 0, -0.555, 0.13, 0.035); c.fill(); c.globalAlpha = 1;
        break;
      case 'ponytail':
      case 'bun':
        c.beginPath();
        c.ellipse(0, -0.43, 0.24, 0.155, 0, Math.PI, 0);
        c.quadraticCurveTo(0, -0.5, -0.24, -0.43);
        c.fill();
        c.strokeStyle = k.hair; c.lineWidth = 0.012;
        c.beginPath();
        c.moveTo(-0.2, -0.45); c.quadraticCurveTo(-0.26, -0.33, -0.21, -0.22);
        c.moveTo(0.2, -0.45); c.quadraticCurveTo(0.26, -0.33, 0.21, -0.22);
        c.stroke();
        if (k.style === 'bun') { circ(c, 0, -0.6, 0.095); c.fill(); c.strokeStyle = shade(k.hair, -0.25); c.lineWidth = 0.012; c.stroke(); }
        break;
      case 'curly': curls(c, k, CURLS_FRONT); break;
      case 'bob':
        c.beginPath();
        c.ellipse(0, -0.42, 0.25, 0.17, 0, Math.PI, 0);
        c.quadraticCurveTo(0.1, -0.43, -0.06, -0.36);
        c.quadraticCurveTo(-0.18, -0.33, -0.25, -0.42);
        c.fill();
        ell(c, -0.235, -0.3, 0.05, 0.12); c.fill();
        ell(c, 0.235, -0.3, 0.05, 0.12); c.fill();
        break;
      case 'messy':
        c.beginPath();
        c.ellipse(0, -0.43, 0.245, 0.16, 0, Math.PI, 0);
        c.lineTo(0.18, -0.39); c.lineTo(0.1, -0.36); c.lineTo(0.06, -0.4); c.lineTo(-0.02, -0.35);
        c.lineTo(-0.07, -0.41); c.lineTo(-0.15, -0.37); c.lineTo(-0.245, -0.43);
        c.fill();
        tri(c, -0.1, -0.57, -0.04, -0.66, 0.0, -0.57);
        tri(c, 0.02, -0.58, 0.1, -0.65, 0.12, -0.55);
        tri(c, -0.19, -0.53, -0.17, -0.62, -0.09, -0.57);
        break;
      case 'neat':
        c.beginPath();
        c.ellipse(0, -0.43, 0.245, 0.16, 0, Math.PI, 0);
        c.quadraticCurveTo(0.05, -0.46, -0.08, -0.43);
        c.quadraticCurveTo(-0.17, -0.4, -0.245, -0.43);
        c.fill();
        c.strokeStyle = shade(k.hair, -0.3); c.lineWidth = 0.01;
        c.beginPath(); c.moveTo(-0.08, -0.58); c.quadraticCurveTo(-0.09, -0.5, -0.08, -0.44); c.stroke();
        break;
      default:   // long, pigtails, short: bangs
        c.beginPath();
        c.ellipse(0, -0.42, 0.245, 0.17, 0, Math.PI, 0);
        c.quadraticCurveTo(0.17, -0.35, 0.1, -0.4);
        c.quadraticCurveTo(0.03, -0.34, -0.04, -0.4);
        c.quadraticCurveTo(-0.12, -0.34, -0.2, -0.38);
        c.quadraticCurveTo(-0.24, -0.38, -0.245, -0.42);
        c.fill();
    }
  }

  // ---------- face ----------
  function eyes(c, k, o, fx) {
    const scared = !!o.scared;
    const blink = !scared && ((o.t || 0) % 3.2) < 0.12;
    if (k.glasses !== 'shades') {
      for (const ex of [-0.08, 0.08]) {
        if (blink) {
          c.strokeStyle = '#1b1325'; c.lineWidth = 0.02;
          c.beginPath(); c.moveTo(fx + ex - 0.03, -0.33); c.lineTo(fx + ex + 0.03, -0.33); c.stroke();
        } else if (scared) {
          c.fillStyle = '#fff'; ell(c, fx + ex, -0.33, 0.045, 0.055); c.fill();
          c.fillStyle = k.eyes; circ(c, fx + ex + 0.01, -0.33, 0.026); c.fill();
          c.fillStyle = '#120c18'; circ(c, fx + ex + 0.01, -0.33, 0.014); c.fill();
        } else {
          c.fillStyle = k.eyes; ell(c, fx + ex, -0.33, 0.034, 0.048); c.fill();
          c.fillStyle = '#120c18'; ell(c, fx + ex, -0.325, 0.02, 0.03); c.fill();
          c.fillStyle = '#fff'; circ(c, fx + ex + 0.012, -0.345, 0.012); c.fill();
        }
      }
    }
    if (k.beard !== 'full') {
      c.fillStyle = 'rgba(255,110,140,0.35)';
      ell(c, fx - 0.14, -0.27, 0.04, 0.025); c.fill();
      ell(c, fx + 0.14, -0.27, 0.04, 0.025); c.fill();
    }
  }
  function mouth(c, k, o, fx) {
    const scared = !!o.scared;
    if (scared) {
      c.fillStyle = '#5a1a2a'; ell(c, fx, -0.245, 0.028, 0.035); c.fill();
    } else {
      c.strokeStyle = k.beard === 'full' ? '#5a2018' : '#5a1a2a'; c.lineWidth = 0.018; c.lineCap = 'round';
      c.beginPath(); c.arc(fx, -0.275, 0.04, 0.25, Math.PI - 0.25); c.stroke();
    }
    if (k.costume === 'vampire' && !scared) {
      c.fillStyle = '#fff';
      tri(c, fx - 0.03, -0.24, fx - 0.015, -0.21, fx - 0.005, -0.24);
      tri(c, fx + 0.005, -0.24, fx + 0.015, -0.21, fx + 0.03, -0.24);
    }
    if (k.costume === 'cat') {
      c.fillStyle = '#ff8fb1';
      tri(c, fx - 0.022, -0.3, fx + 0.022, -0.3, fx, -0.278);
      c.strokeStyle = 'rgba(40,30,50,0.7)'; c.lineWidth = 0.01;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(fx + s * 0.1, -0.29); c.lineTo(fx + s * 0.22, -0.31);
        c.moveTo(fx + s * 0.1, -0.27); c.lineTo(fx + s * 0.22, -0.26);
        c.stroke();
      }
    }
  }
  function beardPath(c, bottom) {
    c.beginPath();
    c.moveTo(-0.215, -0.36);
    c.quadraticCurveTo(-0.25, bottom - 0.1, 0, bottom);
    c.quadraticCurveTo(0.25, bottom - 0.1, 0.215, -0.36);
    c.quadraticCurveTo(0.17, -0.27, 0.09, -0.29);
    c.quadraticCurveTo(0, -0.3, -0.09, -0.29);
    c.quadraticCurveTo(-0.17, -0.27, -0.215, -0.36);
    c.closePath();
  }
  function moustache(c, col) {
    c.fillStyle = col;
    ell(c, -0.05, -0.282, 0.062, 0.026, 0.25); c.fill();
    ell(c, 0.05, -0.282, 0.062, 0.026, -0.25); c.fill();
  }
  function beard(c, k, fx) {
    if (k.beard === 'none') return;
    const b = k.beardColor;
    c.save();
    c.translate(fx * 0.6, 0);
    if (k.beard === 'full') {
      c.fillStyle = b; beardPath(c, 0.02); c.fill();
      c.strokeStyle = shade(b, -0.28); c.lineWidth = 0.01;
      c.beginPath();
      for (const [x0, y0, x1, y1] of [[-0.16, -0.24, -0.12, -0.08], [0.15, -0.22, 0.1, -0.06], [-0.05, -0.17, -0.04, -0.02]]) { c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 0.03, (y0 + y1) / 2, x1, y1); }
      c.stroke();
      c.strokeStyle = 'rgba(232,226,214,0.6)'; c.lineWidth = 0.012;   // a few grey streaks
      c.beginPath();
      for (const [x0, y0, x1, y1] of [[-0.11, -0.2, -0.07, -0.04], [0.1, -0.19, 0.06, -0.03], [0.02, -0.15, 0.02, -0.0], [-0.18, -0.3, -0.17, -0.18]]) { c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 0.025, (y0 + y1) / 2, x1, y1); }
      c.stroke();
      moustache(c, shade(b, -0.1));
    } else if (k.beard === 'stubble') {
      c.globalAlpha = 0.4;
      c.fillStyle = b; beardPath(c, -0.12); c.fill();
      moustache(c, b);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = b;
      ell(c, 0, -0.19, 0.055, 0.045); c.fill();
      moustache(c, b);
    }
    c.restore();
  }
  function glasses(c, k, fx) {
    const g = k.glasses;
    if (g === 'none') return;
    const y = -0.33;
    c.save();
    c.lineCap = 'round';
    const arms = (col) => {
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(fx - 0.15, y - 0.012); c.lineTo(-0.225, y - 0.02);
      c.moveTo(fx + 0.15, y - 0.012); c.lineTo(0.225, y - 0.02);
      c.stroke();
    };
    const frames = (col, lw, wire) => {
      c.strokeStyle = col; c.lineWidth = lw;
      for (const s of [-1, 1]) {
        const ex = fx + s * 0.08;
        if (g === 'round') circ(c, ex, y, 0.058);
        else if (g === 'oval') ell(c, ex, y, 0.066, 0.046);
        else rrect(c, ex - 0.068, y - 0.045, 0.136, 0.088, 0.022);
        c.stroke();
      }
      c.beginPath(); c.moveTo(fx - 0.018, y - 0.012); c.quadraticCurveTo(fx, y - 0.03, fx + 0.018, y - 0.012); c.stroke();
      if (!wire) { c.fillStyle = 'rgba(200,230,255,0.12)'; for (const s of [-1, 1]) { rrect(c, fx + s * 0.08 - 0.06, y - 0.04, 0.12, 0.078, 0.02); c.fill(); } }
    };
    switch (g) {
      case 'round': case 'oval': frames('#c3c7d1', 0.012, true); arms('#c3c7d1'); break;
      case 'square': frames('#18181d', 0.022); arms('#18181d'); break;
      case 'sporty': frames('#4a4f58', 0.022); c.lineWidth = 0.02; arms('#d63a3a'); break;
      case 'chunky': frames('#2b211c', 0.034); c.lineWidth = 0.026; arms('#2b211c'); break;
      case 'shades':
        c.lineWidth = 0.02;
        for (const s of [-1, 1]) {
          const ex = fx + s * 0.085;
          c.beginPath();
          c.moveTo(ex - s * 0.07, y - 0.035);
          c.quadraticCurveTo(ex + s * 0.02, y - 0.06, ex + s * 0.09, y - 0.07);
          c.quadraticCurveTo(ex + s * 0.08, y + 0.05, ex, y + 0.05);
          c.quadraticCurveTo(ex - s * 0.075, y + 0.04, ex - s * 0.07, y - 0.035);
          c.closePath();
          c.fillStyle = '#2c1630'; c.fill();
          c.strokeStyle = '#0d0b10'; c.stroke();
          c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.012;
          c.beginPath(); c.moveTo(ex - s * 0.04, y - 0.02); c.lineTo(ex - s * 0.015, y - 0.035); c.stroke();
          c.lineWidth = 0.02;
        }
        c.strokeStyle = '#0d0b10';
        c.beginPath(); c.moveTo(fx - 0.02, y - 0.02); c.lineTo(fx + 0.02, y - 0.02); c.stroke();
        arms('#0d0b10');
        break;
    }
    c.restore();
  }

  // ---------- clothes ----------
  function torsoPath(c, k) {
    c.beginPath();
    if (k.body === 'dress') {
      c.moveTo(-0.12, -0.14); c.lineTo(0.12, -0.14);
      c.quadraticCurveTo(0.16, 0, 0.21, 0.15);
      c.quadraticCurveTo(0, 0.21, -0.21, 0.15);
      c.quadraticCurveTo(-0.16, 0, -0.12, -0.14);
    } else {
      c.moveTo(-0.13, -0.145); c.lineTo(0.13, -0.145);
      c.quadraticCurveTo(0.168, -0.02, 0.158, 0.1);
      c.lineTo(-0.158, 0.1);
      c.quadraticCurveTo(-0.168, -0.02, -0.13, -0.145);
    }
    c.closePath();
  }
  function waistcoatPath(c) {
    c.beginPath();
    c.moveTo(-0.13, -0.145); c.lineTo(-0.035, -0.145); c.lineTo(0, -0.02); c.lineTo(0.035, -0.145); c.lineTo(0.13, -0.145);
    c.quadraticCurveTo(0.168, -0.02, 0.158, 0.1);
    c.lineTo(-0.158, 0.1);
    c.quadraticCurveTo(-0.168, -0.02, -0.13, -0.145);
    c.closePath();
  }
  function pattern(c, k, base, path) {
    if (k.pattern === 'none') return;
    c.save();
    path();
    c.clip();
    const light = isLight(base);
    switch (k.pattern) {
      case 'flowers':
        for (const [x, y, col] of [[-0.08, -0.07, '#ffb3d1'], [0.07, -0.09, '#ffffff'], [0.0, -0.02, '#9fd3ff'], [-0.1, 0.04, '#ffe28a'], [0.09, 0.03, '#ffb3d1'], [-0.02, 0.08, '#ffffff'], [0.13, -0.03, '#c8f7a8']]) {
          c.fillStyle = col;
          for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circ(c, x + Math.cos(a) * 0.018, y + Math.sin(a) * 0.018, 0.013); c.fill(); }
          c.fillStyle = '#f4c542'; circ(c, x, y, 0.009); c.fill();
        }
        break;
      case 'check':
        c.lineWidth = 0.007;
        c.strokeStyle = light ? 'rgba(60,40,30,0.3)' : 'rgba(255,255,255,0.2)';
        c.beginPath();
        for (let v = -0.25; v <= 0.25; v += 0.045) { c.moveTo(v, -0.2); c.lineTo(v, 0.22); c.moveTo(-0.25, v); c.lineTo(0.25, v); }
        c.stroke();
        break;
      case 'lace':
        c.lineWidth = 0.008;
        c.strokeStyle = light ? 'rgba(120,120,140,0.4)' : 'rgba(255,255,255,0.3)';
        for (let yy = -0.14; yy < 0.22; yy += 0.05) for (let xx = -0.22 + ((yy * 20) % 2 ? 0.025 : 0); xx < 0.22; xx += 0.05) { circ(c, xx, yy, 0.018); c.stroke(); }
        break;
      case 'knit':
        c.fillStyle = light ? 'rgba(40,40,50,0.35)' : 'rgba(255,255,255,0.4)';
        for (let yy = -0.14, row = 0; yy < 0.2; yy += 0.032, row++) for (let xx = -0.2 + (row % 2) * 0.016; xx < 0.2; xx += 0.032) { circ(c, xx, yy, 0.008); c.fill(); }
        break;
    }
    c.restore();
  }
  function outfit(c, k) {
    const suit = k.body === 'suit', vest = k.body === 'waistcoat';
    c.fillStyle = vest ? '#f4f2ee' : k.outfit;
    torsoPath(c, k); c.fill();
    if (!vest) pattern(c, k, k.outfit, () => torsoPath(c, k));
    if (k.body === 'dress') {
      c.strokeStyle = shade(k.outfit, -0.35); c.lineWidth = 0.025;
      c.beginPath(); c.moveTo(0.205, 0.145); c.quadraticCurveTo(0, 0.205, -0.205, 0.145); c.stroke();
    }
    if (k.body === 'casual') {
      c.fillStyle = shade(k.outfit, -0.25);
      ell(c, 0, -0.142, 0.06, 0.022); c.fill();
      c.fillRect(-0.157, 0.075, 0.314, 0.025);
    }
    if (suit) { c.fillStyle = '#f4f2ee'; tri(c, -0.055, -0.145, 0.055, -0.145, 0, -0.01); }
    if ((suit || vest) && k.tie) {
      c.fillStyle = k.tie;
      rrect(c, -0.018, -0.145, 0.036, 0.026, 0.008); c.fill();
      c.beginPath();
      c.moveTo(-0.014, -0.12); c.lineTo(0.014, -0.12); c.lineTo(0.026, 0.02); c.lineTo(0, 0.05); c.lineTo(-0.026, 0.02);
      c.closePath(); c.fill();
    }
    if (suit) {
      c.fillStyle = shade(k.outfit, -0.18);
      tri(c, -0.055, -0.145, -0.105, -0.1, -0.012, -0.03);
      tri(c, 0.055, -0.145, 0.105, -0.1, 0.012, -0.03);
      c.fillStyle = shade(k.outfit, -0.45); circ(c, 0, 0.045, 0.012); c.fill();
    }
    if (vest) {
      c.fillStyle = k.outfit; waistcoatPath(c); c.fill();
      pattern(c, k, k.outfit, () => waistcoatPath(c));
      c.fillStyle = shade(k.outfit, -0.45);
      for (const yy of [0.0, 0.035, 0.07]) { circ(c, 0, yy, 0.011); c.fill(); }
    }
    switch (k.costume) {
      case 'witch':
        c.fillStyle = '#231a2e'; c.fillRect(-0.14, -0.03, 0.28, 0.045);
        c.fillStyle = '#ffd23f'; c.fillRect(-0.025, -0.035, 0.05, 0.055);
        break;
      case 'princess':
        c.fillStyle = 'rgba(255,255,255,0.9)';
        if (k.body === 'dress') for (let i = -2; i <= 2; i++) { circ(c, i * 0.075, 0.165 - Math.abs(i) * 0.008, 0.022); c.fill(); }
        c.fillStyle = '#7df9ff'; circ(c, 0, -0.08, 0.03); c.fill();
        break;
      case 'vampire':
        if (!suit && !vest) { c.fillStyle = '#b3122a'; tri(c, -0.07, -0.14, 0, 0.0, 0.07, -0.14); }
        break;
      case 'fairy':
        c.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [sx, sy] of [[-0.1, 0.05], [0.08, 0.1], [0.02, -0.05], [-0.05, 0.12], [0.12, 0.0]]) { circ(c, sx, sy, 0.016); c.fill(); }
        break;
      case 'cat':
        if (!suit && !vest) { c.fillStyle = 'rgba(255,255,255,0.75)'; ell(c, 0, 0.04, 0.07, 0.09); c.fill(); }
        break;
    }
    if (k.necklace) {
      c.strokeStyle = k.necklace; c.lineWidth = 0.01;
      c.beginPath(); c.arc(0, -0.2, 0.11, 0.47, Math.PI - 0.47); c.stroke();
      c.fillStyle = k.necklace; circ(c, 0, -0.085, 0.017); c.fill();
    }
  }

  // ---------- costumes ----------
  function fairyWings(c, t) {
    const f = 0.85 + Math.sin(t * 18) * 0.15;
    c.fillStyle = 'rgba(180,240,255,0.55)';
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 0.015;
    for (const s of [-1, 1]) {
      c.save();
      c.scale(s * f, 1);
      ell(c, 0.2, -0.16, 0.17, 0.1, -0.5); c.fill(); c.stroke();
      ell(c, 0.18, 0.0, 0.11, 0.07, 0.5); c.fill(); c.stroke();
      c.restore();
    }
  }
  function vampireCape(c, sw) {
    const flap = sw * 0.02;
    c.fillStyle = '#b3122a';
    c.beginPath(); c.moveTo(-0.13, -0.15); c.lineTo(-0.28 - flap, 0.25); c.lineTo(0.28 + flap, 0.25); c.lineTo(0.13, -0.15); c.fill();
    c.fillStyle = '#1a1020';
    c.beginPath(); c.moveTo(-0.13, -0.15); c.lineTo(-0.26 - flap, 0.23); c.lineTo(0.26 + flap, 0.23); c.lineTo(0.13, -0.15); c.fill();
    for (const s of [-1, 1]) {
      c.fillStyle = '#1a1020'; tri(c, s * 0.1, -0.12, s * 0.28, -0.4, s * 0.03, -0.2);
      c.fillStyle = '#b3122a'; tri(c, s * 0.1, -0.14, s * 0.24, -0.36, s * 0.06, -0.2);
    }
  }
  function catTail(c, t) {
    c.strokeStyle = '#231c2b'; c.lineWidth = 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.1, 0.12);
    c.quadraticCurveTo(0.36, 0.15, 0.3 + Math.sin(t * 4) * 0.05, -0.08);
    c.stroke();
  }
  function headwear(c, k) {
    switch (k.costume) {
      case 'witch':
        c.fillStyle = '#2a1840';
        ell(c, 0, -0.53, 0.31, 0.075); c.fill();
        c.beginPath();
        c.moveTo(-0.16, -0.55);
        c.quadraticCurveTo(-0.05, -0.78, 0.12, -0.97);
        c.quadraticCurveTo(0.06, -0.74, 0.16, -0.55);
        c.closePath(); c.fill();
        c.fillStyle = k.outfit; c.fillRect(-0.155, -0.61, 0.31, 0.05);
        c.fillStyle = '#ffd23f'; c.fillRect(-0.03, -0.615, 0.06, 0.06);
        break;
      case 'cat':
        for (const s of [-1, 1]) {
          c.fillStyle = '#231c2b'; tri(c, s * 0.22, -0.44, s * 0.17, -0.69, s * 0.04, -0.55);
          c.fillStyle = '#ff9ec0'; tri(c, s * 0.19, -0.48, s * 0.165, -0.63, s * 0.08, -0.55);
        }
        break;
      case 'princess':
        c.fillStyle = '#ffd23f';
        c.beginPath();
        c.moveTo(-0.13, -0.53); c.lineTo(-0.13, -0.66); c.lineTo(-0.065, -0.585); c.lineTo(0, -0.69);
        c.lineTo(0.065, -0.585); c.lineTo(0.13, -0.66); c.lineTo(0.13, -0.53);
        c.closePath(); c.fill();
        c.fillStyle = '#ff3d6e'; circ(c, 0, -0.575, 0.025); c.fill();
        c.fillStyle = '#7df9ff'; circ(c, -0.08, -0.56, 0.017); c.fill(); circ(c, 0.08, -0.56, 0.017); c.fill();
        break;
      case 'fairy':
        c.fillStyle = '#ff9ad5';
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circ(c, 0.15 + Math.cos(a) * 0.04, -0.52 + Math.sin(a) * 0.04, 0.032); c.fill(); }
        c.fillStyle = '#ffe14d'; circ(c, 0.15, -0.52, 0.025); c.fill();
        break;
    }
  }
  function hat(c, k) {
    if (k.hat === 'cap') {
      c.fillStyle = '#1f1f25';
      ell(c, 0, -0.475, 0.255, 0.125); c.fill();
      c.fillStyle = '#2c2c34';
      ell(c, 0, -0.405, 0.245, 0.055); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.01;
      c.beginPath(); c.moveTo(-0.2, -0.47); c.quadraticCurveTo(0, -0.56, 0.2, -0.47); c.stroke();
      c.fillStyle = '#2c2c34'; circ(c, 0, -0.595, 0.018); c.fill();
    } else if (k.hat === 'flowers') {
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.068, y = -0.505 + i * i * 0.005;
        c.fillStyle = '#fbfbf7';
        for (let p = 0; p < 5; p++) { const a = p * TAU / 5; circ(c, x + Math.cos(a) * 0.022, y + Math.sin(a) * 0.022, 0.018); c.fill(); }
        c.fillStyle = '#f3e7a3'; circ(c, x, y, 0.012); c.fill();
      }
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.008;
      c.beginPath(); c.moveTo(0, -0.49); c.lineTo(0, -0.44); c.stroke();
      c.fillStyle = '#ffffff'; circ(c, 0, -0.435, 0.012); c.fill();
    }
  }
  function dizzyStars(c, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * TAU / 3;
      text(c, '★', Math.cos(a) * 0.22, -0.72 + Math.sin(a) * 0.06, 0.16, '#ffe14d');
    }
  }

  // =====================================================================
  //  GHOSTS, BATS AND ZOMBIE HANDS
  // =====================================================================
  // o = { color, mood: 'calm' | 'chase' | 'search', look: -1..1, scale }
  function ghost(c, x, y, t, o = {}) {
    const col = o.color || '#eef3ff';
    const mood = o.mood || 'calm';
    c.save();
    c.translate(x, y - 0.12 + Math.sin(t * 3) * 0.05);
    if (o.scale) c.scale(o.scale, o.scale);
    const glow = c.createRadialGradient(0, -0.05, 0.05, 0, -0.05, 0.75);
    glow.addColorStop(0, alpha(col, mood === 'chase' ? 0.45 : 0.28));
    glow.addColorStop(1, alpha(col, 0));
    c.fillStyle = glow;
    circ(c, 0, -0.05, 0.75); c.fill();

    const body = c.createLinearGradient(0, -0.5, 0, 0.36);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(1, alpha(col, 0.8));
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-0.33, 0.24);
    c.lineTo(-0.33, -0.12);
    c.arc(0, -0.12, 0.33, Math.PI, 0);
    c.lineTo(0.33, 0.24);
    for (let i = 0; i < 4; i++) {
      const x0 = 0.33 - i * 0.165, x1 = x0 - 0.165;
      c.quadraticCurveTo((x0 + x1) / 2, 0.38 + Math.sin(t * 7 + i * 1.7) * 0.05, x1, 0.24);
    }
    c.closePath();
    c.fill();
    const wave = Math.sin(t * 5) * 0.05;
    ell(c, -0.36, 0.0 + wave, 0.09, 0.05, -0.5); c.fill();
    ell(c, 0.36, 0.0 - wave, 0.09, 0.05, 0.5); c.fill();

    const lx = (o.look || 0) * 0.05;
    if (mood === 'chase') {
      c.fillStyle = '#ff2b3d';
      ell(c, -0.11 + lx, -0.13, 0.065, 0.075); c.fill();
      ell(c, 0.11 + lx, -0.13, 0.065, 0.075); c.fill();
      c.fillStyle = '#ffe0e3';
      circ(c, -0.11 + lx, -0.13, 0.024); c.fill();
      circ(c, 0.11 + lx, -0.13, 0.024); c.fill();
      c.strokeStyle = '#2a1030'; c.lineWidth = 0.035; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-0.2 + lx, -0.26); c.lineTo(-0.05 + lx, -0.2);
      c.moveTo(0.2 + lx, -0.26); c.lineTo(0.05 + lx, -0.2);
      c.stroke();
      c.fillStyle = '#2a1030'; ell(c, lx, 0.05, 0.07, 0.09); c.fill();
    } else {
      c.fillStyle = '#1d1430';
      ell(c, -0.1 + lx, -0.13, 0.05, 0.075); c.fill();
      ell(c, 0.1 + lx, -0.13, 0.05, 0.075); c.fill();
      c.fillStyle = '#fff';
      circ(c, -0.09 + lx * 1.4, -0.16, 0.016); c.fill();
      circ(c, 0.11 + lx * 1.4, -0.16, 0.016); c.fill();
      c.strokeStyle = '#1d1430'; c.lineWidth = 0.025; c.lineCap = 'round';
      c.beginPath();
      if (mood === 'search') { ell(c, lx, 0.04, 0.03, 0.035); c.stroke(); }
      else {
        c.moveTo(-0.06 + lx, 0.03);
        c.quadraticCurveTo(-0.03 + lx, 0.0, lx, 0.03);
        c.quadraticCurveTo(0.03 + lx, 0.06, 0.06 + lx, 0.03);
        c.stroke();
      }
    }
    c.restore();
  }

  // The Banshee: blind (eyes closed), long hair, screams when she hears you
  function banshee(c, x, y, t, o = {}) {
    const scream = !!o.scream;
    c.save();
    c.translate(x + (scream ? Math.sin(t * 60) * 0.02 : 0), y - 0.15 + Math.sin(t * 2) * 0.04);
    const glow = c.createRadialGradient(0, -0.05, 0.05, 0, -0.05, 0.8);
    glow.addColorStop(0, scream ? 'rgba(220,150,255,0.55)' : 'rgba(200,150,255,0.3)');
    glow.addColorStop(1, 'rgba(200,150,255,0)');
    c.fillStyle = glow; circ(c, 0, -0.05, 0.8); c.fill();
    // hair
    c.fillStyle = '#2a1838';
    c.beginPath();
    c.moveTo(-0.27, -0.25);
    c.quadraticCurveTo(-0.38 + Math.sin(t * 3) * 0.03, 0.1, -0.33, 0.42);
    c.lineTo(0.33, 0.42);
    c.quadraticCurveTo(0.38 + Math.sin(t * 3 + 1) * 0.03, 0.1, 0.27, -0.25);
    c.closePath(); c.fill();
    // gown
    const body = c.createLinearGradient(0, -0.3, 0, 0.45);
    body.addColorStop(0, '#f1e4ff'); body.addColorStop(1, 'rgba(160,120,220,0.75)');
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-0.15, -0.12); c.lineTo(0.15, -0.12); c.lineTo(0.27, 0.38);
    for (let i = 0; i < 4; i++) { const x0 = 0.27 - i * 0.135, x1 = x0 - 0.135; c.quadraticCurveTo((x0 + x1) / 2, 0.5 + Math.sin(t * 6 + i) * 0.04, x1, 0.38); }
    c.closePath(); c.fill();
    // arms raised when screaming
    c.strokeStyle = '#e6d6ff'; c.lineWidth = 0.05; c.lineCap = 'round';
    c.beginPath();
    if (scream) { c.moveTo(-0.13, -0.05); c.lineTo(-0.3, -0.42); c.moveTo(0.13, -0.05); c.lineTo(0.3, -0.42); }
    else { c.moveTo(-0.14, -0.05); c.lineTo(-0.2, 0.18); c.moveTo(0.14, -0.05); c.lineTo(0.2, 0.18); }
    c.stroke();
    // face
    c.fillStyle = '#f3ecff'; ell(c, 0, -0.3, 0.17, 0.2); c.fill();
    c.fillStyle = '#2a1838'; ell(c, 0, -0.47, 0.19, 0.08); c.fill();
    if (scream) {
      c.fillStyle = '#fff'; circ(c, -0.07, -0.33, 0.04); c.fill(); circ(c, 0.07, -0.33, 0.04); c.fill();
      c.fillStyle = '#2a1030'; ell(c, 0, -0.2, 0.06, 0.09); c.fill();
    } else {
      c.strokeStyle = '#4a2a5a'; c.lineWidth = 0.02;
      c.beginPath(); c.arc(-0.07, -0.33, 0.035, 0.2, Math.PI - 0.2); c.moveTo(0.105, -0.32); c.arc(0.07, -0.33, 0.035, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.moveTo(-0.03, -0.22); c.lineTo(0.03, -0.22); c.stroke();
    }
    c.restore();
  }

  // The Phantom: a dark hooded wraith that drifts through walls
  function phantom(c, x, y, t, o = {}) {
    c.save();
    c.translate(x, y - 0.15 + Math.sin(t * 1.7) * 0.05);
    const glow = c.createRadialGradient(0, 0, 0.05, 0, 0, 0.8);
    glow.addColorStop(0, o.hunting ? 'rgba(90,220,255,0.3)' : 'rgba(110,70,170,0.3)');
    glow.addColorStop(1, 'rgba(110,70,170,0)');
    c.fillStyle = glow; circ(c, 0, 0, 0.8); c.fill();
    const a0 = c.globalAlpha;
    c.globalAlpha = a0 * 0.88;
    const body = c.createLinearGradient(0, -0.6, 0, 0.4);
    body.addColorStop(0, '#3d2c5c'); body.addColorStop(1, 'rgba(25,15,40,0.6)');
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-0.34, 0.32);
    c.lineTo(-0.3, -0.1);
    c.quadraticCurveTo(-0.27, -0.5, 0, -0.6);
    c.quadraticCurveTo(0.27, -0.5, 0.3, -0.1);
    c.lineTo(0.34, 0.32);
    for (let i = 0; i < 5; i++) {
      const x0 = 0.34 - i * 0.136;
      c.lineTo(x0 - 0.068, 0.46 + Math.sin(t * 5 + i * 2) * 0.05);
      c.lineTo(x0 - 0.136, 0.32);
    }
    c.closePath(); c.fill();
    c.globalAlpha = a0;
    const lx = (o.look || 0) * 0.04;
    c.fillStyle = '#05030a'; ell(c, lx, -0.2, 0.17, 0.2); c.fill();
    c.fillStyle = o.hunting ? '#7ff6ff' : '#9a8cd0';
    ell(c, -0.065 + lx, -0.22, 0.035, 0.022); c.fill();
    ell(c, 0.065 + lx, -0.22, 0.035, 0.022); c.fill();
    c.restore();
  }

  // The "?" meter above a ghost that is getting suspicious (fills up, then it chases you)
  function meter(c, x, y, v) {
    c.fillStyle = '#fff';
    circ(c, x, y, 0.2); c.fill();
    tri(c, x - 0.06, y + 0.17, x + 0.06, y + 0.17, x, y + 0.29);
    c.fillStyle = v > 0.7 ? '#ff6b3d' : '#ffb347';
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, 0.17, -Math.PI / 2, -Math.PI / 2 + v * TAU); c.closePath(); c.fill();
    text(c, '?', x, y, 0.26, '#3a1a50');
  }

  function bubble(c, x, y, str, color) {
    c.fillStyle = '#fff';
    rrect(c, x - 0.17, y - 0.2, 0.34, 0.36, 0.1); c.fill();
    tri(c, x - 0.06, y + 0.15, x + 0.06, y + 0.15, x, y + 0.27);
    text(c, str, x, y - 0.01, 0.3, color);
  }

  function bat(c, x, y, t) {
    const f = Math.sin(t * 20);
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    ell(c, 0, 0.4, 0.18, 0.05); c.fill();
    c.fillStyle = '#21162b';
    for (const s of [-1, 1]) {
      c.save();
      c.scale(s, 1);
      c.beginPath();
      c.moveTo(0.05, -0.03);
      c.lineTo(0.42, -0.1 - f * 0.16);
      c.quadraticCurveTo(0.36, 0.0, 0.31, 0.07 - f * 0.05);
      c.quadraticCurveTo(0.25, 0.0, 0.19, 0.08 - f * 0.03);
      c.quadraticCurveTo(0.12, 0.02, 0.05, 0.06);
      c.closePath();
      c.fill();
      c.restore();
    }
    ell(c, 0, 0, 0.09, 0.12); c.fill();
    tri(c, -0.07, -0.08, -0.05, -0.19, -0.01, -0.1);
    tri(c, 0.07, -0.08, 0.05, -0.19, 0.01, -0.1);
    c.restore();
  }
  function batEyes(c, x, y) {
    c.fillStyle = 'rgba(255,60,60,0.25)';
    circ(c, x, y - 0.03, 0.1); c.fill();
    c.fillStyle = '#ff4646';
    circ(c, x - 0.035, y - 0.03, 0.022); c.fill();
    circ(c, x + 0.035, y - 0.03, 0.022); c.fill();
  }

  // h = 0 (hidden in the ground) .. 1 (all the way up)
  function hand(c, x, y, h, t) {
    if (h <= 0.01) return;
    c.save();
    c.translate(x, y + 0.12);
    const H = 0.42 * h;
    c.fillStyle = '#86b86a';
    c.strokeStyle = '#3c5e2e';
    c.lineWidth = 0.02;
    rrect(c, -0.06, -H, 0.12, H, 0.04); c.fill(); c.stroke();
    ell(c, 0, -H - 0.04, 0.1, 0.08); c.fill(); c.stroke();
    for (let i = 0; i < 4; i++) {
      const fx = -0.075 + i * 0.05;
      rrect(c, fx - 0.018, -H - 0.17 + Math.abs(i - 1.5) * 0.025 + Math.sin(t * 12 + i) * 0.01, 0.036, 0.12, 0.018);
      c.fill(); c.stroke();
    }
    ell(c, 0.11, -H - 0.02, 0.025, 0.06, 0.6); c.fill(); c.stroke();
    c.fillStyle = '#3d2a1c';
    ell(c, 0, 0, 0.17, 0.06); c.fill();
    c.restore();
  }
  // Dirt jumping about = a hand is coming!
  function dirt(c, x, y, t) {
    c.fillStyle = '#6a4a30';
    for (let i = 0; i < 4; i++) {
      circ(c, x + Math.cos(i * 2.1) * 0.16, y + 0.12 - Math.abs(Math.sin(t * 11 + i * 1.7)) * 0.16, 0.03); c.fill();
    }
  }

  // =====================================================================
  //  HIDING SPOTS, ITEMS AND THE GATE (drawn every frame)
  // =====================================================================
  function peekEyes(c, x, y, t, s = 1) {
    const blink = (t % 2.7) < 0.12;
    const look = Math.sin(t * 1.3) * 0.02;
    for (const ex of [-0.065, 0.065]) {
      c.fillStyle = '#fff';
      ell(c, x + ex * s, y, 0.045 * s, blink ? 0.008 : 0.05 * s); c.fill();
      if (!blink) { c.fillStyle = '#1b1325'; circ(c, x + ex * s + look, y + 0.01, 0.022 * s); c.fill(); }
    }
  }
  function wobble(t, shake) { return shake ? Math.sin(t * 45) * 0.035 * Math.min(1, shake) : 0; }

  function bush(c, x, y, t, occupied, shake) {
    c.save();
    c.translate(x + wobble(t, shake), y);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, 0, 0.32, 0.42, 0.12); c.fill();
    const blobs = [[-0.24, 0.1, 0.24], [0.24, 0.1, 0.24], [0, -0.1, 0.3], [-0.14, 0.2, 0.22], [0.15, 0.2, 0.22]];
    c.fillStyle = '#173d24';
    for (const [bx, by, br] of blobs) { circ(c, bx, by, br); c.fill(); }
    c.fillStyle = '#245a34';
    for (const [bx, by, br] of blobs) { circ(c, bx - br * 0.2, by - br * 0.25, br * 0.7); c.fill(); }
    c.fillStyle = '#2f7243';
    for (const [bx, by, br] of blobs) { circ(c, bx - br * 0.35, by - br * 0.4, br * 0.35); c.fill(); }
    c.fillStyle = '#d6324a';
    for (const [bx, by] of [[-0.2, -0.05], [0.15, -0.2], [0.27, 0.12], [-0.05, 0.22]]) { circ(c, bx, by, 0.03); c.fill(); }
    if (occupied) {
      c.fillStyle = 'rgba(5,15,8,0.85)';
      ell(c, 0, 0.03, 0.17, 0.09); c.fill();
      peekEyes(c, 0, 0.03, t);
    }
    c.restore();
  }

  function coffinShape(c) {
    c.beginPath();
    c.moveTo(-0.13, -0.44); c.lineTo(0.13, -0.44); c.lineTo(0.24, -0.22);
    c.lineTo(0.16, 0.42); c.lineTo(-0.16, 0.42); c.lineTo(-0.24, -0.22);
    c.closePath();
  }
  function coffin(c, x, y, t, occupied, shake) {
    c.save();
    c.translate(x + wobble(t, shake), y);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, 0.04, 0.4, 0.3, 0.08); c.fill();
    coffinShape(c);
    c.fillStyle = '#140b10'; c.fill();
    if (occupied) peekEyes(c, 0, -0.3, t, 0.8);
    c.save();
    c.translate(0, occupied ? 0.16 : 0);
    c.scale(0.94, occupied ? 0.78 : 0.96);
    coffinShape(c);
    c.fillStyle = '#6b4226'; c.fill();
    c.strokeStyle = '#2a180c'; c.lineWidth = 0.025; c.stroke();
    c.fillStyle = '#c9a55a';
    c.fillRect(-0.025, -0.28, 0.05, 0.32);
    c.fillRect(-0.09, -0.19, 0.18, 0.05);
    c.restore();
    c.restore();
  }

  function crypt(c, x, y, t, occupied, shake) {
    c.save();
    c.translate(x + wobble(t, shake), y);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, 0, 0.42, 0.5, 0.1); c.fill();
    c.fillStyle = '#5d5870'; c.fillRect(-0.42, -0.22, 0.84, 0.64);
    c.fillStyle = '#4a4659'; c.fillRect(-0.44, 0.32, 0.88, 0.1);
    c.fillStyle = '#7a7590'; c.fillRect(-0.4, -0.2, 0.08, 0.52); c.fillRect(0.32, -0.2, 0.08, 0.52);
    c.fillStyle = '#3d394b';
    c.beginPath(); c.moveTo(-0.5, -0.2); c.lineTo(0, -0.55); c.lineTo(0.5, -0.2); c.closePath(); c.fill();
    c.fillStyle = '#6d6880'; c.fillRect(-0.5, -0.24, 1.0, 0.05);
    c.fillStyle = '#8d88a3'; c.fillRect(-0.02, -0.72, 0.04, 0.18); c.fillRect(-0.07, -0.67, 0.14, 0.04);
    c.fillStyle = '#0c0910';
    c.beginPath(); c.moveTo(-0.15, 0.32); c.lineTo(-0.15, -0.01); c.arc(0, -0.01, 0.15, Math.PI, 0); c.lineTo(0.15, 0.32); c.closePath(); c.fill();
    text(c, 'RIP', 0, -0.34, 0.11, '#b9b4cc');
    if (occupied) peekEyes(c, 0, 0.08, t, 0.9);
    c.restore();
  }

  function gate(c, x, y, open, t) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#2a2219'; c.fillRect(-0.5, -0.5, 1, 1);
    if (open) {
      const p = 0.5 + Math.sin(t * 4) * 0.5;
      const g = c.createRadialGradient(0, 0, 0.05, 0, 0, 0.7);
      g.addColorStop(0, `rgba(120,255,140,${0.45 + p * 0.3})`);
      g.addColorStop(1, 'rgba(120,255,140,0)');
      c.fillStyle = g; c.fillRect(-0.7, -0.7, 1.4, 1.4);
      c.strokeStyle = '#1a1a22'; c.lineWidth = 0.05;
      c.beginPath();
      for (const bx of [-0.46, -0.38, 0.38, 0.46]) { c.moveTo(bx, -0.5); c.lineTo(bx, 0.5); }
      c.stroke();
      text(c, 'EXIT', 0, 0, 0.26 + p * 0.03, '#d4ffcf', { stroke: '#0b3d12', strokeWidth: 9 });
    } else {
      c.strokeStyle = '#4a4958'; c.lineWidth = 0.06; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 5; i++) { const bx = -0.4 + i * 0.2; c.moveTo(bx, -0.48); c.lineTo(bx, 0.48); }
      c.moveTo(-0.48, -0.25); c.lineTo(0.48, -0.25);
      c.moveTo(-0.48, 0.25); c.lineTo(0.48, 0.25);
      c.stroke();
      c.strokeStyle = '#e8b931'; c.lineWidth = 0.04;
      c.beginPath(); c.arc(0, -0.04, 0.08, Math.PI, 0); c.stroke();
      c.fillStyle = '#e8b931'; rrect(c, -0.12, -0.04, 0.24, 0.2, 0.04); c.fill();
      c.fillStyle = '#5a4310'; circ(c, 0, 0.04, 0.025); c.fill(); c.fillRect(-0.01, 0.04, 0.02, 0.06);
    }
    c.restore();
  }

  function sparkle(c, x, y, s, a) {
    c.save();
    c.translate(x, y);
    c.globalAlpha = Math.max(0, Math.min(1, a));
    c.fillStyle = '#fff6c0';
    c.beginPath();
    c.moveTo(0, -s);
    c.quadraticCurveTo(0, 0, s, 0);
    c.quadraticCurveTo(0, 0, 0, s);
    c.quadraticCurveTo(0, 0, -s, 0);
    c.quadraticCurveTo(0, 0, 0, -s);
    c.fill();
    c.restore();
  }

  // =====================================================================
  //  THE MAP (painted once when a level starts)
  // =====================================================================
  const GRASS = ['#1b2a20', '#1c2c21', '#1a281e', '#1d2d22'];

  function ground(c, x, y, r) {
    c.fillStyle = GRASS[(r() * GRASS.length) | 0];
    c.fillRect(x, y, 1.02, 1.02);
    c.strokeStyle = 'rgba(90,140,90,0.28)'; c.lineWidth = 0.022; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const gx = x + r(), gy = y + r();
      c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + (r() - 0.5) * 0.08, gy - 0.07 - r() * 0.07); c.stroke();
    }
    const d = r();
    if (d < 0.035) mushroom(c, x + 0.2 + r() * 0.6, y + 0.3 + r() * 0.5);
    else if (d < 0.06) bone(c, x + 0.2 + r() * 0.6, y + 0.2 + r() * 0.6, r() * Math.PI);
    else if (d < 0.11) {
      for (let i = 0; i < 3; i++) {
        c.fillStyle = r() < 0.5 ? 'rgba(190,150,255,0.7)' : 'rgba(240,240,255,0.6)';
        circ(c, x + 0.15 + r() * 0.7, y + 0.15 + r() * 0.7, 0.025); c.fill();
      }
    }
  }
  function mushroom(c, x, y) {
    c.fillStyle = '#e8e0d0'; c.fillRect(x - 0.02, y - 0.06, 0.04, 0.07);
    c.fillStyle = '#c0283a'; ell(c, x, y - 0.06, 0.07, 0.045); c.fill();
    c.fillStyle = '#fff'; circ(c, x - 0.025, y - 0.075, 0.012); c.fill(); circ(c, x + 0.03, y - 0.065, 0.01); c.fill();
  }
  function bone(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = '#d8d2c0';
    c.fillRect(-0.08, -0.014, 0.16, 0.028);
    for (const s of [-1, 1]) { circ(c, s * 0.08, -0.02, 0.022); c.fill(); circ(c, s * 0.08, 0.02, 0.022); c.fill(); }
    c.restore();
  }
  // The dirt path is drawn as a wide road joining neighbouring path squares
  function paths(c, w, h, isPath, r) {
    c.lineCap = 'round';
    for (const [col, width] of [['#2b2219', 0.95], ['#43362a', 0.78]]) {
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = width;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!isPath(x, y)) continue;
          circ(c, x + 0.5, y + 0.5, width / 2); c.fill();
          c.beginPath();
          for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
            if (isPath(x + dx, y + dy)) { c.moveTo(x + 0.5, y + 0.5); c.lineTo(x + dx + 0.5, y + dy + 0.5); }
          }
          c.stroke();
        }
      }
    }
    c.fillStyle = 'rgba(120,100,78,0.6)';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isPath(x, y)) continue;
        for (let i = 0; i < 3; i++) { ell(c, x + 0.25 + r() * 0.5, y + 0.25 + r() * 0.5, 0.03 + r() * 0.03, 0.02 + r() * 0.02); c.fill(); }
      }
    }
  }
  function wall(c, x, y, r, wallBelow) {
    c.fillStyle = '#2a2638'; c.fillRect(x, y, 1.02, 1.02);
    c.fillStyle = '#48435c'; c.fillRect(x, y, 1.02, wallBelow ? 1.02 : 0.7);
    c.strokeStyle = 'rgba(25,22,35,0.6)'; c.lineWidth = 0.03;
    for (let i = 0; i < 3; i++) {
      const yy = y + i / 3;
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 1, yy);
      const off = (i % 2) * 0.25;
      for (let j = 0; j < 2; j++) { const xx = x + off + j * 0.5 + 0.12; c.moveTo(xx, yy); c.lineTo(xx, yy + 1 / 3); }
      c.stroke();
    }
    if (r() < 0.5) { c.fillStyle = 'rgba(80,140,70,0.45)'; ell(c, x + r(), y + r() * 0.6, 0.12, 0.05); c.fill(); }
    if (!wallBelow) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, y + 0.7, 1.02, 0.32); }
  }
  function tree(c, x, y, r) {
    const cx = x + 0.5, by = y + 0.92;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, cx, by, 0.32, 0.09); c.fill();
    c.strokeStyle = '#5a4332'; c.lineCap = 'round';
    const branch = (px, py, ang, len, w, d) => {
      const nx = px + Math.cos(ang) * len, ny = py + Math.sin(ang) * len;
      c.lineWidth = w;
      c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
      if (d > 0) {
        branch(nx, ny, ang - 0.35 - r() * 0.4, len * 0.72, w * 0.62, d - 1);
        branch(nx, ny, ang + 0.35 + r() * 0.4, len * 0.72, w * 0.62, d - 1);
      }
    };
    branch(cx, by, -Math.PI / 2 + (r() - 0.5) * 0.2, 0.36, 0.13, 3);
    c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(cx, by - 0.02); c.lineTo(cx - 0.17, by + 0.04); c.moveTo(cx, by - 0.02); c.lineTo(cx + 0.16, by + 0.05); c.stroke();
    if (r() < 0.3) {
      c.fillStyle = '#ffd84a';
      circ(c, cx - 0.04, y + 0.38, 0.022); c.fill();
      circ(c, cx + 0.04, y + 0.38, 0.022); c.fill();
    }
  }
  function tomb(c, x, y, r) {
    const cx = x + 0.5;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ell(c, cx + 0.04, y + 0.86, 0.34, 0.09); c.fill();
    c.save();
    c.translate(cx, y + 0.86);
    c.rotate((r() - 0.5) * 0.14);
    const w = 0.27 + r() * 0.06, h = 0.6 + r() * 0.08;
    const slab = (dx) => {
      c.beginPath(); c.moveTo(-w + dx, 0); c.lineTo(-w + dx, -h + w); c.arc(dx, -h + w, w, Math.PI, 0); c.lineTo(w + dx, 0); c.closePath();
    };
    c.fillStyle = '#4f5363'; slab(0.05); c.fill();
    c.fillStyle = '#868b9c'; slab(0); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 0.02; c.stroke();
    text(c, 'RIP', 0, -h + w + 0.02, 0.15, '#4a4d5a');
    if (r() < 0.5) {   // a crack running down from the top edge
      c.strokeStyle = '#5b5f6e'; c.lineWidth = 0.018;
      c.beginPath(); c.moveTo(w * 0.55, -h + w * 0.25); c.lineTo(w * 0.35, -h + w * 0.55); c.lineTo(w * 0.5, -h + w * 0.8); c.stroke();
    }
    c.fillStyle = 'rgba(80,140,70,0.6)';
    ell(c, -w * 0.6, -0.03, 0.08, 0.035); c.fill();
    c.restore();
  }
  function stoneCross(c, x, y) {
    const cx = x + 0.5;
    c.fillStyle = 'rgba(0,0,0,0.35)'; ell(c, cx + 0.04, y + 0.87, 0.3, 0.08); c.fill();
    c.fillStyle = '#5d6172'; c.fillRect(cx - 0.05, y + 0.2, 0.14, 0.68); c.fillRect(cx - 0.22, y + 0.35, 0.48, 0.13);
    c.fillStyle = '#868b9c'; c.fillRect(cx - 0.07, y + 0.18, 0.14, 0.68); c.fillRect(cx - 0.24, y + 0.33, 0.48, 0.13);
    c.fillStyle = '#5d6172'; c.fillRect(cx - 0.15, y + 0.8, 0.3, 0.09);
  }
  function pumpkin(c, cx, cy, s = 1) {
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);
    const g = c.createRadialGradient(0, 0.05, 0.05, 0, 0.05, 0.75);
    g.addColorStop(0, 'rgba(255,150,40,0.35)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    c.fillStyle = g; circ(c, 0, 0.05, 0.75); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)'; ell(c, 0, 0.3, 0.33, 0.07); c.fill();
    c.fillStyle = '#c95a10'; ell(c, -0.17, 0.05, 0.17, 0.25); c.fill(); ell(c, 0.17, 0.05, 0.17, 0.25); c.fill();
    c.fillStyle = '#f07a1a'; ell(c, -0.08, 0.05, 0.16, 0.27); c.fill(); ell(c, 0.08, 0.05, 0.16, 0.27); c.fill();
    c.fillStyle = '#ff9233'; ell(c, 0, 0.05, 0.12, 0.28); c.fill();
    c.fillStyle = '#4c6b2a'; rrect(c, -0.03, -0.3, 0.06, 0.1, 0.02); c.fill();
    c.fillStyle = '#ffe066';
    tri(c, -0.16, 0.0, -0.05, 0.0, -0.1, -0.1);
    tri(c, 0.05, 0.0, 0.16, 0.0, 0.1, -0.1);
    c.beginPath();
    c.moveTo(-0.18, 0.09); c.lineTo(-0.12, 0.13); c.lineTo(-0.06, 0.09); c.lineTo(0, 0.13);
    c.lineTo(0.06, 0.09); c.lineTo(0.12, 0.13); c.lineTo(0.18, 0.09);
    c.quadraticCurveTo(0, 0.3, -0.18, 0.09);
    c.fill();
    c.restore();
  }
  function web(c, x, y) {
    const cx = x + 0.5, cy = y + 0.5;
    c.strokeStyle = 'rgba(230,230,245,0.6)'; c.lineWidth = 0.018;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5); }
    for (const rad of [0.14, 0.28, 0.42]) {
      for (let i = 0; i <= 8; i++) {
        const a = i * TAU / 8 + 0.2;
        const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
    }
    c.stroke();
    c.fillStyle = '#120a14'; circ(c, cx + 0.14, cy - 0.1, 0.045); c.fill();
    c.strokeStyle = '#120a14'; c.lineWidth = 0.012;
    c.beginPath();
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.moveTo(cx + 0.14, cy - 0.1); c.lineTo(cx + 0.14 + s * 0.08, cy - 0.14 + i * 0.04); }
    c.stroke();
  }
  function mound(c, x, y) {
    const cx = x + 0.5, cy = y + 0.6;
    c.fillStyle = '#3a281b'; ell(c, cx, cy, 0.34, 0.2); c.fill();
    c.fillStyle = '#4a3424'; ell(c, cx - 0.05, cy - 0.04, 0.24, 0.12); c.fill();
    c.strokeStyle = '#1e140c'; c.lineWidth = 0.02;
    c.beginPath();
    c.moveTo(cx - 0.15, cy - 0.02); c.lineTo(cx, cy + 0.03); c.lineTo(cx + 0.12, cy - 0.05);
    c.moveTo(cx, cy + 0.03); c.lineTo(cx + 0.02, cy + 0.12);
    c.stroke();
  }

  function paintMap(c, grid, r) {
    const h = grid.length, w = grid[0].length;
    const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '#' : grid[y][x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ground(c, x, y, r);
    // soft light and dark patches so the grass doesn't look like a chessboard
    for (let i = 0; i < w * h / 6; i++) {
      const x = r() * w, y = r() * h, rad = 0.6 + r() * 1.6;
      const col = r() < 0.55 ? '0,0,0' : '70,100,70';
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${col},0.2)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    paths(c, w, h, (x, y) => at(x, y) === '_' || at(x, y) === 'E', r);
    // top row first, so things lower down overlap things above them
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        switch (at(x, y)) {
          case '#': wall(c, x, y, r, at(x, y + 1) === '#'); break;
          case 'T': tree(c, x, y, r); break;
          case 't': tomb(c, x, y, r); break;
          case '+': stoneCross(c, x, y); break;
          case 'P': pumpkin(c, x + 0.5, y + 0.55); break;
          case 'w': web(c, x, y); break;
          case 'h': mound(c, x, y); break;
        }
      }
    }
  }


  // =====================================================================
  //  MULTIPLAYER BITS
  // =====================================================================
  // A glowing ghost cage around a caught player; progress = how far a friend is with freeing them (0..1)
  function cage(c, x, y, t, progress) {
    c.save();
    c.translate(x, y);
    const g = c.createRadialGradient(0, -0.2, 0.05, 0, -0.2, 0.7);
    g.addColorStop(0, 'rgba(150,120,255,0.35)'); g.addColorStop(1, 'rgba(150,120,255,0)');
    c.fillStyle = g; circ(c, 0, -0.2, 0.7); c.fill();
    c.strokeStyle = 'rgba(190,170,255,0.9)'; c.lineWidth = 0.035; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 6; i++) { const bx = -0.3 + i * 0.12; c.moveTo(bx, 0.3); c.lineTo(bx, -0.55 + Math.abs(bx) * 0.25); }
    c.stroke();
    c.beginPath(); c.ellipse(0, -0.52, 0.32, 0.1, 0, 0, TAU); c.stroke();
    c.beginPath(); c.ellipse(0, 0.3, 0.32, 0.08, 0, 0, TAU); c.stroke();
    text(c, '🔒', 0, -0.7, 0.24, '#fff');
    if (progress > 0) {
      c.strokeStyle = '#7dff9e'; c.lineWidth = 0.07;
      c.beginPath(); c.arc(0, -0.15, 0.55, -Math.PI / 2, -Math.PI / 2 + progress * TAU); c.stroke();
    }
    c.restore();
  }
  function nameTag(c, str, x, y, color) {
    c.save();
    c.translate(x, y);
    c.font = `bold 40px ${FONT}`;
    const w = Math.min(4, c.measureText(str).width / 40 * 0.22 + 0.16);
    c.fillStyle = 'rgba(15,6,28,0.7)';
    rrect(c, -w / 2, -0.13, w, 0.26, 0.1); c.fill();
    c.restore();
    text(c, str, x, y, 0.2, color || '#fff');
  }
  // What a phantom player senses: a smudge of smoke where a human is
  function smoke(c, x, y, t) {
    for (let i = 0; i < 3; i++) {
      const r = 0.25 + ((t * 0.8 + i / 3) % 1) * 0.5;
      c.strokeStyle = `rgba(150,240,255,${0.6 * (1 - ((t * 0.8 + i / 3) % 1))})`;
      c.lineWidth = 0.05;
      circ(c, x, y, r); c.stroke();
    }
    c.fillStyle = 'rgba(150,240,255,0.5)'; circ(c, x, y, 0.1); c.fill();
  }
  function emoteBubble(c, x, y, icon, pxPerUnit) {
    c.fillStyle = 'rgba(255,255,255,0.95)';
    rrect(c, x - 0.24, y - 0.24, 0.48, 0.44, 0.14); c.fill();
    tri(c, x - 0.07, y + 0.19, x + 0.07, y + 0.19, x, y + 0.32);
    emoji(c, icon, x, y - 0.02, 0.34, pxPerUnit);
  }

  return {
    SKINS, HAIRS, OUTFITS, BOTTOMS, TIES, EYES, NECKLACES, HAIR_STYLES, HAIR_LABELS, BODIES, PATTERNS, GLASSES, BEARDS, HATS, COSTUMES, FONT,
    circle: circ, roundRect: rrect, text, emoji, rng, shade,
    hero, ghost, banshee, phantom, meter, bubble, bat, batEyes, hand, dirt,
    bush, coffin, crypt, gate, sparkle, pumpkin, tomb,
    paintMap, cage, nameTag, smoke, emoteBubble,
  };
})();
