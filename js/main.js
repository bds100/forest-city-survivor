/* 메인 루프 / 입력 */
(function () {
  const G = window.G, cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  G.input = { mx: 0, my: 0, dash: false };
  G.mode = 'title';

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  window.addEventListener('resize', resize); resize();

  /* ── 키보드 ── */
  const keys = {};
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; keys[e.code] = true; G.audio.init();
    if (G.mode !== 'game') { if (e.code === 'Escape' && G.ui.modalKind && G.ui.modalKind !== 'end') G.ui.close(false); return; }
    const mk = G.ui.modalKind;
    if (e.code === 'Space') { e.preventDefault(); if (!mk) G.input.dash = true; }
    if (e.code === 'KeyE' || e.code === 'KeyB') { if (mk === 'build') G.ui.close(true); else if (!mk) G.ui.showBuild(); }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (mk === 'pause' || mk === 'build') G.ui.close(true); else if (!mk) G.ui.showPause(); }
    if (mk === 'levelup' && /^(Digit|Numpad)[1-3]$/.test(e.code)) G.ui.pickCard(+e.code.slice(-1) - 1);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.mode === 'game' && G.state && !G.state.over && !G.ui.modalKind) G.ui.showPause(); });

  /* ── 터치 / 마우스 드래그 조이스틱 ── */
  const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  let jp = null;
  cv.addEventListener('pointerdown', (e) => {
    G.audio.init(); if (G.mode !== 'game' || jp) return; if (e.pointerType === 'touch') document.body.classList.add('touch');
    jp = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; knob.style.transform = ''; joy.classList.remove('hidden');
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!jp || e.pointerId !== jp.id) return; let dx = e.clientX - jp.x, dy = e.clientY - jp.y; const d = Math.hypot(dx, dy), R = 52;
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; } jp.dx = dx / R; jp.dy = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const endJoy = (e) => { if (jp && e.pointerId === jp.id) { jp = null; joy.classList.add('hidden'); } };
  cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  function readInput() {
    let mx = 0, my = 0; for (const k in MOVE) if (keys[k]) { mx += MOVE[k][0]; my += MOVE[k][1]; }
    if (jp) { mx += jp.dx; my += jp.dy; }
    G.input.mx = mx; G.input.my = my;
  }

  /* ── 루프 ── */
  let last = performance.now(), tt = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    readInput(); G.audio.tick();
    if (G.mode === 'game' && G.state) {
      G.game.update(dt); if (G.state) { G.game.render(ctx, W, H, dpr); G.ui.update(dt); }
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); G.art.drawTitleScene(ctx, W, H, tt, (G.CHARS[G.save.lastChar] || G.CHARS.minji).pal);
    }
    if (G.ui.portraits.length) G.ui.drawPortraits(tt);
    requestAnimationFrame(frame);
  }

  G.art.makeSprites(); G.art.loadCharSprites(G.CHAR_ORDER);
  G.audio.musicOn = G.save.settings.music; G.audio.sfxOn = G.save.settings.sfx;
  G.ui.showTitle();
  requestAnimationFrame(frame);
})();
