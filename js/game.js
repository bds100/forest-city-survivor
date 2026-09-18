/* 게임 코어 — 상태 / 월드 생성 / 업데이트 / 렌더 */
(function () {
  const G = window.G, A = G.art, U = G.util, WD = G.WORLD, T = G.TIME, TAU = Math.PI * 2;
  const Game = (G.game = {});
  let S = null;

  /* ───────── 저장 ───────── */
  const SAVE_KEY = 'moss_city_save_v1';
  G.save = { seeds: 0, meta: {}, chars: {}, best: {}, wins: {}, settings: { music: true, sfx: true, shake: true }, lastChar: 'minji', lastDiff: 'normal', runs: 0 };
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(G.save, JSON.parse(raw)); } catch (e) { /* 저장 불가 환경 */ }
  G.persist = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* noop */ } };

  const meta = (id) => (S.diff.meta ? G.save.meta[id] || 0 : 0);
  const sk = (id) => S.skills[id] || 0;
  const bl = (id) => S.build[id] || 0;
  const bpos = (id) => { const b = G.BUILD.find((x) => x.id === id); return { x: WD.cx + b.pos[0], y: WD.cy + b.pos[1] }; };

  /* ───────── 새 게임 ───────── */
  Game.newRun = function (charId, diffId) {
    const ch = G.CHARS[charId], diff = G.DIFF[diffId];
    S = G.state = {
      diff, char: ch, time: 0, clock: 0, day: 1, isNight: false, weather: 'clear', dark: 0,
      res: { wood: 0, scrap: 0, food: 12, crystal: 0 }, build: {}, skills: {}, ws: {},
      level: 1, xp: 0, xpNeed: 8, pendingLevels: 0, rerolls: 0, revives: 0, bonus: { luck: 0, hp: 0 },
      player: { x: WD.cx, y: WD.cy + 170, hp: 100, maxHp: 100, hunger: 100, facing: 1, walk: 0, moving: false, hurtT: 0, dashT: 0, dashCd: 0, swing: 0, gatherT: 0, iframes: 0, t: 0, ldx: 1, ldy: 0 },
      enemies: [], shots: [], ebullets: [], pickups: [], nodes: [], props: [], tufts: [], solids: [], parts: [], texts: [], fx: [], clouds: [], wx: [],
      tree: { hp: 400, maxHp: 400, shake: 0, alarm: 0 }, tower: { cd: 0, aim: null }, fox: null, boss: null,
      kills: 0, bossKills: 0, shake: 0, flash: 0, combo: 0, comboT: 0, paused: false, over: false, won: false, paid: 0,
      spawnT: 2, daySpawnT: 5, sched: [], cam: { x: WD.cx, y: WD.cy + 100 }, stats: {}, banner: null,
    };
    G.BUILD.forEach((b) => (S.build[b.id] = b.start));
    S.rerolls = meta('reroll'); S.revives = diff.revive + meta('revive');
    const st = meta('start'); S.res.wood += st * 25; S.res.scrap += st * 25; S.res.food += st * 8;
    S.skills[ch.weapon] = 1;
    genWorld(); Game.recalc(); S.player.hp = S.player.maxHp; S.tree.maxHp = S.tree.hp = 250 + bl('tree') * 150;
    G.save.lastChar = charId; G.save.lastDiff = diffId; G.save.runs++; G.persist();
    G.audio.mood = 'day';
    Game.banner('1일차', '자원을 모아 밤을 대비하세요');
  };

  Game.recalc = function () {
    const c = S.char.mod, st = S.stats, hungry = S.player.hunger <= 0;
    st.maxHp = 100 + (c.hp || 0) + meta('hp') * 10 + sk('soup') * 15 + bl('tree') * 10 + S.bonus.hp;
    st.speed = 185 * (1 + (c.speed || 0) + meta('spd') * 0.03 + sk('boots') * 0.08) * (hungry ? 0.85 : 1);
    st.dmg = (1 + bl('bench') * 0.12) * (1 + meta('atk') * 0.06) * (1 + sk('stone') * 0.1) * (1 + (c.dmg || 0));
    st.cd = (1 - sk('quick') * 0.07) * (1 - (c.cd || 0)); st.crit = 0.05 + sk('eye') * 0.07 + (c.crit || 0);
    st.pickR = 72 * (1 + sk('pack') * 0.25 + meta('magnet') * 0.15 + (c.pick || 0));
    st.gSpd = 1 + (c.gather || 0) + sk('hands') * 0.15;
    st.gYield = S.diff.yield * (1 + (c.gather || 0) + sk('hands') * 0.1 + meta('gather') * 0.1);
    st.xp = 1 + (c.xp || 0) + meta('xp') * 0.08; st.armor = sk('coat') * 0.06 + (c.armor || 0);
    st.luck = sk('clover') * 0.1 + S.bonus.luck + (c.luck || 0); st.regen = sk('soup') * 0.4 + (c.regen || 0);
    const d = st.maxHp - S.player.maxHp; S.player.maxHp = st.maxHp; if (d > 0) S.player.hp += d; S.player.hp = Math.min(S.player.hp, st.maxHp);
  };

  /* ───────── 월드 생성 ───────── */
  const ROAD = { vx: WD.cx - 430, hy: WD.cy + 380 };
  function genWorld() {
    const r = U.rng((Math.random() * 1e9) | 0), size = WD.size, M = 120;
    const far = (x, y, d) => U.dist2(x, y, WD.cx, WD.cy) > d * d;
    const free = (x, y, rad) => S.solids.every((s) => U.dist2(x, y, s.x, s.y) > (s.r + rad) * (s.r + rad));
    const place = (minCamp, rad, tries, fn) => { for (let i = 0; i < tries; i++) { const x = M + r() * (size - M * 2), y = M + r() * (size - M * 2); if (far(x, y, minCamp) && free(x, y, rad) && Math.abs(x - ROAD.vx) > 95 && Math.abs(y - ROAD.hy) > 95) { fn(x, y); return true; } } return false; };
    for (let i = 0; i < 34; i++) place(520, 130, 20, (x, y) => { const v = (r() * 4) | 0, w = A.sprites['ruin' + v].anchorW; S.props.push({ x, y, sprite: 'ruin' + v, oy: 22 }); S.solids.push({ x: x - w / 4, y: y - 4, r: w / 4 }, { x: x + w / 4, y: y - 4, r: w / 4 }); });
    for (let x = 200; x < size; x += 420) { S.props.push({ x: x + r() * 60, y: ROAD.hy - 100, sprite: 'lamp', oy: 8 }); }
    for (let y = 260; y < size; y += 460) { S.props.push({ x: ROAD.vx + 100, y: y + r() * 60, sprite: r() < 0.6 ? 'lamp' : 'sign', oy: 8 }); }
    for (let i = 0; i < 36; i++) place(340, 30, 10, (x, y) => { S.props.push({ x, y, sprite: 'rock' + ((r() * 2) | 0), oy: 12 }); S.solids.push({ x, y: y - 4, r: 20 }); });
    const node = (kind, x, y) => {
      const n = { kind, x, y, seed: (r() * 1000) | 0, shake: 0 };
      if (kind === 'tree') { n.maxHp = 5; n.s = 0.9 + r() * 0.5; n.blobs = A.treeBlobs(n.seed + 1); n.cr = 12; S.solids.push({ x, y: y - 3, r: 11, node: n }); }
      if (kind === 'wreck') { n.maxHp = 6; n.v = (r() * 3) | 0; n.cr = 34; S.solids.push({ x, y: y - 6, r: 30 }); }
      if (kind === 'bush') { n.maxHp = 3; n.cr = 16; }
      if (kind === 'crystal') { n.maxHp = 8; n.cr = 14; }
      n.hp = n.maxHp; S.nodes.push(n); return n;
    };
    for (let i = 0; i < 95; i++) place(330, 40, 12, (x, y) => node('tree', x, y));
    for (let i = 0; i < 24; i++) { const onV = r() < 0.5, x = onV ? ROAD.vx + (r() - 0.5) * 90 : M + r() * (size - M * 2), y = onV ? M + r() * (size - M * 2) : ROAD.hy + (r() - 0.5) * 90; if (far(x, y, 360) && free(x, y, 60)) node('wreck', x, y); }
    for (let i = 0; i < 26; i++) place(360, 60, 12, (x, y) => node('wreck', x, y));
    for (let i = 0; i < 44; i++) place(330, 30, 12, (x, y) => node('bush', x, y));
    for (let i = 0; i < 4; i++) place(1000, 40, 30, (x, y) => node('crystal', x, y));
    // 시작 지점 근처에 기본 자원 보장
    [['tree', -330, 120], ['tree', 360, -140], ['tree', 300, 300], ['bush', -300, -220], ['bush', 380, 90], ['wreck', -60, 400]].forEach((a) => node(a[0], WD.cx + a[1], WD.cy + a[2]));
    const tp = bpos('tree'), fp = bpos('fire'); S.solids.push({ x: tp.x, y: tp.y - 4, r: 14 }, { x: fp.x, y: fp.y - 2, r: 20 });
    const fls = ['#fff8e6', '#ffe27a', '#ffd0dc', '#d8e6ff', '#ffb3a0'];
    for (let i = 0; i < 1500; i++) S.tufts.push({ x: r() * size, y: r() * size, h: 9 + r() * 9, ph: r() * 6, fl: r() < 0.22 ? fls[(r() * 5) | 0] : null });
    for (let i = 0; i < 16; i++) S.clouds.push({ x: r() * size, y: r() * size, s: 170 + r() * 110, v: i % 4 });
    for (let i = 0; i < 40; i++) S.wx.push({ x: Math.random(), y: Math.random(), ph: Math.random() * 6, sp: 0.6 + Math.random() * 0.8, s: 0.6 + Math.random() * 0.8 });
  }

  /* ───────── 도우미 ───────── */
  Game.banner = (title, sub) => { S.banner = { title, sub, t: 0 }; };
  function text(x, y, txt, col, size) { S.texts.push({ x: x + U.rand(-6, 6), y, txt, col: col || '#fff', life: 0.9, size: size || 15 }); if (S.texts.length > 80) S.texts.shift(); }
  function part(o) { if (S.parts.length < 520) S.parts.push(o); }
  function burst(x, y, n, col, spd, size, kind, g) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.4 + Math.random() * 0.8); part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (g ? spd * 0.5 : 0), g: g || 0, life: 0, max: 0.35 + Math.random() * 0.4, size: size * (0.6 + Math.random() * 0.8), col: Array.isArray(col) ? U.pick(col) : col, kind: kind || 'dot', rot: Math.random() * 6 }); } }
  function shake(v) { if (G.save.settings.shake) S.shake = Math.max(S.shake, v); }
  function drop(kind, val, x, y) {
    if (kind === 'xp' && S.pickups.length > 260) { const o = S.pickups.find((p) => p.kind === 'xp'); if (o) { o.val += val; return; } }
    const a = Math.random() * TAU, v = 50 + Math.random() * 70; S.pickups.push({ kind, val, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 4, vz: 130 + Math.random() * 60, seed: Math.random() * 6, age: 0 });
  }
  function dropN(kind, amount, x, y) { let n = Math.floor(amount) + (Math.random() < amount % 1 ? 1 : 0); while (n > 0) { const v = n >= 6 ? 3 : 1; drop(kind, v, x, y); n -= v; } }
  function nearestEnemy(x, y, maxD) { let best = null, bd = maxD * maxD; for (const e of S.enemies) { if (e.dead) continue; let d = U.dist2(x, y, e.x, e.y); if (d < bd) { if (e.biting) d *= 0.2; if (d < bd) { bd = d; best = e; } } } return best; }

  /* ───────── 시간 / 낮밤 ───────── */
  function updateClock(dt) {
    S.clock += dt; const c = S.clock;
    if (!S.isNight) { S.dark = U.smooth(T.day - 10, T.day, c) * 0.6 + (1 - U.smooth(0, 5, c)) * 0.35; S.sun = U.smooth(T.day - 18, T.day - 4, c); S.dawn = 1 - U.smooth(0, 9, c); if (c >= T.day) startNight(); }
    else { S.dark = 0.6 + U.smooth(0, 6, c) * 0.4 - U.smooth(T.night - 5, T.night, c) * 0.65; S.sun = 1 - U.smooth(0, 7, c); S.dawn = U.smooth(T.night - 5, T.night, c); if (c >= T.night) startDay(); }
    if (S.weather === 'fog') S.dark = Math.max(S.dark, 0.12);
  }
  function startNight() {
    S.isNight = true; S.clock = 0; S.spawnT = 1.5; S.sched = []; G.audio.sfx('night'); G.audio.mood = 'night';
    const d = S.day, boss = d % 5 === 0; Game.banner(boss ? '⚠ 검은 안개 왕이 다가옵니다' : '밤이 찾아옵니다', boss ? '거점 근처에서 맞서 싸우세요' : '검은 안개가 몰려옵니다 — 생명나무를 지키세요');
    const golems = Math.floor((d - 1) / 2) + (d >= 8 ? 1 : 0); for (let i = 0; i < golems; i++) S.sched.push({ t: 8 + (i * (T.night - 20)) / Math.max(1, golems), type: 'golem' });
    if (boss) { S.sched.push({ t: 9, type: 'boss' }); G.audio.sfx('boss'); }
  }
  function startDay() {
    S.isNight = false; S.clock = 0; S.day++; S.daySpawnT = 6; G.audio.sfx('dawn'); G.audio.mood = 'day';
    S.enemies.forEach((e) => { if (e.boss) return; e.dead = true; burst(e.x, e.y - e.r, 6, ['#6a5a80', '#fff3c0'], 60, 4, 'smoke'); if (Math.random() < 0.5) drop('xp', e.xp, e.x, e.y); });
    S.ebullets.length = 0;
    const g = bl('garden') * 3 * (S.weather === 'rain' ? 1.5 : 1), dw = bl('drone') * 8, ds = bl('drone') * 6; S.res.food += Math.round(g); S.res.wood += dw; S.res.scrap += ds;
    S.tree.hp = Math.min(S.tree.maxHp, S.tree.hp + S.tree.maxHp * 0.3); S.player.hp = Math.min(S.player.maxHp, S.player.hp + S.player.maxHp * 0.15);
    const r = Math.random; S.nodes.forEach((n) => { if (n.hp <= 0 && r() < 0.78) { n.hp = n.maxHp; if (n.kind === 'crystal') { for (let i = 0; i < 30; i++) { const x = 150 + r() * (WD.size - 300), y = 150 + r() * (WD.size - 300); if (U.dist2(x, y, WD.cx, WD.cy) > 900 * 900) { n.x = x; n.y = y; break; } } } } });
    const wr = r(); S.weather = wr < 0.5 ? 'clear' : wr < 0.7 ? 'wind' : wr < 0.88 ? 'rain' : 'fog';
    if (!G.save.best[S.diff.id] || G.save.best[S.diff.id] < S.day) { G.save.best[S.diff.id] = S.day; G.persist(); }
    const inc = []; if (g) inc.push(`🍓+${Math.round(g)}`); if (dw) inc.push(`🪵+${dw} ⚙️+${ds}`);
    Game.banner(`${S.day}일차 · ${G.WEATHER[S.weather].icon} ${G.WEATHER[S.weather].name}`, inc.length ? '새벽 수확: ' + inc.join('  ') : '새 아침이 밝았습니다');
    G.ui.toast('📖 ' + G.DIARY[Math.min(S.day - 1, G.DIARY.length - 1)], 5200);
    if (S.day >= 3 && S.day % 2 === 1) setTimeout(() => { if (S && !S.over && !S.paused) G.ui.showEvent(U.pick(G.EVENTS)); }, 1800);
  }

  /* ───────── 적 생성 ───────── */
  function spawn(type, x, y) {
    const d = G.ENEMY[type], day = S.day, sc = S.diff;
    const hpMul = (1 + 0.24 * (day - 1) + (day > 10 ? (day - 10) * 0.15 : 0)) * sc.hp, dm = (1 + 0.09 * (day - 1)) * sc.dmg;
    const e = { type, x: U.clamp(x, 30, WD.size - 30), y: U.clamp(y, 30, WD.size - 30), vx: 0, vy: 0, kx: 0, ky: 0, hp: d.hp * hpMul * (d.boss ? 1 + (day / 5 - 1) * 0.9 : 1), dmg: d.dmg * dm, spd: d.spd * (0.9 + Math.random() * 0.2), r: d.r, xp: d.xp, seed: Math.random() * 10, flash: 0, slowT: 0, atkT: 1, spawnT: 0.5, bladeT: 0, tree: !!d.tree, ranged: !!d.ranged, elite: !!d.elite, boss: !!d.boss, t1: 3, t2: 6 };
    e.maxHp = e.hp; S.enemies.push(e); if (e.boss) S.boss = e; return e;
  }
  function spawnRing(type) {
    const tree = G.ENEMY[type].tree, c = tree ? bpos('tree') : S.player, a = Math.random() * TAU, d = 640 + Math.random() * 140;
    return spawn(type, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8);
  }
  function pickType(onlyBasic) { const pool = Object.keys(G.ENEMY).filter((k) => G.ENEMY[k].w > 0 && G.ENEMY[k].from <= S.day && (!onlyBasic || k === 'dust' || k === 'beetle')); let tot = 0; pool.forEach((k) => (tot += G.ENEMY[k].w)); let r = Math.random() * tot; for (const k of pool) { r -= G.ENEMY[k].w; if (r <= 0) return k; } return 'dust'; }
  function updateSpawns(dt) {
    const alive = S.enemies.length;
    if (S.isNight) {
      for (let i = S.sched.length - 1; i >= 0; i--) if (S.clock >= S.sched[i].t) { const e = spawnRing(S.sched[i].type); if (e.boss) shake(10); S.sched.splice(i, 1); }
      S.spawnT -= dt; const cap = Math.min(240, (36 + S.day * 16) * S.diff.spawn);
      if (S.spawnT <= 0 && S.clock < T.night - 4) { S.spawnT = (Math.max(0.2, 1.35 - S.day * 0.1) / S.diff.spawn) * (1.7 - 0.7 * U.smooth(0, 16, S.clock)); if (alive < cap) { const n = 1 + (Math.random() < S.day * 0.06 ? 1 : 0) + (S.day >= 6 ? 1 : 0); for (let i = 0; i < n; i++) spawnRing(pickType(false)); } }
    } else {
      S.daySpawnT -= dt; const p = S.player;
      if (S.daySpawnT <= 0) { S.daySpawnT = 3.6 / S.diff.spawn; if (U.dist2(p.x, p.y, WD.cx, WD.cy) > 560 * 560 && alive < 4 + S.day * 2) spawnRing(pickType(true)); }
    }
  }
  Game.ambush = function (n) { const c = bpos('fire'); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; spawn('dust', c.x + Math.cos(a) * 330, c.y + Math.sin(a) * 260); } };

  /* ───────── 피해 처리 ───────── */
  function hitEnemy(e, base, kx, ky, kb) {
    if (e.dead) return; let d = base * S.stats.dmg * (0.9 + Math.random() * 0.2), crit = Math.random() < S.stats.crit; if (crit) d *= 2;
    e.hp -= d; e.flash = 0.1; const k = (kb == null ? 150 : kb) * (e.boss ? 0.08 : e.elite ? 0.3 : 1); const len = Math.hypot(kx, ky) || 1; e.kx += (kx / len) * k; e.ky += (ky / len) * k;
    text(e.x, e.y - e.r * 2, Math.round(d) + (crit ? '!' : ''), crit ? '#ffd24a' : '#ffffff', crit ? 20 : 14); G.audio.sfx('hit');
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; S.kills++; G.audio.sfx('kill'); burst(e.x, e.y - e.r, e.boss ? 40 : 8, ['#5a4a70', '#8a7aa8', '#fff3c0'], e.boss ? 260 : 110, e.boss ? 9 : 5, 'smoke');
    dropN('xp', e.xp, e.x, e.y); const luck = 1 + S.stats.luck;
    if (Math.random() < 0.05 * luck) drop(Math.random() < 0.5 ? 'food' : 'scrap', 1, e.x, e.y);
    if (Math.random() < 0.012 * luck) drop('heart', 20, e.x, e.y);
    if (e.elite) { drop('crystal', 1, e.x, e.y); if (Math.random() < 0.35 * luck) drop('crystal', 1, e.x, e.y); shake(5); }
    if (e.boss) { for (let i = 0; i < 6 + Math.floor(S.day / 5) * 2; i++) drop('crystal', 1, e.x, e.y); drop('heart', 50, e.x, e.y); S.bossKills++; S.boss = null; shake(16); S.flash = 0.6; G.audio.sfx('boom'); Game.banner('검은 안개 왕을 물리쳤습니다!', '에테르 결정을 주우세요'); }
  }
  function hurtPlayer(dmg, fx, fy) {
    const p = S.player; if (p.iframes > 0 || p.dashT > 0 || S.over) return;
    const d = Math.max(1, dmg * (1 - S.stats.armor)); p.hp -= d; p.iframes = 0.6; p.hurtT = 0.35; shake(7); G.audio.sfx('hurt'); text(p.x, p.y - 60, '-' + Math.round(d), '#ff6b6b', 17);
    burst(p.x, p.y - 25, 6, '#ff8a8a', 120, 4);
    if (p.hp <= 0) {
      if (S.revives > 0) { S.revives--; p.hp = p.maxHp * 0.5; p.iframes = 3; S.flash = 0.7; S.fx.push({ kind: 'ring', x: p.x, y: p.y, r0: 20, r1: 320, life: 0, max: 0.6, col: '#eaffd8' }); S.enemies.forEach((e) => { if (U.dist2(e.x, e.y, p.x, p.y) < 300 * 300) hitEnemy(e, 80, e.x - p.x, e.y - p.y, 500); }); Game.banner('🕊️ 숲의 가호', '다시 일어섰습니다'); G.audio.sfx('levelup'); }
      else Game.end('death');
    }
  }

  /* ───────── 플레이어 ───────── */
  function updatePlayer(dt) {
    const p = S.player, inp = G.input; p.t += dt;
    let mx = inp.mx, my = inp.my; const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    p.moving = len > 0.12; if (p.moving) { p.ldx = mx / (len > 1 ? 1 : len || 1); p.ldy = my / (len > 1 ? 1 : len || 1); if (Math.abs(mx) > 0.1) p.facing = mx > 0 ? 1 : -1; }
    p.dashCd -= dt; if (inp.dash && p.dashCd <= 0) { p.dashT = 0.2; p.dashCd = 2.2; G.audio.sfx('dash'); const l = Math.hypot(p.ldx, p.ldy) || 1; p.ddx = p.ldx / l; p.ddy = p.ldy / l; }
    inp.dash = false;
    let vx = mx * S.stats.speed, vy = my * S.stats.speed;
    if (p.dashT > 0) { p.dashT -= dt; vx = p.ddx * 640; vy = p.ddy * 640; if (Math.random() < 0.8) part({ x: p.x, y: p.y - 22, vx: 0, vy: 0, g: 0, life: 0, max: 0.3, size: 13, col: '#ffffff', kind: 'smoke' }); }
    p.x += vx * dt; p.y += vy * dt; if (p.moving) { p.walk += dt * 13; if (Math.sin(p.walk) > 0.96 && Math.random() < 0.5) part({ x: p.x, y: p.y, vx: -vx * 0.1, vy: -8, g: 0, life: 0, max: 0.4, size: 5, col: 'rgba(230,240,200,.7)', kind: 'smoke' }); }
    for (const s of S.solids) { if (s.node && s.node.hp <= 0) continue; const dx = p.x - s.x, dy = (p.y - s.y) * 1.5, rr = s.r + 11, d2 = dx * dx + dy * dy; if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), push = rr - d; p.x += (dx / d) * push; p.y += ((dy / d) * push) / 1.5; } }
    p.x = U.clamp(p.x, 40, WD.size - 40); p.y = U.clamp(p.y, 60, WD.size - 30);
    p.iframes -= dt; p.hurtT -= dt; if (p.swing > 0) p.swing -= dt * 3.4;
    // 허기 & 회복
    const wasHungry = p.hunger <= 0; p.hunger -= 0.9 * (1 + (S.char.mod.hunger || 0)) * S.diff.hunger * (S.weather === 'rain' ? 0.75 : 1) * dt;
    if (p.hunger < 60 && S.res.food > 0) { S.res.food--; p.hunger += 10; text(p.x, p.y - 64, '🍓 냠', '#ffd0d8', 13); G.audio.sfx('eat'); }
    if (p.hunger <= 0) { p.hunger = 0; p.hp -= 2.5 * dt; if (p.hp <= 0 && !S.over) { if (S.revives > 0) { S.revives--; p.hunger = 50; p.hp = p.maxHp * 0.5; p.iframes = 3; Game.banner('🕊️ 숲의 가호', '다시 일어섰습니다'); } else { p.hp = 0; Game.end('hunger'); } } }
    if (wasHungry !== p.hunger <= 0) Game.recalc();
    S.inCamp = U.dist2(p.x, p.y, WD.cx, WD.cy + 30) < WD.campR * WD.campR;
    let regen = S.stats.regen + (p.hunger > 80 ? 0.6 : 0); if (S.inCamp) regen += 1 + bl('fire') * 1.5; if (p.hunger > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  }

  function updateGather(dt) {
    const p = S.player; let best = null, bd = 1e9;
    for (const n of S.nodes) { if (n.shake > 0) n.shake -= dt; if (n.hp <= 0) continue; const dx = n.x - p.x, dy = n.y - p.y; if (Math.abs(dx) > 120 || Math.abs(dy) > 120) continue; const d = Math.hypot(dx, dy) - n.cr; if (d < 44 && d < bd) { bd = d; best = n; } }
    S.gatherNode = best; if (!best) { p.gatherT = Math.min(p.gatherT, 0.2); return; }
    p.gatherT -= dt * S.stats.gSpd; if (p.gatherT > 0) return;
    p.gatherT = 0.45; p.swing = 1; if (!p.moving) p.facing = best.x >= p.x ? 1 : -1; best.hp--; best.shake = 0.3; const done = best.hp <= 0, y = S.stats.gYield;
    const K = { tree: ['wood', 2, 4, 'chop', ['#7dbd62', '#5a9d55', '#a8d97c'], 'leaf'], wreck: ['scrap', 2, 4, 'clang', ['#ffd98a', '#fff', '#aab6bd'], 'spark'], bush: ['food', 2, 2, 'chop', ['#7dbd62', '#e8546e'], 'leaf'], crystal: ['crystal', 0, 2, 'clang', ['#8fe9e4', '#fff'], 'spark'] }[best.kind];
    G.audio.sfx(K[3]); burst(best.x, best.y - 30 * (best.s || 1), 7, K[4], 130, 5, K[5], 260);
    const amt = best.kind === 'crystal' ? (done ? 2 + (Math.random() < 0.3 + S.stats.luck ? 1 : 0) : 0) : (K[1] + (done ? K[2] : 0)) * y;
    dropN(K[0], amt, best.x, best.y - 8); if (done) { shake(3); burst(best.x, best.y - 30, 10, K[4], 170, 6, K[5], 260); }
  }

  /* ───────── 무기 ───────── */
  function updateWeapons(dt) {
    const p = S.player, cdm = S.stats.cd, ws = S.ws; const W = (id) => (ws[id] = ws[id] || { cd: 0.5 });
    let l;
    if ((l = sk('sling'))) { const w = W('sling'); w.cd -= dt; if (w.cd <= 0) { const e = nearestEnemy(p.x, p.y, 520); if (e) { w.cd = (0.95 - l * 0.06) * cdm; const n = 1 + Math.floor(l / 2), base = Math.atan2(e.y - e.r - (p.y - 28), e.x - p.x); for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.16; S.shots.push({ kind: 'stone', x: p.x, y: p.y - 28, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: 10 + l * 4, life: 1.1, pierce: l >= 3 ? 1 : 0, r: 6, hit: [] }); } G.audio.sfx('shoot'); if (!p.moving) p.facing = e.x >= p.x ? 1 : -1; } else w.cd = 0.15; } }
    if ((l = sk('blade'))) { const n = 1 + l, rad = 80 + l * 6; for (let i = 0; i < n; i++) { const a = S.time * 2.9 + (i / n) * TAU, bx = p.x + Math.cos(a) * rad, by = p.y - 22 + Math.sin(a) * rad * 0.8; for (const e of S.enemies) { if (e.dead || e.bladeT > 0) continue; const rr = e.r + 15; if (U.dist2(bx, by, e.x, e.y - e.r) < rr * rr) { e.bladeT = 0.45; hitEnemy(e, 6 + l * 3, e.x - p.x, e.y - p.y, 120); } } } }
    if ((l = sk('acorn'))) { const w = W('acorn'); w.cd -= dt; if (w.cd <= 0) { const c = S.enemies.filter((e) => !e.dead && U.dist2(e.x, e.y, p.x, p.y) < 470 * 470); if (c.length) { w.cd = (3.2 - l * 0.25) * cdm; for (let i = 0; i < (l >= 4 ? 2 : 1); i++) { const e = U.pick(c); S.shots.push({ kind: 'acorn', sx: p.x, sy: p.y - 30, tx: e.x + e.vx * 0.5, ty: e.y + e.vy * 0.5, x: p.x, y: p.y, t: 0, dur: 0.62, dmg: 25 + l * 12, rad: 72 + l * 8, life: 2 }); } G.audio.sfx('shoot'); } else w.cd = 0.3; } }
    if ((l = sk('firefly'))) { const w = W('firefly'); w.cd -= dt; if (w.cd <= 0) { if (nearestEnemy(p.x, p.y, 560)) { w.cd = (1.7 - l * 0.12) * cdm; const n = 1 + Math.floor((l + 1) / 2); for (let i = 0; i < n; i++) { const a = Math.random() * TAU; S.shots.push({ kind: 'firefly', x: p.x, y: p.y - 30, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, dmg: 8 + l * 3, life: 3, pierce: 0, r: 8, hit: [], ph: Math.random() * 6 }); } G.audio.sfx('xp'); } else w.cd = 0.3; } }
    if ((l = sk('thorn'))) { const w = W('thorn'); w.cd -= dt; if (w.cd <= 0) { w.cd = (4 - l * 0.3) * cdm; const rad = 120 + l * 15; S.fx.push({ kind: 'thorn', x: p.x, y: p.y, r0: 20, r1: rad, life: 0, max: 0.45, col: '#5a9d55' }); for (const e of S.enemies) { if (!e.dead && U.dist2(e.x, e.y, p.x, p.y) < rad * rad) { e.slowT = 1.6; hitEnemy(e, 12 + l * 6, e.x - p.x, e.y - p.y, 90); } } G.audio.sfx('chop'); } }
    if ((l = sk('thunder'))) { const w = W('thunder'); w.cd -= dt; if (w.cd <= 0) { const c = S.enemies.filter((e) => !e.dead && U.dist2(e.x, e.y, p.x, p.y) < 500 * 500); if (c.length) { w.cd = (2.5 - l * 0.2) * cdm; for (let i = 0; i < 1 + Math.floor(l / 2); i++) { const e = U.pick(c); const pts = []; let lx = e.x + U.rand(-40, 40); for (let k = 0; k <= 7; k++) { pts.push([U.lerp(lx, e.x, k / 7) + (k < 7 ? U.rand(-16, 16) : 0), e.y - e.r - 420 * (1 - k / 7)]); } S.fx.push({ kind: 'bolt', pts, x: e.x, y: e.y, life: 0, max: 0.28 }); S.enemies.forEach((o) => { if (!o.dead && U.dist2(o.x, o.y, e.x, e.y) < 46 * 46) hitEnemy(o, 30 + l * 14, 0, -1, 40); }); burst(e.x, e.y - 10, 8, ['#fff', '#bfe8ff'], 160, 4, 'spark'); } S.flash = Math.max(S.flash, 0.25); G.audio.sfx('thunder'); shake(3); } else w.cd = 0.3; } }
    if ((l = sk('fox'))) updateFox(dt, l, cdm); else S.fox = null;
  }
  function updateFox(dt, l, cdm) {
    const p = S.player; let f = S.fox; if (!f) f = S.fox = { x: p.x - 30, y: p.y, vx: 1, vy: 0, state: 'idle', cd: 1, target: null, t: 0 };
    f.cd -= dt; f.t += dt;
    if (f.state === 'idle') { const hx = p.x - p.facing * 38 + Math.cos(f.t * 1.5) * 12, hy = p.y + 6 + Math.sin(f.t * 2) * 8; f.vx = (hx - f.x) * 5; f.vy = (hy - f.y) * 5; if (f.cd <= 0) { const e = nearestEnemy(p.x, p.y, 340); if (e) { f.state = 'dash'; f.target = e; f.t2 = 0.8; } } }
    else if (f.state === 'dash') { const e = f.target; f.t2 -= dt; if (!e || e.dead || f.t2 <= 0) { f.state = 'idle'; f.cd = 0.3; } else { const dx = e.x - f.x, dy = e.y - e.r - (f.y - 14), d = Math.hypot(dx, dy) || 1; f.vx = (dx / d) * 640; f.vy = (dy / d) * 640; part({ x: f.x, y: f.y - 14, vx: 0, vy: 0, g: 0, life: 0, max: 0.25, size: 8, col: '#ffcf8a', kind: 'smoke' }); if (d < e.r + 14) { hitEnemy(e, 14 + l * 7, dx, dy, 260); burst(e.x, e.y - e.r, 6, ['#ffcf8a', '#fff'], 150, 4, 'spark'); f.state = 'idle'; f.cd = (1.5 - l * 0.12) * cdm; } } }
    f.x += f.vx * dt; f.y += f.vy * dt;
  }
  function updateTower(dt) {
    const l = bl('tower'); if (!l) return; const tp = bpos('tower'), tw = S.tower; tw.cd -= dt; const e = nearestEnemy(tp.x, tp.y, 440);
    if (e) { const oy = tp.y - 100 - l * 4; tw.aim = Math.atan2(e.y - e.r - oy, e.x - tp.x); if (tw.cd <= 0) { tw.cd = 1.25 - l * 0.13; S.shots.push({ kind: 'bolt', x: tp.x, y: oy, vx: Math.cos(tw.aim) * 760, vy: Math.sin(tw.aim) * 760, dmg: (12 + l * 9) / S.stats.dmg, life: 0.8, pierce: l >= 4 ? 1 : 0, r: 8, hit: [] }); G.audio.sfx('shoot'); } } else tw.aim = null;
  }

  function updateShots(dt) {
    for (const s of S.shots) {
      s.life -= dt;
      if (s.kind === 'acorn') { s.t += dt; const k = Math.min(1, s.t / s.dur); s.x = U.lerp(s.sx, s.tx, k); s.y = U.lerp(s.sy, s.ty, k); s.z = Math.sin(k * Math.PI) * 120; if (k >= 1) { s.life = -1; S.fx.push({ kind: 'boom', x: s.tx, y: s.ty, r0: 10, r1: s.rad, life: 0, max: 0.4 }); burst(s.tx, s.ty - 10, 14, ['#ffb45a', '#fff3c0', '#8a6646'], 220, 6, 'smoke'); G.audio.sfx('boom'); shake(4); for (const e of S.enemies) if (!e.dead && U.dist2(e.x, e.y, s.tx, s.ty) < (s.rad + e.r) * (s.rad + e.r)) hitEnemy(e, s.dmg, e.x - s.tx, e.y - s.ty, 220); } continue; }
      if (s.kind === 'firefly') { const e = nearestEnemy(s.x, s.y, 420); if (e) { const dx = e.x - s.x, dy = e.y - e.r - s.y, d = Math.hypot(dx, dy) || 1; s.vx += (dx / d) * 1500 * dt; s.vy += (dy / d) * 1500 * dt; } const sp = Math.hypot(s.vx, s.vy), mx = 360; if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; } if (Math.random() < 0.5) part({ x: s.x, y: s.y, vx: 0, vy: 0, g: 0, life: 0, max: 0.3, size: 4, col: '#eaffb0', kind: 'dot' }); }
      s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of S.enemies) { if (e.dead || s.hit.indexOf(e) >= 0) continue; const rr = e.r + s.r; if (U.dist2(s.x, s.y, e.x, e.y - e.r) < rr * rr) { hitEnemy(e, s.dmg, s.vx, s.vy, s.kind === 'bolt' ? 200 : 140); s.hit.push(e); if (s.pierce-- <= 0) { s.life = -1; break; } } }
    }
    S.shots = S.shots.filter((s) => s.life > 0);
    const p = S.player;
    for (const b of S.ebullets) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (U.dist2(b.x, b.y, p.x, p.y - 24) < 18 * 18) { hurtPlayer(b.dmg); b.life = p.iframes > 0 && p.dashT <= 0 ? -1 : b.life; } }
    S.ebullets = S.ebullets.filter((b) => b.life > 0);
  }

  /* ───────── 적 AI ───────── */
  function updateEnemies(dt) {
    const p = S.player, tp = bpos('tree'), fence = bl('fence'), E = S.enemies; S.tree.alarm -= dt;
    for (let i = 0; i < E.length; i++) {
      const e = E[i]; if (e.dead) continue; e.flash -= dt; e.slowT -= dt; e.bladeT -= dt; e.spawnT -= dt; e.atkT -= dt;
      const toTree = e.tree || (e.boss && false); const tx = toTree ? tp.x : p.x, ty = toTree ? tp.y : p.y; let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      let sp = e.spd * (e.slowT > 0 ? 0.55 : 1); if (S.weather === 'rain') sp *= 0.95;
      if (e.ranged) { if (d < 230) sp *= -0.6; else if (d < 300) sp = 0; e.t1 -= dt; if (e.t1 <= 0 && d < 520) { e.t1 = 2.8; S.ebullets.push({ x: e.x, y: e.y - e.r * 1.5, vx: dx * 165, vy: (ty - 24 - (e.y - e.r * 1.5)) / d * 165, dmg: e.dmg, life: 4, r: 7 }); } }
      if (e.boss) { e.t1 -= dt; e.t2 -= dt; if (e.t1 <= 0) { e.t1 = 3.6; const n = 10 + Math.floor(S.day / 5) * 2; for (let k = 0; k < n; k++) { const a = (k / n) * TAU + S.time; S.ebullets.push({ x: e.x, y: e.y - e.r, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: e.dmg * 0.6, life: 5, r: 9 }); } G.audio.sfx('dash'); } if (e.t2 <= 0) { e.t2 = 7; for (let k = 0; k < 4; k++) spawn('dust', e.x + U.rand(-60, 60), e.y + U.rand(-40, 40)); } }
      e.biting = toTree && d < e.r + 34;
      if (e.biting) { sp = 0; if (e.atkT <= 0) { e.atkT = 1.2; S.tree.hp -= e.dmg * (1 - fence * 0.12); S.tree.shake = 0.3; S.tree.alarm = 2; if (!(S.tree.warnT > S.time)) { S.tree.warnT = S.time + 14; G.ui.toast('⚠️ 생명나무가 공격받고 있어요! 가까이 가서 지켜 주세요', 3200); G.audio.sfx('deny'); } burst(tp.x, tp.y - 40, 4, ['#a5e6b4', '#fff'], 100, 4, 'leaf', 200); if (fence) hitEnemy(e, (fence * 6) / S.stats.dmg, -dx, -dy, 60); if (S.tree.hp <= 0) { S.tree.hp = 0; Game.end('tree'); return; } } }
      e.vx = dx * sp + e.kx; e.vy = dy * sp + e.ky; e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
      // 분리
      for (let j = i + 1; j < E.length; j++) { const o = E[j]; const ax = o.x - e.x; if (ax > 40 || ax < -40) continue; const ay = o.y - e.y; if (ay > 40 || ay < -40) continue; const rr = (e.r + o.r) * 0.85, d2 = ax * ax + ay * ay; if (d2 < rr * rr && d2 > 0.01) { const dd = Math.sqrt(d2), push = ((rr - dd) / dd) * 0.5, me = o.boss || o.elite ? 1 : 0.5, ot = e.boss || e.elite ? 1 : 0.5; e.x -= ax * push * me; e.y -= ay * push * me; o.x += ax * push * ot; o.y += ay * push * ot; } }
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.spawnT <= 0) { const pr = e.r + 13; if (U.dist2(e.x, e.y, p.x, p.y) < pr * pr) hurtPlayer(e.dmg); }
      if (e.boss && Math.random() < 0.3) part({ x: e.x + U.rand(-50, 50), y: e.y - U.rand(0, 100), vx: 0, vy: -30, g: 0, life: 0, max: 0.8, size: 12, col: 'rgba(40,28,60,.5)', kind: 'smoke' });
    }
    if (S.tree.shake > 0) S.tree.shake -= dt;
    let w = 0; for (let i = 0; i < E.length; i++) if (!E[i].dead) E[w++] = E[i]; E.length = w;
  }

  /* ───────── 줍기 / 경험치 ───────── */
  function updatePickups(dt) {
    const p = S.player, R = S.stats.pickR; let w = 0;
    for (let i = 0; i < S.pickups.length; i++) {
      const k = S.pickups[i]; k.age += dt;
      if (k.z > 0 || k.vz > 0) { k.z += k.vz * dt; k.vz -= 600 * dt; k.x += k.vx * dt; k.y += k.vy * dt; if (k.z <= 0) { k.z = 0; k.vz = 0; k.vx = k.vy = 0; } }
      const dx = p.x - k.x, dy = p.y - 14 - k.y, d = Math.hypot(dx, dy);
      if (k.age > 0.35 && (d < R || k.mag)) { k.mag = true; const sp = 300 + k.age * 500; k.x += (dx / d) * sp * dt; k.y += (dy / d) * sp * dt; k.z *= 0.9; }
      if (k.mag && d < 18) { collect(k); continue; }
      S.pickups[w++] = k;
    }
    S.pickups.length = w;
  }
  function collect(k) {
    const p = S.player; S.combo++; S.comboT = 0.8;
    if (k.kind === 'xp') { Game.gainXp(k.val); G.audio.sfx('xp'); return; }
    if (k.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + k.val); text(p.x, p.y - 60, '+' + k.val + ' ❤', '#ff9aa8', 15); G.audio.sfx('pickup', 8); return; }
    S.res[k.kind] += k.val; G.audio.sfx('pickup', S.combo); text(p.x, p.y - 58, `+${k.val} ${G.RES[k.kind].icon}`, '#fff8d8', 13); G.ui.bump(k.kind);
  }
  Game.gainXp = function (v) { S.xp += v * S.stats.xp; while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = Math.floor(5 + S.level * 3 + S.level * S.level * 0.3); S.pendingLevels++; } };

  /* ───────── 레벨업 카드 ───────── */
  Game.rollCards = function () {
    const owned = (t) => Object.keys(S.skills).filter((k) => S.skills[k] > 0 && G.SKILLS[k].type === t).length;
    const pool = Object.keys(G.SKILLS).filter((id) => { const d = G.SKILLS[id], l = sk(id); return l < d.max && (l > 0 || owned(d.type) < 5); });
    const cards = []; const bag = pool.slice();
    while (cards.length < 3 && bag.length) { let tot = 0; const ws = bag.map((id) => { const w = sk(id) > 0 ? 1.5 : 1; tot += w; return w; }); let r = Math.random() * tot, idx = 0; for (let i = 0; i < bag.length; i++) { r -= ws[i]; if (r <= 0) { idx = i; break; } } const id = bag.splice(idx, 1)[0], d = G.SKILLS[id], l = sk(id); const shiny = l + 2 <= d.max && Math.random() < 0.1 + S.stats.luck * 0.4; cards.push({ id, name: d.name, icon: d.icon, type: d.type, from: l, to: l + (shiny ? 2 : 1), shiny, desc: d.desc(l + (shiny ? 2 : 1)) }); }
    if (!cards.length) { cards.push({ special: 'heal', name: '든든한 한 끼', icon: '🍙', desc: '체력 40% 회복', to: 0, from: 0 }, { special: 'food', name: '비상 식량', icon: '🥫', desc: '식량 +15', to: 0, from: 0 }, { special: 'mat', name: '자재 꾸러미', icon: '📦', desc: '나무·고철 +15', to: 0, from: 0 }); }
    return cards;
  };
  Game.applyCard = function (c) {
    if (c.special === 'heal') S.player.hp = Math.min(S.player.maxHp, S.player.hp + S.player.maxHp * 0.4);
    else if (c.special === 'food') S.res.food += 15; else if (c.special === 'mat') { S.res.wood += 15; S.res.scrap += 15; }
    else S.skills[c.id] = c.to;
    Game.recalc(); const p = S.player; S.fx.push({ kind: 'ring', x: p.x, y: p.y, r0: 10, r1: 200, life: 0, max: 0.5, col: '#fff3c0' }); burst(p.x, p.y - 30, 16, ['#fff3c0', '#d8ff8a', '#ffd0dc'], 200, 5, 'spark'); p.iframes = Math.max(p.iframes, 1);
  };

  /* ───────── 건설 ───────── */
  Game.cost = function (b) { const l = bl(b.id); if (l >= b.max) return null; const c = b.cost(l), m = 1 + (S.char.mod.buildCost || 0), out = {}; Object.keys(c).forEach((k) => { if (c[k] > 0) out[k] = k === 'crystal' ? c[k] : Math.round(c[k] * m); }); return out; };
  Game.canAfford = (cost) => cost && Object.keys(cost).every((k) => S.res[k] >= cost[k]);
  Game.upgrade = function (id) {
    const b = G.BUILD.find((x) => x.id === id), cost = Game.cost(b); if (!cost || !Game.canAfford(cost)) { G.audio.sfx('deny'); return false; }
    Object.keys(cost).forEach((k) => (S.res[k] -= cost[k])); S.build[id]++; G.audio.sfx('build'); const pos = bpos(id); burst(pos.x, pos.y - 30, 22, ['#fff3c0', '#c49a66', '#a5e6b4'], 220, 6, 'spark', 200); S.fx.push({ kind: 'ring', x: pos.x, y: pos.y, r0: 10, r1: 150, life: 0, max: 0.5, col: '#fff3c0' });
    if (id === 'tree') { const nm = 250 + bl('tree') * 150; S.tree.hp += nm - S.tree.maxHp; S.tree.maxHp = nm; S.tree.hp = Math.min(nm, S.tree.hp + nm * 0.5); if (bl('tree') >= 5 && !S.won) setTimeout(() => Game.win(), 900); }
    Game.recalc(); return true;
  };

  /* ───────── 종료 ───────── */
  function payout(won) { const tot = Math.floor(((S.day - 1) * 12 + S.kills * 0.15 + S.bossKills * 40 + bl('tree') * 10 + (won || S.won ? 150 : 0)) * S.diff.reward); const gain = Math.max(0, tot - S.paid); S.paid += gain; G.save.seeds += gain; if (!G.save.best[S.diff.id] || G.save.best[S.diff.id] < S.day) G.save.best[S.diff.id] = S.day; G.persist(); return gain; }
  Game.win = function () { if (!S || S.over || S.won) return; S.won = true; S.paused = true; G.save.wins[S.diff.id] = (G.save.wins[S.diff.id] || 0) + 1; const gain = payout(true); G.audio.sfx('win'); S.flash = 1; S.enemies.forEach((e) => (e.hp = 0, e.dead = true)); S.enemies.length = 0; G.ui.showEnd('win', gain); };
  Game.end = function (reason) { if (S.over) return; S.over = true; const gain = payout(false); G.audio.sfx('lose'); G.ui.showEnd(reason, gain); };
  Game.giveUp = function () { if (S && !S.over) Game.end('quit'); };

  /* ───────── 업데이트 ───────── */
  Game.update = function (dt) {
    if (!S || S.over || S.paused) return; S.time += dt; G.audio.mood = S.boss ? 'boss' : S.isNight ? 'night' : 'day';
    updateClock(dt); updatePlayer(dt); if (S.over) return; updateGather(dt); updateWeapons(dt); updateTower(dt); updateSpawns(dt); updateEnemies(dt); if (S.over) return; updateShots(dt); updatePickups(dt);
    let w = 0; for (const q of S.parts) { q.life += dt; if (q.life >= q.max) continue; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= 0.97; S.parts[w++] = q; } S.parts.length = w;
    S.fx = S.fx.filter((f) => (f.life += dt) < f.max); S.texts = S.texts.filter((t) => { t.life -= dt; t.y -= 34 * dt; return t.life > 0; });
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30); if (S.flash > 0) S.flash -= dt * 1.6; if (S.banner) { S.banner.t += dt; if (S.banner.t > 3.4) S.banner = null; }
    S.clouds.forEach((c) => { c.x += 14 * dt * (S.weather === 'wind' ? 3 : 1); if (c.x > WD.size + 400) c.x = -400; });
    const p = S.player, cam = S.cam, k = 1 - Math.pow(0.002, dt); cam.x += (p.x + p.ldx * (p.moving ? 40 : 0) - cam.x) * k; cam.y += (p.y - 30 + p.ldy * (p.moving ? 30 : 0) - cam.y) * k;
    if (S.pendingLevels > 0) { S.pendingLevels--; G.audio.sfx('levelup'); G.ui.showLevelUp(Game.rollCards()); }
  };

  /* ───────── 렌더 ───────── */
  let groundPat = null, roadPat = null, lightC = null, lctx = null;
  Game.render = function (ctx, W, H, dpr) {
    if (!S) return; const t = S.time, p = S.player;
    if (!groundPat) { groundPat = ctx.createPattern(A.makeGround(), 'repeat'); roadPat = ctx.createPattern(A.makeRoad(), 'repeat'); }
    let sc = H / 760; if (W / sc < 760) sc = W / 760; S.scale = sc; const vw = W / sc, vh = H / sc;
    let cx = U.clamp(S.cam.x, vw / 2, WD.size - vw / 2), cy = U.clamp(S.cam.y, vh / 2, WD.size - vh / 2);
    if (S.shake > 0) { cx += (Math.random() - 0.5) * S.shake; cy += (Math.random() - 0.5) * S.shake; }
    const x0 = cx - vw / 2, y0 = cy - vh / 2, x1 = x0 + vw, y1 = y0 + vh; S.view = { x0, y0, x1, y1, sc };
    const k = sc * dpr; ctx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    ctx.fillStyle = groundPat; ctx.fillRect(x0, y0, vw, vh);
    // 도로
    ctx.fillStyle = roadPat; if (ROAD.vx + 85 > x0 && ROAD.vx - 85 < x1) { ctx.save(); ctx.translate(ROAD.vx - 85, 0); ctx.fillRect(0, y0, 170, vh); ctx.restore(); }
    if (ROAD.hy + 85 > y0 && ROAD.hy - 85 < y1) { ctx.save(); ctx.translate(0, ROAD.hy + 85); ctx.rotate(-Math.PI / 2); ctx.fillRect(0, x0, 170, vw); ctx.restore(); }
    // 거점 흙바닥
    const gx = WD.cx, gy = WD.cy + 40; if (gx + 340 > x0 && gx - 340 < x1 && gy + 300 > y0 && gy - 300 < y1) { ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.78); const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 320); g.addColorStop(0, 'rgba(214,186,140,.85)'); g.addColorStop(0.7, 'rgba(206,180,130,.55)'); g.addColorStop(1, 'rgba(206,180,130,0)'); ctx.fillStyle = g; ctx.fillRect(-330, -330, 660, 660); ctx.restore(); }
    const wind = S.weather === 'wind' ? 1 : S.weather === 'rain' ? 0.5 : 0.15;
    for (const g of S.tufts) { if (g.x < x0 - 20 || g.x > x1 + 20 || g.y < y0 - 5 || g.y > y1 + 30) continue; A.drawTuft(ctx, g, t, wind); }
    for (const f of S.fx) { const q = f.life / f.max; if (f.kind === 'thorn') { const r = U.lerp(f.r0, f.r1, 1 - (1 - q) * (1 - q)); ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.7); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#4f8f4c'; ctx.lineWidth = 9; ctx.setLineDash([16, 9]); A.circ(ctx, 0, 0, r); ctx.stroke(); ctx.strokeStyle = '#a8d97c'; ctx.lineWidth = 3; A.circ(ctx, 0, 0, r - 5); ctx.stroke(); ctx.restore(); } }
    // Y 정렬 드로우
    const list = []; const vis = (o, m) => o.x > x0 - m && o.x < x1 + m && o.y > y0 - 40 && o.y < y1 + m * 1.6;
    for (const o of S.props) if (vis(o, 160)) list.push([o.y, 0, o]);
    for (const o of S.nodes) if (vis(o, 110)) list.push([o.y, 1, o]);
    for (const o of S.enemies) if (vis(o, 90)) list.push([o.y, 2, o]);
    for (const o of S.pickups) if (vis(o, 20)) list.push([o.y - 2, 3, o]);
    G.BUILD.forEach((b) => { if (b.id === 'fence') return; const pos = bpos(b.id); list.push([pos.y, 4, b, pos]); });
    const fl = bl('fence'); if (fl) { const tp = bpos('tree'), n = 12 + fl * 2; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.2; list.push([tp.y + Math.sin(a) * 58, 5, tp.x + Math.cos(a) * 96]); } }
    list.push([p.y, 6, p]); if (S.fox) list.push([S.fox.y, 7, S.fox]);
    list.sort((a, b) => a[0] - b[0]);
    const pc = { x: p.x, y: p.y, t: p.t, walk: p.walk, moving: p.moving, facing: p.facing, pal: S.char.pal, hurtT: p.hurtT, dashT: p.dashT, swing: p.swing, seed: 0 };
    for (const it of list) {
      switch (it[1]) {
        case 0: A.drawProp(ctx, it[2]); break;
        case 1: { const n = it[2]; if (n.kind === 'tree') { const hide = p.y < n.y && p.y > n.y - 115 * n.s && Math.abs(p.x - n.x) < 48 * n.s; n.fa = U.lerp(n.fa == null ? 1 : n.fa, hide ? 0.4 : 1, 0.15); } A.drawNode(ctx, n, t); break; } case 2: A.drawEnemy(ctx, it[2], t); break; case 3: A.drawPickup(ctx, it[2], t); break;
        case 4: { const b = it[2], l = bl(b.id); A.drawBuilding(ctx, b.id, l, it[3].x, it[3].y, t, b.id === 'tree' ? S.tree : b.id === 'tower' ? S.tower : { icon: b.icon }); break; }
        case 5: A.drawFencePost(ctx, it[2], it[0], fl, t); break;
        case 6: if (p.iframes > 1) A.glow(ctx, p.x, p.y - 28, 50, '#eaffd8', 0.6); A.drawChar(ctx, pc); break;
        case 7: A.drawFox(ctx, it[2], t); break;
      }
    }
    // 적 체력바 (엘리트)
    for (const e of S.enemies) if (e.elite && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(40,30,30,.6)'; ctx.fillRect(e.x - 22, e.y - e.r * 2.9, 44, 5); ctx.fillStyle = '#ff8a6b'; ctx.fillRect(e.x - 21, e.y - e.r * 2.9 + 1, 42 * (e.hp / e.maxHp), 3); }
    // 바람 칼날
    const bL = sk('blade'); if (bL) { const n = 1 + bL, rad = 80 + bL * 6; for (let i = 0; i < n; i++) { const a = t * 2.9 + (i / n) * TAU, bx = p.x + Math.cos(a) * rad, by = p.y - 22 + Math.sin(a) * rad * 0.8; ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2 + t * 6); A.glow(ctx, 0, 0, 20, '#d8ffe8', 0.6); ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(0, -8, 13, 0); ctx.quadraticCurveTo(0, 4, -13, 0); ctx.fillStyle = '#eafff2'; ctx.fill(); ctx.strokeStyle = '#7dcfa8'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); } }
    // 투사체
    for (const s of S.shots) {
      if (s.kind === 'stone') { A.circ(ctx, s.x, s.y, 4.5); ctx.fillStyle = '#d8d4c8'; ctx.fill(); ctx.strokeStyle = '#6d6a60'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); ctx.stroke(); }
      else if (s.kind === 'bolt') { ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); ctx.stroke(); A.circ(ctx, s.x, s.y, 2.5); ctx.fillStyle = '#d8dde0'; ctx.fill(); }
      else if (s.kind === 'firefly') { A.glow(ctx, s.x, s.y, 16 + Math.sin(t * 20 + s.ph) * 3, '#eaff8a', 0.95); A.circ(ctx, s.x, s.y, 2.6); ctx.fillStyle = '#fffff0'; ctx.fill(); }
      else if (s.kind === 'acorn') { A.ell(ctx, s.x, s.y, 7, 3); ctx.fillStyle = 'rgba(28,52,48,.25)'; ctx.fill(); ctx.save(); ctx.translate(s.x, s.y - s.z - 10); ctx.rotate(s.t * 9); A.ell(ctx, 0, 1, 6, 7.5); ctx.fillStyle = '#b98556'; ctx.fill(); ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -2.5, 6.8, 4.5, 0, Math.PI, 0); ctx.fillStyle = '#7d5b3e'; ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    for (const b of S.ebullets) { A.glow(ctx, b.x, b.y, b.r * 2.6, '#c46bd9', 0.7); A.circ(ctx, b.x, b.y, b.r * 0.62); ctx.fillStyle = '#f6d8ff'; ctx.fill(); }
    // 이펙트
    for (const f of S.fx) {
      const q = f.life / f.max;
      if (f.kind === 'ring' || f.kind === 'boom') { const r = U.lerp(f.r0, f.r1, 1 - (1 - q) * (1 - q)); ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.7); ctx.globalAlpha = (1 - q) * 0.9; if (f.kind === 'boom') { A.circ(ctx, 0, 0, r); ctx.fillStyle = 'rgba(255,200,120,.35)'; ctx.fill(); } ctx.strokeStyle = f.col || '#ffd98a'; ctx.lineWidth = 5 * (1 - q) + 1; A.circ(ctx, 0, 0, r); ctx.stroke(); ctx.restore(); }
      else if (f.kind === 'bolt') { ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.beginPath(); f.pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke(); A.glow(ctx, f.x, f.y - 10, 70, '#bfe8ff', 0.8); ctx.globalAlpha = 1; }
    }
    for (const q of S.parts) {
      const a = 1 - q.life / q.max; ctx.globalAlpha = a; ctx.fillStyle = q.col;
      if (q.kind === 'leaf') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.life * 8); A.ell(ctx, 0, 0, q.size, q.size * 0.45); ctx.fill(); ctx.restore(); }
      else if (q.kind === 'smoke') { A.circ(ctx, q.x, q.y, q.size * (0.6 + (1 - a) * 1.1)); ctx.fill(); }
      else if (q.kind === 'spark') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size * 0.9, -q.size * 0.18, q.size * 1.8, q.size * 0.36); ctx.fillRect(-q.size * 0.18, -q.size * 0.9, q.size * 0.36, q.size * 1.8); ctx.restore(); }
      else { A.circ(ctx, q.x, q.y, q.size * a); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // 구름 그림자 (낮)
    const dayA = (1 - S.dark) * 0.24; if (dayA > 0.03) { ctx.globalAlpha = dayA; for (const c of S.clouds) { const w = c.s * 2.6, h = w * 0.5; if (c.x + w / 2 < x0 || c.x - w / 2 > x1 || c.y + h / 2 < y0 || c.y - h / 2 > y1) continue; ctx.drawImage(A.cloudShadow(c.v), c.x - w / 2, c.y - h / 2, w, h); } ctx.globalAlpha = 1; }
    // 생명나무 체력바
    const tp = bpos('tree'); if (S.tree.hp < S.tree.maxHp || S.isNight) { const tw = 84, ty = tp.y - 70 - bl('tree') * 24; ctx.fillStyle = 'rgba(40,40,30,.55)'; A.rr(ctx, tp.x - tw / 2, ty, tw, 8, 4); ctx.fill(); ctx.fillStyle = S.tree.alarm > 0 && Math.sin(t * 20) > 0 ? '#ff8a6b' : '#a5e6b4'; A.rr(ctx, tp.x - tw / 2 + 1.5, ty + 1.5, Math.max(4, (tw - 3) * (S.tree.hp / S.tree.maxHp)), 5, 2.5); ctx.fill(); }

    /* ── 화면 공간 ── */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.sun > 0.01) { ctx.fillStyle = `rgba(255,140,70,${S.sun * 0.2})`; ctx.fillRect(0, 0, W, H); }
    if (S.dawn > 0.01) { ctx.fillStyle = `rgba(255,190,190,${S.dawn * 0.16})`; ctx.fillRect(0, 0, W, H); }
    if (S.dark > 0.02) {
      const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2); if (!lightC) { lightC = document.createElement('canvas'); lctx = lightC.getContext('2d'); } if (lightC.width !== lw || lightC.height !== lh) { lightC.width = lw; lightC.height = lh; }
      lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh); lctx.fillStyle = `rgba(14,18,46,${S.dark * 0.84 * (1 - Math.max(0, S.flash) * 0.7)})`; lctx.fillRect(0, 0, lw, lh);
      lctx.globalCompositeOperation = 'destination-out'; const L = (wx, wy, r, a) => A.glow(lctx, ((wx - x0) * sc) / 2, ((wy - y0) * sc) / 2, (r * sc) / 2, '#ffffff', a);
      L(p.x, p.y - 26, 215, 1); L(p.x, p.y - 26, 120, 0.8); const fp = bpos('fire'), fr = 260 + bl('fire') * 45 + Math.sin(t * 11) * 8; L(fp.x, fp.y - 12, fr, 1); L(fp.x, fp.y - 12, fr * 0.55, 0.9); L(tp.x, tp.y - 50, 150 + bl('tree') * 26, 0.9);
      if (S.fox) L(S.fox.x, S.fox.y - 14, 70, 0.8); for (const s of S.shots) if (s.kind === 'firefly') L(s.x, s.y, 50, 0.7); for (const n of S.nodes) if (n.kind === 'crystal' && n.hp > 0) L(n.x, n.y - 18, 90, 0.8); for (const k of S.pickups) if (k.kind === 'xp' || k.kind === 'crystal') L(k.x, k.y - 6, 26, 0.5); for (const b of S.ebullets) L(b.x, b.y, 34, 0.6);
      ctx.drawImage(lightC, 0, 0, W, H);
      const fsx = (fp.x - x0) * sc, fsy = (fp.y - 12 - y0) * sc; ctx.globalCompositeOperation = 'lighter'; A.glow(ctx, fsx, fsy, fr * sc * 0.9, '#ff9a4a', S.dark * 0.22); ctx.globalCompositeOperation = 'source-over';
    }
    drawWeather(ctx, W, H, t);
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, S.flash)})`; ctx.fillRect(0, 0, W, H); }
    // 비네트 + 위험 표시
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75); const low = p.hp / p.maxHp < 0.3 ? (0.3 + Math.sin(t * 6) * 0.15) : 0; vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, low ? `rgba(190,30,40,${low + 0.2})` : 'rgba(20,30,50,.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 데미지 텍스트
    ctx.textAlign = 'center'; ctx.lineJoin = 'round'; for (const q of S.texts) { const sx = (q.x - x0) * sc, sy = (q.y - y0) * sc; ctx.globalAlpha = Math.min(1, q.life * 2.5); ctx.font = `${Math.round(q.size * Math.max(0.85, sc))}px Jua, sans-serif`; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(50,35,30,.85)'; ctx.strokeText(q.txt, sx, sy); ctx.fillStyle = q.col; ctx.fillText(q.txt, sx, sy); } ctx.globalAlpha = 1;
    // 거점 방향 화살표
    const hx = (WD.cx - x0) * sc, hy = (WD.cy - y0) * sc; if (hx < 0 || hx > W || hy < 0 || hy > H) { const a = Math.atan2(hy - H / 2, hx - W / 2), rx = W / 2 - 46, ry = H / 2 - 46, kk = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6)), ax = W / 2 + Math.cos(a) * kk, ay = H / 2 + Math.sin(a) * kk, alarm = S.tree.alarm > 0; ctx.save(); ctx.translate(ax, ay); A.circ(ctx, 0, 0, 19); ctx.fillStyle = alarm && Math.sin(t * 16) > 0 ? '#ff8a6b' : 'rgba(255,250,235,.92)'; ctx.fill(); ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 2; ctx.stroke(); ctx.font = '17px sans-serif'; ctx.fillText(alarm ? '⚠️' : '🏕️', 0, 6); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(21, -7); ctx.lineTo(21, 7); ctx.closePath(); ctx.fillStyle = '#4a3a30'; ctx.fill(); ctx.restore(); }
  };

  function drawWeather(ctx, W, H, t) {
    const wx = S.wx, we = S.weather, night = S.dark > 0.5;
    if (we === 'rain') { ctx.strokeStyle = 'rgba(200,225,255,.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 40; i++) for (let k = 0; k < 3; k++) { const q = wx[i], x = ((q.x + k * 0.37 + t * 0.12 * q.sp) % 1) * (W + 100) - 50, y = ((q.y + k * 0.31 + t * 1.5 * q.sp) % 1) * (H + 60) - 30; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 20); } ctx.stroke(); ctx.fillStyle = 'rgba(60,80,120,.1)'; ctx.fillRect(0, 0, W, H); }
    if (we === 'fog') { for (let i = 0; i < 9; i++) { const q = wx[i], x = ((q.x + t * 0.012 * q.sp) % 1) * (W + 600) - 300, y = q.y * H; A.glow(ctx, x, y, 260 + q.s * 160, '#eef4f4', 0.34); } }
    const nLeaf = we === 'wind' ? 22 : 6; for (let i = 0; i < nLeaf; i++) { const q = wx[i + 10], sp = we === 'wind' ? 0.28 : 0.07, x = ((q.x + t * sp * q.sp) % 1) * (W + 80) - 40, y = ((q.y + t * 0.03 + Math.sin(t * 1.3 + q.ph) * 0.02) % 1) * H; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2.4 * q.sp + q.ph); ctx.fillStyle = i % 3 ? 'rgba(140,200,110,.85)' : 'rgba(240,190,110,.85)'; A.ell(ctx, 0, 0, 6 * q.s, 2.6 * q.s); ctx.fill(); ctx.restore(); }
    if (night) for (let i = 0; i < 16; i++) { const q = wx[i + 22], x = ((q.x + Math.sin(t * 0.3 * q.sp + q.ph) * 0.05 + 1) % 1) * W, y = ((q.y + Math.cos(t * 0.23 * q.sp + q.ph) * 0.05 + 1) % 1) * H; A.glow(ctx, x, y, 9 * q.s, '#e8ff9a', (0.5 + Math.sin(t * 2.2 + q.ph * 3) * 0.5) * 0.8); }
    else if (we === 'clear') for (let i = 0; i < 10; i++) { const q = wx[i + 22], x = ((q.x + t * 0.01 * q.sp) % 1) * W, y = ((q.y + Math.sin(t * 0.4 + q.ph) * 0.04 + 1) % 1) * H; A.glow(ctx, x, y, 5 * q.s, '#fffbe0', 0.5); }
  }
})();
