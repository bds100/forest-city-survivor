/* 아트 — 모든 그림을 코드로 그립니다 (지브리풍 수채 팔레트 + Live2D식 파츠 애니메이션) */
(function () {
  const G = window.G;
  const A = (G.art = {});
  const OUT = '#4a3a30';
  const TAU = Math.PI * 2;

  /* ───────── 유틸 ───────── */
  const U = (G.util = {
    rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
    dist2: (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    rand: (a, b) => a + Math.random() * (b - a),
  });

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function fs(ctx, fill, stroke, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke !== null) { ctx.strokeStyle = stroke || OUT; ctx.lineWidth = lw || 1.3; ctx.stroke(); } }
  A.ell = ell; A.circ = circ; A.rr = rr;

  /* 글로우 스프라이트 캐시 */
  const glows = {};
  A.glow = function (ctx, x, y, r, color, alpha) {
    let g = glows[color];
    if (!g) {
      g = glows[color] = canvas(128, 128); const c = g.getContext('2d');
      const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, color); gr.addColorStop(0.35, color + 'aa'); gr.addColorStop(1, color + '00');
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    }
    const pa = ctx.globalAlpha; ctx.globalAlpha = pa * (alpha == null ? 1 : alpha);
    ctx.drawImage(g, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = pa;
  };
  A.shadow = function (ctx, x, y, rx, ry) { ell(ctx, x, y, rx, ry); ctx.fillStyle = 'rgba(28,52,48,.24)'; ctx.fill(); };

  /* ───────── 바닥 텍스처 (이음매 없는 타일) ───────── */
  A.makeGround = function () {
    const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), r = U.rng(7);
    ctx.fillStyle = '#8ac46c'; ctx.fillRect(0, 0, S, S);
    const wrap = (x, y, rad, fn) => { for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) { if (x + ox + rad < 0 || x + ox - rad > S || y + oy + rad < 0 || y + oy - rad > S) continue; fn(x + ox, y + oy); } };
    const tones = ['#9fd47c', '#7ab75e', '#94cc70', '#6fae58', '#b3dc86', '#82bd6a'];
    for (let i = 0; i < 150; i++) {
      const x = r() * S, y = r() * S, rad = 30 + r() * 80, col = tones[(r() * tones.length) | 0];
      wrap(x, y, rad, (px, py) => { const g = ctx.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, col + '88'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2); });
    }
    // 붓터치 풀잎
    ctx.lineCap = 'round';
    for (let i = 0; i < 520; i++) {
      const x = r() * S, y = r() * S, h = 4 + r() * 6, lean = (r() - 0.5) * 5;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(70,130,70,.35)' : 'rgba(190,230,140,.4)'; ctx.lineWidth = 1.2;
      wrap(x, y, 8, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + lean * 0.3, py - h * 0.6, px + lean, py - h); ctx.stroke(); });
    }
    // 작은 들꽃
    for (let i = 0; i < 46; i++) {
      const x = r() * S, y = r() * S, col = ['#fff8e6', '#ffe27a', '#ffd0dc', '#d8e6ff'][(r() * 4) | 0];
      wrap(x, y, 4, (px, py) => { ctx.fillStyle = col; for (let k = 0; k < 5; k++) { circ(ctx, px + Math.cos(k * 1.256) * 2, py + Math.sin(k * 1.256) * 2, 1.3); ctx.fill(); } ctx.fillStyle = '#f2b84b'; circ(ctx, px, py, 1); ctx.fill(); });
    }
    return c;
  };

  /* 갈라진 옛 도로 타일 (세로 방향으로 반복, 가로는 가장자리 페이드) */
  A.makeRoad = function () {
    const W = 170, H = 256, c = canvas(W, H), ctx = c.getContext('2d'), r = U.rng(21);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(176,170,156,0)'); g.addColorStop(0.16, 'rgba(176,170,156,.95)'); g.addColorStop(0.84, 'rgba(168,163,150,.95)'); g.addColorStop(1, 'rgba(168,163,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(250,246,225,.7)'; for (let y = 10; y < H; y += 64) { rr(ctx, W / 2 - 3, y, 6, 30, 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(80,80,72,.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { let x = 25 + r() * (W - 50), y = r() * H; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 26; y += 6 + r() * 12; ctx.lineTo(x, y); } ctx.stroke(); }
    for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, rad = 5 + r() * 14, edge = Math.abs(x - W / 2) / (W / 2); if (r() > edge + 0.15) continue; ctx.fillStyle = ['rgba(122,183,94,.75)', 'rgba(148,204,112,.7)', 'rgba(100,160,84,.7)'][(r() * 3) | 0]; circ(ctx, x, y, rad); ctx.fill(); }
    return c;
  };

  /* ───────── 구름 (지브리식 뭉게구름) ───────── */
  function cloudShape(seed, n) { const r = U.rng(seed), b = []; for (let i = 0; i < n; i++) { const tx = i / (n - 1); b.push({ x: (tx - 0.5) * 2, y: -Math.sin(tx * Math.PI) * (0.35 + r() * 0.35) - r() * 0.1, r: 0.22 + Math.sin(tx * Math.PI) * 0.22 + r() * 0.1 }); } return b; }
  function drawCloud(ctx, shape, x, y, s, shade, light) {
    ctx.fillStyle = shade; shape.forEach((b) => { circ(ctx, x + b.x * s, y + b.y * s + s * 0.07, b.r * s); ctx.fill(); });
    ctx.fillRect(x - s * 0.95, y - s * 0.02, s * 1.9, s * 0.14);
    ctx.fillStyle = light; shape.forEach((b) => { circ(ctx, x + b.x * s - s * 0.03, y + b.y * s - s * 0.04, b.r * s * 0.9); ctx.fill(); });
  }

  /* 뭉게구름 모양 그림자 (한 덩어리 실루엣, 가장자리 부드럽게) */
  const cloudShadows = {};
  A.cloudShadow = function (v) {
    if (cloudShadows[v]) return cloudShadows[v];
    const W = 640, H = 320, c = canvas(W, H), ctx = c.getContext('2d'), r = U.rng(500 + v * 17), tmp = canvas(W, H), tc = tmp.getContext('2d');
    tc.fillStyle = '#1e3c5a'; const cx = W / 2, cy = H / 2, a = W * 0.3, b = H * 0.2, n = 13 + ((r() * 4) | 0);
    ell(tc, cx, cy, a, b); tc.fill();
    for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2 + r() * 0.3, up = Math.sin(ang) < 0, rad = (up ? 46 : 30) + r() * (up ? 34 : 18); circ(tc, cx + Math.cos(ang) * a * (0.85 + r() * 0.2), cy + Math.sin(ang) * b * (up ? 1.15 : 0.9), rad); tc.fill(); }
    for (let i = 0; i < 3; i++) { circ(tc, cx + (r() - 0.5) * a, cy - b * (0.9 + r() * 0.5), 40 + r() * 26); tc.fill(); }
    try { ctx.filter = 'blur(9px)'; } catch (e) { /* 미지원 브라우저 */ }
    ctx.drawImage(tmp, 0, 0); ctx.filter = 'none';
    return (cloudShadows[v] = c);
  };

  /* ───────── 타이틀 장면 (패럴랙스) ───────── */
  let TS = null;
  function initTitle() {
    const r = U.rng(99); TS = { clouds: [], far: [], near: [], grass: [], motes: [], birds: [] };
    for (let i = 0; i < 7; i++) TS.clouds.push({ x: r(), y: 0.12 + r() * 0.36, s: 0.1 + r() * 0.16, sp: 0.004 + r() * 0.006, shape: cloudShape(100 + i, 7 + ((r() * 4) | 0)) });
    let x = -0.05; while (x < 1.05) { const w = 0.03 + r() * 0.05; TS.far.push({ x, w, h: 0.12 + r() * 0.24, cut: r(), tree: r() < 0.5 }); x += w + r() * 0.025; }
    x = -0.05; while (x < 1.05) { const w = 0.05 + r() * 0.07; TS.near.push({ x, w, h: 0.1 + r() * 0.2, cut: r(), win: r(), tree: r() < 0.7 }); x += w + 0.02 + r() * 0.07; }
    for (let i = 0; i < 90; i++) TS.grass.push({ x: r(), h: 0.03 + r() * 0.05, ph: r() * 6, c: r() });
    for (let i = 0; i < 26; i++) TS.motes.push({ x: r(), y: r(), s: 1 + r() * 2.5, sp: 0.01 + r() * 0.02, ph: r() * 6 });
    for (let i = 0; i < 5; i++) TS.birds.push({ x: r(), y: 0.18 + r() * 0.2, sp: 0.012 + r() * 0.01, ph: r() * 6 });
    TS.treeBlobs = treeBlobs(U.rng(5), 1);
  }
  function ruinTower(ctx, x, base, w, h, cut, col, W) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h);
    const steps = 4; for (let i = 1; i <= steps; i++) { const px = x + (w * i) / steps, py = base - h + (((cut * 97 * i) % 1) * h * 0.22); ctx.lineTo(px - w / steps, py); ctx.lineTo(px, py); }
    ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
  }
  A.drawTitleScene = function (ctx, W, H, t, charPal) {
    if (!TS) initTitle();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5fa9e0'); sky.addColorStop(0.45, '#a6daf4'); sky.addColorStop(0.72, '#fbf1d6'); sky.addColorStop(1, '#f7e2b6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    A.glow(ctx, W * 0.78, H * 0.2, Math.max(W, H) * 0.5, '#fff6d0', 0.8);
    TS.clouds.forEach((c) => { const cx = (((c.x + t * c.sp) % 1.3) - 0.15) * W; drawCloud(ctx, c.shape, cx, c.y * H, c.s * Math.min(W, H * 1.3), '#bcd2ee', '#ffffff'); });
    TS.birds.forEach((b) => { const bx = (((b.x + t * b.sp) % 1.2) - 0.1) * W, by = b.y * H + Math.sin(t + b.ph) * 8, f = Math.sin(t * 7 + b.ph) * 4; ctx.strokeStyle = 'rgba(70,80,100,.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bx - 7, by - f); ctx.quadraticCurveTo(bx - 3, by - 3, bx, by); ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by - f); ctx.stroke(); });
    const hz = H * 0.7;
    // 먼 폐허 스카이라인
    TS.far.forEach((b) => { ruinTower(ctx, b.x * W, hz, b.w * W, b.h * H, b.cut, '#a9c8dd', W); if (b.tree) { ctx.fillStyle = '#9ccab0'; circ(ctx, (b.x + b.w * 0.5) * W, hz - b.h * H, b.w * W * 0.45); ctx.fill(); } });
    ctx.fillStyle = 'rgba(255,248,225,.35)'; ctx.fillRect(0, hz - H * 0.3, W, H * 0.3);
    // 가까운 폐허 (덩굴로 뒤덮인 빌딩)
    const px = Math.sin(t * 0.1) * 6;
    TS.near.forEach((b) => {
      const bx = b.x * W + px, bw = b.w * W, bh = b.h * H + H * 0.06; ruinTower(ctx, bx, hz + H * 0.04, bw, bh, b.cut, '#86aeb0', W);
      ctx.fillStyle = 'rgba(60,90,100,.35)'; for (let wy = 0; wy < 5; wy++) for (let wx = 0; wx < 3; wx++) { if (((b.win * 31 * (wy + 2) * (wx + 3)) % 1) < 0.35) continue; const yy = hz - bh + bh * 0.3 + wy * bh * 0.13; if (yy > hz) continue; ctx.fillRect(bx + bw * (0.16 + wx * 0.28), yy, bw * 0.14, bh * 0.07); }
      ctx.fillStyle = '#7fb27a'; for (let k = 0; k < 5; k++) { circ(ctx, bx + bw * ((b.cut * 13 * (k + 1)) % 1), hz - bh * (0.75 - k * 0.12) + bh * 0.2, bw * 0.16); ctx.fill(); }
      if (b.tree) { ctx.fillStyle = '#6fa56e'; circ(ctx, bx + bw * 0.4, hz - bh + bh * 0.22, bw * 0.3); ctx.fill(); ctx.fillStyle = '#8cc283'; circ(ctx, bx + bw * 0.33, hz - bh + bh * 0.18, bw * 0.2); ctx.fill(); }
    });
    // 언덕들
    const hill = (yb, amp, ph, c1, c2) => { const g = ctx.createLinearGradient(0, yb - amp, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, yb - Math.sin(x / W * 5 + ph) * amp - Math.sin(x / W * 11 + ph * 2) * amp * 0.3); ctx.lineTo(W, H); ctx.fill(); };
    hill(hz + H * 0.05, H * 0.03, 1, '#9bd080', '#7dbb68');
    // 기울어진 송전탑
    ctx.save(); ctx.translate(W * 0.63, hz + H * 0.06); ctx.rotate(-0.13); ctx.strokeStyle = 'rgba(95,120,120,.75)'; ctx.lineWidth = 2; const ph = H * 0.24;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, -ph); ctx.lineTo(4, -ph); ctx.lineTo(14, 0); for (let k = 1; k < 5; k++) { const yy = -ph * k / 5, ww = 14 - k * 2; ctx.moveTo(-ww, yy); ctx.lineTo(ww, yy - ph / 5); ctx.moveTo(ww, yy); ctx.lineTo(-ww, yy - ph / 5); } ctx.moveTo(-26, -ph * 0.86); ctx.lineTo(26, -ph * 0.86); ctx.stroke(); ctx.restore();
    hill(hz + H * 0.13, H * 0.035, 2.6, '#86c56c', '#5fa457');
    // 앞 언덕 + 큰 나무
    const fy = H * 0.9; hill(fy, H * 0.03, 4, '#79bb60', '#4d934c');
    const k = Math.min(W, H * 1.4) / 900;
    ctx.save(); ctx.translate(W * 0.84, fy - H * 0.01); ctx.scale(k * 3.3, k * 3.3); drawTreeLive(ctx, TS.treeBlobs, t, 0, 1); ctx.restore();
    // 묘목 + 캐릭터
    const cx = Math.max(W * 0.22, 150 * k), cy = fy - Math.sin(cx / W * 5 + 4) * H * 0.03 + 6;
    ctx.save(); ctx.translate(cx + 120 * k, cy + 4); ctx.scale(k * 1.7, k * 1.7); A.drawBuilding(ctx, 'tree', 2, 0, 0, t); ctx.restore();
    A.drawChar(ctx, { x: cx, y: cy, t, walk: 0, moving: false, facing: 1, scale: k * 3.1, pal: charPal, seed: 1, wind: 1 });
    // 앞 풀
    TS.grass.forEach((g) => { const gx = g.x * W, gh = g.h * H, sway = Math.sin(t * 1.6 + g.ph + gx * 0.01) * gh * 0.35; ctx.strokeStyle = g.c < 0.5 ? '#3f8447' : '#5fa457'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx, H + 4); ctx.quadraticCurveTo(gx + sway * 0.3, H - gh * 0.6, gx + sway, H - gh); ctx.stroke(); });
    TS.motes.forEach((m) => { const mx = ((m.x + t * m.sp) % 1) * W, my = ((m.y + Math.sin(t * 0.5 + m.ph) * 0.03) % 1) * H; A.glow(ctx, mx, my, m.s * 5, '#fffbe0', 0.55 + Math.sin(t * 2 + m.ph) * 0.3); });
  };

  /* ───────── 이미지 캐릭터 (assets/chars/<id>.png 가 있으면 코드 그림 대신 사용) ─────────
     한 장짜리 그림을 숨쉬기·걷기 바운스·기울임으로 움직입니다. <id>_walk1/2.png 가 있으면 걷기 프레임으로 사용 */
  A.charImg = {};
  A.loadCharSprites = function (ids) {
    ids.forEach((id) => { const im = new Image(); im.onload = () => { A.charImg[id] = im; ['_walk1', '_walk2'].forEach((s) => { const w = new Image(); w.onload = () => { A.charImg[id + s] = w; }; w.src = 'assets/chars/' + id + s + '.png'; }); }; im.src = 'assets/chars/' + id + '.png'; });
  };
  /* 이미지 분석: 아래쪽에서 위로 훑으며 두 다리 사이의 빈틈을 찾아 '다리 시작 높이'와 '좌우 분할선'을 구함 */
  function analyzeSprite(img) {
    const w = img.width, h = img.height, an = { legTop: 0.8, split: 0.5, gap: false, cx: 0.5 };
    let d; try { const cv = canvas(w, h), c = cv.getContext('2d'); c.drawImage(img, 0, 0); d = c.getImageData(0, 0, w, h).data; } catch (e) { return an; }
    const minRun = Math.max(3, w * 0.04), splits = []; let topRow = h, miss = 0;
    for (let y = h - 3; y > h * 0.5; y--) {
      const runs = []; let st = -1, hole = 0;
      for (let x = 0; x <= w; x++) { const on = x < w && d[(y * w + x) * 4 + 3] > 90; if (on) { if (st < 0) st = x; hole = 0; } else if (st >= 0 && (++hole > 2 || x === w)) { if (x - hole - st + 1 >= minRun) runs.push([st, x - hole]); st = -1; hole = 0; } }
      if (runs.length >= 2) { runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])); const two = runs.slice(0, 2).sort((a, b) => a[0] - b[0]); splits.push((two[0][1] + two[1][0]) / 2); topRow = y; miss = 0; }
      else if (splits.length && ++miss > h * 0.015) break;
      else if (!splits.length && h - y > h * 0.14) break;
    }
    if (splits.length >= 6) { splits.sort((a, b) => a - b); an.gap = true; an.split = splits[splits.length >> 1] / w; an.legTop = Math.max(0.55, topRow / h); }
    let sx = 0, n = 0; for (let y = (h * 0.3) | 0; y < h * 0.7; y += 3) for (let x = 0; x < w; x += 3) if (d[(y * w + x) * 4 + 3] > 90) { sx += x; n++; } if (n) an.cx = sx / n / w;
    return an;
  }
  /* Live2D식 메시 변형: 가로 띠로 나눠 그리며 띠마다 위치·폭·높이를 다르게 → 머리 끄덕임/상체 호흡/머리카락·모자 지연 흔들림/다리 교차 */
  function drawCharSprite(ctx, c, base) {
    const img = base, an = img._an || (img._an = analyzeSprite(img));
    const t = c.t + (c.seed || 0), k = c.scale || 1, mv = c.moving, ph = c.walk, breath = Math.sin(t * 2.4);
    const H = 102, s = H / img.height, W = img.width * s, N = 84, sh = img.height / N, headEnd = 0.36;
    const stepS = mv ? Math.sin(ph) : 0, stepC = mv ? Math.cos(ph) : 0, bob = mv ? Math.abs(Math.cos(ph)) * 2.4 : 0;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k); A.shadow(ctx, 0, 0, 16 - bob, 5.5 - bob * 0.4);
    if (c.hurtT > 0 && ((c.hurtT * 20) | 0) % 2) ctx.globalAlpha = 0.45;
    ctx.scale(c.facing || 1, 1); if (c.dashT > 0) ctx.scale(1.16, 0.88);
    ctx.translate(0, -bob); ctx.rotate((mv ? 0.045 : 0) + (c.swing > 0 ? Math.sin(c.swing * Math.PI) * 0.2 : 0));
    const cxPx = an.cx * W, splitSrc = an.split * img.width, legSpan = Math.max(0.05, 1 - an.legTop);
    let yb = 2;
    for (let i = N - 1; i >= 0; i--) {
      const v = (i + 0.5) / N, up = 1 - v; let dh = sh * s;
      if (v > headEnd && v < 0.64) dh *= 1 + breath * 0.022; if (v < headEnd) dh *= 1 + Math.sin(t * 1.2) * 0.006;
      const y0 = yb - dh; yb = y0;
      let dx = Math.sin(t * 1.3) * 1.5 * Math.pow(up, 1.5) + (mv ? -stepS * 1.3 * up : 0), ws = 1;
      if (v < headEnd) { const hv = (headEnd - v) / headEnd; dx += (Math.sin(t * 1.7 + 0.6) * 1.5 + (mv ? Math.sin(ph * 1 - 0.9) * 2.2 : 0)) * hv + Math.sin(t * 2.6 + 1.4) * 0.9 * hv * hv; ws = 1 + Math.sin(t * 0.9) * 0.014 * hv; }
      else if (v < 0.64) ws = 1 + breath * 0.014;
      const sy = i * sh, shh = Math.min(sh + 1, img.height - sy), dhh = dh + 0.8;
      if (an.gap && v > an.legTop) {
        const lv = (v - an.legTop) / legSpan, sw = stepS * 7.5 * lv, liftL = Math.max(0, stepC) * 5 * lv, liftR = Math.max(0, -stepC) * 5 * lv, dSplit = splitSrc * s;
        ctx.drawImage(img, 0, sy, splitSrc, shh, -cxPx + dx + sw, y0 - liftL, dSplit, dhh);
        ctx.drawImage(img, splitSrc, sy, img.width - splitSrc, shh, -cxPx + dSplit + dx - sw, y0 - liftR, W - dSplit, dhh);
      } else { if (!an.gap && mv && v > 0.58) dx += stepS * 4.2 * Math.sin(((v - 0.58) / 0.42) * Math.PI * 0.85); const dw = W * ws; ctx.drawImage(img, 0, sy, img.width, shh, -cxPx * ws + dx, y0, dw, dhh); }
    }
    ctx.restore();
  }

  /* ───────── 캐릭터 (지브리풍 SD · 파츠 애니메이션) ─────────
     수채 느낌의 부드러운 음영 / 흰자가 보이는 단순한 눈 / 따뜻한 갈색 외곽선 */
  const CO = 'rgba(84,60,46,.92)';
  function cfs(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = CO; ctx.lineWidth = lw || 1.05; ctx.stroke(); }
  function ghEye(ctx, x, y, rx, ry, col) {
    ell(ctx, x, y, rx, ry); ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.save(); ell(ctx, x, y, rx, ry); ctx.clip();
    ell(ctx, x + 0.35, y + 0.5, rx * 0.8, ry * 0.88); ctx.fillStyle = col; ctx.fill();
    ell(ctx, x + 0.35, y + 0.7, rx * 0.42, ry * 0.5); ctx.fillStyle = '#231816'; ctx.fill();
    ctx.fillStyle = 'rgba(60,40,40,.18)'; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 0.5);
    ctx.restore();
    ctx.fillStyle = '#fff'; circ(ctx, x - rx * 0.22, y - ry * 0.32, rx * 0.33); ctx.fill();
    ctx.strokeStyle = '#3a2a26'; ctx.lineWidth = 1.35; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,50,.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
  const FRINGE = {
    straw: [[15.5, 2, 13, -4.5], [10, -0.5, 6.5, -6], [2.5, -2, -1.5, -6.5], [-5.5, -2, -9, -6], [-12.5, 0, -14.5, -4], [-16, 3, -17, 1]],
    goggles: [[15.5, 2.5, 13, -4], [10.5, 0, 8, -5], [5, -1, 2, -6], [-1, -1.5, -4, -6], [-7.5, -1, -10.5, -5], [-13.5, 1, -17, 1]],
    beanie: [[15.5, 1, 13, -5], [9, -2, 5, -6.5], [1, -2.5, -3, -6.5], [-7, -2, -11, -5.5], [-14.5, 0, -17, 1]],
    helmet: [[15, 0, 12, -6], [6, -4.5, 0, -7], [-6, -4.5, -12, -6], [-15, 0, -17, 1]],
    sprout: [[16.5, 5, 14.5, -3], [8, -3.8, 0, -4.2], [-8, -3.8, -13.5, -3], [-16.5, 5, -17, 1]],
  };
  A.drawChar = function (ctx, c) {
    if (A.charImg[c.pal.sid]) return drawCharSprite(ctx, c, A.charImg[c.pal.sid]);
    const pal = c.pal, hat = pal.hat, t = c.t + (c.seed || 0), k = c.scale || 1;
    const breath = Math.sin(t * 2.4), walk = c.moving ? Math.sin(c.walk) : 0, bounce = c.moving ? Math.abs(Math.sin(c.walk)) * 2.6 : 0;
    const wind = (c.wind || 0.4) + (c.moving ? 1 : 0), hw = Math.sin(t * 2.2) * (1.2 + wind * 1.4);
    const bt = t % 3.9, blink = bt < 0.14 || (bt > 0.3 && bt < 0.42 && ((t / 3.9) | 0) % 3 === 0);
    const hood = hat === 'cat' || hat === 'rain';
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k); A.shadow(ctx, 0, 0, 15 - bounce, 5.5 - bounce * 0.4);
    if (c.hurtT > 0 && ((c.hurtT * 20) | 0) % 2) ctx.globalAlpha = 0.45;
    ctx.scale(c.facing || 1, 1); if (c.dashT > 0) ctx.scale(1.16, 0.88);
    ctx.rotate(c.moving ? 0.06 : 0); ctx.translate(0, -bounce); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hy = -45 - breath * 0.8, tilt = Math.sin(t * 1.1) * 0.03 + (c.moving ? 0.05 : 0);
    const head = (fn) => { ctx.save(); ctx.translate(0.5, hy); ctx.rotate(tilt); fn(); ctx.restore(); };
    const grad = (y0, y1, c0, c1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
    const hairFill = () => grad(-20, 22, pal.hairLight, pal.hair);

    // ── 뒤쪽: 꼬리 / 목도리 자락 / 뒷머리 / 후드
    if (hat === 'cat') { const tw = Math.sin(t * 2.6) * 4; ctx.beginPath(); ctx.moveTo(-8, -13); ctx.bezierCurveTo(-20, -10, -25 + tw * 0.5, -22, -21 + tw, -32); ctx.bezierCurveTo(-19 + tw, -36, -15 + tw, -34, -17 + tw * 0.8, -29); ctx.bezierCurveTo(-19, -20, -14, -17, -7, -18); ctx.closePath(); cfs(ctx, pal.top); ctx.fillStyle = '#fff6e6'; circ(ctx, -19.5 + tw, -32.5, 2.6); ctx.fill(); }
    else if (!hood) { const tail = () => { ctx.beginPath(); ctx.moveTo(-5, -30); for (let i = 1; i <= 5; i++) ctx.lineTo(-6 - i * (2.8 + wind * 2.2), -30 + Math.sin(t * (4 + wind * 2) - i * 0.9) * (0.8 + i * 0.7) + i * (2.6 - wind * 1.1)); ctx.stroke(); }; ctx.strokeStyle = CO; ctx.lineWidth = 6.2; tail(); ctx.strokeStyle = pal.scarf; ctx.lineWidth = 4.4; tail(); }
    head(() => {
      if (hat === 'straw') { ctx.beginPath(); ctx.moveTo(-16, -8); ctx.bezierCurveTo(-23, 4, -22 - wind * 2, 18, -18 - wind * 3, 28 + hw); ctx.quadraticCurveTo(-11 - wind * 2, 32 + hw, -7 - wind, 26 + hw * 0.6); ctx.quadraticCurveTo(-1, 31, 6, 25); ctx.bezierCurveTo(13, 22, 17, 10, 16, -6); ctx.closePath(); cfs(ctx, hairFill()); }
      if (hat === 'sprout') { ctx.beginPath(); ctx.moveTo(-17, -6); ctx.bezierCurveTo(-22, 4, -21, 14, -16.5 + hw * 0.3, 19); ctx.quadraticCurveTo(0, 23, 16.5 + hw * 0.3, 18); ctx.bezierCurveTo(21, 12, 21, 2, 17, -6); ctx.closePath(); cfs(ctx, hairFill()); }
      if (hood) { if (hat === 'rain') { ctx.beginPath(); ctx.moveTo(-8, -17); ctx.quadraticCurveTo(-19, -27 + hw * 0.4, -22, -21 + hw * 0.5); ctx.quadraticCurveTo(-19, -12, -17, -6); ctx.closePath(); cfs(ctx, pal.topShade); } ell(ctx, 0, -1, 20, 18.5); cfs(ctx, pal.topShade); }
    });
    // 배낭
    rr(ctx, -18, -30, 11, 17, 4.5); cfs(ctx, grad(-30, -13, pal.pack, pal.packShade || pal.pack)); rr(ctx, -19, -34.5, 13, 6.5, 3.2); cfs(ctx, '#e8d8b2'); ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, -16.5, -27, 3, 8, 1.5); ctx.fill();
    // 다리 + 신발
    for (let s = -1; s <= 1; s += 2) { const sw = walk * s * 4.2, lift = Math.max(0, walk * s) * 3; rr(ctx, s * 4.6 - 3 + sw, -12 - lift, 6, 9, 2.6); cfs(ctx, pal.leg); if (pal.socks) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(s * 4.6 - 2.5 + sw, -7.2 - lift, 5, 2.6); } rr(ctx, s * 4.6 - 4.2 + sw, -5 - lift, 10, 6, 3); cfs(ctx, pal.boot); ctx.fillStyle = 'rgba(255,255,255,.25)'; ell(ctx, s * 4.6 + 2.5 + sw, -3.4 - lift, 1.8, 1); ctx.fill(); }
    // 뒤팔
    ctx.save(); ctx.translate(-6.5, -27); ctx.rotate(0.3 - walk * 0.7); rr(ctx, -2.6, 0, 5.2, 10.5, 2.6); cfs(ctx, pal.topShade); circ(ctx, 0, 11, 2.4); cfs(ctx, pal.skin, 0.9); ctx.restore();
    // 몸통 (의상)
    const top = -29.5 - breath * 0.5, by = -9, of = pal.outfit;
    const body = () => { ctx.beginPath(); ctx.moveTo(-6.5, top); ctx.quadraticCurveTo(-8.5, top + 9, -12.5, by); ctx.quadraticCurveTo(0, by + 3.8, 12.5, by); ctx.quadraticCurveTo(8.5, top + 9, 6.5, top); ctx.closePath(); };
    body(); ctx.fillStyle = grad(top, by, pal.top, pal.topShade); ctx.fill(); ctx.save(); body(); ctx.clip();
    if (of === 'overall') { ctx.fillStyle = grad(-21, -6, pal.bottom, pal.bottomShade || pal.bottom); ctx.fillRect(-14, -20.5, 28, 18); rr(ctx, -5, -26, 10, 7, 1.6); ctx.fill(); ctx.strokeStyle = pal.bottom; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(-4, top); ctx.lineTo(-4.4, -24); ctx.moveTo(4, top); ctx.lineTo(4.4, -24); ctx.stroke(); ctx.fillStyle = '#ecd08a'; circ(ctx, -3.6, -24.4, 1.1); ctx.fill(); circ(ctx, 3.6, -24.4, 1.1); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-12, -11.2); ctx.quadraticCurveTo(0, -7.4, 12, -11.2); ctx.stroke(); }
    else if (of === 'jacket') { ctx.fillStyle = 'rgba(80,50,30,.18)'; ctx.fillRect(-14, -13, 28, 8); ctx.fillStyle = '#6b4a36'; ctx.fillRect(-14, -16.5, 28, 3); ctx.fillStyle = '#ecd08a'; rr(ctx, -1.8, -17.3, 3.6, 4.4, 1); ctx.fill(); ctx.strokeStyle = 'rgba(90,64,52,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0.5, top); ctx.lineTo(0.5, -17); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, 3.5, -24.5, 4.5, 3.6, 1); ctx.fill(); }
    else if (of === 'poncho') { ctx.fillStyle = pal.topShade; for (let i = -2; i <= 2; i++) { circ(ctx, i * 6, by + 1.5, 3.6); ctx.fill(); } ctx.fillStyle = '#f3dc9a'; [[-5, -20], [5.5, -16], [-1, -13.5]].forEach((p) => { circ(ctx, p[0], p[1], 1.1); ctx.fill(); }); }
    else if (of === 'raincoat') { ctx.strokeStyle = 'rgba(120,80,20,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0.5, top); ctx.lineTo(0.5, by + 3); ctx.stroke(); ctx.fillStyle = '#b9822a'; [-24.5, -19.5, -14.5].forEach((y) => { circ(ctx, 2.6, y, 1.15); ctx.fill(); }); ctx.strokeStyle = 'rgba(120,80,20,.45)'; ctx.beginPath(); ctx.moveTo(-9.5, -15); ctx.lineTo(-4, -15.6); ctx.moveTo(5, -15.6); ctx.lineTo(10, -15); ctx.stroke(); }
    else if (of === 'hoodie') { rr(ctx, -6.5, -18, 13, 6.5, 2.6); ctx.fillStyle = 'rgba(40,60,40,.2)'; ctx.fill(); ctx.strokeStyle = 'rgba(60,50,40,.35)'; ctx.lineWidth = 0.9; ctx.stroke(); ctx.fillStyle = 'rgba(40,60,40,.22)'; ctx.fillRect(-14, -12, 28, 6); ctx.strokeStyle = '#f4ecd6'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2.4, top + 3); ctx.lineTo(-3, -21.5 + Math.sin(t * 3) * 0.4); ctx.moveTo(3.2, top + 3); ctx.lineTo(3.8, -22.5 + Math.cos(t * 3) * 0.4); ctx.stroke(); }
    else if (of === 'vest') { ctx.fillStyle = pal.vest; ctx.fillRect(-14, -32, 11.5, 22); ctx.fillRect(3.5, -32, 11, 22); ctx.fillStyle = '#f3e28a'; ctx.fillRect(-14, -19.5, 11.5, 2.6); ctx.fillRect(3.5, -19.5, 11, 2.6); ctx.fillStyle = '#6b4a36'; ctx.fillRect(-14, -12.5, 28, 2.6); }
    else if (of === 'apron') { ctx.strokeStyle = pal.apron; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-4, top); ctx.lineTo(-5, -25); ctx.moveTo(4.5, top); ctx.lineTo(5.5, -25); ctx.stroke(); rr(ctx, -7.5, -26, 15, 20, 3); ctx.fillStyle = pal.apron; ctx.fill(); rr(ctx, -4, -18.5, 8.5, 5.5, 1.6); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(50,70,40,.4)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.fillStyle = '#f4a8a0'; circ(ctx, -1.5, -19.5, 1.3); ctx.fill(); }
    ctx.fillStyle = 'rgba(80,50,80,.12)'; ctx.fillRect(-14, -32, 7, 26); ctx.fillStyle = 'rgba(80,50,60,.14)'; ctx.fillRect(-14, top, 28, 4); ctx.restore(); body(); ctx.strokeStyle = CO; ctx.lineWidth = 1.05; ctx.stroke();
    // 목도리 / 방울 / 옷깃
    if (hat === 'cat') { rr(ctx, -7, -32.5 - breath * 0.4, 14, 4.6, 2.3); cfs(ctx, pal.scarf); circ(ctx, 0.5, -26.8 - breath * 0.4, 2.7); cfs(ctx, '#f0cf6a'); ctx.fillStyle = CO; circ(ctx, 0.5, -26.2 - breath * 0.4, 0.7); ctx.fill(); }
    else if (hat === 'rain') { rr(ctx, -8, -33 - breath * 0.4, 16, 5, 2.5); cfs(ctx, pal.top); }
    else { rr(ctx, -9, -33.5 - breath * 0.4, 18, 7, 3.5); cfs(ctx, grad(-34, -26, pal.scarf, pal.scarfShade || pal.scarf)); ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, -6, -32.4 - breath * 0.4, 9, 2, 1); ctx.fill(); }

    // ── 머리
    head(() => {
      const face = () => { ctx.beginPath(); ctx.moveTo(-16, -3); ctx.bezierCurveTo(-16, -18, 16.5, -18, 16.5, -3); ctx.bezierCurveTo(17, 8.5, 8.5, 14.5, 0.5, 14.5); ctx.bezierCurveTo(-8, 14.5, -16.5, 8.5, -16, -3); ctx.closePath(); };
      if (!hood) { ell(ctx, 0, -3, 18, 16.5); cfs(ctx, hairFill()); }
      face(); cfs(ctx, grad(-16, 15, pal.skin, pal.skinShade || pal.skin));
      ctx.save(); face(); ctx.clip(); ctx.fillStyle = 'rgba(170,95,75,.13)'; ctx.fillRect(-18, -20, 36, 19.5); ctx.fillRect(-18, -20, 5.5, 40); ctx.restore();
      // 볼터치 (수채 번짐)
      A.glow(ctx, -10.5, 8.8, 6.2, '#ff8f8f', 0.42); A.glow(ctx, 13, 8.8, 5.4, '#ff8f8f', 0.42);
      // 앞머리
      const fringe = (pts) => { ctx.beginPath(); ctx.moveTo(-17, 1); ctx.bezierCurveTo(-18, -21, 18, -21, 17.5, 0); pts.forEach((p) => ctx.quadraticCurveTo(p[0], p[1], p[2], p[3])); ctx.closePath(); };
      if (hood) { ctx.beginPath(); ctx.moveTo(-14.5, -9); [[-12, 0, -8.5, -5], [-5, 0.5, -1.5, -5.5], [2.5, 0.5, 6, -5], [10, 0, 14.5, -9]].forEach((p) => ctx.quadraticCurveTo(p[0], p[1], p[2], p[3])); ctx.closePath(); cfs(ctx, pal.hair); fringe([[16, -6, 10, -9.5], [0, -13, -10, -9.5], [-16, -6, -17, 1]]); cfs(ctx, grad(-20, 0, pal.top, pal.topShade)); }
      else {
        fringe(FRINGE[hat] || FRINGE.beanie); cfs(ctx, hairFill());
        if (hat === 'straw' || hat === 'sprout') for (let s = -1; s <= 1; s += 2) { const lx = s < 0 ? -15.5 : 15.8, sw = hw * 0.35, len = hat === 'sprout' ? 12 : 15; ctx.beginPath(); ctx.moveTo(lx - 2, -3); ctx.quadraticCurveTo(lx - 3 * s + sw, len * 0.55, lx + sw - s, len); ctx.quadraticCurveTo(lx + 2.5 * s + sw, len * 0.55, lx + 2, -3); ctx.closePath(); cfs(ctx, pal.hair); }
        if (hat === 'goggles') { for (let i = 0; i < 6; i++) { const sx = -14 + i * 5.6, tip = Math.sin(t * 3 + i) * 0.8; ctx.beginPath(); ctx.moveTo(sx - 3.4, -13.5); ctx.quadraticCurveTo(sx - 2.5 + tip, -20 - (i % 2) * 2, sx + 1 + tip, -20.5 - (i % 2) * 2.5); ctx.quadraticCurveTo(sx + 4.5, -19, sx + 4.4, -13.5); ctx.closePath(); cfs(ctx, pal.hairLight); } ctx.strokeStyle = CO; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(1, -21); ctx.quadraticCurveTo(4 + hw, -30, 9 + hw * 1.4, -27); ctx.stroke(); ctx.strokeStyle = pal.hair; ctx.lineWidth = 1.5; ctx.stroke(); }
        // 머릿결
        ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -1, 13.5, -2.25, -1.8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -1, 13.5, -1.62, -1.0); ctx.stroke();
      }
      // 눈썹 · 눈 · 코 · 입
      if (!(c.hurtT > 0)) { ctx.strokeStyle = 'rgba(70,45,35,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, -5.2); ctx.quadraticCurveTo(-5.6, -6.6, -3.2, -6); ctx.moveTo(6.4, -6); ctx.quadraticCurveTo(8.8, -6.6, 11, -5.2); ctx.stroke(); }
      if (c.hurtT > 0) { ctx.strokeStyle = '#3a2a26'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8.5, 0.4); ctx.lineTo(-3.5, 3.2); ctx.lineTo(-8.5, 6); ctx.moveTo(11.5, 0.4); ctx.lineTo(6.5, 3.2); ctx.lineTo(11.5, 6); ctx.stroke(); }
      else if (blink) { ctx.strokeStyle = '#3a2a26'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-9.2, 3.6); ctx.quadraticCurveTo(-5.5, 6.4, -1.8, 3.6); ctx.moveTo(5.4, 3.6); ctx.quadraticCurveTo(8.6, 6.4, 11.8, 3.6); ctx.stroke(); }
      else { ghEye(ctx, -5.5, 3, 3.7, 4.7, pal.eye); ghEye(ctx, 8.7, 3, 3.2, 4.6, pal.eye); }
      ctx.strokeStyle = 'rgba(170,100,80,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(3.2, 7); ctx.quadraticCurveTo(4.2, 7.8, 3.4, 8.4); ctx.stroke();
      if (c.hurtT > 0) { ctx.strokeStyle = '#a0504a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-0.5, 11); ctx.quadraticCurveTo(0.8, 9.6, 2, 11); ctx.quadraticCurveTo(3.2, 12.4, 4.5, 11); ctx.stroke(); }
      else if (c.moving || c.swing > 0) { ctx.beginPath(); ctx.moveTo(-1.2, 10); ctx.quadraticCurveTo(2, 10.8, 5.2, 10); ctx.quadraticCurveTo(2, 14.6, -1.2, 10); ctx.closePath(); ctx.fillStyle = '#b8504e'; ctx.fill(); ctx.strokeStyle = '#7a3434'; ctx.lineWidth = 0.9; ctx.stroke(); }
      else { ctx.strokeStyle = '#9a4c46'; ctx.lineWidth = 1.15; ctx.beginPath(); ctx.moveTo(-0.6, 10.2); ctx.quadraticCurveTo(2, 12.4, 4.6, 10.2); ctx.stroke(); }
      if (hat === 'sprout') { ctx.strokeStyle = '#6b4a36'; ctx.lineWidth = 1.15; circ(ctx, -5.5, 3.2, 5.7); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.stroke(); circ(ctx, 8.8, 3.2, 5.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0.2, 2.6); ctx.quadraticCurveTo(1.8, 1.6, 3.5, 2.6); ctx.stroke(); }
      // 모자 · 장식
      if (hat === 'straw') { ctx.save(); ctx.translate(-1, -13.5); ctx.rotate(-0.13 + Math.sin(t * 2.2) * 0.03); ell(ctx, 0, 0, 25, 6.4); cfs(ctx, grad(-6, 6, '#f2dc98', '#dcbc6c')); ctx.strokeStyle = 'rgba(150,110,40,.35)'; ctx.lineWidth = 0.8; ell(ctx, 0, 0.3, 20, 4.6); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -1.2, 13.5, 12, 0, Math.PI, 0); ctx.closePath(); cfs(ctx, grad(-13, 0, '#f7e8b0', '#e6cd84')); ctx.save(); ctx.beginPath(); ctx.ellipse(0, -1.2, 13.5, 12, 0, Math.PI, 0); ctx.clip(); ctx.fillStyle = pal.scarf; ctx.fillRect(-14, -5.6, 28, 4); ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, -5, -9, 4.5, 2, -0.5); ctx.fill(); ctx.restore(); ctx.fillStyle = '#fffaf0'; for (let i = 0; i < 5; i++) { circ(ctx, 9.5 + Math.cos(i * 1.256) * 2.3, -4 + Math.sin(i * 1.256) * 2.3, 1.7); ctx.fill(); } ctx.fillStyle = '#e8b04a'; circ(ctx, 9.5, -4, 1.3); ctx.fill(); ctx.restore(); }
      if (hat === 'goggles') { ctx.strokeStyle = CO; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(-16.5, -9); ctx.quadraticCurveTo(0, -14.5, 17, -8.5); ctx.stroke(); ctx.strokeStyle = '#8a6244'; ctx.lineWidth = 3; ctx.stroke(); for (let s = 0; s < 2; s++) { const gx = -4.5 + s * 10.5; circ(ctx, gx, -11.5, 5); cfs(ctx, '#cfa862'); circ(ctx, gx, -11.5, 3.4); cfs(ctx, '#9fd4cc', 0.9); ctx.fillStyle = 'rgba(255,255,255,.8)'; ell(ctx, gx - 1, -12.6, 1.5, 0.9, -0.6); ctx.fill(); } }
      if (hat === 'cat') { for (let s = -1; s <= 1; s += 2) { const wig = Math.sin(t * 3 + s) * 0.8; ctx.beginPath(); ctx.moveTo(s * 5.5, -15.5); ctx.quadraticCurveTo(s * 11, -30 + wig, s * 14 + wig, -28.5); ctx.quadraticCurveTo(s * 18.5, -20, s * 17.5, -9.5); ctx.closePath(); cfs(ctx, pal.top); ctx.beginPath(); ctx.moveTo(s * 9, -16.5); ctx.quadraticCurveTo(s * 12, -25 + wig, s * 13.6 + wig, -24.5); ctx.quadraticCurveTo(s * 16, -19, s * 15.2, -13.5); ctx.closePath(); ctx.fillStyle = '#f2b6c2'; ctx.fill(); } }
      if (hat === 'beanie') { ctx.beginPath(); ctx.moveTo(-17.3, -6); ctx.bezierCurveTo(-19, -26, 19, -26, 17.8, -6); ctx.quadraticCurveTo(0, -11.5, -17.3, -6); ctx.closePath(); cfs(ctx, grad(-24, -6, pal.hatC, pal.hatShade)); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5.5, -10); ctx.quadraticCurveTo(i * 5, -17, i * 3, -22); ctx.stroke(); } const band = () => { ctx.beginPath(); ctx.moveTo(-17.4, -5.5); ctx.quadraticCurveTo(0, -11, 17.9, -5.5); ctx.stroke(); }; ctx.strokeStyle = CO; ctx.lineWidth = 7; band(); ctx.strokeStyle = pal.hatShade; ctx.lineWidth = 5.2; band(); circ(ctx, 1 + hw * 0.4, -24.5, 4.6); cfs(ctx, '#f4ecd6'); }
      if (hat === 'helmet') { ctx.beginPath(); ctx.moveTo(-17.6, -7); ctx.bezierCurveTo(-19, -27, 19, -27, 18, -7); ctx.closePath(); cfs(ctx, grad(-25, -7, '#f6c555', '#e09a2e')); ctx.strokeStyle = 'rgba(140,80,10,.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -8); ctx.stroke(); rr(ctx, -19.5, -9.6, 40, 4.6, 2.3); cfs(ctx, '#e39f30'); A.glow(ctx, 7.5, -15, 11, '#fff2b0', 0.75); circ(ctx, 7.5, -15, 3.8); cfs(ctx, '#8d949a'); circ(ctx, 7.5, -15, 2.5); ctx.fillStyle = '#fffbe0'; ctx.fill(); }
      if (hat === 'sprout') { ctx.strokeStyle = CO; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, -18.5); ctx.quadraticCurveTo(0.5, -23, 1 + hw * 0.5, -26); ctx.stroke(); ctx.strokeStyle = '#6fae58'; ctx.lineWidth = 1.5; ctx.stroke(); for (let s = -1; s <= 1; s += 2) { ctx.save(); ctx.translate(1 + hw * 0.5, -26); ctx.rotate(s * (0.75 + Math.sin(t * 2 + s) * 0.08)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -5.5, 0, -10); ctx.quadraticCurveTo(-4, -5.5, 0, 0); ctx.closePath(); cfs(ctx, s < 0 ? '#8cc56a' : '#a5d67e'); ctx.restore(); } }
    });
    // 앞팔 (+채집 도구)
    ctx.save(); ctx.translate(6.5, -27);
    if (c.swing > 0) { const sp = 1 - c.swing; ctx.rotate(-2.3 + sp * sp * 3.1); rr(ctx, -2.6, 0, 5.2, 10.5, 2.6); cfs(ctx, pal.top); ctx.save(); ctx.translate(0, 11); ctx.rotate(-1.2); ctx.fillStyle = '#8a6a48'; ctx.fillRect(-1.2, -2, 2.4, 17); rr(ctx, -5, 11, 10, 7, 2); cfs(ctx, '#b9c4ca'); ctx.restore(); circ(ctx, 0, 11, 2.5); cfs(ctx, pal.skin, 0.9); }
    else { ctx.rotate(-0.25 + walk * 0.7); rr(ctx, -2.6, 0, 5.2, 10.5, 2.6); cfs(ctx, pal.top); circ(ctx, 0, 11, 2.5); cfs(ctx, pal.skin, 0.9); }
    ctx.restore();
    ctx.restore();
  };

  /* ───────── 적 ───────── */
  A.drawEnemy = function (ctx, e, t) {
    const fl = e.flash > 0, ph = e.seed, r = e.r;
    ctx.save(); ctx.translate(e.x, e.y); A.shadow(ctx, 0, 2, r * 0.9, r * 0.32);
    const sq = 1 + Math.sin(t * 7 + ph) * 0.07; ctx.scale((e.vx < 0 ? -1 : 1), 1);
    if (e.spawnT > 0) { const s = 1 - e.spawnT / 0.5; ctx.scale(s, s); ctx.globalAlpha = s; }
    switch (e.type) {
      case 'dust': {
        ctx.translate(0, -r * 0.9 - Math.abs(Math.sin(t * 6 + ph)) * 4); ctx.scale(1 / sq, sq);
        ctx.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU, rad = r * (1 + (i % 2 ? 0.2 : 0) + Math.sin(t * 9 + i + ph) * 0.05); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); fs(ctx, fl ? '#fff' : '#4b3f57', '#2c2436', 1.4);
        eyes(ctx, 1, -2, 4.6, r * 0.42, fl); break;
      }
      case 'beetle': {
        ctx.translate(0, -r * 0.6); ctx.strokeStyle = '#3d2a22'; ctx.lineWidth = 1.6; for (let i = -1; i <= 1; i++) { const w = Math.sin(t * 22 + i * 2 + ph) * 3; ctx.beginPath(); ctx.moveTo(i * 5, 2); ctx.lineTo(i * 7 + w, r * 0.75); ctx.stroke(); }
        ell(ctx, 0, 0, r * 1.15, r * 0.78); fs(ctx, fl ? '#fff' : '#c2703f', '#5a2f1c'); ctx.strokeStyle = 'rgba(90,47,28,.7)'; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.75); ctx.lineTo(-r * 0.2, r * 0.75); ctx.stroke();
        ctx.fillStyle = fl ? '#fff' : '#e39a5c'; ell(ctx, -r * 0.5, -r * 0.3, r * 0.3, r * 0.16, -0.4); ctx.fill();
        circ(ctx, r * 0.95, 0, r * 0.42); fs(ctx, fl ? '#fff' : '#7a4528', '#5a2f1c'); eyes(ctx, r * 0.95, -1, 2.6, 2.4, fl);
        ctx.strokeStyle = '#5a2f1c'; ctx.beginPath(); ctx.moveTo(r * 1.2, -3); ctx.quadraticCurveTo(r * 1.6, -10, r * 1.9, -8 + Math.sin(t * 8 + ph) * 2); ctx.stroke(); break;
      }
      case 'gnaw': {
        ctx.translate(0, -r * 0.8 - Math.abs(Math.sin(t * 8 + ph)) * 2);
        ctx.strokeStyle = '#c98a9a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-r, 4); ctx.quadraticCurveTo(-r * 1.7, 2 + Math.sin(t * 6 + ph) * 5, -r * 2, -4); ctx.stroke();
        ell(ctx, 0, 0, r * 1.15, r * 0.85); fs(ctx, fl ? '#fff' : '#7d6a9a', '#3e3252');
        circ(ctx, r * 0.15, -r * 0.8, r * 0.36); fs(ctx, fl ? '#fff' : '#9a86b8', '#3e3252'); circ(ctx, r * 0.15, -r * 0.8, r * 0.18); ctx.fillStyle = '#e7a8b6'; ctx.fill();
        eyes(ctx, r * 0.55, -r * 0.2, 3.4, 3, fl); ctx.fillStyle = '#fff'; rr(ctx, r * 0.72, r * 0.18, 5, 6.5, 1); fs(ctx, '#fffdf0', '#3e3252', 1); circ(ctx, r * 1.1, 0, 2); ctx.fillStyle = '#e28a9a'; ctx.fill(); break;
      }
      case 'wisp': {
        const fy = -r * 1.5 + Math.sin(t * 2.4 + ph) * 5; A.glow(ctx, 0, fy, r * 2.6, '#8fe8e0', 0.5); ctx.translate(0, fy);
        ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.bezierCurveTo(r * 1.3, -r * 0.4, r * 1.1, r * 0.9, 0, r); ctx.bezierCurveTo(-r * 1.1, r * 0.9, -r * 1.3 + Math.sin(t * 5 + ph) * 3, -r * 0.2, Math.sin(t * 4 + ph) * 4, -r * 1.5); ctx.closePath();
        fs(ctx, fl ? '#fff' : 'rgba(160,235,228,.88)', '#4f9d9a', 1.3); eyes(ctx, 1, 0, 4.4, 3.2, fl, '#1f4a50'); break;
      }
      case 'golem': {
        const st = Math.abs(Math.sin(t * 2.6 + ph)) * 3; ctx.translate(0, -st);
        const bc = fl ? '#fff' : '#8e9aa0', dk = fl ? '#fff' : '#6d7a82';
        rr(ctx, -r * 0.75, -12, r * 0.55, 13, 3); fs(ctx, dk); rr(ctx, r * 0.2, -12, r * 0.55, 13, 3); fs(ctx, dk);
        rr(ctx, -r * 1.3, -r * 1.6, r * 0.5, r * 1.1, 4); fs(ctx, dk); rr(ctx, r * 0.8, -r * 1.6, r * 0.5, r * 1.1, 4); fs(ctx, dk);
        rr(ctx, -r * 0.9, -r * 1.9, r * 1.8, r * 1.55, 7); fs(ctx, bc); ctx.fillStyle = fl ? '#fff' : '#b9653c'; rr(ctx, -r * 0.9, -r * 0.95, r * 0.7, r * 0.5, 3); ctx.fill();
        rr(ctx, -r * 0.55, -r * 2.55, r * 1.1, r * 0.8, 5); fs(ctx, bc); A.glow(ctx, 2, -r * 2.15, 13, '#ffd36b', 0.9); circ(ctx, 2, -r * 2.15, 4.2); fs(ctx, '#ffe9a0', '#8a5a20');
        ctx.fillStyle = '#7ab75e'; circ(ctx, -r * 0.5, -r * 1.9, 6); ctx.fill(); circ(ctx, -r * 0.2, -r * 2.55, 5); ctx.fill(); circ(ctx, r * 0.7, -r * 1.85, 4.5); ctx.fill(); break;
      }
      case 'boss': {
        const by = -r * 1.0 - Math.sin(t * 1.8) * 5; A.glow(ctx, 0, by, r * 2.4, '#3a2a55', 0.55); ctx.translate(0, by);
        ctx.beginPath(); for (let i = 0; i <= 36; i++) { const a = (i / 36) * TAU, rad = r * (1 + (i % 2 ? 0.16 : 0) + Math.sin(t * 5 + i * 1.7) * 0.05); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.92); } ctx.closePath(); fs(ctx, fl ? '#fff' : '#33283f', '#1c1526', 2);
        ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 4; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 13, -r * 0.82); ctx.lineTo(i * 17, -r * 1.25 - (i % 2 ? 0 : 9)); ctx.stroke(); }
        eyes(ctx, 0, -6, 17, 9, fl, '#c2334a'); eyes(ctx, 0, -r * 0.5, 9, 4, fl, '#c2334a');
        ctx.strokeStyle = '#1c1526'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-18, 18); for (let i = 0; i < 6; i++) ctx.lineTo(-18 + (i + 0.5) * 6, 18 + (i % 2 ? -5 : 5)); ctx.stroke(); break;
      }
    }
    ctx.restore();
  };
  function eyes(ctx, cx, cy, gap, s, fl, pupil) {
    for (let k = -1; k <= 1; k += 2) { ell(ctx, cx + k * gap, cy, s * 0.75, s); ctx.fillStyle = fl ? '#ffd' : '#fffef2'; ctx.fill(); ell(ctx, cx + k * gap + s * 0.2, cy + s * 0.1, s * 0.34, s * 0.5); ctx.fillStyle = pupil || '#221a2a'; ctx.fill(); }
  }

  /* ───────── 나무 / 채집 노드 ───────── */
  function treeBlobs(r, big) {
    const b = [], n = 6 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = 14 + r() * 12; b.push({ x: Math.cos(a) * d * 1.25, y: -62 + Math.sin(a) * d * 0.75, r: 17 + r() * 9, ph: r() * 6 }); }
    b.push({ x: 0, y: -66, r: 24, ph: 0 }); b.sort((p, q) => p.y - q.y); return b;
  }
  A.treeBlobs = (seed) => treeBlobs(U.rng(seed), 1);
  function drawTreeLive(ctx, blobs, t, shake, alive, alpha) {
    A.shadow(ctx, 0, 0, 30, 9);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-5, -20, -6, -46); ctx.lineTo(6, -46); ctx.quadraticCurveTo(5, -20, 9, 0); ctx.closePath(); fs(ctx, '#7d5b3e'); ctx.fillStyle = 'rgba(60,35,20,.28)'; ctx.fillRect(1, -46, 6, 45);
    if (!alive) return;
    if (alpha != null && alpha < 0.98) ctx.globalAlpha = alpha;
    const sx = Math.sin(shake * 40) * shake * 5;
    const layer = (col, ox, oy, sc) => { ctx.fillStyle = col; blobs.forEach((b) => { const sw = Math.sin(t * 1.3 + b.ph) * 2.2; circ(ctx, b.x + ox + sw + sx, b.y + oy, b.r * sc); ctx.fill(); }); };
    layer('#3f7f4c', 0, 3, 1.04); layer('#5a9d55', -2, -1, 0.92); layer('#7dbd62', -5, -5, 0.68);
    ctx.fillStyle = '#a8d97c'; blobs.forEach((b, i) => { if (i % 2) return; const sw = Math.sin(t * 1.3 + b.ph) * 2.6; circ(ctx, b.x - 8 + sw + sx, b.y - 9, b.r * 0.3); ctx.fill(); });
  }
  A.drawNode = function (ctx, n, t) {
    ctx.save(); ctx.translate(n.x, n.y); const alive = n.hp > 0, sh = n.shake || 0;
    if (n.kind === 'tree') { ctx.scale(n.s, n.s); if (alive) drawTreeLive(ctx, n.blobs, t, sh, true, n.fa); else { A.shadow(ctx, 0, 0, 14, 5); rr(ctx, -8, -12, 17, 13, 3); fs(ctx, '#7d5b3e'); ell(ctx, 0.5, -12, 8.5, 3.4); fs(ctx, '#d9b98a'); ctx.strokeStyle = 'rgba(120,80,40,.6)'; ell(ctx, 0.5, -12, 4.5, 1.7); ctx.stroke(); ctx.fillStyle = '#7dbd62'; circ(ctx, 9, -2, 3); ctx.fill(); } }
    else if (n.kind === 'wreck') { const sp = A.sprites['wreck' + n.v]; ctx.translate(Math.sin(sh * 40) * sh * 4, 0); if (!alive) ctx.globalAlpha = 0.4; ctx.drawImage(sp, -sp.width / 4, -sp.height / 2 + 8, sp.width / 2, sp.height / 2); if (alive && Math.sin(t * 3 + n.seed) > 0.8) A.glow(ctx, n.seed % 30 - 15, -26, 7, '#ffffff', 0.9); }
    else if (n.kind === 'bush') {
      A.shadow(ctx, 0, 0, 24, 7); const sx = Math.sin(sh * 40) * sh * 4;
      [['#3f7f4c', 0, 0, 1], ['#5a9d55', -2, -3, 0.85], ['#86c56c', -5, -7, 0.5]].forEach((L) => { ctx.fillStyle = L[0]; [[-13, -10, 12], [0, -16, 15], [13, -10, 12], [-5, -7, 11], [7, -6, 10]].forEach((b, i) => { circ(ctx, b[0] + L[1] + sx + Math.sin(t * 1.5 + i) * 0.8, b[1] + L[2], b[2] * L[3]); ctx.fill(); }); });
      const berries = Math.ceil((n.hp / n.maxHp) * 7); for (let i = 0; i < berries; i++) { const bx = [-14, -6, 3, 12, -10, 8, 0][i], by = [-10, -19, -22, -12, -3, -4, -11][i]; circ(ctx, bx + sx, by, 3.1); fs(ctx, '#e8546e', '#9a2f45', 1); ctx.fillStyle = '#ffd0d8'; circ(ctx, bx - 1 + sx, by - 1, 0.9); ctx.fill(); }
    } else if (n.kind === 'crystal') {
      A.shadow(ctx, 0, 0, 20, 6); if (alive) { A.glow(ctx, 0, -18, 46 + Math.sin(t * 2 + n.seed) * 6, '#7fe3e0', 0.55); const sx = Math.sin(sh * 40) * sh * 3; [[-9, 18, -0.3], [2, 30, 0.05], [11, 20, 0.35]].forEach((c) => { ctx.save(); ctx.translate(c[0] + sx, 0); ctx.rotate(c[2]); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-6, -c[1] * 0.7); ctx.lineTo(0, -c[1]); ctx.lineTo(6, -c[1] * 0.7); ctx.lineTo(6, 0); ctx.closePath(); fs(ctx, '#8fe9e4', '#3f9a9a'); ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-4, -c[1] * 0.66); ctx.lineTo(-1, -c[1] * 0.9); ctx.lineTo(-1, -2); ctx.fill(); ctx.restore(); }); } else { ctx.fillStyle = '#9aa7a8'; circ(ctx, -4, -3, 5); ctx.fill(); circ(ctx, 5, -2, 4); ctx.fill(); }
    }
    ctx.restore();
  };

  /* ───────── 정적 소품 스프라이트 ───────── */
  A.sprites = {};
  function moss(ctx, r, x, y, n, spread) { for (let i = 0; i < n; i++) { ctx.fillStyle = ['#5a9d55', '#7dbd62', '#3f7f4c', '#94cc70'][(r() * 4) | 0]; circ(ctx, x + (r() - 0.5) * spread, y + (r() - 0.5) * spread * 0.5, 4 + r() * 8); ctx.fill(); } }
  function makeRuin(seed) {
    const r = U.rng(seed), w = 150 + r() * 90, h = 120 + r() * 80, c = canvas((w + 50) * 2, (h + 40) * 2), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(25, 20);
    ell(ctx, w / 2, h, w * 0.6, 12); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    const tops = []; let ty = h * (0.1 + r() * 0.3); for (let x = 0; x <= w; x += 16) { if (r() < 0.45) ty = U.clamp(ty + (r() - 0.45) * h * 0.4, 0, h * 0.7); tops.push([x, ty]); }
    ctx.beginPath(); ctx.moveTo(0, h); tops.forEach((p, i) => { if (i) ctx.lineTo(p[0], tops[i - 1][1]); ctx.lineTo(p[0], p[1]); }); ctx.lineTo(w, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e6dcc6'); g.addColorStop(1, '#bdb199'); fs(ctx, g, 'rgba(74,58,48,.7)', 1.5);
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(90,80,110,.16)'; ctx.fillRect(w * 0.78, 0, w, h);
    const topAt = (x) => tops[Math.min(tops.length - 1, Math.max(0, Math.round(x / 16)))][1];
    for (let x = 16; x < w - 26; x += 36) for (let y = 14; y < h - 30; y += 42) { if (y < Math.max(topAt(x), topAt(x + 20)) + 10 || r() < 0.2) continue; rr(ctx, x, y, 20, 26, 2); fs(ctx, '#5f6f7a', 'rgba(74,58,48,.6)', 1.2); ctx.fillStyle = 'rgba(180,215,235,.35)'; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x + 20, y + 4); ctx.lineTo(x + 20, y + 14); ctx.lineTo(x + 8, y + 26); ctx.fill(); }
    ctx.strokeStyle = 'rgba(74,58,48,.35)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { let x = r() * w, y = h * 0.3 + r() * h * 0.6; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 22; y += 8 + r() * 10; ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.restore();
    tops.forEach((p) => { if (r() < 0.6) { moss(ctx, r, p[0], p[1] + 2, 3, 18); if (r() < 0.6) { ctx.strokeStyle = '#5a9d55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); const len = 20 + r() * 50; ctx.quadraticCurveTo(p[0] + 5, p[1] + len * 0.5, p[0] - 2, p[1] + len); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#7dbd62'; circ(ctx, p[0] + (r() - 0.5) * 6, p[1] + len * (k / 4 + 0.2), 3); ctx.fill(); } } } });
    moss(ctx, r, w * 0.2, h, 6, 60); moss(ctx, r, w * 0.75, h, 6, 60);
    c.anchorW = w; return c;
  }
  function makeCar(seed) {
    const r = U.rng(seed), c = canvas(240, 140), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(60, 60);
    ell(ctx, 0, 0, 52, 9); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    const col = ['#c4734a', '#7fa3b0', '#d2b25c'][(r() * 3) | 0];
    circ(ctx, -26, -5, 8); fs(ctx, '#3d3a3a'); circ(ctx, 26, -4, 8); fs(ctx, '#3d3a3a');
    ctx.beginPath(); ctx.moveTo(-46, -8); ctx.quadraticCurveTo(-48, -24, -36, -25); ctx.lineTo(-24, -41); ctx.lineTo(16, -41); ctx.lineTo(30, -25); ctx.quadraticCurveTo(48, -23, 47, -8); ctx.closePath(); fs(ctx, col);
    ctx.fillStyle = 'rgba(140,70,40,.55)'; for (let i = 0; i < 9; i++) { circ(ctx, -40 + r() * 80, -10 - r() * 14, 2 + r() * 5); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-31, -26); ctx.lineTo(-22, -38); ctx.lineTo(-5, -38); ctx.lineTo(-5, -26); ctx.closePath(); fs(ctx, '#a9c4cc', null); ctx.beginPath(); ctx.moveTo(-1, -26); ctx.lineTo(-1, -38); ctx.lineTo(14, -38); ctx.lineTo(24, -26); ctx.closePath(); fs(ctx, '#8fb0ba', null);
    moss(ctx, r, -8, -42, 5, 36); moss(ctx, r, 34, -10, 3, 20); ctx.fillStyle = '#fff3c4'; circ(ctx, -12, -48, 2.2); ctx.fill(); circ(ctx, 2, -47, 1.8); ctx.fill();
    return c;
  }
  function makeHeap(seed) {
    const r = U.rng(seed), c = canvas(200, 160), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(50, 70);
    ell(ctx, 0, 0, 40, 8); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    rr(ctx, -34, -30, 26, 30, 3); fs(ctx, '#d8d4c8'); ctx.strokeStyle = 'rgba(74,58,48,.5)'; ctx.beginPath(); ctx.moveTo(-34, -18); ctx.lineTo(-8, -18); ctx.stroke();
    rr(ctx, -4, -22, 32, 22, 3); fs(ctx, '#6d7a82'); rr(ctx, 0, -18, 20, 14, 2); fs(ctx, '#9fc4c9'); ctx.save(); ctx.translate(-10, -30); ctx.rotate(-0.3); rr(ctx, 0, -20, 18, 22, 8); fs(ctx, '#b9653c'); ctx.restore();
    ctx.strokeStyle = '#8e9aa0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, -22); ctx.lineTo(30, -46); ctx.stroke(); moss(ctx, r, 0, -2, 6, 70); moss(ctx, r, -22, -30, 2, 14);
    return c;
  }
  function makeLamp() {
    const c = canvas(120, 280), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(30, 132); ell(ctx, 0, 0, 12, 4); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    ctx.rotate(0.09); ctx.strokeStyle = '#6d7a82'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -112); ctx.quadraticCurveTo(0, -124, 14, -124); ctx.stroke(); rr(ctx, 10, -128, 16, 6, 3); fs(ctx, '#8e9aa0');
    ctx.strokeStyle = '#5a9d55'; ctx.lineWidth = 2; ctx.beginPath(); for (let y = 0; y > -90; y -= 10) ctx.lineTo(Math.sin(y * 0.3) * 4, y); ctx.stroke(); ctx.fillStyle = '#7dbd62'; for (let y = -8; y > -90; y -= 14) { circ(ctx, Math.sin(y * 0.3) * 4 + 3, y, 3.2); ctx.fill(); }
    return c;
  }
  function makeSign() {
    const c = canvas(140, 180), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(35, 84); ell(ctx, 0, 0, 12, 4); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    ctx.rotate(-0.12); ctx.fillStyle = '#8e9aa0'; ctx.fillRect(-2, -66, 4, 66); rr(ctx, -24, -80, 48, 30, 4); fs(ctx, '#5f8fb5'); ctx.strokeStyle = '#f6f2e0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12, -65); ctx.lineTo(10, -65); ctx.lineTo(4, -71); ctx.moveTo(10, -65); ctx.lineTo(4, -59); ctx.stroke();
    ctx.fillStyle = 'rgba(160,90,50,.5)'; circ(ctx, 16, -56, 5); ctx.fill(); ctx.fillStyle = '#7dbd62'; circ(ctx, -20, -78, 6); ctx.fill(); circ(ctx, -14, -82, 4); ctx.fill();
    return c;
  }
  function makeRock(seed) {
    const r = U.rng(seed), c = canvas(140, 100), ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.translate(35, 40); ell(ctx, 0, 0, 28, 7); ctx.fillStyle = 'rgba(28,52,48,.22)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-28, -18, -12, -24); ctx.quadraticCurveTo(4, -32, 18, -20); ctx.quadraticCurveTo(30, -10, 26, 0); ctx.closePath(); fs(ctx, '#b4b0a4'); ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, -8, -18, 10, 4, -0.4); ctx.fill(); moss(ctx, r, 6, -20, 4, 26);
    return c;
  }
  A.makeSprites = function () {
    for (let i = 0; i < 4; i++) A.sprites['ruin' + i] = makeRuin(40 + i * 7);
    for (let i = 0; i < 3; i++) A.sprites['wreck' + i] = i < 2 ? makeCar(60 + i) : makeHeap(70);
    A.sprites.lamp = makeLamp(); A.sprites.sign = makeSign(); A.sprites.rock0 = makeRock(1); A.sprites.rock1 = makeRock(2);
  };
  A.drawProp = function (ctx, p) { const sp = A.sprites[p.sprite]; ctx.drawImage(sp, p.x - sp.width / 4, p.y - sp.height / 2 + (p.oy || 12), sp.width / 2, sp.height / 2); };
  A.drawTuft = function (ctx, g, t, wind) {
    ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
    for (let i = -1; i <= 1; i++) { const sway = Math.sin(t * (1.4 + wind) + g.ph + i) * (2.5 + wind * 3) + i * 3; ctx.strokeStyle = i ? '#5a9d55' : '#94cc70'; ctx.beginPath(); ctx.moveTo(g.x + i * 3, g.y); ctx.quadraticCurveTo(g.x + i * 3 + sway * 0.3, g.y - g.h * 0.6, g.x + i * 3 + sway, g.y - g.h - (i ? 0 : 3)); ctx.stroke(); }
    if (g.fl) { ctx.fillStyle = g.fl; const fx = g.x + Math.sin(t * 1.4 + g.ph) * 2.5, fy = g.y - g.h - 4; for (let k = 0; k < 5; k++) { circ(ctx, fx + Math.cos(k * 1.256) * 2.4, fy + Math.sin(k * 1.256) * 2.4, 1.7); ctx.fill(); } ctx.fillStyle = '#f2b84b'; circ(ctx, fx, fy, 1.3); ctx.fill(); }
  };

  /* ───────── 거점 건물 ───────── */
  A.drawBuilding = function (ctx, id, l, x, y, t, st) {
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (l <= 0) { ctx.setLineDash([7, 7]); ell(ctx, 0, 0, 46, 17); ctx.strokeStyle = 'rgba(90,70,50,.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#8a6a48'; ctx.fillRect(-1.5, -24, 3, 24); rr(ctx, -13, -40, 26, 18, 3); fs(ctx, '#e6d3a8'); ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(st && st.icon || '?', 0, -26.5); ctx.restore(); return; }
    switch (id) {
      case 'tree': {
        const h = 26 + l * 15, cr = 20 + l * 9, pul = Math.sin(t * 1.6) * 0.5 + 0.5;
        A.glow(ctx, 0, -h * 0.8, cr * 3.2 + pul * 12, '#c8ffd0', 0.35 + l * 0.05); A.shadow(ctx, 0, 0, 14 + l * 5, 5 + l);
        ctx.beginPath(); ctx.moveTo(-4 - l * 1.4, 0); ctx.quadraticCurveTo(-2 - l, -h * 0.5, -2 - l * 0.6, -h); ctx.lineTo(2 + l * 0.6, -h); ctx.quadraticCurveTo(3 + l, -h * 0.5, 5 + l * 1.4, 0); ctx.closePath(); fs(ctx, '#a08263');
        const sx = st && st.shake ? Math.sin(st.shake * 40) * st.shake * 5 : 0;
        const bl = [[0, 0, 1], [-0.75, 0.25, 0.7], [0.75, 0.25, 0.7], [-0.4, -0.5, 0.75], [0.45, -0.45, 0.72]];
        [['#4f9f78', 0, 3, 1.05], ['#74c79a', -1, -1, 0.9], ['#a5e6b4', -3, -4, 0.62]].forEach((L) => { ctx.fillStyle = L[0]; bl.forEach((b, i) => { circ(ctx, b[0] * cr + L[1] + sx + Math.sin(t * 1.2 + i) * 1.6, -h - cr * 0.35 + b[1] * cr + L[2], cr * b[2] * L[3]); ctx.fill(); }); });
        if (l >= 4) { for (let i = 0; i < l * 4; i++) { const a = i * 2.4, d = cr * (0.3 + ((i * 37) % 10) / 12); ctx.fillStyle = i % 2 ? '#ffe3ee' : '#fff8d8'; circ(ctx, Math.cos(a) * d * 1.2 + sx, -h - cr * 0.35 + Math.sin(a) * d * 0.8, 2.6); ctx.fill(); } }
        for (let i = 0; i < 3 + l; i++) { const a = t * 0.5 + i * 2.1, d = cr * 1.2 + Math.sin(t + i) * 8; A.glow(ctx, Math.cos(a) * d, -h * 0.8 + Math.sin(a * 1.3) * cr * 0.8, 5, '#eaffd8', 0.9); }
        break;
      }
      case 'fire': {
        const s = 1 + l * 0.12, fl = Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
        A.glow(ctx, 0, -12, 80 * s + fl * 60, '#ffb45a', 0.4); A.shadow(ctx, 0, 2, 26, 8);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; ell(ctx, Math.cos(a) * 22, Math.sin(a) * 8, 6, 4.2); fs(ctx, i % 2 ? '#b4b0a4' : '#9c988c'); }
        ctx.save(); ctx.rotate(0.35); rr(ctx, -16, -5, 32, 7, 3); fs(ctx, '#7d5b3e'); ctx.restore(); ctx.save(); ctx.rotate(-0.35); rr(ctx, -16, -5, 32, 7, 3); fs(ctx, '#8a6646'); ctx.restore();
        const flame = (w, h, col, ph) => { const hh = h * s * (1 + fl + Math.sin(t * 9 + ph) * 0.08), lean = Math.sin(t * 5 + ph) * 3; ctx.beginPath(); ctx.moveTo(-w * s, -3); ctx.bezierCurveTo(-w * s * 1.2, -hh * 0.5, -w * 0.2 + lean, -hh * 0.7, lean, -hh); ctx.bezierCurveTo(w * 0.3 + lean, -hh * 0.65, w * s * 1.2, -hh * 0.45, w * s, -3); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
        flame(12, 40, '#f2823a', 0); flame(8.5, 29, '#ffc04d', 1); flame(4.5, 17, '#fff3c0', 2);
        break;
      }
      case 'bench': {
        A.shadow(ctx, 0, 2, 40, 10); ctx.fillStyle = '#7d5b3e'; ctx.fillRect(-30, -20, 5, 21); ctx.fillRect(25, -20, 5, 21); rr(ctx, -36, -27, 72, 9, 3); fs(ctx, '#c49a66'); ctx.fillStyle = 'rgba(90,60,30,.3)'; ctx.fillRect(-34, -21, 68, 2.5);
        rr(ctx, -28, -37, 14, 10, 2); fs(ctx, '#8e9aa0'); ctx.save(); ctx.translate(8, -29); ctx.rotate(-0.5 + Math.sin(t * 2) * 0.04); ctx.fillStyle = '#8a6a48'; ctx.fillRect(-1.5, -16, 3, 18); rr(ctx, -7, -21, 14, 7, 2); fs(ctx, '#6d7a82'); ctx.restore();
        if (l >= 2) { ctx.strokeStyle = '#7d5b3e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(-36, -62); ctx.moveTo(36, 0); ctx.lineTo(36, -62); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-44, -58); ctx.quadraticCurveTo(0, -74 - l * 2, 44, -58); ctx.lineTo(40, -50); ctx.quadraticCurveTo(0, -64, -40, -50); ctx.closePath(); fs(ctx, ['#e2574c', '#e2574c', '#e0a458', '#5fa8a0', '#7a6fb0', '#f0c05a'][l]); }
        if (l >= 3) { A.glow(ctx, 26, -40, 16, '#ffd98a', 0.8); rr(ctx, 23, -46, 7, 10, 2); fs(ctx, '#ffe9a0'); }
        break;
      }
      case 'garden': {
        rr(ctx, -44, -18, 88, 36, 10); fs(ctx, '#8a6646', 'rgba(74,58,48,.6)'); ctx.strokeStyle = 'rgba(60,35,20,.35)'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-38, i * 10); ctx.lineTo(38, i * 10); ctx.stroke(); }
        const n = 3 + l * 2; for (let i = 0; i < n; i++) { const gx = -36 + (i % 6) * 14.5 + (i >= 6 ? 7 : 0), gy = i >= 6 ? 8 : -6, sw = Math.sin(t * 2 + i) * 1.8; ctx.strokeStyle = '#5a9d55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + sw * 0.4, gy - 6, gx + sw, gy - 10); ctx.stroke(); ctx.fillStyle = '#86c56c'; ell(ctx, gx + sw - 3, gy - 9, 3.6, 2, -0.5); ctx.fill(); ell(ctx, gx + sw + 3, gy - 9, 3.6, 2, 0.5); ctx.fill(); if (i % 3 === 0) { ctx.fillStyle = '#f08a3c'; circ(ctx, gx, gy, 2.2); ctx.fill(); } }
        if (l >= 3) { ctx.save(); ctx.translate(34, -16); ctx.rotate(Math.sin(t * 1.5) * 0.05); ctx.fillStyle = '#8a6a48'; ctx.fillRect(-1.5, -40, 3, 40); ctx.fillRect(-14, -30, 28, 3); circ(ctx, 0, -42, 6.5); fs(ctx, '#f2d98d'); ell(ctx, 0, -47, 10, 2.6); fs(ctx, '#d9b35c'); ctx.restore(); }
        break;
      }
      case 'drone': {
        ell(ctx, 0, 0, 34, 12); fs(ctx, '#a9adaa', 'rgba(74,58,48,.6)'); ctx.strokeStyle = '#f6e9a8'; ctx.lineWidth = 2.5; ell(ctx, 0, 0, 22, 7.5); ctx.stroke(); ctx.fillStyle = '#7dbd62'; circ(ctx, -28, 4, 5); ctx.fill(); circ(ctx, 26, -5, 4); ctx.fill();
        const a = t * 0.7, dx = Math.cos(a) * 46, dy = -58 - l * 2 + Math.sin(t * 2.3) * 5 + Math.sin(a) * 10; ell(ctx, dx, 0 + Math.sin(a) * 10, 10, 3); ctx.fillStyle = 'rgba(28,52,48,.18)'; ctx.fill();
        ctx.save(); ctx.translate(dx, dy); ctx.rotate(Math.sin(t * 2) * 0.08); ctx.fillStyle = 'rgba(220,235,240,.6)'; ell(ctx, 0, -13, 17 + Math.sin(t * 40) * 3, 2.4); ctx.fill(); ctx.fillStyle = '#6d7a82'; ctx.fillRect(-1, -13, 2, 5);
        ell(ctx, 0, 0, 13, 10); fs(ctx, '#f4efe0'); circ(ctx, 3, -0.5, 5); fs(ctx, '#3d5a73'); A.glow(ctx, 3, -0.5, 8, '#8fe8ff', 0.7); ctx.fillStyle = '#c8f4ff'; circ(ctx, 4.2, -1.8, 1.6); ctx.fill(); ctx.strokeStyle = '#6d7a82'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 9); ctx.lineTo(-7, 14); ctx.moveTo(5, 9); ctx.lineTo(7, 14); ctx.stroke(); ctx.restore();
        break;
      }
      case 'tower': {
        A.shadow(ctx, 0, 2, 30, 9); const H2 = 72 + l * 4; ctx.strokeStyle = '#7d5b3e'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-15, -H2); ctx.moveTo(20, 0); ctx.lineTo(15, -H2); ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8a6646'; ctx.beginPath(); ctx.moveTo(-19, -8); ctx.lineTo(17, -H2 * 0.5); ctx.moveTo(19, -8); ctx.lineTo(-17, -H2 * 0.5); ctx.moveTo(-17, -H2 * 0.5); ctx.lineTo(16, -H2 + 6); ctx.stroke();
        rr(ctx, -24, -H2 - 6, 48, 9, 2); fs(ctx, '#c49a66'); rr(ctx, -24, -H2 - 20, 48, 15, 2); fs(ctx, '#a67f52'); ctx.fillStyle = 'rgba(60,35,20,.3)'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 9 - 0.7, -H2 - 20, 1.4, 15);
        ctx.save(); ctx.translate(0, -H2 - 26); ctx.rotate(st && st.aim != null ? st.aim : Math.sin(t * 0.6) * 0.6); ctx.strokeStyle = '#6d7a82'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(6, 0, 12, -1.15, 1.15); ctx.stroke(); ctx.fillStyle = '#8a6a48'; ctx.fillRect(-10, -2, 26, 4); ctx.restore();
        ctx.beginPath(); ctx.moveTo(-30, -H2 - 40); ctx.lineTo(0, -H2 - 58); ctx.lineTo(30, -H2 - 40); ctx.closePath(); fs(ctx, '#d9705f'); ctx.strokeStyle = '#7d5b3e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-20, -H2 - 20); ctx.lineTo(-22, -H2 - 40); ctx.moveTo(20, -H2 - 20); ctx.lineTo(22, -H2 - 40); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  };
  A.drawFencePost = function (ctx, x, y, l, t) { ctx.save(); ctx.translate(x, y); rr(ctx, -3.5, -22, 7, 23, 2); fs(ctx, '#a67f52'); ctx.beginPath(); ctx.moveTo(-3.5, -21); ctx.lineTo(0, -28); ctx.lineTo(3.5, -21); ctx.closePath(); fs(ctx, '#c49a66'); if (l >= 2) { ctx.strokeStyle = '#4f8f4c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(0, -12, 4, -16); ctx.stroke(); ctx.fillStyle = '#d9705f'; if (l >= 4) { circ(ctx, 3, -16, 2.4); ctx.fill(); } } ctx.restore(); };

  /* ───────── 기타 ───────── */
  A.drawPickup = function (ctx, p, t) {
    const by = p.y - 6 - Math.abs(Math.sin(t * 4 + p.seed)) * 3 - (p.z || 0); ctx.save(); ctx.translate(p.x, by);
    if (!p.z) { ell(ctx, 0, p.y - by, 5, 2); ctx.fillStyle = 'rgba(28,52,48,.2)'; ctx.fill(); }
    switch (p.kind) {
      case 'xp': A.glow(ctx, 0, 0, 11, '#d8ff8a', 0.8); ell(ctx, 0, 0, 3, 4.2, 0.4); fs(ctx, '#eaffb0', '#7aa83a', 1); break;
      case 'wood': ctx.rotate(-0.4); rr(ctx, -8, -3.5, 16, 7, 3.5); fs(ctx, '#b98556'); ell(ctx, 7, 0, 2, 3); fs(ctx, '#e3c08e', null); break;
      case 'scrap': ctx.rotate(t + p.seed); ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i * 1.047) * 6.5, Math.sin(i * 1.047) * 6.5); ctx.closePath(); fs(ctx, '#aab6bd'); circ(ctx, 0, 0, 2.4); fs(ctx, '#6d7a82', null); break;
      case 'food': circ(ctx, 0, 0, 5.5); fs(ctx, '#e8546e', '#9a2f45'); ctx.fillStyle = '#5a9d55'; ell(ctx, 1.5, -5.5, 3.4, 1.7, -0.5); ctx.fill(); ctx.fillStyle = '#ffd0d8'; circ(ctx, -1.8, -1.8, 1.3); ctx.fill(); break;
      case 'crystal': A.glow(ctx, 0, 0, 16, '#7fe3e0', 0.8); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5.5, 0); ctx.closePath(); fs(ctx, '#8fe9e4', '#3f9a9a'); break;
      case 'heart': A.glow(ctx, 0, 0, 13, '#ff9aa8', 0.7); ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-9, -2, -4, -8, 0, -3); ctx.bezierCurveTo(4, -8, 9, -2, 0, 5); fs(ctx, '#ff6b81', '#a83a4c'); break;
    }
    ctx.restore();
  };
  A.drawFox = function (ctx, f, t) {
    ctx.save(); ctx.translate(f.x, f.y - 14 + Math.sin(t * 3) * 3); ctx.scale(f.vx < 0 ? -1 : 1, 1); A.glow(ctx, 0, 0, 26, '#ffcf8a', 0.5); ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(-24, 4 + Math.sin(t * 6) * 5, -22, -8); ctx.quadraticCurveTo(-14, -4, -7, -3); ctx.closePath(); fs(ctx, '#f6a552', '#a8602a'); ctx.fillStyle = '#fff6e0'; circ(ctx, -21, -5, 3); ctx.fill();
    ell(ctx, 0, 0, 11, 7.5); fs(ctx, '#f6a552', '#a8602a'); circ(ctx, 9, -4, 6.5); fs(ctx, '#f8b566', '#a8602a');
    for (let s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.moveTo(7 + s * 3, -9); ctx.lineTo(8 + s * 5, -17); ctx.lineTo(11 + s * 4, -8); ctx.closePath(); fs(ctx, '#f6a552', '#a8602a', 1); }
    ctx.fillStyle = '#fff6e0'; ell(ctx, 12, -2, 3.4, 2.6); ctx.fill(); ctx.fillStyle = '#3b2a22'; circ(ctx, 10, -5, 1.1); ctx.fill(); circ(ctx, 15, -2.5, 0.9); ctx.fill(); ctx.restore();
  };
  A.cloudShape = cloudShape;
})();
