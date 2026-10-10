/*
  Graveyard Escape — music and sound effects.
  All sounds are made by the browser (Web Audio), so there are no sound files.
  Browsers only allow sound after the first tap, so Sound.init() runs on taps.
*/
const Sound = (() => {
  'use strict';
  let ac = null, master = null, musicBus = null, fxBus = null, noiseBuf = null;
  let enabled = true;
  let mode = 'off';            // 'off' | 'calm' | 'chase'
  let step = 0, nextT = 0;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) {
      if (ac.state !== 'running' && !document.hidden) ac.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // iPhone: play sound even when the silent switch is on (there's a mute button in the game)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
    ac = new AC();
    master = ac.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    fxBus = ac.createGain(); fxBus.gain.value = 1; fxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 50);
  }

  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, o = {}) {
    if (!ac) return;
    const t = o.at != null ? o.at : ac.currentTime + (o.when || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * o.slide, t + dur);
    env(g, t, o.vol != null ? o.vol : 0.2, o.attack || 0.01, dur);
    osc.connect(g); g.connect(o.dest || fxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ac) return;
    const t = o.at != null ? o.at : ac.currentTime + (o.when || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime((o.freq || 1000) * o.slide, t + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    env(g, t, o.vol != null ? o.vol : 0.2, o.attack || 0.01, dur);
    src.connect(f); f.connect(g); g.connect(o.dest || fxBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const SFX = {
    click() { tone(660, 0.06, { type: 'triangle', vol: 0.08 }); },
    key() { [660, 880, 1320, 1760].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.22, when: i * 0.07 })); },
    candy() { tone(990, 0.08, { type: 'square', vol: 0.06 }); tone(1480, 0.12, { type: 'square', vol: 0.05, when: 0.06 }); },
    speed() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.06, when: i * 0.05 })); },
    spotted() { tone(300, 0.45, { type: 'sawtooth', vol: 0.12, slide: 0.45 }); tone(450, 0.2, { type: 'square', vol: 0.06 }); },
    boo() {
      noise(0.7, { vol: 0.35, freq: 900, slide: 0.25 });
      tone(200, 0.8, { type: 'sawtooth', vol: 0.18, slide: 0.35 });
      tone(150, 0.8, { type: 'sine', vol: 0.3, slide: 0.4 });
    },
    hide() { noise(0.3, { vol: 0.22, freq: 2500, filter: 'bandpass', q: 0.8 }); },
    bat() { tone(2400, 0.06, { type: 'square', vol: 0.05 }); tone(2000, 0.08, { type: 'square', vol: 0.05, when: 0.08 }); tone(2600, 0.06, { type: 'square', vol: 0.04, when: 0.16 }); },
    grab() { tone(110, 0.35, { type: 'sine', vol: 0.4, slide: 0.5 }); noise(0.2, { vol: 0.2, freq: 500 }); },
    gate() {
      tone(110, 1.1, { type: 'sawtooth', vol: 0.07, slide: 1.8 });   // creeeak
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.15, when: 0.5 + i * 0.09 }));
    },
    alert() { tone(520, 0.12, { type: 'sine', vol: 0.1 }); tone(700, 0.2, { type: 'sine', vol: 0.1, when: 0.1 }); },
    scream() {
      tone(880, 1.2, { type: 'sawtooth', vol: 0.08, slide: 1.7 });
      tone(1240, 1.1, { type: 'triangle', vol: 0.08, slide: 1.4, when: 0.05 });
      noise(1.1, { vol: 0.16, freq: 3000, filter: 'bandpass', q: 2 });
    },
    throw() { noise(0.2, { vol: 0.15, freq: 1500, filter: 'bandpass', slide: 2.5 }); },
    clack() {
      tone(1600, 0.05, { type: 'square', vol: 0.07 });
      noise(0.08, { vol: 0.25, freq: 3500, filter: 'highpass' });
      tone(1150, 0.05, { type: 'square', vol: 0.05, when: 0.08 });
    },
    tired() { noise(0.35, { vol: 0.12, freq: 900, filter: 'bandpass' }); noise(0.35, { vol: 0.12, freq: 700, filter: 'bandpass', when: 0.45 }); },
    win() {
      [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.07, when: i * 0.13 }));
      tone(1047, 0.9, { type: 'triangle', vol: 0.18, when: 0.8 });
      tone(784, 0.9, { type: 'triangle', vol: 0.14, when: 0.8 });
    },
    lose() { [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.35, { type: 'sawtooth', vol: 0.08, when: i * 0.32, slide: i === 3 ? 0.8 : 1 })); },
  };

  // ---------- spooky music ----------
  // Am - F - Dm - E, slow and twinkly when calm, fast with a heartbeat when chased.
  const CHORDS = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
  const CALM_PATTERN = [0, 1, 2, 1, 2, 1, 0, 1];
  function schedule() {
    if (!ac || mode === 'off' || ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.25) {
      playStep(step, nextT);
      nextT += mode === 'chase' ? 0.16 : 0.34;
      step++;
    }
  }
  function playStep(s, t) {
    const chord = CHORDS[Math.floor(s / 8) % 4];
    const i = s % 8;
    if (mode === 'calm') {
      if (i === 0) tone(mtof(chord[0] - 12), 2.6, { type: 'triangle', vol: 0.12, at: t, attack: 0.08, dest: musicBus });
      if (i % 2 === 0 || Math.random() < 0.55) tone(mtof(chord[CALM_PATTERN[i]] + 12), 0.6, { type: 'sine', vol: 0.06, at: t, dest: musicBus });
      if (i === 5 && Math.random() < 0.35) tone(mtof(chord[2] + 24), 0.9, { type: 'sine', vol: 0.025, at: t + 0.17, dest: musicBus });
    } else {
      tone(mtof(chord[0] - 12 + (i % 2 ? 12 : 0)), 0.15, { type: 'triangle', vol: 0.13, at: t, dest: musicBus });
      if (i % 2 === 0) tone(mtof(chord[(i / 2) % 3] + 12), 0.13, { type: 'sawtooth', vol: 0.022, at: t, dest: musicBus });
      if (i % 4 === 0) {
        tone(60, 0.14, { type: 'sine', vol: 0.4, at: t, dest: musicBus });
        tone(52, 0.16, { type: 'sine', vol: 0.3, at: t + 0.14, dest: musicBus });
      }
    }
  }

  return {
    init,
    sfx(name) { if (ac && enabled && SFX[name]) SFX[name](); },
    setMode(m) { if (m !== mode) { mode = m; step = 0; } },
    setEnabled(on) {
      enabled = on;
      if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ac.currentTime, 0.05);
    },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state !== 'running') ac.resume(); },
  };
})();
