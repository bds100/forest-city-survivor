/* UI — 타이틀 / HUD / 모달 (DOM) */
(function () {
  const G = window.G, Game = G.game, $ = (id) => document.getElementById(id);
  const UI = (G.ui = { portraits: [], modalKind: null });
  const modal = $('modal'), panel = $('panel');
  const click = () => G.audio.sfx('click');

  function open(kind, html, narrow) {
    UI.modalKind = kind; UI.portraits = []; panel.className = 'panel' + (narrow ? ' narrow' : ''); panel.innerHTML = html; modal.classList.remove('hidden');
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
  }
  function close(resume) { modal.classList.add('hidden'); UI.modalKind = null; UI.portraits = []; if (resume && G.state) G.state.paused = false; }
  UI.close = close;

  UI.toast = function (msg, ms) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms || 2600);
  };

  /* ───────── 타이틀 ───────── */
  UI.showTitle = function () {
    G.mode = 'title'; G.state = null; $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); close(false);
    $('titleSeeds').textContent = '🌱 ' + G.save.seeds; G.audio.mood = 'title';
  };
  $('btnStart').onclick = () => { G.audio.init(); click(); UI.showSelect(); };
  $('btnMeta').onclick = () => { G.audio.init(); click(); UI.showMeta(); };
  $('btnHelp').onclick = () => { G.audio.init(); click(); UI.showHelp(); };

  /* ───────── 캐릭터 / 난이도 선택 ───────── */
  UI.showSelect = function () {
    let selC = G.CHARS[G.save.lastChar] ? G.save.lastChar : 'minji', selD = G.DIFF[G.save.lastDiff] ? G.save.lastDiff : 'normal';
    const render = () => {
      const chips = G.CHAR_ORDER.map((id) => { const c = G.CHARS[id]; return `<div class="chip ${selC === id ? 'sel' : ''}" data-c="${id}"><canvas width="150" height="150" data-pal="${id}"></canvas><b>${c.name}</b></div>`; }).join('');
      const c = G.CHARS[selC], w = G.SKILLS[c.weapon];
      const diffs = G.DIFF_ORDER.map((id) => { const d = G.DIFF[id]; return `<div class="diff ${selD === id ? 'sel' : ''}" data-d="${id}" style="${selD === id ? `background:${d.color}` : ''}">${d.icon} ${d.name}</div>`; }).join('');
      const d = G.DIFF[selD], best = G.save.best[selD], wins = G.save.wins[selD];
      open('select', `<h2>누구와 떠날까요?</h2><div class="chips">${chips}</div>
        <div class="chardetail"><h3>${c.name} <small>${c.title}</small></h3><p>${c.desc}</p><span class="perk">${c.perk}</span> <span class="perk wp">시작 무기 ${w.icon} ${w.name}</span></div>
        <div class="diffs">${diffs}</div>
        <div class="diffdesc"><b>${d.icon} ${d.name}</b> — ${d.desc}<br>적 체력 ×${d.hp} · 적 공격 ×${d.dmg} · 채집량 ×${d.yield} · 🌱 보상 ×${d.reward}${best ? ` · 최고 기록 ${best}일차` : ''}${wins ? ` · 🌳 ${wins}회 정화` : ''}</div>
        <div class="row"><button class="btn" id="selBack">돌아가기</button><button class="btn big" id="selGo">🌿 출발!</button></div>`);
      panel.querySelectorAll('canvas[data-pal]').forEach((cv) => UI.portraits.push({ cv, pal: G.CHARS[cv.dataset.pal].pal }));
      panel.querySelectorAll('[data-c]').forEach((el) => (el.onclick = () => { click(); selC = el.dataset.c; G.save.lastChar = selC; render(); }));
      panel.querySelectorAll('[data-d]').forEach((el) => (el.onclick = () => { click(); selD = el.dataset.d; render(); }));
      $('selBack').onclick = () => { click(); G.persist(); close(false); };
      $('selGo').onclick = () => { click(); UI.startRun(selC, selD); };
    };
    render();
  };
  UI.startRun = function (c, d) {
    close(false); $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); Game.newRun(c, d); G.mode = 'game'; lastSkillKey = ''; buildRes();
    $('diffTag').textContent = `${G.DIFF[d].icon} ${G.DIFF[d].name}`;
    if (G.save.runs <= 1) setTimeout(() => UI.toast('🌳 나무·🚗 폐차·🍓 덤불 옆에 서면 자동으로 채집해요. 밤이 오기 전에 거점(🏕️)을 발전시키세요!', 7000), 1200);
  };

  /* ───────── 영구 강화 ───────── */
  UI.showMeta = function () {
    const render = () => {
      const items = G.META.map((m) => { const l = G.save.meta[m.id] || 0, max = l >= m.max, cost = max ? 0 : m.cost(l); return `<div class="bcard"><div class="ico">${m.icon}</div><h3>${m.name}<span class="pips">${'●'.repeat(l)}${'○'.repeat(m.max - l)}</span></h3><p>${l ? '현재: ' + m.desc(l) : '아직 배우지 않음'}${max ? '' : `<br><span class="next">다음: ${m.desc(l + 1)}</span>`}</p><div class="foot2"><div class="cost"><span class="${G.save.seeds < cost ? 'no' : ''}">${max ? '최대' : '🌱 ' + cost}</span></div><button class="btn small green" data-m="${m.id}" ${max || G.save.seeds < cost ? 'disabled' : ''}>배우기</button></div></div>`; }).join('');
      open('meta', `<h2>🌱 기억의 정원</h2><div class="sub">모험에서 가져온 기억의 씨앗으로 영원히 남는 힘을 키웁니다 · 보유 <b>🌱 ${G.save.seeds}</b><br><small>※ 하드코어 난이도에서는 적용되지 않습니다</small></div><div class="grid c2">${items}</div><div class="row"><button class="btn" id="mBack">돌아가기</button></div>`);
      panel.querySelectorAll('[data-m]').forEach((el) => (el.onclick = () => { const m = G.META.find((x) => x.id === el.dataset.m), l = G.save.meta[m.id] || 0, cost = m.cost(l); if (G.save.seeds < cost) return; G.save.seeds -= cost; G.save.meta[m.id] = l + 1; G.persist(); G.audio.sfx('build'); $('titleSeeds').textContent = '🌱 ' + G.save.seeds; const sc = panel.scrollTop; render(); panel.scrollTop = sc; }));
      $('mBack').onclick = () => { click(); close(false); };
    };
    render();
  };

  /* ───────── 도움말 ───────── */
  UI.showHelp = function (inGame) {
    open('help', `<h2>📖 생존 수첩</h2><div class="help">
      <h3>하루의 흐름</h3><ul><li><b>낮</b> — 폐허를 돌아다니며 🪵나무 · ⚙️고철 · 🍓식량을 모읍니다. 자원 옆에 서 있으면 자동으로 채집해요.</li><li><b>밤</b> — 검은 안개의 괴물들이 몰려옵니다. 공격은 자동! 움직임과 위치 선정에 집중하세요.</li><li>새벽이 오면 남은 괴물은 햇빛에 사라지고, 텃밭·드론이 자원을 가져다줍니다.</li></ul>
      <h3>거점과 생명나무</h3><ul><li>거점 안에서 <kbd>E</kbd> 를 눌러 건물을 짓고 발전시킵니다. 모닥불 근처에서는 체력이 회복돼요.</li><li>🌳 <b>생명나무를 5단계까지 키우면 이 땅이 정화됩니다 (승리).</b> 💎에테르 결정이 필요해요.</li><li>결정은 밤의 고철 골렘, 5일마다 오는 보스, 먼 곳의 결정 광맥에서 얻습니다.</li><li>생명나무가 쓰러지거나 내가 쓰러지면 모험이 끝납니다.</li></ul>
      <h3>성장</h3><ul><li>괴물이 떨어뜨린 빛씨앗으로 레벨업 → 카드 3장 중 하나를 고릅니다. ✨반짝 카드는 +2레벨!</li><li>허기가 0이 되면 체력이 줄어요. 식량은 자동으로 먹습니다.</li><li>모험이 끝나면 🌱기억의 씨앗을 얻어 <b>기억의 정원</b>에서 영구 강화를 배울 수 있어요.</li></ul>
      <h3>조작</h3><ul><li>이동 <kbd>WASD</kbd>/<kbd>방향키</kbd> · 대시(무적) <kbd>Space</kbd> · 거점 <kbd>E</kbd> · 일시정지 <kbd>Esc</kbd></li><li>모바일: 화면을 드래그해 이동, 💨 버튼으로 대시</li></ul></div>
      <div class="row"><button class="btn green" id="hBack">알겠어요</button></div>`, true);
    $('hBack').onclick = () => { click(); if (inGame) UI.showPause(); else close(false); };
  };

  /* ───────── 레벨업 ───────── */
  UI.showLevelUp = function (cards) {
    const S = G.state; S.paused = true; UI.cards = cards;
    const html = cards.map((c, i) => `<div class="card ${c.shiny ? 'shiny' : ''}" data-i="${i}"><span class="key">${i + 1}</span><div class="ico">${c.icon}</div>${c.type ? `<span class="tag ${c.type}">${c.type === 'w' ? '무기' : '패시브'}</span>` : ''}<h3>${c.name}</h3>${c.to ? `<div class="lvl">${c.from ? `Lv.${c.from} → Lv.${c.to}` : '새로 배우기!' + (c.to > 1 ? ` Lv.${c.to}` : '')}</div>` : ''}<p>${c.desc}</p></div>`).join('');
    open('levelup', `<h2>✨ 레벨 업! Lv.${S.level}</h2><div class="sub">하나를 골라 주세요 <small>(숫자키 1·2·3)</small></div><div class="grid c3">${html}</div><div class="row"><button class="btn small" id="reroll" ${S.rerolls > 0 ? '' : 'disabled'}>🎲 다시 뽑기 (${S.rerolls})</button></div>`);
    panel.querySelectorAll('[data-i]').forEach((el) => (el.onclick = () => UI.pickCard(+el.dataset.i)));
    $('reroll').onclick = () => { if (S.rerolls <= 0) return; S.rerolls--; click(); UI.showLevelUp(Game.rollCards()); };
  };
  UI.pickCard = function (i) { if (UI.modalKind !== 'levelup' || !UI.cards[i]) return; G.audio.sfx('build'); Game.applyCard(UI.cards[i]); lastSkillKey = ''; close(true); };

  /* ───────── 거점 관리 ───────── */
  UI.showBuild = function () {
    const S = G.state; if (!S || S.over || UI.modalKind || !S.inCamp) return; if (S.diff.pauseBuild) S.paused = true; click();
    const render = () => {
      const res = Object.keys(G.RES).map((k) => `<span>${G.RES[k].icon} ${S.res[k]}</span>`).join('');
      const items = G.BUILD.map((b) => { const l = S.build[b.id], cost = Game.cost(b), ok = Game.canAfford(cost); return `<div class="bcard"><div class="ico">${b.icon}</div><h3>${b.name}<span>${l ? 'Lv.' + l : '미건설'}</span> <span class="pips">${'●'.repeat(l)}${'○'.repeat(b.max - l)}</span></h3><p>${b.lore}${l ? `<br>현재: ${b.eff(l)}` : ''}${cost ? `<br><span class="next">다음: ${b.eff(l + 1)}</span>` : ''}</p><div class="foot2"><div class="cost">${cost ? Object.keys(cost).map((k) => `<span class="${S.res[k] < cost[k] ? 'no' : ''}">${G.RES[k].icon} ${cost[k]}</span>`).join('') : '<span>최대 레벨</span>'}</div><button class="btn small green" data-b="${b.id}" ${ok ? '' : 'disabled'}>${l ? '발전' : '건설'}</button></div></div>`; }).join('');
      open('build', `<h2>🏕️ 거점 관리</h2><div class="sub">${S.diff.pauseBuild ? '생명나무를 5단계까지 키우면 이 땅이 정화됩니다' : '💀 하드코어: 시간이 멈추지 않습니다!'}</div><div class="reshead">${res}</div><div class="grid c2">${items}</div><div class="row"><button class="btn" id="bClose">닫기 <kbd>E</kbd></button></div>`);
      panel.querySelectorAll('[data-b]').forEach((el) => (el.onclick = () => { if (Game.upgrade(el.dataset.b)) { const sc = panel.scrollTop; if (UI.modalKind === 'build') { render(); panel.scrollTop = sc; } } }));
      $('bClose').onclick = () => { click(); close(true); };
    };
    render();
  };

  /* ───────── 이벤트 ───────── */
  UI.showEvent = function (ev) {
    const S = G.state; if (UI.modalKind) return; S.paused = true;
    const ch = ev.choices.map((c, i) => { const ok = !c.need || Object.keys(c.need).every((k) => S.res[k] >= c.need[k]); return `<button class="btn" data-i="${i}" ${ok ? '' : 'disabled'}>${c.label}${ok ? '' : ' <small>(부족)</small>'}</button>`; }).join('');
    open('event', `<div class="evt-ico">${ev.icon}</div><h2>${ev.title}</h2><div class="evt-text">${ev.text}</div><div class="choices">${ch}</div>`, true);
    panel.querySelectorAll('[data-i]').forEach((el) => (el.onclick = () => { click(); const c = ev.choices[+el.dataset.i]; if (c.need) Object.keys(c.need).forEach((k) => (S.res[k] -= c.need[k])); const msg = c.run(S, Game); Game.recalc(); open('event', `<div class="evt-ico">${ev.icon}</div><h2>${ev.title}</h2><div class="evt-text">${msg}</div><div class="row"><button class="btn green" id="evOk">확인</button></div>`, true); $('evOk').onclick = () => { click(); close(true); }; }));
  };

  /* ───────── 일시정지 ───────── */
  UI.showPause = function () {
    const S = G.state; if (!S || S.over) return; S.paused = true; const st = G.save.settings;
    const tg = (id, label, on) => `<div class="toggle"><span>${label}</span><button class="btn small ${on ? 'green' : ''}" data-t="${id}">${on ? '켜짐' : '꺼짐'}</button></div>`;
    open('pause', `<h2>⏸ 잠시 쉬어가기</h2><div class="sub">${S.day}일차 · ${S.diff.icon} ${S.diff.name} · ${S.char.name}</div>${tg('music', '🎵 배경 음악', st.music)}${tg('sfx', '🔔 효과음', st.sfx)}${tg('shake', '📳 화면 흔들림', st.shake)}
      <div class="row"><button class="btn green" id="pResume">계속하기</button><button class="btn" id="pHelp">📖 생존 수첩</button><button class="btn red" id="pQuit">모험 포기</button></div>`, true);
    panel.querySelectorAll('[data-t]').forEach((el) => (el.onclick = () => { const k = el.dataset.t; st[k] = !st[k]; G.persist(); G.audio.setMusic(st.music); G.audio.setSfx(st.sfx); click(); UI.showPause(); }));
    $('pResume').onclick = () => { click(); close(true); }; $('pHelp').onclick = () => { click(); UI.showHelp(true); };
    $('pQuit').onclick = () => { click(); close(false); G.state.paused = false; Game.giveUp(); };
  };

  /* ───────── 결과 ───────── */
  UI.showEnd = function (reason, gain) {
    const S = G.state, win = reason === 'win';
    const T = { win: ['🌳 생명나무가 만개했습니다', '검은 안개가 걷히고, 도시는 다시 숲이 되었습니다.'], death: ['🍂 모험이 끝났습니다', '검은 안개 속에서 쓰러졌습니다. 하지만 기억은 남습니다.'], tree: ['🥀 생명나무가 쓰러졌습니다', '마지막 묘목을 지키지 못했습니다...'], hunger: ['🍽️ 배고픔에 쓰러졌습니다', '다음에는 식량을 더 챙겨야겠어요.'], quit: ['🎒 모험을 마쳤습니다', '다음 여정을 기약합니다.'] }[reason];
    const skills = Object.keys(S.skills).filter((k) => S.skills[k] > 0).map((k) => `${G.SKILLS[k].icon}${S.skills[k]}`).join(' ');
    open('end', `<h2>${T[0]}</h2><div class="sub">${T[1]}</div><div class="stats"><div>생존 <b>${S.day}일차</b></div><div>레벨 <b>Lv.${S.level}</b></div><div>처치 <b>${S.kills}</b></div><div>보스 처치 <b>${S.bossKills}</b></div><div>생명나무 <b>Lv.${S.build.tree}</b></div><div>난이도 <b>${S.diff.icon} ${S.diff.name}</b></div></div><div class="sub">${skills}</div><div class="gain">🌱 기억의 씨앗 +${gain}</div>
      <div class="row">${win ? '<button class="btn green" id="eCont">계속 살아가기 <small>무한 모드</small></button>' : ''}<button class="btn ${win ? '' : 'green'}" id="eRetry">다시 도전</button><button class="btn" id="eTitle">타이틀로</button></div>`, true);
    if (win) $('eCont').onclick = () => { click(); close(true); UI.toast('🌸 정화된 땅에서의 삶은 계속됩니다. 얼마나 버틸 수 있을까요?', 4000); };
    $('eRetry').onclick = () => { click(); UI.startRun(S.char.id, S.diff.id); }; $('eTitle').onclick = () => { click(); UI.showTitle(); };
  };

  /* ───────── HUD ───────── */
  function buildRes() { $('res').innerHTML = Object.keys(G.RES).map((k) => `<div id="res-${k}"><span>${G.RES[k].icon}</span><b>0</b></div>`).join(''); }
  UI.bump = function (k) { const el = $('res-' + k); if (!el) return; el.classList.add('bump'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('bump'), 130); };
  let lastSkillKey = '', lastBanner = null, hudT = 0, miniT = 0;
  UI.update = function (dt) {
    const S = G.state; if (!S || G.mode !== 'game') return;
    if (S.banner !== lastBanner) { lastBanner = S.banner; const b = $('banner'); if (S.banner) { b.querySelector('h2').textContent = S.banner.title; b.querySelector('p').textContent = S.banner.sub || ''; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; } else b.classList.add('hidden'); }
    hudT -= dt; if (hudT > 0) return; hudT = 0.1; const p = S.player;
    $('hpFill').style.transform = `scaleX(${Math.max(0, p.hp / p.maxHp)})`; $('hpTxt').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
    $('hgFill').style.transform = `scaleX(${p.hunger / 100})`; $('hgTxt').textContent = p.hunger <= 0 ? '배고파요!' : '';
    $('hgFill').parentNode.classList.toggle('low', p.hunger < 20);
    $('xpFill').style.width = (S.xp / S.xpNeed) * 100 + '%'; $('lvl').textContent = 'Lv.' + S.level;
    Object.keys(G.RES).forEach((k) => { const el = $('res-' + k); if (el) el.lastChild.textContent = S.res[k]; });
    const tot = S.isNight ? G.TIME.night : G.TIME.day; $('clockIcon').textContent = S.isNight ? '🌙' : '☀️'; $('dayTxt').textContent = S.day + '일차'; $('wxTxt').textContent = G.WEATHER[S.weather].icon;
    $('clockFill').style.width = (1 - S.clock / tot) * 100 + '%'; $('clockFill').parentNode.classList.toggle('night', S.isNight);
    $('btnBuild').classList.toggle('off', !S.inCamp || !!UI.modalKind);
    const bb = $('bossbar'); if (S.boss && !S.boss.dead) { bb.classList.remove('hidden'); $('bossFill').style.width = (S.boss.hp / S.boss.maxHp) * 100 + '%'; } else bb.classList.add('hidden');
    const key = JSON.stringify(S.skills); if (key !== lastSkillKey) { lastSkillKey = key; $('skills').innerHTML = Object.keys(S.skills).filter((k) => S.skills[k] > 0).sort((a, b) => (G.SKILLS[a].type > G.SKILLS[b].type ? -1 : 1)).map((k) => `<div class="skill ${G.SKILLS[k].type}" title="${G.SKILLS[k].name}">${G.SKILLS[k].icon}<em>${S.skills[k]}</em></div>`).join(''); }
    miniT -= 0.1; if (miniT <= 0) { miniT = 0.3; drawMini(S); }
  };
  function drawMini(S) {
    const cv = $('mini'), c = cv.getContext('2d'), N = cv.width, k = N / G.WORLD.size; c.fillStyle = S.isNight ? '#3d5a5c' : '#9fd47c'; c.fillRect(0, 0, N, N);
    c.fillStyle = 'rgba(200,195,180,.8)'; c.fillRect((G.WORLD.cx - 430) * k - 2, 0, 4, N); c.fillRect(0, (G.WORLD.cy + 380) * k - 2, N, 4);
    const col = { tree: '#3f7f4c', wreck: '#b9824a', bush: '#f7b4cc', crystal: '#7ff0f0' };
    for (const n of S.nodes) { if (n.hp <= 0) continue; c.fillStyle = col[n.kind]; const s = n.kind === 'crystal' ? 4 : 2; c.fillRect(n.x * k - s / 2, n.y * k - s / 2, s, s); }
    c.fillStyle = '#ff2a2a'; for (const e of S.enemies) { const s = e.boss ? 7 : e.elite ? 5 : 3; c.fillRect(e.x * k - s / 2, e.y * k - s / 2, s, s); }
    c.fillStyle = '#ffe27a'; c.strokeStyle = '#4a3a30'; c.lineWidth = 1.5; c.beginPath(); c.arc(G.WORLD.cx * k, G.WORLD.cy * k, 5, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(S.player.x * k, S.player.y * k, 3.5, 0, 7); c.fill(); c.stroke();
    if (S.view) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(S.view.x0 * k, S.view.y0 * k, (S.view.x1 - S.view.x0) * k, (S.view.y1 - S.view.y0) * k); }
  }

  /* 선택 화면 초상화 애니메이션 */
  UI.drawPortraits = function (t) {
    for (const p of UI.portraits) { const c = p.cv.getContext('2d'); c.clearRect(0, 0, 150, 150); const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#bfe6f7'); g.addColorStop(0.7, '#f5f0d2'); g.addColorStop(1, '#a9d67a'); c.fillStyle = g; c.beginPath(); c.arc(75, 75, 72, 0, 7); c.fill(); c.save(); c.beginPath(); c.arc(75, 75, 72, 0, 7); c.clip(); const im = G.art.charImg[p.pal.sid]; G.art.drawChar(c, { x: im ? 75 : 78, y: im ? 232 : 146, t, walk: 0, moving: false, facing: 1, scale: im ? 2.7 : 1.75, pal: p.pal, seed: p.pal.hair.charCodeAt(2) * 0.37, wind: 0.8 }); c.restore(); }
  };

  $('btnPause').onclick = () => { if (!UI.modalKind) { click(); UI.showPause(); } };
  $('btnBuild').onclick = () => UI.showBuild();
  $('btnDash').addEventListener('pointerdown', (e) => { e.preventDefault(); G.input.dash = true; });
})();
