/* 사운드 — WebAudio 합성 (효과음 + 시퀀서 BGM) */
(function () {
  const G = window.G;
  const A = (G.audio = { ctx: null, musicOn: true, sfxOn: true, mood: 'day' });
  let master, musicBus, sfxBus, delay, noiseBuf;


  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicOn ? 0.5 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxOn ? 0.55 : 0; sfxBus.connect(master);
    // 부드러운 잔향 느낌의 피드백 딜레이
    delay = ctx.createDelay(1); delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.36;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  };

  A.setMusic = (on) => { A.musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, A.ctx.currentTime, 0.2); };
  A.setSfx = (on) => { A.sfxOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, A.ctx.currentTime, 0.05); };

  function tone(bus, type, f0, f1, t0, dur, vol, attack) {
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
    return g;
  }
  function noise(bus, t0, dur, vol, freq, q, type, f1) {
    const ctx = A.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; s.loop = true; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t0); s.stop(t0 + dur + 0.05);
  }

  let lastPlay = {};
  A.sfx = function (name, p) {
    if (!A.ctx || !A.sfxOn) return;
    const now = A.ctx.currentTime;
    const gap = { hit: 0.04, shoot: 0.05, pickup: 0.03, chop: 0.08, kill: 0.04 }[name] || 0;
    if (gap && lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    const t = now, b = sfxBus;
    switch (name) {
      case 'shoot': tone(b, 'triangle', 620, 240, t, 0.09, 0.12); break;
      case 'hit': noise(b, t, 0.06, 0.18, 900, 1.2); tone(b, 'sine', 180, 90, t, 0.07, 0.12); break;
      case 'kill': tone(b, 'sine', 320, 640, t, 0.09, 0.1); noise(b, t, 0.08, 0.1, 2400, 0.8); break;
      case 'pickup': { const f = 700 + Math.min(12, p || 0) * 55; tone(b, 'sine', f, f * 1.5, t, 0.1, 0.1); break; }
      case 'xp': tone(b, 'sine', 980, 1400, t, 0.07, 0.06); break;
      case 'chop': noise(b, t, 0.07, 0.25, 500, 1.5); tone(b, 'square', 140, 70, t, 0.06, 0.06); break;
      case 'clang': tone(b, 'square', 520, 380, t, 0.08, 0.05); noise(b, t, 0.09, 0.16, 3200, 3); break;
      case 'hurt': tone(b, 'sawtooth', 240, 90, t, 0.22, 0.16); noise(b, t, 0.12, 0.15, 600, 0.7); break;
      case 'dash': noise(b, t, 0.22, 0.2, 500, 0.9, 'bandpass', 2600); break;
      case 'boom': noise(b, t, 0.4, 0.4, 300, 0.5, 'lowpass', 60); tone(b, 'sine', 120, 35, t, 0.35, 0.3); break;
      case 'thunder': noise(b, t, 0.5, 0.35, 1800, 0.4, 'lowpass', 120); tone(b, 'sawtooth', 90, 40, t, 0.3, 0.12); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(b, 'triangle', f, f, t + i * 0.07, 0.35, 0.13)); break;
      case 'build': noise(b, t, 0.05, 0.3, 700, 2); noise(b, t + 0.12, 0.05, 0.3, 800, 2); [659, 880, 1175].forEach((f, i) => tone(b, 'sine', f, f, t + 0.22 + i * 0.08, 0.4, 0.12)); break;
      case 'click': tone(b, 'sine', 880, 660, t, 0.06, 0.1); break;
      case 'deny': tone(b, 'square', 200, 150, t, 0.14, 0.07); break;
      case 'night': [220, 207, 165].forEach((f, i) => tone(b, 'sine', f, f, t + i * 0.32, 1.2, 0.16, 0.05)); break;
      case 'dawn': [523, 659, 784, 1047].forEach((f, i) => tone(b, 'sine', f, f, t + i * 0.16, 1.0, 0.12, 0.02)); break;
      case 'boss': tone(b, 'sawtooth', 70, 50, t, 1.6, 0.22, 0.3); noise(b, t, 1.4, 0.2, 200, 0.6, 'lowpass', 80); break;
      case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(b, 'triangle', f, f, t + i * 0.12, 1.0, 0.13)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(b, 'sine', f, f, t + i * 0.3, 1.0, 0.15, 0.03)); break;
      case 'eat': tone(b, 'sine', 300, 420, t, 0.08, 0.08); tone(b, 'sine', 340, 460, t + 0.1, 0.08, 0.08); break;
    }
  };

  /* ───────── BGM: 작곡된 테마를 시퀀서로 연주 ─────────
     낮/타이틀 = F장조 3박자 왈츠(펠트 피아노+현악 패드), 밤 = D단조 하프+심장박동, 보스 = 긴박한 오스티나토 */
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let revSend = null;
  function setupReverb() {
    const ctx = A.ctx, sec = 2.6, len = (ctx.sampleRate * sec) | 0, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    const conv = ctx.createConvolver(); conv.buffer = buf; revSend = ctx.createGain(); revSend.gain.value = 0.55;
    const wet = ctx.createBiquadFilter(); wet.type = 'lowpass'; wet.frequency.value = 3600; revSend.connect(conv); conv.connect(wet); wet.connect(musicBus);
  }
  function voice(parts, f, t0, dur, env, cutoff) {
    const ctx = A.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff[0], t0); lp.frequency.exponentialRampToValueAtTime(cutoff[1], t0 + dur);
    env(g.gain, t0, dur);
    parts.forEach((p) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = p[1]; o.frequency.value = f * p[0]; if (p[3]) o.detune.value = p[3]; og.gain.value = p[2]; o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + dur + 0.1); });
    lp.connect(g); g.connect(musicBus); g.connect(revSend);
  }
  const pluckEnv = (vel) => (gp, t0, dur) => { gp.setValueAtTime(0.0001, t0); gp.linearRampToValueAtTime(vel, t0 + 0.01); gp.exponentialRampToValueAtTime(vel * 0.32, t0 + 0.28); gp.exponentialRampToValueAtTime(0.0001, t0 + dur); };
  const padEnv = (vel) => (gp, t0, dur) => { gp.setValueAtTime(0.0001, t0); gp.linearRampToValueAtTime(vel, t0 + dur * 0.35); gp.linearRampToValueAtTime(vel * 0.8, t0 + dur * 0.7); gp.linearRampToValueAtTime(0.0001, t0 + dur); };
  const piano = (m, t0, vel, dur) => { const f = mtof(m); voice([[1, 'triangle', 1], [2, 'sine', 0.32], [3, 'sine', 0.1], [1, 'sine', 0.5, 5]], f, t0, dur || 2.2, pluckEnv(vel), [Math.min(7000, f * 7), Math.max(500, f * 1.6)]); };
  const bell = (m, t0, vel, dur) => { const f = mtof(m); voice([[1, 'sine', 1], [3.01, 'sine', 0.22], [5.4, 'sine', 0.06]], f, t0, dur || 1.8, pluckEnv(vel), [9000, 2500]); };
  const harp = (m, t0, vel) => { const f = mtof(m); voice([[1, 'triangle', 1], [2, 'sine', 0.2]], f, t0, 1.6, pluckEnv(vel), [Math.min(5000, f * 5), Math.max(300, f * 1.2)]); };
  const bass = (m, t0, vel, dur) => { const f = mtof(m); voice([[1, 'sine', 1], [2, 'triangle', 0.25]], f, t0, dur || 1.4, pluckEnv(vel), [900, 200]); };
  const pad = (notes, t0, dur, vel) => notes.forEach((m) => voice([[1, 'sawtooth', 0.5, -6], [1, 'sawtooth', 0.5, 7], [0.5, 'sine', 0.5]], mtof(m), t0, dur, padEnv(vel), [750, 600]));
  const thump = (t0, vel) => { const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(82, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.22); g.gain.setValueAtTime(vel, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3); o.connect(g); g.connect(musicBus); o.start(t0); o.stop(t0 + 0.35); };

  const CH = { F: [41, [57, 60, 65]], CE: [40, [55, 60, 64]], Dm: [38, [57, 62, 65]], Bb: [46, [58, 62, 65]], FA: [45, [57, 60, 65]], Gm: [43, [58, 62, 67]], C: [48, [55, 60, 64]], A: [45, [57, 61, 64]], Bbl: [34, [53, 58, 62]], Dml: [38, [53, 57, 62]], Gml: [31, [50, 55, 58]], Al: [33, [49, 52, 57]] };
  const WALTZ = {
    chords: ['F', 'CE', 'Dm', 'Bb', 'FA', 'Gm', 'C', 'F', 'F', 'CE', 'Dm', 'Bb', 'Gm', 'C', 'F', 'F'],
    mel: [[69, 0, 72, 0, 77, 0], [76, 0, 74, 72, 0, 0], [74, 0, 77, 0, 81, 0], [79, 0, 77, 74, 0, 0], [72, 0, 69, 0, 72, 0], [70, 0, 74, 0, 79, 0], [76, 0, 79, 77, 76, 74], [77, 0, 0, 0, 0, 0],
      [81, 0, 79, 77, 0, 72], [79, 0, 76, 0, 72, 0], [77, 0, 76, 74, 0, 69], [74, 0, 70, 0, 74, 0], [70, 72, 74, 0, 79, 0], [76, 0, 74, 0, 72, 0], [77, 0, 0, 0, 72, 0], [77, 0, 0, 0, 0, 0]],
  };
  const NIGHT = {
    chords: ['Dml', 'Bbl', 'Gml', 'Al', 'Dml', 'Bbl', 'Gml', 'Al'],
    mel: [[69, 0, 0, 74, 0, 0, 77, 0], [74, 0, 0, 0, 70, 0, 0, 0], [67, 0, 0, 70, 0, 0, 74, 0], [73, 0, 0, 0, 69, 0, 0, 0], [77, 0, 76, 74, 0, 0, 69, 0], [70, 0, 0, 74, 0, 0, 77, 0], [79, 0, 77, 0, 74, 0, 70, 0], [69, 0, 0, 0, 0, 0, 0, 0]],
  };
  let cur = null, bar = 0, st = 0, nextT = 0;
  function playStep(mood, t) {
    const hum = () => (Math.random() - 0.5) * 0.012, v = (x) => x * (0.85 + Math.random() * 0.3);
    if (mood === 'day' || mood === 'title') {
      const L = WALTZ.chords.length, sec = Math.floor(bar / L) % 3, b = bar % L, ch = CH[WALTZ.chords[b]], rest = sec === 1 && b >= 8, title = mood === 'title';
      if (st === 0) { pad(ch[1], t, (60 / (title ? 84 : 104)) * 3 * 1.25, 0.011); bass(ch[0] + (title ? 12 : 0), t, v(title ? 0.07 : 0.13)); }
      if (sec === 2 || title) { const arp = [null, ch[1][0], ch[1][1], ch[1][2], ch[1][1], ch[1][0]][st]; if (arp) harp(arp + 12, t + hum(), v(0.04)); }
      else if (st === 2 || st === 4) ch[1].slice(1).forEach((m) => piano(m, t + hum(), v(0.045), 1.2));
      const n = WALTZ.mel[b][st]; if (n && !rest) { if (sec === 2 || title) bell(n + 12, t + hum(), v(0.075)); else piano(n, t + hum(), v(0.15)); }
      if (rest && Math.random() < 0.3) bell(ch[1][(Math.random() * 3) | 0] + 24, t, v(0.035));
    } else {
      const boss = mood === 'boss', L = NIGHT.chords.length, b = bar % L, ch = CH[NIGHT.chords[b]], quiet = Math.floor(bar / L) % 2 === 1;
      if (st === 0) pad(ch[1].concat(ch[0] + 12), t, (60 / (boss ? 96 : 66)) * 4 * 1.2, boss ? 0.016 : 0.013);
      if (boss) { bass(ch[0] + 12, t, v(st % 2 ? 0.07 : 0.12), 0.5); if (st % 2 === 0) thump(t, 0.2); bell([74, 77, 81, 77, 74, 77, 82, 77][st] + (b % 4 === 3 ? -1 : 0), t + hum(), v(0.05), 0.9); }
      else { if (st % 2 === 0) harp([ch[0] + 12, ch[1][0], ch[1][1], ch[1][2]][st / 2], t + hum(), v(0.06)); if (st === 0) thump(t, 0.12); if (st === 3) thump(t, 0.07); }
      const n = NIGHT.mel[b][st]; if (n && (!quiet || boss)) bell(n + (boss ? 0 : 0), t + hum(), v(boss ? 0.06 : 0.08), 2.4);
    }
  }
  A.tick = function () {
    if (!A.ctx || !A.musicOn || !musicBus) return; const ctx = A.ctx; if (!revSend) setupReverb();
    if (A.mood !== cur) { cur = A.mood; bar = 0; st = 0; nextT = Math.max(nextT, ctx.currentTime + 0.15); }
    if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.1;
    const bpm = { day: 104, title: 84, night: 66, boss: 96 }[cur] || 100, steps = cur === 'day' || cur === 'title' ? 6 : 8, sd = 60 / bpm / 2;
    while (nextT < ctx.currentTime + 0.3) { playStep(cur, nextT); nextT += sd; if (++st >= steps) { st = 0; bar++; } }
  };
})();
