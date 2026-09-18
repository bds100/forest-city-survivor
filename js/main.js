/* 메인 루프 / 입력 */
(function () {
  const G = window.G, cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  G.input = { mx: 0, my: 0, dash: false, attack: false, place: false, mouse: { x: 0, y: 0, on: false } };
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
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); if (e.repeat) return; keys[e.code] = true; G.audio.init();
    if (G.mode !== 'game') { if (e.code === 'Escape' && G.ui.modalKind && G.ui.modalKind !== 'end') G.ui.close(false); return; }
    const mk = G.ui.modalKind, S = G.state, soft = ['build', 'craft', 'villager', 'tree', 'pause'];
    if (e.code === 'Escape') { if (mk && soft.indexOf(mk) >= 0) G.ui.close(true); else if (!mk && S && S.build) G.game.setBuild(null); else if (!mk) G.ui.showPause(); return; }
    if (mk) { if ((e.code === 'KeyB' && mk === 'build') || (e.code === 'KeyE' && soft.indexOf(mk) >= 0 && mk !== 'pause')) G.ui.close(true); return; }
    if (!S || S.over) return;
    if (e.code === 'Space') { if (S.build) G.input.place = true; }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.input.dash = true;
    else if (e.code === 'KeyB') G.ui.showBuildMenu();
    else if (e.code === 'KeyX') G.game.setBuild(S.build === 'remove' ? null : 'remove');
    else if (e.code === 'KeyE') G.game.interact();
    else if (e.code === 'KeyP') G.ui.showPause();
    else if (/^Digit[1-6]$/.test(e.code)) G.ui.hot(G.HOTBAR[+e.code.slice(-1) - 1]);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; G.input.attack = false; if (G.mode === 'game' && G.state && !G.state.over && !G.ui.modalKind) G.ui.showPause(); });
  window.addEventListener('beforeunload', () => { if (G.mode === 'game') G.game.saveRun(); });

  /* ── 포인터: 마우스 = 조준·공격·설치 / 터치 = 드래그 조이스틱 ── */
  const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  let jp = null, mouseDown = false;
  cv.addEventListener('pointerdown', (e) => {
    G.audio.init(); if (G.mode !== 'game' || !G.state) return;
    if (e.pointerType === 'mouse') { if (e.button === 2) { if (G.state.build) G.game.setBuild(null); return; } G.input.mouse.x = e.clientX; G.input.mouse.y = e.clientY; G.input.mouse.on = true; mouseDown = true; if (G.state.build) G.input.place = true; return; }
    document.body.classList.add('touch'); G.input.mouse.on = false; if (jp) return;
    jp = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; knob.style.transform = ''; joy.classList.remove('hidden');
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { G.input.mouse.x = e.clientX; G.input.mouse.y = e.clientY; G.input.mouse.on = true; if (mouseDown && G.state && G.state.build && G.state.build !== 'remove' && e.buttons === 1 && G.state.ghost && G.state.ghost.ok) G.input.place = true; return; }
    if (!jp || e.pointerId !== jp.id) return; let dx = e.clientX - jp.x, dy = e.clientY - jp.y; const d = Math.hypot(dx, dy), R = 52;
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; } jp.dx = dx / R; jp.dy = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const endPtr = (e) => { if (e.pointerType === 'mouse') { mouseDown = false; return; } if (jp && e.pointerId === jp.id) { jp = null; joy.classList.add('hidden'); } };
  window.addEventListener('pointerup', endPtr); window.addEventListener('pointercancel', endPtr);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  function readInput() {
    let mx = 0, my = 0; for (const k in MOVE) if (keys[k]) { mx += MOVE[k][0]; my += MOVE[k][1]; }
    if (jp) { mx += jp.dx; my += jp.dy; }
    G.input.mx = mx; G.input.my = my; if (!G.input.attackBtn) G.input.attack = !!(keys.Space || mouseDown) && !G.ui.modalKind;
  }

  /* ── 루프 ── */
  let last = performance.now(), tt = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    readInput(); G.audio.tick();
    if (G.mode === 'game' && G.state) { G.game.update(dt); if (G.state) { G.game.render(ctx, W, H, dpr); G.ui.update(dt); } }
    else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); G.art.drawTitleScene(ctx, W, H, tt, (G.CHARS[G.save.lastChar] || G.CHARS.minji).pal); }
    if (G.ui.portraits.length) G.ui.drawPortraits(tt);
    requestAnimationFrame(frame);
  }

  G.art.makeSprites(); G.art.loadCharSprites(G.CHAR_ORDER);
  G.audio.musicOn = G.save.settings.music; G.audio.sfxOn = G.save.settings.sfx;
  G.ui.showTitle();
  requestAnimationFrame(frame);
})();
