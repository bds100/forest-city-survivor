/* 게임 코어 — 자유 건설 생존 (격자 건설 / 집·지붕 / 직접 전투 / 주민 / 밤 습격 / 자동 저장) */
(function () {
  const G = window.G, A = G.art, U = G.util, WD = G.WORLD, T = G.TIME, TAU = Math.PI * 2, TS = G.TILE, GW = Math.ceil(WD.size / TS), DEF = G.STRUCT;
  const Game = (G.game = {});
  let S = null;

  /* ───────── 저장 ───────── */
  const SAVE_KEY = 'moss_city_save_v1';
  G.save = { seeds: 0, meta: {}, best: {}, wins: {}, settings: { music: true, sfx: true, shake: true }, lastChar: 'minji', lastDiff: 'normal', runs: 0, run: null };
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(G.save, JSON.parse(raw)); } catch (e) { /* 저장 불가 환경 */ }
  G.persist = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* noop */ } };

  const meta = (id) => (S.diff.meta ? G.save.meta[id] || 0 : 0);
  const key = (tx, ty) => ty * GW + tx;
  const tileOf = (v) => Math.floor(v / TS);
  const treePos = { x: WD.cx, y: WD.cy - 50 };
  const ROAD = { vx: WD.cx - 430, hy: WD.cy + 380 };

  /* ───────── 새 게임 / 이어하기 ───────── */
  Game.newRun = function (charId, diffId, sv) {
    const ch = G.CHARS[charId], diff = G.DIFF[diffId];
    S = G.state = {
      diff, char: ch, seed: sv ? sv.seed : (Math.random() * 1e9) | 0, time: 0, clock: sv ? sv.clock : 0, day: sv ? sv.day : 1, isNight: sv ? sv.isNight : false, weather: sv ? sv.weather : 'clear', dark: 0,
      res: sv ? sv.res : { wood: 24, scrap: 0, food: 12, crystal: 0 }, treeLv: sv ? sv.treeLv : 1, tool: sv ? sv.tool : 0, armor: sv ? sv.armor : 0, lantern: sv ? sv.lantern : 0, bonus: sv ? sv.bonus : { luck: 0, hp: 0 },
      player: { x: WD.cx, y: WD.cy + 170, hp: 100, maxHp: 100, hunger: 100, facing: 1, walk: 0, moving: false, hurtT: 0, dashT: 0, dashCd: 0, swing: 0, atk: 0, atkCd: 0, gatherT: 0, iframes: 0, t: 0, ldx: 1, ldy: 0 },
      structs: [], obj: new Map(), floor: new Map(), rooms: [], villagers: [], survivor: sv ? sv.survivor : null, build: null, ghost: null, interact: null, sleeping: false, inRoom: null, vhungry: false,
      enemies: [], shots: [], ebullets: [], pickups: [], nodes: [], props: [], tufts: [], solids: [], parts: [], texts: [], fx: [], clouds: [], wx: [], block: new Uint8Array(GW * GW),
      tree: { hp: 400, maxHp: 400, shake: 0, alarm: 0 }, boss: null, kills: sv ? sv.kills : 0, bossKills: sv ? sv.bossKills : 0, built: sv ? sv.built : 0, shake: 0, flash: 0, combo: 0, comboT: 0,
      paused: false, over: false, won: sv ? sv.won : false, paid: sv ? sv.paid : 0, spawnT: 2, daySpawnT: 5, sched: [], cam: { x: WD.cx, y: WD.cy + 100 }, stats: {}, banner: null, saveT: 25, lastRaid: -99,
    };
    genWorld();
    if (sv) {
      sv.nodes.forEach((hp, i) => { if (S.nodes[i]) S.nodes[i].hp = hp; }); (sv.cry || []).forEach((c) => { const n = S.nodes[c[0]]; if (n) { n.x = c[1]; n.y = c[2]; } });
      sv.structs.forEach((a) => { if (DEF[a[0]]) addStruct(a[0], a[1], a[2], a[3], { grow: a[4] || 0 }); });
      const p = S.player; p.x = sv.px; p.y = sv.py; p.hunger = sv.hunger; Game.recalc(); p.hp = Math.min(p.maxHp, sv.hp); S.tree.maxHp = 250 + S.treeLv * 150; S.tree.hp = Math.min(S.tree.maxHp, sv.treeHp);
      computeRooms(); (sv.vill || []).forEach((v) => { const bed = v.bed ? S.obj.get(key(v.bed[0], v.bed[1])) : null; const nv = makeVillager(v.id, v.x, v.y, v.job); if (bed && bed.id === 'bed') { nv.bed = bed; bed.owner = v.id; } });
      S.cam.x = p.x; S.cam.y = p.y; Game.banner(`${S.day}일차 — 다시 오신 걸 환영해요`, '저장된 거점에서 이어합니다');
    } else {
      const st = meta('start'); S.res.wood += st * 25; S.res.scrap += st * 25; S.res.food += st * 8;
      addStruct('fire', tileOf(WD.cx), tileOf(WD.cy + 96)); Game.recalc(); S.player.hp = S.player.maxHp; S.tree.maxHp = S.tree.hp = 250 + S.treeLv * 150; computeRooms();
      G.save.runs++; Game.banner('1일차', '자원을 모아 벽과 집을 짓고, 밤을 대비하세요');
    }
    G.save.lastChar = charId; G.save.lastDiff = diffId; G.persist(); G.audio.mood = S.isNight ? 'night' : 'day';
  };
  Game.saveRun = function () {
    if (!S || S.over) return; const p = S.player, cry = []; S.nodes.forEach((n, i) => { if (n.kind === 'crystal') cry.push([i, Math.round(n.x), Math.round(n.y)]); });
    G.save.run = { char: S.char.id, diff: S.diff.id, seed: S.seed, clock: S.clock, day: S.day, isNight: S.isNight, weather: S.weather, res: S.res, treeLv: S.treeLv, tool: S.tool, armor: S.armor, lantern: S.lantern, bonus: S.bonus, survivor: S.survivor,
      px: Math.round(p.x), py: Math.round(p.y), hp: Math.round(p.hp), hunger: Math.round(p.hunger), treeHp: Math.round(S.tree.hp), nodes: S.nodes.map((n) => n.hp), cry, structs: S.structs.map((s) => [s.id, s.tx, s.ty, Math.round(s.hp), +(s.grow || 0).toFixed(2)]),
      vill: S.villagers.map((v) => ({ id: v.id, job: v.job, x: Math.round(v.x), y: Math.round(v.y), bed: v.bed ? [v.bed.tx, v.bed.ty] : null })), kills: S.kills, bossKills: S.bossKills, built: S.built, won: S.won, paid: S.paid };
    G.persist();
  };
  Game.hasRun = () => !!(G.save.run && G.CHARS[G.save.run.char] && G.DIFF[G.save.run.diff]);
  Game.continueRun = function () { const r = G.save.run; Game.newRun(r.char, r.diff, r); };

  Game.recalc = function () {
    const c = S.char.mod, st = S.stats, hungry = S.player.hunger <= 0, tool = G.TOOLS[S.tool];
    st.maxHp = 100 + (c.hp || 0) + meta('hp') * 10 + S.treeLv * 10 + S.bonus.hp;
    st.speed = 185 * (1 + (c.speed || 0) + meta('spd') * 0.03) * (hungry ? 0.85 : 1);
    st.dmg = (1 + meta('atk') * 0.06) * (1 + (c.dmg || 0)); st.atkCd = 0.42 * (1 - (c.cd || 0)); st.crit = 0.05 + (c.crit || 0);
    st.pickR = 78 * (1 + meta('magnet') * 0.15 + (c.pick || 0)); st.gSpd = (1 + (c.gather || 0)) * tool.gather; st.gYield = S.diff.yield * (1 + (c.gather || 0) + meta('gather') * 0.1);
    st.armor = G.ARMORS[S.armor].armor + (c.armor || 0); st.luck = S.bonus.luck + (c.luck || 0); st.regen = c.regen || 0; st.build = Math.max(0.4, 1 + (c.buildCost || 0) - meta('build') * 0.04); st.work = 1 + meta('work') * 0.12 + (c.work || 0);
    const d = st.maxHp - S.player.maxHp; S.player.maxHp = st.maxHp; if (d > 0) S.player.hp += d; S.player.hp = Math.min(S.player.hp, st.maxHp);
  };

  /* ───────── 월드 생성 (시드 고정 → 이어하기 때 같은 지형) ───────── */
  function genWorld() {
    const r = U.rng(S.seed), size = WD.size, M = 120;
    const far = (x, y, d) => U.dist2(x, y, WD.cx, WD.cy) > d * d;
    const free = (x, y, rad) => S.solids.every((s) => U.dist2(x, y, s.x, s.y) > (s.r + rad) * (s.r + rad));
    const place = (minCamp, rad, tries, fn) => { for (let i = 0; i < tries; i++) { const x = M + r() * (size - M * 2), y = M + r() * (size - M * 2); if (far(x, y, minCamp) && free(x, y, rad) && Math.abs(x - ROAD.vx) > 95 && Math.abs(y - ROAD.hy) > 95) { fn(x, y); return true; } } return false; };
    for (let i = 0; i < 34; i++) place(620, 130, 20, (x, y) => { const v = (r() * 4) | 0, w = A.sprites['ruin' + v].anchorW; S.props.push({ x, y, sprite: 'ruin' + v, oy: 22, ruin: true }); S.solids.push({ x: x - w / 4, y: y - 4, r: w / 4 }, { x: x + w / 4, y: y - 4, r: w / 4 }); });
    for (let x = 200; x < size; x += 420) S.props.push({ x: x + r() * 60, y: ROAD.hy - 100, sprite: 'lamp', oy: 8 });
    for (let y = 260; y < size; y += 460) S.props.push({ x: ROAD.vx + 100, y: y + r() * 60, sprite: r() < 0.6 ? 'lamp' : 'sign', oy: 8 });
    for (let i = 0; i < 36; i++) place(480, 30, 10, (x, y) => { S.props.push({ x, y, sprite: 'rock' + ((r() * 2) | 0), oy: 12 }); S.solids.push({ x, y: y - 4, r: 20 }); });
    const node = (kind, x, y) => {
      const n = { kind, x, y, seed: (r() * 1000) | 0, shake: 0 };
      if (kind === 'tree') { n.maxHp = 5; n.s = 0.9 + r() * 0.5; n.blobs = A.treeBlobs(n.seed + 1); n.cr = 12; S.solids.push({ x, y: y - 3, r: 11, node: n }); }
      if (kind === 'wreck') { n.maxHp = 6; n.v = (r() * 3) | 0; n.cr = 34; S.solids.push({ x, y: y - 6, r: 30 }); }
      if (kind === 'bush') { n.maxHp = 3; n.cr = 16; } if (kind === 'crystal') { n.maxHp = 8; n.cr = 14; }
      n.hp = n.maxHp; S.nodes.push(n); return n;
    };
    for (let i = 0; i < 95; i++) place(420, 40, 12, (x, y) => node('tree', x, y));
    for (let i = 0; i < 24; i++) { const onV = r() < 0.5, x = onV ? ROAD.vx + (r() - 0.5) * 90 : M + r() * (size - M * 2), y = onV ? M + r() * (size - M * 2) : ROAD.hy + (r() - 0.5) * 90; if (far(x, y, 360) && free(x, y, 60)) node('wreck', x, y); }
    for (let i = 0; i < 26; i++) place(420, 60, 12, (x, y) => node('wreck', x, y));
    for (let i = 0; i < 44; i++) place(400, 30, 12, (x, y) => node('bush', x, y));
    for (let i = 0; i < 4; i++) place(1000, 40, 30, (x, y) => node('crystal', x, y));
    [['tree', -420, 150], ['tree', 440, -170], ['tree', 400, 330], ['tree', -380, -250], ['bush', -340, 300], ['bush', 430, 110], ['wreck', -90, 430]].forEach((a) => node(a[0], WD.cx + a[1], WD.cy + a[2]));
    S.solids.push({ x: treePos.x, y: treePos.y - 4, r: 16, core: true });
    for (const s of S.solids) { const rad = s.r + (s.core ? 40 : 12), t0x = tileOf(s.x - rad), t1x = tileOf(s.x + rad), t0y = tileOf(s.y - rad), t1y = tileOf(s.y + rad); for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) { if (tx < 0 || ty < 0 || tx >= GW || ty >= GW) continue; if (U.dist2((tx + 0.5) * TS, (ty + 0.5) * TS, s.x, s.y) < rad * rad) S.block[key(tx, ty)] = 1; } }
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
  function drop(kind, val, x, y) { const a = Math.random() * TAU, v = 50 + Math.random() * 70; S.pickups.push({ kind, val, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 4, vz: 130 + Math.random() * 60, seed: Math.random() * 6, age: 0 }); }
  function dropN(kind, amount, x, y) { let n = Math.floor(amount) + (Math.random() < amount % 1 ? 1 : 0); while (n > 0) { const v = n >= 6 ? 3 : 1; drop(kind, v, x, y); n -= v; } }
  function nearestEnemy(x, y, maxD) { let best = null, bd = maxD * maxD; for (const e of S.enemies) { if (e.dead) continue; const d = U.dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } } return best; }
  function homePos() { const f = S.structs.find((s) => s.id === 'fire'); return f ? { x: (f.tx + 0.5) * TS, y: (f.ty + 1.6) * TS } : { x: WD.cx, y: WD.cy + 120 }; }
  const sCenter = (s) => ({ x: (s.tx + s.w / 2) * TS, y: (s.ty + 0.5) * TS });

  /* ───────── 건설 ───────── */
  function addStruct(id, tx, ty, hp, extra) { const d = DEF[id], s = { id, tx, ty, w: d.w || 1, hp: hp || d.hp, maxHp: d.hp, shake: 0, cd: 0, grow: 0, snap: 0, owner: null, aim: null }; Object.assign(s, extra); S.structs.push(s); const m = d.floorLayer ? S.floor : S.obj; for (let i = 0; i < s.w; i++) m.set(key(tx + i, ty), s); return s; }
  function delStruct(s) { const i = S.structs.indexOf(s); if (i >= 0) S.structs.splice(i, 1); const m = DEF[s.id].floorLayer ? S.floor : S.obj; for (let k = 0; k < s.w; k++) if (m.get(key(s.tx + k, s.ty)) === s) m.delete(key(s.tx + k, s.ty)); if (s.id === 'bed') S.villagers.forEach((v) => { if (v.bed === s) v.bed = null; }); computeRooms(); }
  function destroyStruct(s) { const c = sCenter(s); burst(c.x, c.y - 10, 12, ['#c9a06c', '#8a6646', '#fff3c0'], 170, 6, 'leaf', 260); G.audio.sfx('boom'); shake(3); delStruct(s); }
  Game.costOf = function (id) { const c = DEF[id].cost, out = {}; Object.keys(c).forEach((k) => (out[k] = k === 'crystal' ? c[k] : Math.max(1, Math.round(c[k] * S.stats.build)))); return out; };
  Game.canAfford = (cost) => cost && Object.keys(cost).every((k) => S.res[k] >= cost[k]);
  Game.unlocked = (id) => !DEF[id].need || S.structs.some((s) => s.id === DEF[id].need);
  function pay(cost) { Object.keys(cost).forEach((k) => (S.res[k] -= cost[k])); }
  function canPlace(id, tx, ty) {
    const d = DEF[id], p = S.player;
    for (let i = 0; i < (d.w || 1); i++) {
      const x = tx + i; if (x < 1 || ty < 1 || x >= GW - 1 || ty >= GW - 1) return false; const k = key(x, ty); if (S.block[k]) return false;
      if (d.floorLayer) { if (S.floor.has(k)) return false; const o = S.obj.get(k); if (o && o.id === 'farm') return false; } else { if (S.obj.has(k)) return false; if (id === 'farm' && S.floor.has(k)) return false; }
      const cx = (x + 0.5) * TS, cy = (ty + 0.5) * TS; for (const n of S.nodes) if (n.hp > 0 && U.dist2(n.x, n.y - 6, cx, cy) < 34 * 34) return false;
      if (d.solid && !d.door) { const nx = U.clamp(p.x, x * TS, x * TS + TS), ny = U.clamp(p.y - 5, ty * TS, ty * TS + TS); if (U.dist2(p.x, p.y - 5, nx, ny) < 12 * 12) return false; }
    }
    return true;
  }
  Game.setBuild = function (id) { S.build = id || null; S.ghost = null; if (id) S.sleeping = false; };
  function updateGhost() {
    if (!S.build) { S.ghost = null; return; } const p = S.player, inp = G.input, v = S.view; let wx, wy;
    if (inp.mouse && inp.mouse.on && v) { wx = v.x0 + inp.mouse.x / v.sc; wy = v.y0 + inp.mouse.y / v.sc; const dx = wx - p.x, dy = wy - p.y, d = Math.hypot(dx, dy), mx = TS * 6.5; if (d > mx) { wx = p.x + (dx / d) * mx; wy = p.y + (dy / d) * mx; } }
    else { wx = p.x + p.ldx * TS * 1.7; wy = p.y - 8 + p.ldy * TS * 1.7; }
    const tx = tileOf(wx), ty = tileOf(wy); if (S.build === 'remove') { const s = S.obj.get(key(tx, ty)) || S.floor.get(key(tx, ty)); S.ghost = { tx, ty, ok: !!s, target: s }; return; }
    S.ghost = { tx, ty, ok: canPlace(S.build, tx, ty) };
  }
  Game.tryPlace = function () {
    const g = S.ghost; if (!S.build || !g) return;
    if (S.build === 'remove') { if (!g.target) { G.audio.sfx('deny'); return; } const c = Game.costOf(g.target.id), ctr = sCenter(g.target); Object.keys(c).forEach((k) => { if (k !== 'crystal') S.res[k] += Math.floor(c[k] * 0.5 * (g.target.hp / g.target.maxHp)); }); burst(ctr.x, ctr.y, 8, ['#c9a06c', '#fff3c0'], 120, 5, 'leaf', 200); G.audio.sfx('chop'); delStruct(g.target); return; }
    const cost = Game.costOf(S.build); if (!g.ok) { G.audio.sfx('deny'); return; } if (!Game.canAfford(cost)) { G.audio.sfx('deny'); G.ui.toast('자원이 부족해요: ' + Object.keys(cost).map((k) => `${G.RES[k].icon}${cost[k]}`).join(' ')); return; }
    pay(cost); const s = addStruct(S.build, g.tx, g.ty), c = sCenter(s); S.built++; G.audio.sfx('build'); burst(c.x, c.y, 10, ['#fff3c0', '#c49a66', '#a5e6b4'], 140, 5, 'spark', 160); S.fx.push({ kind: 'ring', x: c.x, y: c.y, r0: 6, r1: 50, life: 0, max: 0.35, col: '#fff3c0' });
    const rooms0 = S.rooms.length; computeRooms(); if (S.rooms.length > rooms0) { Game.banner('🏠 집이 완성됐어요!', '침대가 있는 방 — 생존자를 데려오면 입주합니다'); G.audio.sfx('levelup'); }
  };
  /* 방(집) 판정: 침대에서 시작해 벽·문에 막힐 때까지 채워서, 새어 나가지 않으면 방 */
  function computeRooms() {
    const seen = new Set(), rooms = [];
    for (const bed of S.structs) {
      if (bed.id !== 'bed') continue; const k0 = key(bed.tx, bed.ty); if (seen.has(k0)) { bed.room = rooms.find((r) => r.tiles.has(k0)) || null; continue; }
      const tiles = new Set([k0]), stack = [k0]; let open = false;
      while (stack.length && !open) { const k = stack.pop(), tx = k % GW, ty = (k / GW) | 0; for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = tx + d[0], ny = ty + d[1]; if (nx < 0 || ny < 0 || nx >= GW || ny >= GW) { open = true; break; } const nk = key(nx, ny), o = S.obj.get(nk); if (o && (DEF[o.id].wall || DEF[o.id].door)) continue; if (!tiles.has(nk)) { tiles.add(nk); if (tiles.size > 80) { open = true; break; } stack.push(nk); } } }
      if (open) { bed.room = null; continue; }
      const roof = new Set(tiles); tiles.forEach((k) => { const tx = k % GW, ty = (k / GW) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nk = key(tx + dx, ty + dy), o = S.obj.get(nk); if (o && (DEF[o.id].wall || DEF[o.id].door)) roof.add(nk); } });
      const old = S.rooms.find((r) => r.tiles.has(k0)); const room = { tiles, roof, alpha: old ? old.alpha : 0 }; tiles.forEach((k) => seen.add(k)); rooms.push(room); bed.room = room;
    }
    S.rooms = rooms;
  }
  Game.housing = () => ({ beds: S.structs.filter((s) => s.id === 'bed' && s.room).length, used: S.villagers.filter((v) => v.bed && v.bed.room).length });

  /* ───────── 시간 / 낮밤 ───────── */
  function updateClock(dt) {
    S.clock += dt; const c = S.clock;
    if (!S.isNight) { S.dark = U.smooth(T.day - 10, T.day, c) * 0.6 + (1 - U.smooth(0, 5, c)) * 0.35; S.sun = U.smooth(T.day - 18, T.day - 4, c); S.dawn = 1 - U.smooth(0, 9, c); if (c >= T.day) startNight(); }
    else { S.dark = 0.6 + U.smooth(0, 6, c) * 0.4 - U.smooth(T.night - 5, T.night, c) * 0.65; S.sun = 1 - U.smooth(0, 7, c); S.dawn = U.smooth(T.night - 5, T.night, c); if (c >= T.night) startDay(); }
    if (S.weather === 'fog') S.dark = Math.max(S.dark, 0.12);
  }
  function startNight() {
    S.isNight = true; S.clock = 0; S.spawnT = 3; S.sched = []; G.audio.sfx('night');
    const d = S.day, boss = d % 5 === 0; Game.banner(boss ? '⚠ 검은 안개 왕이 다가옵니다' : '밤이 찾아옵니다', boss ? '벽 뒤에서 맞서 싸우세요' : '괴물들이 몰려옵니다 — 벽 안에서 생명나무를 지키세요');
    const golems = Math.floor((d - 1) / 2) + (d >= 8 ? 1 : 0); for (let i = 0; i < golems; i++) S.sched.push({ t: 8 + (i * (T.night - 20)) / Math.max(1, golems), type: 'golem' });
    if (boss) { S.sched.push({ t: 9, type: 'boss' }); G.audio.sfx('boss'); }
  }
  function startDay() {
    S.isNight = false; S.clock = 0; S.day++; S.daySpawnT = 6; S.sleeping = false; G.audio.sfx('dawn');
    S.enemies.forEach((e) => { if (e.boss) return; e.dead = true; burst(e.x, e.y - e.r, 6, ['#6a5a80', '#fff3c0'], 60, 4, 'smoke'); });
    S.ebullets.length = 0; S.tree.hp = Math.min(S.tree.maxHp, S.tree.hp + S.tree.maxHp * 0.3); S.player.hp = Math.min(S.player.maxHp, S.player.hp + S.player.maxHp * 0.15);
    const r = Math.random; S.nodes.forEach((n) => { if (n.hp <= 0 && r() < 0.78) { n.hp = n.maxHp; if (n.kind === 'crystal') { for (let i = 0; i < 30; i++) { const x = 150 + r() * (WD.size - 300), y = 150 + r() * (WD.size - 300); if (U.dist2(x, y, WD.cx, WD.cy) > 900 * 900) { n.x = x; n.y = y; break; } } } } });
    const wr = r(); S.weather = wr < 0.5 ? 'clear' : wr < 0.7 ? 'wind' : wr < 0.88 ? 'rain' : 'fog';
    if (!G.save.best[S.diff.id] || G.save.best[S.diff.id] < S.day) G.save.best[S.diff.id] = S.day;
    const nv = S.villagers.length, need = nv * 2; let sub = '새 아침이 밝았습니다'; if (nv) { if (S.res.food >= need) { S.res.food -= need; S.vhungry = false; sub = `주민 ${nv}명이 아침을 먹었어요 (🍓-${need})`; } else { S.res.food = 0; S.vhungry = true; sub = '⚠ 식량이 모자라 주민들이 힘이 없어요'; } }
    Game.banner(`${S.day}일차 · ${G.WEATHER[S.weather].icon} ${G.WEATHER[S.weather].name}`, sub);
    G.ui.toast('📖 ' + G.DIARY[Math.min(S.day - 1, G.DIARY.length - 1)], 5200);
    if (S.day >= 2) Game.callSurvivor(true);
    if (S.day >= 3 && S.day % 2 === 1) setTimeout(() => { if (S && !S.over && !S.paused && !S.build) G.ui.showEvent(U.pick(G.EVENTS)); }, 1800);
    Game.saveRun();
  }

  /* ───────── 적 ───────── */
  function spawn(type, x, y) {
    const d = G.ENEMY[type], day = S.day, sc = S.diff;
    const hpMul = (1 + 0.2 * (day - 1) + (day > 10 ? (day - 10) * 0.12 : 0)) * sc.hp, dm = (1 + 0.08 * (day - 1)) * sc.dmg;
    const e = { type, x: U.clamp(x, 30, WD.size - 30), y: U.clamp(y, 30, WD.size - 30), vx: 0, vy: 0, kx: 0, ky: 0, hp: d.hp * hpMul * (d.boss ? 1 + (day / 5 - 1) * 0.9 : 1), dmg: d.dmg * dm, spd: d.spd * (0.9 + Math.random() * 0.2), r: d.r, seed: Math.random() * 10, flash: 0, slowT: 0, atkT: 1, spawnT: 0.5, trapT: 0, tree: !!d.tree, ranged: !!d.ranged, elite: !!d.elite, boss: !!d.boss, t1: 3, t2: 6 };
    e.maxHp = e.hp; S.enemies.push(e); if (e.boss) S.boss = e; return e;
  }
  function spawnRing(type, nearPlayer) { const c = nearPlayer ? S.player : treePos, a = Math.random() * TAU, d = 660 + Math.random() * 160; return spawn(type, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.85); }
  function pickType(onlyBasic) { const pool = Object.keys(G.ENEMY).filter((k) => G.ENEMY[k].w > 0 && G.ENEMY[k].from <= S.day && (!onlyBasic || k === 'dust' || k === 'beetle')); let tot = 0; pool.forEach((k) => (tot += G.ENEMY[k].w)); let r = Math.random() * tot; for (const k of pool) { r -= G.ENEMY[k].w; if (r <= 0) return k; } return 'dust'; }
  function updateSpawns(dt) {
    const alive = S.enemies.length, p = S.player;
    if (S.isNight) {
      for (let i = S.sched.length - 1; i >= 0; i--) if (S.clock >= S.sched[i].t) { const e = spawnRing(S.sched[i].type, false); if (e.boss) shake(10); S.sched.splice(i, 1); }
      S.spawnT -= dt; const cap = Math.min(90, (10 + S.day * 6) * S.diff.spawn);
      if (S.spawnT <= 0 && S.clock < T.night - 5) { S.spawnT = (Math.max(0.55, 2.6 - S.day * 0.17) / S.diff.spawn) * (1.7 - 0.7 * U.smooth(0, 16, S.clock)); if (alive < cap) spawnRing(pickType(false), U.dist2(p.x, p.y, WD.cx, WD.cy) > 700 * 700 && Math.random() < 0.6); }
    } else { S.daySpawnT -= dt; if (S.daySpawnT <= 0) { S.daySpawnT = 4.5 / S.diff.spawn; if (U.dist2(p.x, p.y, WD.cx, WD.cy) > 620 * 620 && alive < 3 + S.day) spawnRing(pickType(true), true); } }
  }
  Game.ambush = function (n) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; spawn('dust', treePos.x + Math.cos(a) * 420, treePos.y + Math.sin(a) * 340); } };

  function hitEnemy(e, base, kx, ky, kb, raw) {
    if (e.dead) return; let d = base * (raw ? 1 : S.stats.dmg) * (0.9 + Math.random() * 0.2); const crit = !raw && Math.random() < S.stats.crit; if (crit) d *= 2;
    e.hp -= d; e.flash = 0.1; const k = (kb == null ? 150 : kb) * (e.boss ? 0.08 : e.elite ? 0.3 : 1), len = Math.hypot(kx, ky) || 1; e.kx += (kx / len) * k; e.ky += (ky / len) * k;
    text(e.x, e.y - e.r * 2, Math.round(d) + (crit ? '!' : ''), crit ? '#ffd24a' : raw ? '#d8e6ff' : '#ffffff', crit ? 20 : 14); G.audio.sfx('hit'); if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; S.kills++; G.audio.sfx('kill'); burst(e.x, e.y - e.r, e.boss ? 40 : 8, ['#5a4a70', '#8a7aa8', '#fff3c0'], e.boss ? 260 : 110, e.boss ? 9 : 5, 'smoke'); const luck = 1 + S.stats.luck;
    if (Math.random() < 0.22 * luck) drop(Math.random() < 0.45 ? 'food' : Math.random() < 0.6 ? 'scrap' : 'wood', 1, e.x, e.y); if (Math.random() < 0.02 * luck) drop('heart', 20, e.x, e.y);
    if (e.elite) { drop('crystal', 1, e.x, e.y); if (Math.random() < 0.4 * luck) drop('crystal', 1, e.x, e.y); dropN('scrap', 6, e.x, e.y); shake(5); }
    if (e.boss) { for (let i = 0; i < 6 + Math.floor(S.day / 5) * 2; i++) drop('crystal', 1, e.x, e.y); drop('heart', 50, e.x, e.y); S.bossKills++; S.boss = null; shake(16); S.flash = 0.6; G.audio.sfx('boom'); Game.banner('검은 안개 왕을 물리쳤습니다!', '에테르 결정을 주우세요'); }
  }
  function hurtPlayer(dmg) {
    const p = S.player; if (p.iframes > 0 || p.dashT > 0 || S.over) return; S.sleeping = false;
    const d = Math.max(1, dmg * (1 - S.stats.armor)); p.hp -= d; p.iframes = 0.6; p.hurtT = 0.35; shake(7); G.audio.sfx('hurt'); text(p.x, p.y - 80, '-' + Math.round(d), '#ff6b6b', 17); burst(p.x, p.y - 25, 6, '#ff8a8a', 120, 4);
    if (p.hp <= 0) knockedOut('death');
  }
  function knockedOut(reason) {
    const p = S.player; if (S.diff.id === 'hardcore') { p.hp = 0; Game.end(reason); return; }
    const keep = meta('keep'), lost = []; if (!keep) ['wood', 'scrap', 'food'].forEach((k) => { const n = Math.floor(S.res[k] * 0.3); if (n) { S.res[k] -= n; lost.push(`${G.RES[k].icon}-${n}`); } });
    const h = homePos(); p.x = h.x; p.y = h.y; p.hp = p.maxHp * 0.5; p.hunger = Math.max(p.hunger, 45); p.iframes = 4; S.flash = 0.8; S.build = null; G.audio.sfx('lose');
    S.enemies.forEach((e) => { if (!e.boss && U.dist2(e.x, e.y, h.x, h.y) < 260 * 260) { e.kx = (e.x - h.x) * 3; e.ky = (e.y - h.y) * 3; } });
    Game.banner('😵 쓰러졌어요…', keep ? '모닥불 곁에서 정신을 차렸습니다 (숲의 가호: 자원 보존)' : '모닥불 곁에서 깨어났습니다. ' + (lost.length ? '잃은 자원: ' + lost.join(' ') : ''));
  }

  /* ───────── 플레이어 ───────── */
  function solidAt(tx, ty, friendly) { const o = S.obj.get(key(tx, ty)); return o && DEF[o.id].solid && !(friendly && DEF[o.id].door) ? o : null; }
  function updatePlayer(dt) {
    const p = S.player, inp = G.input; p.t += dt;
    let mx = inp.mx, my = inp.my; const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    p.moving = len > 0.12; if (p.moving) { const l = Math.hypot(mx, my) || 1; p.ldx = mx / l; p.ldy = my / l; if (Math.abs(mx) > 0.1) p.facing = mx > 0 ? 1 : -1; if (S.sleeping) S.sleeping = false; }
    p.dashCd -= dt; if (inp.dash && p.dashCd <= 0) { p.dashT = 0.2; p.dashCd = 2.2; G.audio.sfx('dash'); p.ddx = p.ldx; p.ddy = p.ldy; } inp.dash = false;
    let vx = mx * S.stats.speed, vy = my * S.stats.speed;
    if (p.dashT > 0) { p.dashT -= dt; vx = p.ddx * 600; vy = p.ddy * 600; if (Math.random() < 0.8) part({ x: p.x, y: p.y - 22, vx: 0, vy: 0, g: 0, life: 0, max: 0.3, size: 13, col: '#ffffff', kind: 'smoke' }); }
    p.x += vx * dt; p.y += vy * dt; if (p.moving) { p.walk += dt * 11; if (Math.sin(p.walk) > 0.96 && Math.random() < 0.5) part({ x: p.x, y: p.y, vx: -vx * 0.1, vy: -8, g: 0, life: 0, max: 0.4, size: 5, col: 'rgba(230,240,200,.7)', kind: 'smoke' }); }
    for (const s of S.solids) { if (s.node && s.node.hp <= 0) continue; const dx = p.x - s.x, dy = (p.y - s.y) * 1.5, rr = s.r + 11, d2 = dx * dx + dy * dy; if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), push = rr - d; p.x += (dx / d) * push; p.y += ((dy / d) * push) / 1.5; } }
    for (let pass = 0; pass < 2; pass++) { const ptx = tileOf(p.x), pty = tileOf(p.y - 5); for (let ty = pty - 1; ty <= pty + 1; ty++) for (let tx = ptx - 1; tx <= ptx + 1; tx++) { if (!solidAt(tx, ty, true)) continue; const cy = p.y - 5, nx = U.clamp(p.x, tx * TS, tx * TS + TS), ny = U.clamp(cy, ty * TS, ty * TS + TS), dx = p.x - nx, dy = cy - ny, d2 = dx * dx + dy * dy, R = 10; if (d2 >= R * R) continue; if (d2 > 0.0001) { const d = Math.sqrt(d2); p.x += (dx / d) * (R - d); p.y += (dy / d) * (R - d); } else { const c = { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS }; if (Math.abs(p.x - c.x) > Math.abs(cy - c.y)) p.x = c.x + Math.sign(p.x - c.x || 1) * (TS / 2 + R); else p.y = c.y + Math.sign(cy - c.y || 1) * (TS / 2 + R) + 5; } } }
    p.x = U.clamp(p.x, 40, WD.size - 40); p.y = U.clamp(p.y, 60, WD.size - 30);
    p.iframes -= dt; p.hurtT -= dt; if (p.atk > 0) p.atk -= dt * 4.2; if (p.swing > 0) p.swing -= dt * 3.4; p.atkCd -= dt;
    if (inp.attack && !S.build && p.atkCd <= 0 && p.dashT <= 0) swingTool();
    const wasHungry = p.hunger <= 0; p.hunger -= 0.9 * (1 + (S.char.mod.hunger || 0)) * S.diff.hunger * (S.weather === 'rain' ? 0.75 : 1) * (S.sleeping ? 0.4 : 1) * dt;
    if (p.hunger < 60 && S.res.food > 0) { S.res.food--; p.hunger += 10; text(p.x, p.y - 84, '🍓 냠', '#ffd0d8', 13); G.audio.sfx('eat'); }
    if (p.hunger <= 0) { p.hunger = 0; p.hp -= 2.5 * dt; if (p.hp <= 0 && !S.over) knockedOut('hunger'); }
    if (wasHungry !== p.hunger <= 0) Game.recalc();
    S.nearFire = S.structs.some((s) => s.id === 'fire' && U.dist2(p.x, p.y, (s.tx + 0.5) * TS, (s.ty + 0.5) * TS) < 150 * 150);
    const pk = key(tileOf(p.x), tileOf(p.y - 5)); S.inRoom = S.rooms.find((r) => r.tiles.has(pk)) || null;
    const regen = S.stats.regen + (p.hunger > 80 ? 0.6 : 0) + (S.nearFire ? 2.5 : 0) + (S.inRoom ? 1 : 0) + (S.sleeping ? 2 : 0); if (p.hunger > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  }
  function swingTool() {
    const p = S.player, tool = G.TOOLS[S.tool], t = nearestEnemy(p.x, p.y - 20, 140); let ax = p.ldx, ay = p.ldy;
    if (t) { ax = t.x - p.x; ay = t.y - t.r - (p.y - 24); } else if (G.input.mouse && G.input.mouse.on && S.view) { ax = S.view.x0 + G.input.mouse.x / S.view.sc - p.x; ay = S.view.y0 + G.input.mouse.y / S.view.sc - (p.y - 24); }
    const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l; if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1; p.atk = 1; p.atkCd = S.stats.atkCd; G.audio.sfx('swing'); S.sleeping = false;
    S.fx.push({ kind: 'slash', x: p.x + ax * 30, y: p.y - 26 + ay * 30, ang: Math.atan2(ay, ax), life: 0, max: 0.2 });
    let hit = 0; for (const e of S.enemies) { if (e.dead) continue; const dx = e.x - p.x, dy = e.y - e.r - (p.y - 24), d = Math.hypot(dx, dy); if (d < 86 + e.r && (dx * ax + dy * ay) / (d || 1) > 0.15) { hitEnemy(e, tool.dmg, dx, dy, 210); hit++; } } if (hit) shake(2.5);
  }
  function updateGather(dt) {
    const p = S.player; let best = null, bd = 1e9; if (S.build || p.atk > 0) return;
    for (const n of S.nodes) { if (n.shake > 0) n.shake -= dt; if (n.hp <= 0) continue; const dx = n.x - p.x, dy = n.y - p.y; if (Math.abs(dx) > 120 || Math.abs(dy) > 120) continue; const d = Math.hypot(dx, dy) - n.cr; if (d < 44 && d < bd) { bd = d; best = n; } }
    let farm = null; if (!best) for (const s of S.structs) { if (s.id !== 'farm' || s.grow < 1) continue; const c = sCenter(s), d = Math.hypot(c.x - p.x, c.y - (p.y - 5)); if (d < 62 && d < bd) { bd = d; farm = s; } }
    if (!best && !farm) { p.gatherT = Math.min(p.gatherT, 0.2); return; } p.gatherT -= dt * S.stats.gSpd; if (p.gatherT > 0) return; p.gatherT = 0.45; p.swing = 1;
    if (farm) { const c = sCenter(farm); farm.grow = 0; G.audio.sfx('chop'); burst(c.x, c.y - 8, 8, ['#7dbd62', '#f08a3c'], 120, 5, 'leaf', 240); dropN('food', 4 * S.stats.gYield, c.x, c.y); if (!p.moving) p.facing = c.x >= p.x ? 1 : -1; return; }
    if (!p.moving) p.facing = best.x >= p.x ? 1 : -1; best.hp--; best.shake = 0.3; const done = best.hp <= 0, y = S.stats.gYield;
    const K = { tree: ['wood', 2, 4, 'chop', ['#7dbd62', '#5a9d55', '#a8d97c'], 'leaf'], wreck: ['scrap', 2, 4, 'clang', ['#ffd98a', '#fff', '#aab6bd'], 'spark'], bush: ['food', 2, 2, 'chop', ['#7dbd62', '#e8546e'], 'leaf'], crystal: ['crystal', 0, 2, 'clang', ['#8fe9e4', '#fff'], 'spark'] }[best.kind];
    G.audio.sfx(K[3]); burst(best.x, best.y - 30 * (best.s || 1), 7, K[4], 130, 5, K[5], 260);
    const amt = best.kind === 'crystal' ? (done ? 2 + (Math.random() < 0.3 + S.stats.luck ? 1 : 0) : 0) : (K[1] + (done ? K[2] : 0)) * y; dropN(K[0], amt, best.x, best.y - 8); if (done) { shake(3); burst(best.x, best.y - 30, 10, K[4], 170, 6, K[5], 260); }
  }

  /* ───────── 시설 동작 (포탑·텃밭) ───────── */
  function updateStructs(dt) {
    for (const s of S.structs) {
      if (s.shake > 0) s.shake -= dt; if (s.snap > 0) s.snap -= dt;
      if (s.id === 'farm' && s.grow < 1) s.grow = Math.min(1, s.grow + (dt / 48) * (S.weather === 'rain' ? 1.6 : 1) * (S.isNight ? 0.35 : 1));
      if (s.id === 'turret') { s.cd -= dt; const c = sCenter(s), oy = c.y - 62, e = nearestEnemy(c.x, c.y, 350); if (e) { s.aim = Math.atan2(e.y - e.r - oy, e.x - c.x); if (s.cd <= 0) { s.cd = 0.95; S.shots.push({ x: c.x, y: oy, vx: Math.cos(s.aim) * 760, vy: Math.sin(s.aim) * 760, dmg: 15 + S.day * 0.6, life: 0.7, r: 8 }); G.audio.sfx('shoot'); } } else s.aim = null; }
    }
  }
  function updateShots(dt) {
    for (const s of S.shots) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; for (const e of S.enemies) { if (e.dead) continue; const rr = e.r + s.r; if (U.dist2(s.x, s.y, e.x, e.y - e.r) < rr * rr) { hitEnemy(e, s.dmg, s.vx, s.vy, 180, true); s.life = -1; break; } } }
    S.shots = S.shots.filter((s) => s.life > 0); const p = S.player;
    for (const b of S.ebullets) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (solidAt(tileOf(b.x), tileOf(b.y), false)) { b.life = -1; continue; } if (U.dist2(b.x, b.y, p.x, p.y - 24) < 18 * 18) { hurtPlayer(b.dmg); if (p.dashT <= 0) b.life = -1; } }
    S.ebullets = S.ebullets.filter((b) => b.life > 0);
  }

  /* ───────── 적 AI: 목표로 직진, 건물에 막히면 부순다 ───────── */
  function updateEnemies(dt) {
    const p = S.player, E = S.enemies; S.tree.alarm -= dt;
    for (let i = 0; i < E.length; i++) {
      const e = E[i]; if (e.dead) continue; e.flash -= dt; e.slowT -= dt; e.spawnT -= dt; e.atkT -= dt; e.trapT -= dt;
      const dp = Math.hypot(p.x - e.x, p.y - e.y), toTree = e.tree || (dp > 560 && S.isNight), tx = toTree ? treePos.x : p.x, ty = toTree ? treePos.y : p.y; let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      let sp = e.spd * (e.slowT > 0 ? 0.55 : 1);
      if (e.ranged && !toTree) { if (d < 230) sp *= -0.6; else if (d < 300) sp = 0; e.t1 -= dt; if (e.t1 <= 0 && d < 520) { e.t1 = 2.8; S.ebullets.push({ x: e.x, y: e.y - e.r * 1.5, vx: dx * 165, vy: ((ty - 24 - (e.y - e.r * 1.5)) / d) * 165, dmg: e.dmg, life: 4, r: 7 }); } }
      if (e.boss) { e.t1 -= dt; e.t2 -= dt; if (e.t1 <= 0) { e.t1 = 3.6; const n = 10 + Math.floor(S.day / 5) * 2; for (let k = 0; k < n; k++) { const a = (k / n) * TAU + S.time; S.ebullets.push({ x: e.x, y: e.y - e.r, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: e.dmg * 0.6, life: 5, r: 9 }); } G.audio.sfx('dash'); } if (e.t2 <= 0) { e.t2 = 7; for (let k = 0; k < 3; k++) spawn('dust', e.x + U.rand(-60, 60), e.y + U.rand(-40, 40)); } }
      if (toTree && d < e.r + 38) { sp = 0; if (e.atkT <= 0) { e.atkT = 1.2; S.tree.hp -= e.dmg * (e.tree ? 1 : 0.6); S.tree.shake = 0.3; S.tree.alarm = 2; S.lastRaid = S.time; burst(treePos.x, treePos.y - 40, 4, ['#a5e6b4', '#fff'], 100, 4, 'leaf', 200); if (!(S.tree.warnT > S.time)) { S.tree.warnT = S.time + 14; G.ui.toast('⚠️ 생명나무가 공격받고 있어요!', 3200); G.audio.sfx('deny'); } if (S.tree.hp <= 0) { S.tree.hp = 0; Game.end('tree'); return; } } }
      const look = e.r * 0.8 + 6, blk = sp > 0 ? solidAt(tileOf(e.x + dx * look), tileOf(e.y - 4 + dy * look), false) : null;
      if (blk) { sp = 0; if (e.atkT <= 0) { e.atkT = 0.9; blk.hp -= e.dmg * (e.boss ? 4 : e.elite ? 2 : 1); blk.shake = 0.25; S.lastRaid = S.time; const c = sCenter(blk); burst(c.x, c.y - 12, 3, ['#c9a06c', '#8a6646'], 90, 4, 'leaf', 200); G.audio.sfx('chop'); if (blk.hp <= 0) destroyStruct(blk); } }
      e.vx = dx * sp + e.kx; e.vy = dy * sp + e.ky; e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
      for (let j = i + 1; j < E.length; j++) { const o = E[j], ax = o.x - e.x; if (ax > 40 || ax < -40) continue; const ay = o.y - e.y; if (ay > 40 || ay < -40) continue; const rr = (e.r + o.r) * 0.85, d2 = ax * ax + ay * ay; if (d2 < rr * rr && d2 > 0.01) { const dd = Math.sqrt(d2), push = ((rr - dd) / dd) * 0.5, me = o.boss || o.elite ? 1 : 0.5, ot = e.boss || e.elite ? 1 : 0.5; e.x -= ax * push * me; e.y -= ay * push * me; o.x += ax * push * ot; o.y += ay * push * ot; } }
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; if (!solidAt(tileOf(nx), tileOf(ny - 4), false)) { e.x = nx; e.y = ny; } else { e.kx = e.ky = 0; }
      const under = S.obj.get(key(tileOf(e.x), tileOf(e.y - 4))); if (under && under.id === 'trap' && e.trapT <= 0) { e.trapT = 0.7; under.snap = 0.3; hitEnemy(e, 16 + S.day, 0, -1, 30, true); e.slowT = 0.8; if (--under.hp <= 0) destroyStruct(under); }
      if (e.spawnT <= 0) { const pr = e.r + 13; if (U.dist2(e.x, e.y, p.x, p.y) < pr * pr) hurtPlayer(e.dmg); }
      if (e.boss && Math.random() < 0.3) part({ x: e.x + U.rand(-50, 50), y: e.y - U.rand(0, 100), vx: 0, vy: -30, g: 0, life: 0, max: 0.8, size: 12, col: 'rgba(40,28,60,.5)', kind: 'smoke' });
    }
    if (S.tree.shake > 0) S.tree.shake -= dt; let w = 0; for (let i = 0; i < E.length; i++) if (!E[i].dead) E[w++] = E[i]; E.length = w;
  }

  /* ───────── 줍기 ───────── */
  function updatePickups(dt) {
    const p = S.player, R = S.stats.pickR; let w = 0;
    for (let i = 0; i < S.pickups.length; i++) {
      const k = S.pickups[i]; k.age += dt; if (k.z > 0 || k.vz > 0) { k.z += k.vz * dt; k.vz -= 600 * dt; k.x += k.vx * dt; k.y += k.vy * dt; if (k.z <= 0) { k.z = 0; k.vz = 0; k.vx = k.vy = 0; } }
      const dx = p.x - k.x, dy = p.y - 14 - k.y, d = Math.hypot(dx, dy) || 1; if (k.age > 0.35 && (d < R || k.mag)) { k.mag = true; const sp = 300 + k.age * 500; k.x += (dx / d) * sp * dt; k.y += (dy / d) * sp * dt; k.z *= 0.9; }
      if (k.mag && d < 18) { S.combo++; S.comboT = 0.8; if (k.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + k.val); text(p.x, p.y - 84, '+' + k.val + ' ❤', '#ff9aa8', 15); G.audio.sfx('pickup', 8); } else { S.res[k.kind] += k.val; G.audio.sfx('pickup', S.combo); text(p.x, p.y - 84, `+${k.val} ${G.RES[k.kind].icon}`, '#fff8d8', 13); G.ui.bump(k.kind); } continue; }
      S.pickups[w++] = k;
    }
    S.pickups.length = w;
  }

  /* ───────── 주민 ───────── */
  function makeVillager(id, x, y, job) { const v = { id, x, y, job: job || 'wood', state: 'idle', wait: 1, path: null, pi: 0, next: null, dest: { x, y }, node: null, farm: null, carry: null, workT: 0, swing: 0, swingT: 0, t: Math.random() * 5, walk: 0, facing: 1, moving: false, bed: null, cd: 0, stuck: 0 }; S.villagers.push(v); return v; }
  function blockedTile(x, y) { if (x < 0 || y < 0 || x >= GW || y >= GW) return true; const k = key(x, y); if (S.block[k]) return true; const o = S.obj.get(k); return !!(o && DEF[o.id].solid && !DEF[o.id].door); }
  function findPath(sx, sy, gx, gy) {
    if (blockedTile(gx, gy)) { let best = null, bd = 1e9; for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (blockedTile(gx + dx, gy + dy)) continue; const d = Math.hypot(gx + dx - sx, gy + dy - sy); if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } } if (!best) return null; gx = best[0]; gy = best[1]; }
    const start = key(sx, sy), goal = key(gx, gy); if (start === goal) return [[gx, gy]];
    const open = [start], g = new Map([[start, 0]]), f = new Map([[start, 0]]), came = new Map(), closed = new Set(); let pops = 0;
    while (open.length && pops++ < 2600) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i; const cur = open.splice(bi, 1)[0];
      if (cur === goal) { const path = []; let k = cur; while (k !== start) { path.push([k % GW, (k / GW) | 0]); k = came.get(k); } return path.reverse(); }
      closed.add(cur); const cx = cur % GW, cy = (cur / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (blockedTile(nx, ny)) continue; if (dx && dy && (blockedTile(cx + dx, cy) || blockedTile(cx, cy + dy))) continue; const nk = key(nx, ny); if (closed.has(nk)) continue; const ng = g.get(cur) + (dx && dy ? 1.41 : 1); if (g.has(nk) && ng >= g.get(nk)) continue; came.set(nk, cur); g.set(nk, ng); f.set(nk, ng + Math.hypot(gx - nx, gy - ny)); if (open.indexOf(nk) < 0) open.push(nk); }
    }
    return null;
  }
  function goTo(v, x, y, next) { v.path = findPath(tileOf(v.x), tileOf(v.y - 4), tileOf(x), tileOf(y)); v.pi = 0; v.dest = { x, y }; v.state = 'walk'; v.next = next; v.stuck = 0; }
  function pickTask(v) {
    const h = homePos(), kind = { wood: 'tree', scrap: 'wreck', farm: 'bush' }[v.job];
    if (v.job === 'farm') { let bf = null, bd = 1e18; for (const s of S.structs) if (s.id === 'farm' && s.grow >= 1 && !s.taken) { const c = sCenter(s), d = U.dist2(c.x, c.y, v.x, v.y); if (d < bd) { bd = d; bf = s; } } if (bf) { bf.taken = true; v.farm = bf; const c = sCenter(bf); goTo(v, c.x, c.y + TS * 0.8, 'work'); return; } }
    let best = null, bd = 1e18; for (const n of S.nodes) { if (n.hp <= 0 || n.kind !== kind || n.taken) continue; if (U.dist2(n.x, n.y, h.x, h.y) > 1150 * 1150) continue; const d = U.dist2(n.x, n.y, v.x, v.y); if (d < bd) { bd = d; best = n; } }
    if (best) { best.taken = true; v.node = best; goTo(v, best.x, best.y + best.cr + 22, 'work'); } else { const a = Math.random() * TAU; goTo(v, h.x + Math.cos(a) * 90, h.y + Math.sin(a) * 60, 'idle'); v.wait = 3; }
  }
  function updateVillagers(dt) {
    const wk = S.stats.work * (S.vhungry ? 0.5 : 1), h = homePos();
    for (const v of S.villagers) {
      v.t += dt; if (v.swing > 0) v.swing -= dt * 3; v.cd -= dt; v.moving = false;
      if (S.isNight && v.job !== 'guard' && !v.nightGo) { if (v.node) v.node.taken = false; if (v.farm) v.farm.taken = false; v.node = v.farm = null; const b = v.bed ? sCenter(v.bed) : h; goTo(v, b.x, b.y + (v.bed ? TS * 0.9 : 0), 'home'); v.nightGo = true; }
      if (!S.isNight && v.nightGo) { v.nightGo = false; v.state = 'idle'; v.wait = Math.random() * 2; }
      if (v.job === 'guard' && S.isNight) { const e = nearestEnemy(v.x, v.y, 330); if (e && U.dist2(e.x, e.y, h.x, h.y) < 620 * 620) { const dx = e.x - v.x, dy = e.y - v.y, d = Math.hypot(dx, dy) || 1; if (d > e.r + 34) { v.x += (dx / d) * 135 * dt; v.y += (dy / d) * 135 * dt; v.moving = true; v.walk += dt * 11; } v.facing = dx >= 0 ? 1 : -1; if (d < e.r + 46 && v.cd <= 0) { v.cd = 0.8; v.swing = 1; hitEnemy(e, 11 + S.day * 1.5, dx, dy, 160, true); } v.state = 'idle'; v.wait = 0.5; continue; } }
      if (v.state === 'idle') { v.wait -= dt; if (v.wait <= 0) { if (v.carry) goTo(v, h.x + U.rand(-30, 30), h.y + U.rand(-10, 20), 'deposit'); else if (v.job === 'guard') { const a = Math.random() * TAU, rad = S.isNight ? 150 : 110; goTo(v, h.x + Math.cos(a) * rad, h.y + Math.sin(a) * rad * 0.7, 'idle'); v.wait = 2 + Math.random() * 3; } else pickTask(v); } }
      else if (v.state === 'walk') {
        let tx, ty; if (v.path && v.pi < v.path.length) { tx = (v.path[v.pi][0] + 0.5) * TS; ty = (v.path[v.pi][1] + 0.5) * TS + 4; } else { tx = v.dest.x; ty = v.dest.y; }
        const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy); if (d < 7) { if (v.path && v.pi < v.path.length) v.pi++; else { v.state = v.next; v.workT = 5; if (v.next === 'idle' && !(v.wait > 0)) v.wait = 1; } }
        else { const sp = (v.carry ? 95 : 112) * (S.vhungry ? 0.75 : 1); v.x += (dx / d) * sp * dt; v.y += (dy / d) * sp * dt; v.moving = true; v.walk += dt * 10; if (Math.abs(dx) > 2) v.facing = dx > 0 ? 1 : -1; v.stuck += dt; if (v.stuck > 25) { v.x = v.dest.x; v.y = v.dest.y; } }
      } else if (v.state === 'work') {
        const tgt = v.farm ? sCenter(v.farm) : v.node; if (!tgt || (v.node && v.node.hp <= 0) || (v.farm && v.farm.grow < 1)) { if (v.node) v.node.taken = false; if (v.farm) v.farm.taken = false; v.node = v.farm = null; v.state = 'idle'; v.wait = 0.5; continue; }
        v.facing = tgt.x >= v.x ? 1 : -1; v.workT -= dt * wk; v.swingT -= dt; if (v.swingT <= 0) { v.swingT = 0.7; v.swing = 1; if (v.node) v.node.shake = 0.25; if (U.dist2(v.x, v.y, S.player.x, S.player.y) < 420 * 420) burst(tgt.x, tgt.y - 24, 3, v.job === 'scrap' ? ['#ffd98a', '#aab6bd'] : ['#7dbd62', '#a8d97c'], 90, 4, v.job === 'scrap' ? 'spark' : 'leaf', 220); }
        if (v.workT <= 0) { if (v.farm) { v.farm.grow = 0; v.farm.taken = false; v.carry = { kind: 'food', n: 4 }; v.farm = null; } else { v.node.hp = Math.max(0, v.node.hp - 2); v.node.taken = false; v.carry = { kind: { tree: 'wood', wreck: 'scrap', bush: 'food' }[v.node.kind], n: v.node.kind === 'tree' ? 6 : 5 }; v.node = null; } goTo(v, h.x + U.rand(-30, 30), h.y + U.rand(-10, 20), 'deposit'); }
      } else if (v.state === 'deposit') { if (v.carry) { const n = Math.round(v.carry.n * S.diff.yield); S.res[v.carry.kind] += n; text(v.x, v.y - 80, `+${n} ${G.RES[v.carry.kind].icon}`, '#d8ffb0', 13); G.ui.bump(v.carry.kind); v.carry = null; } v.state = 'idle'; v.wait = 0.6; }
    }
  }
  Game.callSurvivor = function (quiet) {
    if (S.survivor) return; const used = new Set(S.villagers.map((v) => v.id)); used.add(S.char.id); const left = G.CHAR_ORDER.filter((id) => !used.has(id)); if (!left.length) return;
    const ruins = S.props.filter((p) => p.ruin && U.dist2(p.x, p.y, WD.cx, WD.cy) < 1500 * 1500), spot = ruins.length ? U.pick(ruins) : { x: WD.cx + 900, y: WD.cy };
    S.survivor = { id: U.pick(left), x: spot.x + U.rand(-40, 40), y: spot.y + 58 }; if (!quiet || S.day <= 3) G.ui.toast(`📡 어디선가 구조 신호가! 지도에 노란 점으로 표시됩니다 (${G.CHARS[S.survivor.id].name})`, 5000);
  };
  function recruit() {
    const bed = S.structs.find((s) => s.id === 'bed' && s.room && !S.villagers.some((v) => v.bed === s)), sv = S.survivor, name = G.CHARS[sv.id].name;
    if (!bed) { G.ui.toast(`${name}: "잘 곳이 없으면 따라갈 수 없어… 벽과 문으로 둘러싼 방에 침대를 놓아 줘!"`, 5000); G.audio.sfx('deny'); return; }
    const jobs = Object.keys(G.JOBS), v = makeVillager(sv.id, sv.x, sv.y, jobs[S.villagers.length % 3]); v.bed = bed; bed.owner = sv.id; S.survivor = null; G.audio.sfx('levelup'); burst(v.x, v.y - 40, 16, ['#fff3c0', '#d8ff8a', '#ffd0dc'], 180, 5, 'spark');
    Game.banner(`🤝 ${name} 합류!`, `${G.JOBS[v.job].icon} ${G.JOBS[v.job].name} 일을 시작합니다 (말을 걸어 바꿀 수 있어요)`); Game.saveRun();
  }

  /* ───────── 상호작용 (E) ───────── */
  function updateInteract() {
    const p = S.player; let best = null, bd = 1e9; const tryIt = (type, x, y, r, label, ref) => { const d = Math.hypot(x - p.x, y - (p.y - 10)); if (d < r && d < bd) { bd = d; best = { type, label, ref }; } };
    if (S.survivor) tryIt('survivor', S.survivor.x, S.survivor.y - 20, 90, `🤝 ${G.CHARS[S.survivor.id].name} 데려가기`, S.survivor);
    for (const v of S.villagers) tryIt('villager', v.x, v.y - 20, 64, `💬 ${G.CHARS[v.id].name}`, v);
    for (const s of S.structs) { if (s.id === 'bench') { const c = sCenter(s); tryIt('bench', c.x, c.y, 92, '🛠️ 작업대', s); } else if (s.id === 'bed' && S.isNight && !S.villagers.some((v) => v.bed === s)) { const c = sCenter(s); tryIt('bed', c.x, c.y, 80, '🛏️ 잠자기', s); } }
    tryIt('tree', treePos.x, treePos.y - 10, 120, '🌳 생명나무', null); S.interact = S.build ? null : best;
  }
  Game.interact = function () {
    const it = S.interact; if (!it || S.over) return;
    if (it.type === 'survivor') recruit(); else if (it.type === 'villager') G.ui.showVillager(it.ref); else if (it.type === 'bench') G.ui.showCraft(); else if (it.type === 'tree') G.ui.showTree();
    else if (it.type === 'bed') { if (!S.inRoom) { G.ui.toast('지붕 있는 집 안에서만 잘 수 있어요'); return; } if (nearestEnemy(S.player.x, S.player.y, 380)) { G.ui.toast('괴물이 너무 가까워서 잠들 수 없어요!'); G.audio.sfx('deny'); return; } S.sleeping = true; G.ui.toast('💤 잠이 듭니다… (움직이면 깹니다)', 2500); }
  };
  Game.craft = function (kind) {
    const list = kind === 'tool' ? G.TOOLS : G.ARMORS, cur = kind === 'tool' ? S.tool : S.armor, nx = kind === 'lantern' ? G.LANTERN : list[cur + 1]; if (!nx || (kind === 'lantern' && S.lantern)) return false;
    if (!Game.canAfford(nx.cost)) { G.audio.sfx('deny'); return false; } pay(nx.cost); if (kind === 'tool') S.tool++; else if (kind === 'armor') S.armor++; else S.lantern = 1; G.audio.sfx('build'); Game.recalc(); return true;
  };
  Game.treeCost = () => (S.treeLv >= 5 ? null : G.TREE_COST(S.treeLv));
  Game.upgradeTree = function () {
    const c = Game.treeCost(); if (!c || !Game.canAfford(c)) { G.audio.sfx('deny'); return false; } pay(c); S.treeLv++; G.audio.sfx('build'); burst(treePos.x, treePos.y - 40, 24, ['#fff3c0', '#a5e6b4', '#eaffd8'], 240, 6, 'spark', 200); S.fx.push({ kind: 'ring', x: treePos.x, y: treePos.y, r0: 10, r1: 190, life: 0, max: 0.6, col: '#eaffd8' });
    const nm = 250 + S.treeLv * 150; S.tree.maxHp = nm; S.tree.hp = nm; Game.recalc(); if (S.treeLv >= 5 && !S.won) setTimeout(() => Game.win(), 900); return true;
  };

  /* ───────── 종료 ───────── */
  function payout(won) { const tot = Math.floor(((S.day - 1) * 12 + S.kills * 0.2 + S.bossKills * 40 + S.treeLv * 10 + S.built * 0.4 + S.villagers.length * 15 + (won || S.won ? 150 : 0)) * S.diff.reward); const gain = Math.max(0, tot - S.paid); S.paid += gain; G.save.seeds += gain; if (!G.save.best[S.diff.id] || G.save.best[S.diff.id] < S.day) G.save.best[S.diff.id] = S.day; G.persist(); return gain; }
  Game.win = function () { if (!S || S.over || S.won) return; S.won = true; S.paused = true; S.build = null; G.save.wins[S.diff.id] = (G.save.wins[S.diff.id] || 0) + 1; const gain = payout(true); G.audio.sfx('win'); S.flash = 1; S.enemies.length = 0; S.boss = null; Game.saveRun(); G.ui.showEnd('win', gain); };
  Game.end = function (reason) { if (S.over) return; S.over = true; S.build = null; const gain = payout(false); G.save.run = null; G.persist(); G.audio.sfx('lose'); G.ui.showEnd(reason, gain); };
  Game.giveUp = function () { if (S && !S.over) Game.end('quit'); };

  /* ───────── 업데이트 ───────── */
  function step(dt) {
    S.time += dt; updateClock(dt); updatePlayer(dt); if (S.over) return; updateGather(dt); updateStructs(dt); updateSpawns(dt); updateEnemies(dt); if (S.over) return; updateShots(dt); updatePickups(dt); updateVillagers(dt);
    let w = 0; for (const q of S.parts) { q.life += dt; if (q.life >= q.max) continue; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= 0.97; S.parts[w++] = q; } S.parts.length = w;
    S.fx = S.fx.filter((f) => (f.life += dt) < f.max); S.texts = S.texts.filter((t) => { t.life -= dt; t.y -= 34 * dt; return t.life > 0; });
  }
  Game.update = function (dt) {
    if (!S || S.over || S.paused) return; G.audio.mood = S.boss ? 'boss' : S.isNight ? 'night' : 'day';
    if (S.sleeping && (!S.isNight || S.time - S.lastRaid < 1.5 || nearestEnemy(S.player.x, S.player.y, 260))) { if (S.isNight) G.ui.toast('❗ 소란에 잠이 깼어요'); S.sleeping = false; }
    const n = S.sleeping ? 6 : 1; for (let i = 0; i < n && !S.over; i++) step(dt); if (S.over) return;
    if (G.input.place) { G.input.place = false; Game.tryPlace(); } updateGhost(); updateInteract();
    for (const r of S.rooms) r.alpha += ((S.inRoom === r ? 0 : 1) - r.alpha) * Math.min(1, dt * 7);
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30); if (S.flash > 0) S.flash -= dt * 1.6; if (S.banner) { S.banner.t += dt; if (S.banner.t > 3.4) S.banner = null; }
    S.clouds.forEach((c) => { c.x += 14 * dt * (S.weather === 'wind' ? 3 : 1); if (c.x > WD.size + 400) c.x = -400; });
    const p = S.player, cam = S.cam, k = 1 - Math.pow(0.002, dt); cam.x += (p.x + p.ldx * (p.moving ? 40 : 0) - cam.x) * k; cam.y += (p.y - 30 + p.ldy * (p.moving ? 30 : 0) - cam.y) * k;
    S.saveT -= dt; if (S.saveT <= 0) { S.saveT = 30; Game.saveRun(); }
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
    ctx.fillStyle = roadPat; if (ROAD.vx + 85 > x0 && ROAD.vx - 85 < x1) { ctx.save(); ctx.translate(ROAD.vx - 85, 0); ctx.fillRect(0, y0, 170, vh); ctx.restore(); }
    if (ROAD.hy + 85 > y0 && ROAD.hy - 85 < y1) { ctx.save(); ctx.translate(0, ROAD.hy + 85); ctx.rotate(-Math.PI / 2); ctx.fillRect(0, x0, 170, vw); ctx.restore(); }
    const gx = treePos.x, gy = treePos.y + 10; if (gx + 200 > x0 && gx - 200 < x1 && gy + 170 > y0 && gy - 170 < y1) { ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.78); const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 170); g.addColorStop(0, 'rgba(214,186,140,.8)'); g.addColorStop(0.7, 'rgba(206,180,130,.45)'); g.addColorStop(1, 'rgba(206,180,130,0)'); ctx.fillStyle = g; ctx.fillRect(-180, -180, 360, 360); ctx.restore(); }
    const tx0 = tileOf(x0) - 1, tx1 = tileOf(x1) + 1, ty0 = tileOf(y0) - 1, ty1 = tileOf(y1) + 2;
    for (const s of S.structs) if (DEF[s.id].floorLayer && s.tx >= tx0 && s.tx <= tx1 && s.ty >= ty0 && s.ty <= ty1) A.drawFloorTile(ctx, s.tx * TS, s.ty * TS, TS);
    const wind = S.weather === 'wind' ? 1 : S.weather === 'rain' ? 0.5 : 0.15;
    for (const g of S.tufts) { if (g.x < x0 - 20 || g.x > x1 + 20 || g.y < y0 - 5 || g.y > y1 + 30) continue; const tk = key(tileOf(g.x), tileOf(g.y - 2)); if (S.floor.has(tk) || S.obj.has(tk)) continue; A.drawTuft(ctx, g, t, wind); }
    if (S.build && S.ghost) { ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.beginPath(); const g = S.ghost; for (let i = -4; i <= 5; i++) { ctx.moveTo((g.tx + i) * TS, (g.ty - 4) * TS); ctx.lineTo((g.tx + i) * TS, (g.ty + 5) * TS); ctx.moveTo((g.tx - 4) * TS, (g.ty + i) * TS); ctx.lineTo((g.tx + 5) * TS, (g.ty + i) * TS); } ctx.stroke(); }
    const list = [], vis = (o, m) => o.x > x0 - m && o.x < x1 + m && o.y > y0 - 40 && o.y < y1 + m * 1.6;
    for (const o of S.props) if (vis(o, 160)) list.push([o.y, 0, o]);
    for (const o of S.nodes) if (vis(o, 110)) list.push([o.y, 1, o]);
    for (const o of S.enemies) if (vis(o, 90)) list.push([o.y, 2, o]);
    for (const o of S.pickups) if (vis(o, 20)) list.push([o.y - 2, 3, o]);
    list.push([treePos.y, 4, null]);
    for (const s of S.structs) { const d = DEF[s.id]; if (d.floorLayer || s.tx + s.w < tx0 || s.tx > tx1 || s.ty < ty0 || s.ty > ty1) continue; list.push([d.solid ? (s.ty + 1) * TS - 2 : s.id === 'torch' ? (s.ty + 1) * TS - 6 : s.ty * TS + 2, 8, s]); }
    for (const v of S.villagers) if (vis(v, 80)) list.push([v.y, 9, v]);
    if (S.survivor && vis(S.survivor, 80)) list.push([S.survivor.y, 10, S.survivor]);
    list.push([p.y, 6, p]); list.sort((a, b) => a[0] - b[0]);
    const pc = { x: p.x, y: p.y, t: p.t, walk: p.walk, moving: p.moving, facing: p.facing, pal: S.char.pal, hurtT: p.hurtT, dashT: p.dashT, swing: p.swing, atk: p.atk, sleep: S.sleeping, seed: 0 };
    for (const it of list) {
      switch (it[1]) {
        case 0: A.drawProp(ctx, it[2]); break;
        case 1: { const n = it[2]; if (n.kind === 'tree') { const hide = p.y < n.y && p.y > n.y - 115 * n.s && Math.abs(p.x - n.x) < 48 * n.s; n.fa = U.lerp(n.fa == null ? 1 : n.fa, hide ? 0.4 : 1, 0.15); } A.drawNode(ctx, n, t); break; }
        case 2: A.drawEnemy(ctx, it[2], t); break; case 3: A.drawPickup(ctx, it[2], t); break;
        case 4: A.drawBuilding(ctx, 'tree', S.treeLv, treePos.x, treePos.y, t, S.tree); break;
        case 8: { const s = it[2], o = {}; if (s.id === 'door') o.open = U.dist2(p.x, p.y, (s.tx + 0.5) * TS, (s.ty + 0.5) * TS) < 70 * 70 || S.villagers.some((v) => U.dist2(v.x, v.y, (s.tx + 0.5) * TS, (s.ty + 0.5) * TS) < 60 * 60); if (s.id === 'bed') { const ow = S.villagers.find((v) => v.bed === s); if (ow) { o.label = G.CHARS[ow.id].name; o.blanket = G.CHARS[ow.id].pal.scarf; } else if (!s.room) o.label = '방이 아님'; } A.drawStruct(ctx, s, DEF[s.id], TS, t, o); break; }
        case 9: { const v = it[2]; A.drawChar(ctx, { x: v.x, y: v.y, t: v.t, walk: v.walk, moving: v.moving, facing: v.facing, pal: G.CHARS[v.id].pal, swing: v.swing, scale: 0.92, seed: 0, sleep: v.state === 'home' }); break; }
        case 10: { const sv = it[2]; A.drawChar(ctx, { x: sv.x, y: sv.y, t: t + 2, walk: 0, moving: false, facing: p.x >= sv.x ? 1 : -1, pal: G.CHARS[sv.id].pal, scale: 0.92, seed: 0 }); const by = sv.y - 118 + Math.sin(t * 4) * 4; A.circ(ctx, sv.x, by, 13); ctx.fillStyle = '#ffe27a'; ctx.fill(); ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#4a3a30'; ctx.font = '18px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', sv.x, by + 6); break; }
        case 6: if (p.iframes > 1) A.glow(ctx, p.x, p.y - 28, 50, '#eaffd8', 0.6); A.drawChar(ctx, pc); break;
      }
    }
    for (const r of S.rooms) A.drawRoof(ctx, r.roof, GW, TS, r.alpha * 0.97);
    ctx.textAlign = 'center'; ctx.font = '11px Jua, sans-serif';
    for (const v of S.villagers) { if (!vis(v, 80) || v.state === 'home') continue; const nm = `${G.JOBS[v.job].icon} ${G.CHARS[v.id].name}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,30,25,.7)'; ctx.strokeText(nm, v.x, v.y - 100); ctx.fillStyle = '#fff8e7'; ctx.fillText(nm, v.x, v.y - 100); if (v.carry) { ctx.font = '15px sans-serif'; ctx.fillText(G.RES[v.carry.kind].icon, v.x + v.facing * 18, v.y - 50); ctx.font = '11px Jua, sans-serif'; } }
    for (const s of S.structs) if (s.hp < s.maxHp && s.id !== 'trap' && s.tx >= tx0 && s.tx <= tx1 && s.ty >= ty0 && s.ty <= ty1) { const c = sCenter(s); ctx.fillStyle = 'rgba(40,30,30,.6)'; ctx.fillRect(c.x - 17, s.ty * TS - 40, 34, 5); ctx.fillStyle = s.hp / s.maxHp < 0.35 ? '#ff8a6b' : '#ffd98a'; ctx.fillRect(c.x - 16, s.ty * TS - 39, 32 * (s.hp / s.maxHp), 3); }
    for (const e of S.enemies) if (e.elite && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(40,30,30,.6)'; ctx.fillRect(e.x - 22, e.y - e.r * 2.9, 44, 5); ctx.fillStyle = '#ff8a6b'; ctx.fillRect(e.x - 21, e.y - e.r * 2.9 + 1, 42 * (e.hp / e.maxHp), 3); }
    if (S.build && S.ghost) {
      const g = S.ghost;
      if (S.build === 'remove') { const s = g.target, gx0 = (s ? s.tx : g.tx) * TS, gw = (s ? s.w : 1) * TS; ctx.fillStyle = s ? 'rgba(255,90,80,.4)' : 'rgba(255,255,255,.15)'; ctx.fillRect(gx0, g.ty * TS, gw, TS); ctx.strokeStyle = '#ff5a50'; ctx.lineWidth = 3; ctx.strokeRect(gx0 + 1.5, g.ty * TS + 1.5, gw - 3, TS - 3); }
      else { const d = DEF[S.build], w = (d.w || 1) * TS; ctx.fillStyle = g.ok ? 'rgba(140,255,150,.3)' : 'rgba(255,90,80,.35)'; ctx.fillRect(g.tx * TS, g.ty * TS, w, TS); ctx.globalAlpha = 0.65; if (d.floorLayer) A.drawFloorTile(ctx, g.tx * TS, g.ty * TS, TS); else A.drawStruct(ctx, { id: S.build, tx: g.tx, ty: g.ty, w: d.w || 1, hp: 1, maxHp: 1, grow: 0.5 }, d, TS, t, {}); ctx.globalAlpha = 1; ctx.strokeStyle = g.ok ? '#7dff8a' : '#ff5a50'; ctx.lineWidth = 2.5; ctx.strokeRect(g.tx * TS + 1, g.ty * TS + 1, w - 2, TS - 2); }
    }
    for (const s of S.shots) { ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); ctx.stroke(); A.circ(ctx, s.x, s.y, 2.5); ctx.fillStyle = '#d8dde0'; ctx.fill(); }
    for (const b of S.ebullets) { A.glow(ctx, b.x, b.y, b.r * 2.6, '#c46bd9', 0.7); A.circ(ctx, b.x, b.y, b.r * 0.62); ctx.fillStyle = '#f6d8ff'; ctx.fill(); }
    for (const f of S.fx) {
      const q = f.life / f.max;
      if (f.kind === 'ring') { const r = U.lerp(f.r0, f.r1, 1 - (1 - q) * (1 - q)); ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.7); ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = f.col || '#ffd98a'; ctx.lineWidth = 5 * (1 - q) + 1; A.circ(ctx, 0, 0, r); ctx.stroke(); ctx.restore(); }
      else if (f.kind === 'slash') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7 * (1 - q) + 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-14, 0, 52 + q * 14, -1.0, 1.0); ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,160,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-14, 0, 60 + q * 14, -0.8, 0.8); ctx.stroke(); ctx.restore(); }
    }
    for (const q of S.parts) {
      const a = 1 - q.life / q.max; ctx.globalAlpha = a; ctx.fillStyle = q.col;
      if (q.kind === 'leaf') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + q.life * 8); A.ell(ctx, 0, 0, q.size, q.size * 0.45); ctx.fill(); ctx.restore(); }
      else if (q.kind === 'smoke') { A.circ(ctx, q.x, q.y, q.size * (0.6 + (1 - a) * 1.1)); ctx.fill(); }
      else if (q.kind === 'spark') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size * 0.9, -q.size * 0.18, q.size * 1.8, q.size * 0.36); ctx.fillRect(-q.size * 0.18, -q.size * 0.9, q.size * 0.36, q.size * 1.8); ctx.restore(); }
      else { A.circ(ctx, q.x, q.y, q.size * a); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    const dayA = (1 - S.dark) * 0.24; if (dayA > 0.03) { ctx.globalAlpha = dayA; for (const c of S.clouds) { const w = c.s * 2.6, h = w * 0.5; if (c.x + w / 2 < x0 || c.x - w / 2 > x1 || c.y + h / 2 < y0 || c.y - h / 2 > y1) continue; ctx.drawImage(A.cloudShadow(c.v), c.x - w / 2, c.y - h / 2, w, h); } ctx.globalAlpha = 1; }
    if (S.tree.hp < S.tree.maxHp || S.isNight) { const tw = 84, ty = treePos.y - 70 - S.treeLv * 24; ctx.fillStyle = 'rgba(40,40,30,.55)'; A.rr(ctx, treePos.x - tw / 2, ty, tw, 8, 4); ctx.fill(); ctx.fillStyle = S.tree.alarm > 0 && Math.sin(t * 20) > 0 ? '#ff8a6b' : '#a5e6b4'; A.rr(ctx, treePos.x - tw / 2 + 1.5, ty + 1.5, Math.max(4, (tw - 3) * (S.tree.hp / S.tree.maxHp)), 5, 2.5); ctx.fill(); }

    /* ── 화면 공간 ── */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (S.sun > 0.01) { ctx.fillStyle = `rgba(255,140,70,${S.sun * 0.2})`; ctx.fillRect(0, 0, W, H); }
    if (S.dawn > 0.01) { ctx.fillStyle = `rgba(255,190,190,${S.dawn * 0.16})`; ctx.fillRect(0, 0, W, H); }
    if (S.dark > 0.02) {
      const lw = Math.ceil(W / 2), lh = Math.ceil(H / 2); if (!lightC) { lightC = document.createElement('canvas'); lctx = lightC.getContext('2d'); } if (lightC.width !== lw || lightC.height !== lh) { lightC.width = lw; lightC.height = lh; }
      lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, lw, lh); lctx.fillStyle = `rgba(14,18,46,${S.dark * 0.84 * (1 - Math.max(0, S.flash) * 0.7)})`; lctx.fillRect(0, 0, lw, lh);
      lctx.globalCompositeOperation = 'destination-out'; const L = (wx, wy, r, a) => { if (wx + r < x0 || wx - r > x1 || wy + r < y0 || wy - r > y1) return; A.glow(lctx, ((wx - x0) * sc) / 2, ((wy - y0) * sc) / 2, (r * sc) / 2, '#ffffff', a); };
      const pr = S.lantern ? 300 : 200; L(p.x, p.y - 26, pr, 1); L(p.x, p.y - 26, pr * 0.55, 0.8); L(treePos.x, treePos.y - 50, 150 + S.treeLv * 26, 0.9);
      for (const s of S.structs) { const li = DEF[s.id].light; if (!li) continue; const c = sCenter(s), fr = li + Math.sin(t * 11 + s.tx) * 7; L(c.x, c.y - 14, fr, 1); L(c.x, c.y - 14, fr * 0.55, 0.9); }
      for (const n of S.nodes) if (n.kind === 'crystal' && n.hp > 0) L(n.x, n.y - 18, 90, 0.8); for (const k2 of S.pickups) if (k2.kind === 'crystal') L(k2.x, k2.y - 6, 26, 0.5); for (const b of S.ebullets) L(b.x, b.y, 34, 0.6); if (S.survivor) L(S.survivor.x, S.survivor.y - 40, 80, 0.7);
      ctx.drawImage(lightC, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; for (const s of S.structs) if (s.id === 'fire') { const c = sCenter(s), fx = (c.x - x0) * sc, fy = (c.y - 14 - y0) * sc; if (fx > -300 && fx < W + 300 && fy > -300 && fy < H + 300) A.glow(ctx, fx, fy, 230 * sc, '#ff9a4a', S.dark * 0.2); } ctx.globalCompositeOperation = 'source-over';
    }
    drawWeather(ctx, W, H, t);
    if (S.sleeping) { ctx.fillStyle = 'rgba(10,14,40,.45)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '26px Jua, sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const q = (t * 0.6 + i / 3) % 1; ctx.globalAlpha = 1 - q; ctx.fillText('z', (p.x - x0) * sc + 26 + q * 26 + i * 4, (p.y - 96 - y0) * sc - q * 50); } ctx.globalAlpha = 1; }
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, S.flash)})`; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75), low = p.hp / p.maxHp < 0.3 ? 0.3 + Math.sin(t * 6) * 0.15 : 0; vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, low ? `rgba(190,30,40,${low + 0.2})` : 'rgba(20,30,50,.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.lineJoin = 'round'; for (const q of S.texts) { const sx = (q.x - x0) * sc, sy = (q.y - y0) * sc; ctx.globalAlpha = Math.min(1, q.life * 2.5); ctx.font = `${Math.round(q.size * Math.max(0.85, sc))}px Jua, sans-serif`; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(50,35,30,.85)'; ctx.strokeText(q.txt, sx, sy); ctx.fillStyle = q.col; ctx.fillText(q.txt, sx, sy); } ctx.globalAlpha = 1;
    const arrow = (wx, wy, icon, alarm) => { const hx = (wx - x0) * sc, hy = (wy - y0) * sc; if (hx >= 0 && hx <= W && hy >= 0 && hy <= H) return; const a = Math.atan2(hy - H / 2, hx - W / 2), rx = W / 2 - 46, ry = H / 2 - 46, kk = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6)), ax = W / 2 + Math.cos(a) * kk, ay = H / 2 + Math.sin(a) * kk; ctx.save(); ctx.translate(ax, ay); A.circ(ctx, 0, 0, 19); ctx.fillStyle = alarm && Math.sin(t * 16) > 0 ? '#ff8a6b' : 'rgba(255,250,235,.92)'; ctx.fill(); ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 2; ctx.stroke(); ctx.font = '17px sans-serif'; ctx.fillStyle = '#4a3a30'; ctx.fillText(icon, 0, 6); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(21, -7); ctx.lineTo(21, 7); ctx.closePath(); ctx.fill(); ctx.restore(); };
    arrow(treePos.x, treePos.y, S.tree.alarm > 0 ? '⚠️' : '🏕️', S.tree.alarm > 0); if (S.survivor) arrow(S.survivor.x, S.survivor.y - 40, '🆘', false);
  };

  function drawWeather(ctx, W, H, t) {
    const wx = S.wx, we = S.weather, night = S.dark > 0.5;
    if (we === 'rain') { ctx.strokeStyle = 'rgba(200,225,255,.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 40; i++) for (let k = 0; k < 3; k++) { const q = wx[i], x = ((q.x + k * 0.37 + t * 0.12 * q.sp) % 1) * (W + 100) - 50, y = ((q.y + k * 0.31 + t * 1.5 * q.sp) % 1) * (H + 60) - 30; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 20); } ctx.stroke(); ctx.fillStyle = 'rgba(60,80,120,.1)'; ctx.fillRect(0, 0, W, H); }
    if (we === 'fog') for (let i = 0; i < 9; i++) { const q = wx[i], x = ((q.x + t * 0.012 * q.sp) % 1) * (W + 600) - 300, y = q.y * H; A.glow(ctx, x, y, 260 + q.s * 160, '#eef4f4', 0.34); }
    const nLeaf = we === 'wind' ? 22 : 6; for (let i = 0; i < nLeaf; i++) { const q = wx[i + 10], sp = we === 'wind' ? 0.28 : 0.07, x = ((q.x + t * sp * q.sp) % 1) * (W + 80) - 40, y = ((q.y + t * 0.03 + Math.sin(t * 1.3 + q.ph) * 0.02) % 1) * H; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2.4 * q.sp + q.ph); ctx.fillStyle = i % 3 ? 'rgba(140,200,110,.85)' : 'rgba(240,190,110,.85)'; A.ell(ctx, 0, 0, 6 * q.s, 2.6 * q.s); ctx.fill(); ctx.restore(); }
    if (night) for (let i = 0; i < 16; i++) { const q = wx[i + 22], x = ((q.x + Math.sin(t * 0.3 * q.sp + q.ph) * 0.05 + 1) % 1) * W, y = ((q.y + Math.cos(t * 0.23 * q.sp + q.ph) * 0.05 + 1) % 1) * H; A.glow(ctx, x, y, 9 * q.s, '#e8ff9a', (0.5 + Math.sin(t * 2.2 + q.ph * 3) * 0.5) * 0.8); }
    else if (we === 'clear') for (let i = 0; i < 10; i++) { const q = wx[i + 22], x = ((q.x + t * 0.01 * q.sp) % 1) * W, y = ((q.y + Math.sin(t * 0.4 + q.ph) * 0.04 + 1) % 1) * H; A.glow(ctx, x, y, 5 * q.s, '#fffbe0', 0.5); }
  }
})();
