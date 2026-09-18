/* UI — 타이틀 / HUD / 건설 핫바 / 모달 (DOM) */
(function () {
  const G = window.G, Game = G.game, $ = (id) => document.getElementById(id);
  const UI = (G.ui = { portraits: [], modalKind: null });
  const modal = $('modal'), panel = $('panel');
  const click = () => G.audio.sfx('click');
  const costHtml = (cost, S) => Object.keys(cost).map((k) => `<span class="${S.res[k] < cost[k] ? 'no' : ''}">${G.RES[k].icon} ${cost[k]}</span>`).join('');

  function open(kind, html, narrow) {
    UI.modalKind = kind; UI.portraits = []; panel.className = 'panel' + (narrow ? ' narrow' : ''); panel.innerHTML = html; modal.classList.remove('hidden');
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
  }
  function close(resume) { modal.classList.add('hidden'); UI.modalKind = null; UI.portraits = []; if (resume && G.state) G.state.paused = false; }
  UI.close = close;
  const softPause = (S) => { if (S.diff.pauseBuild) S.paused = true; };

  UI.toast = function (msg, ms) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; const box = $('toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms || 2600);
  };

  /* ───────── 타이틀 ───────── */
  UI.showTitle = function () {
    G.mode = 'title'; G.state = null; $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); close(false);
    $('titleSeeds').textContent = '🌱 ' + G.save.seeds; G.audio.mood = 'title';
    const has = Game.hasRun(), b = $('btnContinue'); b.classList.toggle('hidden', !has); $('btnStart').classList.toggle('big', !has);
    if (has) { const r = G.save.run; b.innerHTML = `🏡 이어하기 <small>${G.CHARS[r.char].name} · ${r.day}일차 · ${G.DIFF[r.diff].name}</small>`; }
  };
  $('btnContinue').onclick = () => { G.audio.init(); click(); enterGame(() => Game.continueRun()); };
  $('btnStart').onclick = () => { G.audio.init(); click(); UI.showSelect(); };
  $('btnMeta').onclick = () => { G.audio.init(); click(); UI.showMeta(); };
  $('btnHelp').onclick = () => { G.audio.init(); click(); UI.showHelp(); };

  /* ───────── 캐릭터 / 난이도 선택 ───────── */
  UI.showSelect = function () {
    let selC = G.CHARS[G.save.lastChar] ? G.save.lastChar : 'minji', selD = G.DIFF[G.save.lastDiff] ? G.save.lastDiff : 'normal';
    const render = () => {
      const chips = G.CHAR_ORDER.map((id) => `<div class="chip ${selC === id ? 'sel' : ''}" data-c="${id}"><canvas width="150" height="150" data-pal="${id}"></canvas><b>${G.CHARS[id].name}</b></div>`).join('');
      const c = G.CHARS[selC], diffs = G.DIFF_ORDER.map((id) => { const d = G.DIFF[id]; return `<div class="diff ${selD === id ? 'sel' : ''}" data-d="${id}" style="${selD === id ? `background:${d.color}` : ''}">${d.icon} ${d.name}</div>`; }).join('');
      const d = G.DIFF[selD], best = G.save.best[selD], wins = G.save.wins[selD];
      open('select', `<h2>누구로 시작할까요?</h2><div class="sub">나머지 친구들은 폐허 어딘가에서 구조를 기다리고 있어요</div><div class="chips">${chips}</div>
        <div class="chardetail"><h3>${c.name} <small>${c.title}</small></h3><p>${c.desc}</p><span class="perk">${c.perk}</span></div>
        <div class="diffs">${diffs}</div>
        <div class="diffdesc"><b>${d.icon} ${d.name}</b> — ${d.desc}<br>적 체력 ×${d.hp} · 적 공격 ×${d.dmg} · 채집량 ×${d.yield} · 🌱 보상 ×${d.reward}${best ? ` · 최고 기록 ${best}일차` : ''}${wins ? ` · 🌳 ${wins}회 정화` : ''}</div>
        ${Game.hasRun() ? '<div class="sub" style="color:#a3261c;margin-top:8px">※ 새 모험을 시작하면 저장된 거점은 사라집니다</div>' : ''}
        <div class="row"><button class="btn" id="selBack">돌아가기</button><button class="btn big" id="selGo">🌿 출발!</button></div>`);
      panel.querySelectorAll('canvas[data-pal]').forEach((cv) => UI.portraits.push({ cv, pal: G.CHARS[cv.dataset.pal].pal }));
      panel.querySelectorAll('[data-c]').forEach((el) => (el.onclick = () => { click(); selC = el.dataset.c; G.save.lastChar = selC; render(); }));
      panel.querySelectorAll('[data-d]').forEach((el) => (el.onclick = () => { click(); selD = el.dataset.d; render(); }));
      $('selBack').onclick = () => { click(); G.persist(); close(false); };
      $('selGo').onclick = () => { click(); UI.startRun(selC, selD); };
    };
    render();
  };
  function enterGame(start) {
    close(false); $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); start(); G.mode = 'game'; lastStatus = ''; lastHot = ''; buildRes();
    $('diffTag').textContent = `${G.state.diff.icon} ${G.state.diff.name}`;
  }
  UI.startRun = function (c, d) {
    enterGame(() => Game.newRun(c, d));
    setTimeout(() => UI.toast('🪵 나무 옆에 서면 자동으로 캡니다. 아래 핫바(또는 B)로 벽·문·침대를 놓아 집을 지어 보세요!', 7000), 1200);
    setTimeout(() => UI.toast('🏠 벽과 문으로 빈틈없이 둘러싼 방에 침대를 놓으면 지붕이 덮이며 집이 됩니다', 7000), 9000);
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
      <h3>집 짓기</h3><ul><li>아래 <b>핫바</b>나 <kbd>B</kbd> 로 건설 메뉴를 열고, 마우스로 위치를 정해 <b>클릭</b>(모바일은 [설치] 버튼)으로 놓습니다. <kbd>X</kbd> 는 철거(자원 절반 회수).</li><li><b>벽과 문으로 빈틈없이 둘러싼 방 안에 침대</b>를 놓으면 지붕이 덮이며 집이 됩니다. 집 안에서는 체력이 회복돼요.</li><li>작업대를 지으면 고철 벽·포탑과 더 좋은 도구·방어구를 만들 수 있습니다.</li></ul>
      <h3>하루의 흐름</h3><ul><li><b>낮</b> — 🪵나무 · ⚙️고철 · 🍓식량을 모읍니다. 자원 옆에 서 있으면 자동으로 채집해요. 텃밭은 시간이 지나면 열립니다.</li><li><b>밤</b> — 괴물들이 생명나무와 나를 노리고 몰려옵니다. 괴물은 벽을 <b>부수며</b> 들어오니 벽·함정·포탑으로 길목을 막고, <kbd>Space</kbd>/클릭으로 도구를 휘둘러 싸우세요.</li><li>집 안 빈 침대에서 <kbd>E</kbd> 로 잠을 자면 밤이 빨리 지나갑니다 (소란이 나면 깹니다).</li></ul>
      <h3>친구들 (주민)</h3><ul><li>아침마다 폐허 어딘가에서 <b>구조 신호</b>(지도의 노란 점 · 🆘)가 옵니다. 찾아가 <kbd>E</kbd> 로 데려오세요.</li><li>단, <b>빈 침대가 있는 집</b>이 있어야 따라옵니다. 주민은 벌목·고철 수집·농사·경비 일을 하고, 매일 아침 식량 2를 먹어요.</li></ul>
      <h3>목표</h3><ul><li>🌳 생명나무에 다가가 <kbd>E</kbd> — 💎에테르 결정으로 <b>5단계까지 키우면 이 땅이 정화됩니다 (승리).</b> 결정은 밤의 골렘·보스, 먼 곳의 결정 광맥에서 얻어요.</li><li>쓰러지면 자원 일부를 잃고 모닥불 곁에서 깨어납니다. 생명나무가 쓰러지면 끝. (하드코어는 쓰러지면 끝)</li><li>게임은 자동 저장되며 타이틀의 <b>이어하기</b>로 계속할 수 있어요.</li></ul>
      <h3>조작</h3><ul><li>이동 <kbd>WASD</kbd> · 공격 <kbd>Space</kbd>/클릭 · 대시 <kbd>Shift</kbd> · 건설 <kbd>B</kbd> · 철거 <kbd>X</kbd> · 상호작용 <kbd>E</kbd> · 핫바 <kbd>1</kbd>~<kbd>6</kbd> · 일시정지 <kbd>Esc</kbd></li><li>모바일: 화면 드래그로 이동, ⚔️ 공격, 💨 대시, 핫바 터치 후 [설치]</li></ul></div>
      <div class="row"><button class="btn green" id="hBack">알겠어요</button></div>`, true);
    $('hBack').onclick = () => { click(); if (inGame) UI.showPause(); else close(false); };
  };

  /* ───────── 건설 메뉴 ───────── */
  UI.showBuildMenu = function () {
    const S = G.state; if (!S || S.over || UI.modalKind) return; softPause(S); click();
    const res = Object.keys(G.RES).map((k) => `<span>${G.RES[k].icon} ${S.res[k]}</span>`).join('');
    const cats = Object.keys(G.CATS).map((cat) => `<h3 class="cat">${G.CATS[cat]}</h3><div class="grid c3">${G.STRUCT_ORDER.filter((id) => G.STRUCT[id].cat === cat).map((id) => { const d = G.STRUCT[id], ok = Game.unlocked(id), cost = Game.costOf(id); return `<div class="bcard pick ${ok ? '' : 'locked'}" data-s="${id}"><div class="ico">${d.icon}</div><h3>${d.name}</h3><p>${ok ? d.desc : '🔒 작업대를 먼저 지으세요'}</p><div class="foot2"><div class="cost">${costHtml(cost, S)}</div></div></div>`; }).join('')}</div>`).join('');
    const h = Game.housing();
    open('build', `<h2>🔨 무엇을 지을까요?</h2><div class="reshead">${res}<span>🏠 집 ${h.beds} · 👥 주민 ${S.villagers.length}</span></div>${cats}<div class="row"><button class="btn small red" id="bRemove">🧹 철거 모드 <kbd>X</kbd></button><button class="btn" id="bClose">닫기 <kbd>B</kbd></button></div>`);
    panel.querySelectorAll('[data-s]').forEach((el) => (el.onclick = () => { const id = el.dataset.s; if (!Game.unlocked(id)) { G.audio.sfx('deny'); return; } click(); close(true); Game.setBuild(id); }));
    $('bRemove').onclick = () => { click(); close(true); Game.setBuild('remove'); }; $('bClose').onclick = () => { click(); close(true); };
  };

  /* ───────── 작업대 제작 ───────── */
  UI.showCraft = function () {
    const S = G.state; if (UI.modalKind) return; softPause(S); click();
    const render = () => {
      const row = (kind, cur, nx, extra) => `<div class="bcard"><div class="ico">${(nx || cur).icon}</div><h3>${nx ? nx.name : cur.name}<span>${nx ? '' : '최고 등급'}</span></h3><p>현재: ${cur.name}${extra(cur)}${nx ? `<br><span class="next">제작 후: ${nx.name}${extra(nx)}</span>` : ''}</p><div class="foot2"><div class="cost">${nx ? costHtml(nx.cost, S) : ''}</div>${nx ? `<button class="btn small green" data-k="${kind}" ${Game.canAfford(nx.cost) ? '' : 'disabled'}>제작</button>` : ''}</div></div>`;
      const lan = G.LANTERN, lanHtml = `<div class="bcard"><div class="ico">${lan.icon}</div><h3>${lan.name}<span>${S.lantern ? '보유 중' : ''}</span></h3><p>${lan.desc}</p><div class="foot2"><div class="cost">${S.lantern ? '' : costHtml(lan.cost, S)}</div>${S.lantern ? '' : `<button class="btn small green" data-k="lantern" ${Game.canAfford(lan.cost) ? '' : 'disabled'}>제작</button>`}</div></div>`;
      open('craft', `<h2>🛠️ 작업대</h2><div class="reshead">${Object.keys(G.RES).map((k) => `<span>${G.RES[k].icon} ${S.res[k]}</span>`).join('')}</div><div class="grid c2">
        ${row('tool', G.TOOLS[S.tool], G.TOOLS[S.tool + 1], (t) => ` (공격 ${t.dmg} · 채집 ×${t.gather})`)}${row('armor', G.ARMORS[S.armor], G.ARMORS[S.armor + 1], (a) => ` (받는 피해 -${Math.round(a.armor * 100)}%)`)}${lanHtml}</div><div class="row"><button class="btn" id="cClose">닫기</button></div>`);
      panel.querySelectorAll('[data-k]').forEach((el) => (el.onclick = () => { if (Game.craft(el.dataset.k)) { lastStatus = ''; render(); } })); $('cClose').onclick = () => { click(); close(true); };
    };
    render();
  };

  /* ───────── 주민 ───────── */
  UI.showVillager = function (v) {
    const S = G.state; if (UI.modalKind) return; softPause(S); click(); const c = G.CHARS[v.id];
    const render = () => {
      const jobs = Object.keys(G.JOBS).map((j) => `<button class="btn ${v.job === j ? 'green' : ''}" data-j="${j}">${G.JOBS[j].icon} ${G.JOBS[j].name}</button>`).join('');
      const say = S.vhungry ? '"배고파서 힘이 안 나…"' : !v.bed || !v.bed.room ? '"내 방이 없어졌어… 침대 있는 집이 필요해."' : S.isNight ? '"밤엔 역시 집이 최고야."' : ['"오늘도 힘내자!"', '"이 마을, 점점 좋아지는걸?"', '"구해 줘서 고마워."'][(S.day + v.id.length) % 3];
      open('villager', `<canvas width="150" height="150" data-pal="${v.id}" style="display:block;margin:0 auto;width:110px;height:110px"></canvas><h2>${c.name}</h2><div class="sub">${c.title} · ${say}</div><div class="evt-text">무슨 일을 맡길까요?</div><div class="choices">${jobs}</div><div class="sub" style="margin-top:10px">벌목→🪵 · 고철 수집→⚙️ · 농사·채집→🍓(텃밭 우선) · 경비→밤에 괴물과 싸움<br>주민은 매일 아침 식량 2를 먹습니다</div><div class="row"><button class="btn" id="vClose">닫기</button></div>`, true);
      panel.querySelectorAll('canvas[data-pal]').forEach((cv) => UI.portraits.push({ cv, pal: c.pal }));
      panel.querySelectorAll('[data-j]').forEach((el) => (el.onclick = () => { click(); if (v.node) v.node.taken = false; if (v.farm) v.farm.taken = false; v.node = v.farm = null; v.job = el.dataset.j; v.state = 'idle'; v.wait = 0.3; v.nightGo = false; render(); })); $('vClose').onclick = () => { click(); close(true); };
    };
    render();
  };

  /* ───────── 생명나무 ───────── */
  UI.showTree = function () {
    const S = G.state; if (UI.modalKind) return; softPause(S); click();
    const render = () => {
      const cost = Game.treeCost();
      open('tree', `<div class="evt-ico">🌳</div><h2>생명나무 <small style="font-size:16px;color:#4f8f4c">${'●'.repeat(S.treeLv)}${'○'.repeat(5 - S.treeLv)}</small></h2><div class="evt-text">검은 안개를 정화하는 마지막 묘목.<br><b>5단계까지 키우면 이 땅이 되살아납니다.</b><br>내구도 ${Math.ceil(S.tree.hp)} / ${S.tree.maxHp} · 내 최대 체력 +${S.treeLv * 10}</div>
        ${cost ? `<div class="reshead">${costHtml(cost, S).replace(/<span/g, '<span style="font-size:18px"')}</div><div class="row"><button class="btn green big" id="tUp" ${Game.canAfford(cost) ? '' : 'disabled'}>🌱 키우기</button><button class="btn" id="tClose">닫기</button></div>` : '<div class="gain">🌸 만개했습니다</div><div class="row"><button class="btn" id="tClose">닫기</button></div>'}`, true);
      if (cost) $('tUp').onclick = () => { if (Game.upgradeTree()) { if (S.treeLv >= 5) close(true); else render(); } }; $('tClose').onclick = () => { click(); close(true); };
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
    const S = G.state; if (!S || S.over) return; S.paused = true; Game.saveRun(); const st = G.save.settings;
    const tg = (id, label, on) => `<div class="toggle"><span>${label}</span><button class="btn small ${on ? 'green' : ''}" data-t="${id}">${on ? '켜짐' : '꺼짐'}</button></div>`;
    open('pause', `<h2>⏸ 잠시 쉬어가기</h2><div class="sub">${S.day}일차 · ${S.diff.icon} ${S.diff.name} · ${S.char.name} · 💾 저장됨</div>${tg('music', '🎵 배경 음악', st.music)}${tg('sfx', '🔔 효과음', st.sfx)}${tg('shake', '📳 화면 흔들림', st.shake)}
      <div class="row"><button class="btn green" id="pResume">계속하기</button><button class="btn" id="pHelp">📖 생존 수첩</button></div><div class="row"><button class="btn" id="pTitle">💾 저장하고 나가기</button><button class="btn red small" id="pQuit">모험 포기 (저장 삭제)</button></div>`, true);
    panel.querySelectorAll('[data-t]').forEach((el) => (el.onclick = () => { const k = el.dataset.t; st[k] = !st[k]; G.persist(); G.audio.setMusic(st.music); G.audio.setSfx(st.sfx); click(); UI.showPause(); }));
    $('pResume').onclick = () => { click(); close(true); }; $('pHelp').onclick = () => { click(); UI.showHelp(true); }; $('pTitle').onclick = () => { click(); Game.saveRun(); UI.showTitle(); };
    $('pQuit').onclick = () => { click(); close(false); G.state.paused = false; Game.giveUp(); };
  };

  /* ───────── 결과 ───────── */
  UI.showEnd = function (reason, gain) {
    const S = G.state, win = reason === 'win';
    const T = { win: ['🌳 생명나무가 만개했습니다', '검은 안개가 걷히고, 도시는 다시 숲이 되었습니다.'], death: ['🍂 모험이 끝났습니다', '검은 안개 속에서 쓰러졌습니다. 하지만 기억은 남습니다.'], tree: ['🥀 생명나무가 쓰러졌습니다', '마지막 묘목을 지키지 못했습니다...'], hunger: ['🍽️ 배고픔에 쓰러졌습니다', '다음에는 식량을 더 챙겨야겠어요.'], quit: ['🎒 모험을 마쳤습니다', '다음 여정을 기약합니다.'] }[reason];
    open('end', `<h2>${T[0]}</h2><div class="sub">${T[1]}</div><div class="stats"><div>생존 <b>${S.day}일차</b></div><div>지은 건물 <b>${S.built}</b></div><div>함께한 주민 <b>${S.villagers.length}명</b></div><div>처치 <b>${S.kills}</b></div><div>생명나무 <b>Lv.${S.treeLv}</b></div><div>난이도 <b>${S.diff.icon} ${S.diff.name}</b></div></div><div class="gain">🌱 기억의 씨앗 +${gain}</div>
      <div class="row">${win ? '<button class="btn green" id="eCont">계속 살아가기 <small>무한 모드</small></button>' : ''}<button class="btn ${win ? '' : 'green'}" id="eRetry">새로 시작</button><button class="btn" id="eTitle">타이틀로</button></div>`, true);
    if (win) $('eCont').onclick = () => { click(); close(true); UI.toast('🌸 정화된 땅에서의 삶은 계속됩니다. 마을을 마음껏 키워 보세요!', 4000); };
    $('eRetry').onclick = () => { click(); if (win) { G.save.run = null; G.persist(); } UI.startRun(S.char.id, S.diff.id); }; $('eTitle').onclick = () => { click(); UI.showTitle(); };
  };

  /* ───────── HUD ───────── */
  function buildRes() { $('res').innerHTML = Object.keys(G.RES).map((k) => `<div id="res-${k}"><span>${G.RES[k].icon}</span><b>0</b></div>`).join(''); }
  UI.bump = function (k) { const el = $('res-' + k); if (!el) return; el.classList.add('bump'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('bump'), 130); };
  let lastStatus = '', lastHot = '', lastBanner = null, lastBuild = undefined, lastInteract = '', hudT = 0, miniT = 0;
  UI.update = function (dt) {
    const S = G.state; if (!S || G.mode !== 'game') return;
    if (S.banner !== lastBanner) { lastBanner = S.banner; const b = $('banner'); if (S.banner) { b.querySelector('h2').textContent = S.banner.title; b.querySelector('p').textContent = S.banner.sub || ''; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; } else b.classList.add('hidden'); }
    hudT -= dt; if (hudT > 0) return; hudT = 0.1; const p = S.player;
    $('hpFill').style.transform = `scaleX(${Math.max(0, p.hp / p.maxHp)})`; $('hpTxt').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
    $('hgFill').style.transform = `scaleX(${p.hunger / 100})`; $('hgTxt').textContent = p.hunger <= 0 ? '배고파요!' : ''; $('hgFill').parentNode.classList.toggle('low', p.hunger < 20);
    Object.keys(G.RES).forEach((k) => { const el = $('res-' + k); if (el) el.lastChild.textContent = S.res[k]; });
    const tot = S.isNight ? G.TIME.night : G.TIME.day; $('clockIcon').textContent = S.sleeping ? '💤' : S.isNight ? '🌙' : '☀️'; $('dayTxt').textContent = S.day + '일차'; $('wxTxt').textContent = G.WEATHER[S.weather].icon;
    $('clockFill').style.width = (1 - S.clock / tot) * 100 + '%'; $('clockFill').parentNode.classList.toggle('night', S.isNight);
    const bb = $('bossbar'); if (S.boss && !S.boss.dead) { bb.classList.remove('hidden'); $('bossFill').style.width = (S.boss.hp / S.boss.maxHp) * 100 + '%'; } else bb.classList.add('hidden');
    const h = Game.housing(), status = [S.tool, S.armor, S.lantern, S.villagers.length, h.beds, S.nearFire, !!S.inRoom, S.survivor ? 1 : 0].join();
    if (status !== lastStatus) { lastStatus = status; $('lvl').textContent = G.TOOLS[S.tool].icon; $('lvl').title = G.TOOLS[S.tool].name; $('skills').innerHTML = `<div class="chipstat" title="주민 / 입주 가능한 집">👥 ${S.villagers.length}/${h.beds}</div>${S.armor ? `<div class="chipstat">${G.ARMORS[S.armor].icon}</div>` : ''}${S.lantern ? '<div class="chipstat">🔦</div>' : ''}${S.inRoom ? '<div class="chipstat warm">🏠 아늑함</div>' : S.nearFire ? '<div class="chipstat warm">🔥 따뜻함</div>' : ''}${S.survivor ? '<div class="chipstat sos">🆘 구조 신호</div>' : ''}`; }
    // 핫바
    const hot = G.HOTBAR.map((id) => (Game.canAfford(Game.costOf(id)) ? 1 : 0)).join('') + '|' + S.build;
    if (hot !== lastHot) { lastHot = hot; $('hotbar').innerHTML = G.HOTBAR.map((id, i) => { const d = G.STRUCT[id], ok = Game.canAfford(Game.costOf(id)); return `<button class="hot ${S.build === id ? 'on' : ''} ${ok ? '' : 'poor'}" data-h="${id}" title="${d.name}"><i>${i + 1}</i>${d.icon}</button>`; }).join('') + `<button class="hot wide ${S.build && G.HOTBAR.indexOf(S.build) < 0 && S.build !== 'remove' ? 'on' : ''}" data-h="menu" title="건설 메뉴 (B)">🔨<small>B</small></button><button class="hot ${S.build === 'remove' ? 'on' : ''}" data-h="remove" title="철거 (X)">🧹<small>X</small></button>`; $('hotbar').querySelectorAll('[data-h]').forEach((el) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); UI.hot(el.dataset.h); })); }
    if (S.build !== lastBuild) { lastBuild = S.build; const bar = $('buildbar'); bar.classList.toggle('hidden', !S.build); if (S.build) { const rm = S.build === 'remove'; $('buildName').innerHTML = rm ? '🧹 철거 — 자원 절반 회수' : `${G.STRUCT[S.build].icon} ${G.STRUCT[S.build].name} <span class="cost">${costHtml(Game.costOf(S.build), S)}</span>`; $('btnPlace').firstChild.textContent = rm ? '철거 ' : '설치 '; } }
    else if (S.build && S.build !== 'remove') $('buildName').querySelector('.cost').innerHTML = costHtml(Game.costOf(S.build), S);
    const il = S.interact && !UI.modalKind ? S.interact.label : ''; if (il !== lastInteract) { lastInteract = il; const b = $('btnInteract'); b.classList.toggle('hidden', !il); b.innerHTML = il + ' <kbd>E</kbd>'; }
    miniT -= 0.1; if (miniT <= 0) { miniT = 0.3; drawMini(S); }
  };
  UI.hot = function (h) { const S = G.state; if (!S || S.over || UI.modalKind) return; click(); if (h === 'menu') UI.showBuildMenu(); else Game.setBuild(S.build === h ? null : h); };
  function drawMini(S) {
    const cv = $('mini'), c = cv.getContext('2d'), N = cv.width, k = N / G.WORLD.size, TS = G.TILE; c.fillStyle = S.isNight ? '#3d5a5c' : '#9fd47c'; c.fillRect(0, 0, N, N);
    c.fillStyle = 'rgba(200,195,180,.8)'; c.fillRect((G.WORLD.cx - 430) * k - 2, 0, 4, N); c.fillRect(0, (G.WORLD.cy + 380) * k - 2, N, 4);
    const col = { tree: '#3f7f4c', wreck: '#b9824a', bush: '#f7b4cc', crystal: '#7ff0f0' };
    for (const n of S.nodes) { if (n.hp <= 0) continue; c.fillStyle = col[n.kind]; const s = n.kind === 'crystal' ? 4 : 2; c.fillRect(n.x * k - s / 2, n.y * k - s / 2, s, s); }
    c.fillStyle = '#7a4f2c'; for (const s of S.structs) c.fillRect(s.tx * TS * k - 0.5, s.ty * TS * k - 0.5, Math.max(2, s.w * TS * k), 2);
    c.fillStyle = '#ff2a2a'; for (const e of S.enemies) { const s = e.boss ? 7 : e.elite ? 5 : 3; c.fillRect(e.x * k - s / 2, e.y * k - s / 2, s, s); }
    c.fillStyle = '#5ad1ff'; for (const v of S.villagers) c.fillRect(v.x * k - 1.5, v.y * k - 1.5, 3, 3);
    c.strokeStyle = '#4a3a30'; c.lineWidth = 1.5; if (S.survivor) { c.fillStyle = Math.sin(S.time * 6) > 0 ? '#ffe27a' : '#ff9a3c'; c.beginPath(); c.arc(S.survivor.x * k, S.survivor.y * k, 4.5, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#a5e6b4'; c.beginPath(); c.arc(G.WORLD.cx * k, (G.WORLD.cy - 50) * k, 4, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(S.player.x * k, S.player.y * k, 3.5, 0, 7); c.fill(); c.stroke();
    if (S.view) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(S.view.x0 * k, S.view.y0 * k, (S.view.x1 - S.view.x0) * k, (S.view.y1 - S.view.y0) * k); }
  }

  /* 초상화 애니메이션 */
  UI.drawPortraits = function (t) {
    for (const p of UI.portraits) { const c = p.cv.getContext('2d'); c.clearRect(0, 0, 150, 150); const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#bfe6f7'); g.addColorStop(0.7, '#f5f0d2'); g.addColorStop(1, '#a9d67a'); c.fillStyle = g; c.beginPath(); c.arc(75, 75, 72, 0, 7); c.fill(); c.save(); c.beginPath(); c.arc(75, 75, 72, 0, 7); c.clip(); const im = G.art.charImg[p.pal.sid]; G.art.drawChar(c, { x: im ? 75 : 78, y: im ? 232 : 146, t, walk: 0, moving: false, facing: 1, scale: im ? 2.7 : 1.75, pal: p.pal, seed: p.pal.hair.charCodeAt(2) * 0.37, wind: 0.8 }); c.restore(); }
  };

  const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  $('btnPause').onclick = () => { if (!UI.modalKind) { click(); UI.showPause(); } };
  tap('btnDash', () => { G.input.dash = true; });
  tap('btnAttack', () => { G.input.attack = true; G.input.attackBtn = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => $('btnAttack').addEventListener(ev, () => { if (G.input.attackBtn) { G.input.attack = false; G.input.attackBtn = false; } }));
  tap('btnPlace', () => { G.input.mouse.on = false; G.input.place = true; }); tap('btnCancel', () => { click(); Game.setBuild(null); }); tap('btnInteract', () => { if (!UI.modalKind) Game.interact(); });
})();
