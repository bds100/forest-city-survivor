/* 밸런스 점검용 자동 플레이 봇 (개발 도구) — 콘솔에서 runBot('normal', 16) */
window.runBot = function (diff, maxDays, ch) {
  const G = window.G; G.ui.startRun(ch || 'minji', diff); G.mode = 'sim';
  const S = G.state, W = G.WORLD, log = []; let lastDay = 0, steps = 0;
  const prio = ['bench', 'tower', 'tree', 'garden', 'fence', 'drone', 'fire'];
  const _t = G.ui.toast; G.ui.toast = () => {};
  while (!S.over && !S.won && S.day <= maxDays && steps < 900000) {
    steps++;
    if (G.ui.modalKind === 'levelup') { G.ui.pickCard(0); continue; }
    if (G.ui.modalKind) G.ui.close(true);
    const p = S.player; let tx, ty; const danger = S.isNight || p.hp < p.maxHp * 0.4;
    if (danger) {
      const a = S.time * 1.1; tx = W.cx + Math.cos(a) * 125; ty = W.cy - 30 + Math.sin(a) * 95;
      let xp = null, xd = 200 * 200; for (const k of S.pickups) { const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2; if (d < xd) { xd = d; xp = k; } }
      if (xp && p.hp > p.maxHp * 0.5) { tx = xp.x; ty = xp.y; }
      let fx = 0, fy = 0;
      for (const e of S.enemies) { if (!e.boss && !e.elite) continue; const ex = p.x - e.x, ey = p.y - e.y, d = Math.hypot(ex, ey), rr = e.boss ? 240 : 150; if (d < rr) { fx += (ex / d) * (rr - d); fy += (ey / d) * (rr - d); } }
      for (const b of S.ebullets) { const ex = p.x - b.x, ey = p.y - b.y, d = Math.hypot(ex, ey); if (d < 70) { fx += (ex / d) * 60; fy += (ey / d) * 60; } }
      if (fx || fy) { tx = p.x + fx * 3 + (tx - p.x) * 0.2; ty = p.y + fy * 3 + (ty - p.y) * 0.2; }
    } else {
      let best = null, bd = 1e18;
      for (const n of S.nodes) { if (n.hp <= 0) continue; if (n.kind === 'bush' && S.res.food > 30) continue; const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2, dc = (n.x - W.cx) ** 2 + (n.y - W.cy) ** 2; if (dc > 1500 * 1500) continue; if (d < bd) { bd = d; best = n; } }
      if (best) { tx = best.x; ty = best.y + best.cr + 20; } else { tx = W.cx; ty = W.cy + 150; }
      if (S.clock > G.TIME.day - 12) { tx = W.cx; ty = W.cy + 150; }
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy); G.input.mx = d > 8 ? dx / d : 0; G.input.my = d > 8 ? dy / d : 0;
    if (S.inCamp) for (const id of prio) { const b = G.BUILD.find((x) => x.id === id), c = G.game.cost(b); if (c && G.game.canAfford(c)) { G.game.upgrade(id); break; } }
    G.game.update(1 / 30);
    if (S.day !== lastDay) { lastDay = S.day; log.push([S.day, 'L' + S.level, Math.round(p.hp) + '/' + p.maxHp, 'T' + Math.round(S.tree.hp) + '/' + S.tree.maxHp, 'k' + S.kills, Object.values(S.res).join('/'), Object.values(S.build).join('')].join(' ')); }
  }
  G.input.mx = G.input.my = 0; G.ui.toast = _t;
  return { over: S.over, won: S.won, day: S.day, night: S.isNight, clock: Math.round(S.clock), lvl: S.level, hp: Math.round(S.player.hp), tree: Math.round(S.tree.hp), skills: S.skills, log };
};
