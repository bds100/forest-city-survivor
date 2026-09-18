/* 숲이 된 도시 — 게임 데이터 (난이도 / 자원 / 건물 / 스킬 / 적 / 영구강화 / 이벤트) */
(function () {
  const G = (window.G = window.G || {});

  G.WORLD = { size: 3600, cx: 1800, cy: 1800, campR: 300 };
  G.TIME = { day: 62, night: 56 };

  /* ───────── 난이도 ───────── */
  G.DIFF = {
    easy: {
      id: 'easy', name: '쉬움', icon: '🌼', color: '#8ccf7e',
      desc: '느긋하게 폐허를 산책해요. 적이 약하고 자원이 풍족합니다.',
      hp: 0.7, dmg: 0.6, spawn: 0.75, yield: 1.3, hunger: 0.7, reward: 0.8, revive: 1, meta: true, pauseBuild: true,
    },
    normal: {
      id: 'normal', name: '보통', icon: '🍃', color: '#6fb8d9',
      desc: '기본 생존 경험. 낮에 모으고, 밤을 버텨내세요.',
      hp: 1, dmg: 1, spawn: 1, yield: 1, hunger: 1, reward: 1, revive: 0, meta: true, pauseBuild: true,
    },
    hard: {
      id: 'hard', name: '어려움', icon: '🍂', color: '#e0a458',
      desc: '밤이 길게 느껴집니다. 적이 강하고 허기가 빨리 집니다.',
      hp: 1.35, dmg: 1.3, spawn: 1.25, yield: 0.9, hunger: 1.15, reward: 1.4, revive: 0, meta: true, pauseBuild: true,
    },
    vhard: {
      id: 'vhard', name: '매우 어려움', icon: '🌪️', color: '#d9705f',
      desc: '검은 안개가 짙습니다. 숙련된 생존자만 도전하세요.',
      hp: 1.8, dmg: 1.7, spawn: 1.5, yield: 0.8, hunger: 1.3, reward: 1.9, revive: 0, meta: true, pauseBuild: true,
    },
    hardcore: {
      id: 'hardcore', name: '하드코어', icon: '💀', color: '#8d6bc4',
      desc: '영구 강화 미적용 · 부활 없음 · 건설 중에도 시간이 흐릅니다. 보상 3배.',
      hp: 2.2, dmg: 2.0, spawn: 1.7, yield: 0.7, hunger: 1.5, reward: 3, revive: 0, meta: false, pauseBuild: false,
    },
  };
  G.DIFF_ORDER = ['easy', 'normal', 'hard', 'vhard', 'hardcore'];

  /* ───────── 자원 ───────── */
  G.RES = {
    wood: { name: '나무', icon: '🪵', color: '#b98556' },
    scrap: { name: '고철', icon: '⚙️', color: '#9fb0b8' },
    food: { name: '식량', icon: '🍓', color: '#e8657a' },
    crystal: { name: '에테르 결정', icon: '💎', color: '#7fe3e0' },
  };

  /* ───────── 캐릭터 ───────── */
  G.CHARS = {
    minji: {
      id: 'minji', name: '민지', title: '밀짚모자 소녀', 
      desc: '폐허를 누비는 씩씩한 아이. 무엇이든 고르게 잘해요.',
      perk: '체력 +20 · 모든 능력 균형', mod: { hp: 20 },
      pal: { hat: 'straw', outfit: 'overall', socks: true, hair: '#6e4a34', hairLight: '#946a4a', skin: '#ffe9d4', skinShade: '#fbd3bb', eye: '#6b4630', top: '#f7f3e8', topShade: '#d9d6cc', bottom: '#6d93b8', bottomShade: '#55799e', leg: '#ffe4cc', boot: '#80573c', scarf: '#d9665a', scarfShade: '#b94f46', pack: '#b88a58', packShade: '#96693e' },
    },
    doosan: {
      id: 'doosan', name: '두산', title: '고글 쓴 수리공', 
      desc: '뭐든 뚝딱 고치는 손재주꾼. 채집과 건설이라면 맡겨 주세요.',
      perk: '채집 속도·채집량 +30% · 건설 비용 -10%', mod: { gather: 0.3, buildCost: -0.1 },
      pal: { hat: 'goggles', outfit: 'jacket', hair: '#3a3f4e', hairLight: '#565d72', skin: '#fbdfc2', skinShade: '#f3c9a6', eye: '#3f5a5c', top: '#dc9a52', topShade: '#b97a3a', bottom: '#5b5048', leg: '#6a5d52', boot: '#4a3a34', scarf: '#6aa89e', scarfShade: '#4f8a82', pack: '#8496a0', packShade: '#66788a' },
    },
    youngmin: {
      id: 'youngmin', name: '영민', title: '고양이 두건', 
      desc: '숲의 정령과 친구가 된 아이. 재빠르지만 몸이 조금 약해요.',
      perk: '이동속도 +15% · 주민 작업 속도 +15% · 체력 -20', mod: { speed: 0.15, work: 0.15, hp: -20 },
      pal: { hat: 'cat', outfit: 'poncho', hair: '#f3e4c0', hairLight: '#fff6e0', skin: '#ffeadb', skinShade: '#fbd6c4', eye: '#6a5590', top: '#9187c2', topShade: '#7166a3', bottom: '#3d3a55', leg: '#4a4568', boot: '#e8aebb', scarf: '#fff3dc', pack: '#a87890', packShade: '#8a5c74' },
    },
    seongwoo: {
      id: 'seongwoo', name: '성우', title: '노란 우비', 
      desc: '비 오는 날을 제일 좋아해요. 손이 빨라 휘두르는 속도가 남다릅니다.',
      perk: '공격 속도 +10% · 치명타 +8%', mod: { cd: 0.1, crit: 0.08 },
      pal: { hat: 'rain', outfit: 'raincoat', hair: '#4a3a30', hairLight: '#6a5444', skin: '#ffe6cf', skinShade: '#f9cfb4', eye: '#54412f', top: '#f2cd5c', topShade: '#d9a93c', bottom: '#4f6f8f', leg: '#5d7d9c', boot: '#5a86b0', scarf: '#f2cd5c', pack: '#7d9a8a', packShade: '#5f7c6c' },
    },
    hoon: {
      id: 'hoon', name: '훈', title: '빨간 털모자', 
      desc: '털모자가 트레이드마크. 이상하게 운이 좋아서 뭐든 잘 주워요.',
      perk: '행운 +20% · 줍기 범위 +30%', mod: { luck: 0.2, pick: 0.3 },
      pal: { hat: 'beanie', outfit: 'hoodie', hatC: '#c4604e', hatShade: '#9c4638', hair: '#2f2a2a', hairLight: '#4a4242', skin: '#fde2c8', skinShade: '#f5cbac', eye: '#3d3029', top: '#7fa37a', topShade: '#5f8560', bottom: '#4a4a52', leg: '#55555f', boot: '#6b4a36', scarf: '#ecdcae', scarfShade: '#d2bf88', pack: '#a9825a', packShade: '#87643f' },
    },
    daehee: {
      id: 'daehee', name: '대희', title: '방망이 순경', 
      desc: '야구방망이를 어깨에 멘 든든한 순경. 느리지만 누구보다 단단합니다.',
      perk: '체력 +50 · 받는 피해 -10% · 이동속도 -8%', mod: { hp: 50, armor: 0.1, speed: -0.08 },
      pal: { hat: 'helmet', outfit: 'vest', vest: '#d97a3a', hair: '#3b2e26', hairLight: '#5a4638', skin: '#f9d9b8', skinShade: '#efc19a', eye: '#4a3626', top: '#e9e4d6', topShade: '#c9c4b4', bottom: '#5a6470', leg: '#5a6470', boot: '#3f3a38', scarf: '#5f7f9c', scarfShade: '#48647e', pack: '#8a8f7a', packShade: '#6c715e' },
    },
    minyong: {
      id: 'minyong', name: '민용', title: '푸른 제복 경관', 
      desc: '말수는 적지만 끝까지 자리를 지키는 경관. 좀처럼 지치지 않아요.',
      perk: '초당 회복 +0.8 · 허기 소모 -25%', mod: { regen: 0.8, hunger: -0.25 },
      pal: { hat: 'sprout', outfit: 'apron', apron: '#6f9a62', socks: true, hair: '#8a6a48', hairLight: '#ae8c64', skin: '#ffe8d2', skinShade: '#fad2b8', eye: '#5a4a30', top: '#f4ead2', topShade: '#d8ccb0', bottom: '#8a6a48', leg: '#ffe4cc', boot: '#6f9a62', scarf: '#e8b86a', scarfShade: '#c99846', pack: '#b07c4a', packShade: '#8c5f34' },
    },
  };
  G.CHAR_ORDER = ['minji', 'doosan', 'youngmin', 'seongwoo', 'hoon', 'daehee', 'minyong'];
  G.CHAR_ORDER.forEach((id) => (G.CHARS[id].pal.sid = id));
  /* 이미지 캐릭터용 눈 위치 [중심x, 중심y, 반폭(이미지 폭 기준), 반높이(이미지 높이 기준)] + 눈꺼풀 색 — 깜빡임에 사용 */
  const EYES = {
    minji: { lid: '#fbd0ae', eyes: [[0.570, 0.182, 0.040, 0.020], [0.750, 0.178, 0.034, 0.020]] },
    doosan: { lid: '#f9c497', eyes: [[0.180, 0.210, 0.042, 0.019], [0.375, 0.210, 0.040, 0.019]] },
    youngmin: { lid: '#fdd6b7', eyes: [[0.266, 0.243, 0.044, 0.027], [0.462, 0.243, 0.044, 0.027]] },
    seongwoo: { lid: '#f7c59b', eyes: [[0.250, 0.228, 0.050, 0.019], [0.533, 0.228, 0.052, 0.019]] },
    hoon: { lid: '#f7c29b', eyes: [[0.207, 0.270, 0.040, 0.020], [0.440, 0.270, 0.040, 0.020]] },
    daehee: { lid: '#f7c49d', eyes: [[0.400, 0.263, 0.035, 0.018], [0.580, 0.263, 0.035, 0.018]] },
    minyong: { lid: '#f6c49e', eyes: [[0.476, 0.272, 0.033, 0.017], [0.658, 0.272, 0.033, 0.017]] },
  };
  G.CHAR_ORDER.forEach((id) => Object.assign(G.CHARS[id].pal, EYES[id]));

  /* ───────── 건설 (격자 48px 자유 배치) ─────────
     solid: 통행 차단 / wall·door: 방(집) 판정에 쓰임 / floorLayer: 바닥층(위에 가구를 놓을 수 있음) / need: 선행 시설 */
  G.TILE = 48;
  G.STRUCT = {
    fire: { name: '모닥불', icon: '🔥', cat: 'life', hp: 220, solid: true, light: 250, cost: { wood: 10 }, desc: '불빛과 온기. 근처에서 체력이 회복되고, 주민들이 자원을 가져다 놓는 거점이 됩니다.' },
    torch: { name: '횃불', icon: '🕯️', cat: 'life', hp: 40, light: 170, cost: { wood: 3 }, desc: '밤을 밝히는 작은 불빛.' },
    farm: { name: '텃밭', icon: '🥕', cat: 'life', hp: 50, cost: { wood: 4 }, desc: '시간이 지나면 식량이 열립니다. 옆에 서면 수확해요. 비 오는 날은 더 빨리 자랍니다.' },
    bench: { name: '작업대', icon: '🛠️', cat: 'life', w: 2, hp: 200, solid: true, cost: { wood: 20, scrap: 10 }, desc: '도구·방어구 제작, 고급 건설 해금. 가까이서 E.' },
    floor: { name: '나무 바닥', icon: '🟫', cat: 'house', hp: 60, floorLayer: true, cost: { wood: 2 }, desc: '집 바닥. 위에 가구를 놓을 수 있어요.' },
    wall: { name: '나무 벽', icon: '🪵', cat: 'house', hp: 150, solid: true, wall: true, cost: { wood: 5 }, desc: '괴물을 막는 기본 벽. 벽과 문으로 둘러싸면 집이 됩니다.' },
    swall: { name: '고철 벽', icon: '🧱', cat: 'house', hp: 420, solid: true, wall: true, need: 'bench', cost: { wood: 2, scrap: 6 }, desc: '훨씬 단단한 벽.' },
    door: { name: '문', icon: '🚪', cat: 'house', hp: 120, solid: true, door: true, cost: { wood: 8 }, desc: '나와 주민은 지나가고 괴물은 막습니다.' },
    bed: { name: '침대', icon: '🛏️', cat: 'house', w: 2, hp: 90, solid: true, cost: { wood: 14 }, desc: '벽·문으로 둘러싸인 방 안에 놓으면 주민 1명이 입주할 수 있는 집이 됩니다. 밤에는 E 로 잠을 잘 수 있어요.' },
    fence: { name: '울타리', icon: '🚧', cat: 'def', hp: 60, solid: true, cost: { wood: 2 }, desc: '값싼 방어선. 집 벽으로는 인정되지 않아요.' },
    trap: { name: '가시 함정', icon: '🪤', cat: 'def', hp: 14, cost: { wood: 4, scrap: 3 }, desc: '밟은 괴물에게 피해. 14번 쓰면 부서집니다.' },
    turret: { name: '석궁 포탑', icon: '🏹', cat: 'def', hp: 180, solid: true, need: 'bench', cost: { wood: 15, scrap: 25 }, desc: '사거리 안의 괴물을 자동으로 쏩니다.' },
  };
  G.STRUCT_ORDER = ['wall', 'door', 'floor', 'bed', 'fire', 'torch', 'farm', 'bench', 'fence', 'trap', 'turret', 'swall'];
  G.HOTBAR = ['wall', 'door', 'floor', 'bed', 'farm', 'torch'];
  G.CATS = { house: '🏠 집짓기', life: '🌱 생활', def: '🛡️ 방어' };

  /* 작업대 제작: 도구(공격·채집) / 방어구 / 등불 */
  G.TOOLS = [
    { name: '나무 몽둥이', icon: '🏏', dmg: 12, gather: 1 },
    { name: '고철 도끼', icon: '🪓', dmg: 22, gather: 1.4, cost: { wood: 20, scrap: 25 } },
    { name: '결정 곡괭이', icon: '⛏️', dmg: 36, gather: 1.9, cost: { scrap: 50, crystal: 4 } },
  ];
  G.ARMORS = [
    { name: '평상복', icon: '👕', armor: 0 },
    { name: '누빔 조끼', icon: '🦺', armor: 0.15, cost: { scrap: 20, food: 10 } },
    { name: '고철 갑옷', icon: '🛡️', armor: 0.3, cost: { scrap: 60, crystal: 3 } },
  ];
  G.LANTERN = { name: '손전등', icon: '🔦', cost: { wood: 10, scrap: 15 }, desc: '밤에 내 주변이 훨씬 밝아집니다' };
  G.JOBS = { wood: { name: '벌목', icon: '🪓' }, scrap: { name: '고철 수집', icon: '⚙️' }, farm: { name: '농사·채집', icon: '🥕' }, guard: { name: '경비', icon: '🛡️' } };
  G.TREE_COST = (l) => ({ wood: 40 * l + 20, scrap: 30 * l, crystal: [0, 3, 8, 14, 22][l] });

  /* ───────── 적 ───────── */
  G.ENEMY = {
    dust: { name: '먼지뭉치', hp: 18, dmg: 8, spd: 62, r: 15, xp: 1, from: 1, w: 10 },
    beetle: { name: '녹슨 벌레', hp: 12, dmg: 6, spd: 118, r: 12, xp: 1, from: 2, w: 5 },
    gnaw: { name: '갉아먹이', hp: 30, dmg: 4.5, spd: 70, r: 15, xp: 2, from: 3, w: 2, tree: true },
    wisp: { name: '안개 도깨비불', hp: 26, dmg: 10, spd: 50, r: 14, xp: 3, from: 3, w: 3, ranged: true },
    golem: { name: '고철 골렘', hp: 240, dmg: 20, spd: 40, r: 30, xp: 12, from: 3, w: 0, elite: true },
    boss: { name: '검은 안개 왕', hp: 1300, dmg: 28, spd: 46, r: 58, xp: 60, from: 5, w: 0, boss: true },
  };

  /* ───────── 영구 강화 (기억의 정원) ───────── */
  G.META = [
    { id: 'hp', name: '튼튼한 몸', icon: '❤️', max: 5, cost: (l) => 30 + l * 30, desc: (l) => `최대 체력 +${l * 10}` },
    { id: 'atk', name: '손에 익은 도구', icon: '⚔️', max: 5, cost: (l) => 40 + l * 35, desc: (l) => `공격력 +${l * 6}%` },
    { id: 'spd', name: '가벼운 발걸음', icon: '👟', max: 5, cost: (l) => 30 + l * 25, desc: (l) => `이동속도 +${l * 3}%` },
    { id: 'gather', name: '채집의 지혜', icon: '🌾', max: 5, cost: (l) => 30 + l * 25, desc: (l) => `채집량 +${l * 10}%` },
    { id: 'build', name: '목수의 눈썰미', icon: '📐', max: 5, cost: (l) => 40 + l * 30, desc: (l) => `건설 비용 -${l * 4}%` },
    { id: 'start', name: '비상 배낭', icon: '🧺', max: 3, cost: (l) => 50 + l * 50, desc: (l) => `시작 자원: 나무·고철 +${l * 25}, 식량 +${l * 8}` },
    { id: 'magnet', name: '정령의 손짓', icon: '🧲', max: 3, cost: (l) => 40 + l * 40, desc: (l) => `줍기 범위 +${l * 15}%` },
    { id: 'work', name: '든든한 이웃', icon: '🤝', max: 3, cost: (l) => 60 + l * 60, desc: (l) => `주민 작업 속도 +${l * 12}%` },
    { id: 'keep', name: '숲의 가호', icon: '🕊️', max: 1, cost: () => 300, desc: () => '쓰러져도 자원을 잃지 않음' },
  ];

  /* ───────── 일기 (새벽마다 한 줄) ───────── */
  G.DIARY = [
    '1일차. 무너진 고가도로 아래, 작은 묘목을 찾았다. 여기서 시작하자.',
    '도시는 조용하다. 바람이 빌딩 사이로 풀 냄새를 실어 온다.',
    '밤마다 검은 안개가 온다. 모닥불 곁은 그래도 따뜻하다.',
    '녹슨 자동차 안에서 누군가의 도시락통을 찾았다. 텅 비어 있었다.',
    '묘목에 새 잎이 났다. 괜히 말을 걸어 보았다.',
    '오늘은 구름이 고래처럼 생겼다. 옛날 사람들도 저걸 봤을까.',
    '안개 속에서 커다란 그림자를 봤다. 울타리를 더 단단히 해야겠다.',
    '비 온 뒤 폐허에서 무지개가 떴다. 세상은 아직 예쁘다.',
    '라디오에서 잡음 사이로 노래가 흘러나왔다. 어딘가 누군가 살아 있다.',
    '나무가 자랄수록 안개가 옅어지는 기분이다. 조금만 더.',
    '오늘도 살아남았다. 내일도 그럴 것이다.',
  ];

  /* ───────── 새벽 이벤트 ───────── */
  G.EVENTS = [
    {
      id: 'merchant', icon: '🦝', title: '떠돌이 너구리 상인',
      text: '커다란 보따리를 멘 너구리가 거점 앞에서 꾸벅 인사합니다. "좋은 물건 있수다."',
      choices: [
        { label: '고철 30 → 결정 2', need: { scrap: 30 }, run: (s) => { s.res.crystal += 2; return '반짝이는 결정을 받았습니다.'; } },
        { label: '나무 30 → 식량 18', need: { wood: 30 }, run: (s) => { s.res.food += 18; return '말린 과일 꾸러미를 받았습니다.'; } },
        { label: '그냥 보낸다', run: () => '너구리는 어깨를 으쓱하고 떠났습니다.' },
      ],
    },
    {
      id: 'crate', icon: '📦', title: '버려진 보급 상자',
      text: '안개가 걷힌 자리에 낡은 보급 상자가 놓여 있습니다. 안에서 달그락 소리가...',
      choices: [
        {
          label: '열어 본다 (위험할 수도)', run: (s, g) => {
            if (Math.random() < 0.68) { s.res.wood += 25; s.res.scrap += 25; s.res.food += 8; return '통조림과 자재가 가득! 나무·고철 +25, 식량 +8'; }
            g.ambush(8); return '상자에서 먼지뭉치들이 쏟아져 나왔습니다!';
          },
        },
        { label: '건드리지 않는다', run: () => '조심해서 나쁠 건 없죠.' },
      ],
    },
    {
      id: 'cat', icon: '🐈', title: '길 잃은 고양이',
      text: '마른 고양이 한 마리가 모닥불 곁에서 당신을 올려다봅니다.',
      choices: [
        { label: '식량 10을 나눠 준다', need: { food: 10 }, run: (s) => { s.bonus.luck += 0.15; return '고양이가 골골거립니다. 행운 +15%'; } },
        { label: '쓰다듬어 준다', run: (s) => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25); return '마음이 따뜻해졌습니다. 체력 +25'; } },
      ],
    },
    {
      id: 'vending', icon: '🥤', title: '오래된 자판기',
      text: '덩굴에 뒤덮인 자판기에 아직 불이 들어옵니다. 동전 대신 고철을 넣어 볼까요?',
      choices: [
        {
          label: '고철 15를 넣는다', need: { scrap: 15 }, run: (s) => {
            const r = Math.random();
            if (r < 0.45) { s.res.food += 20; return '덜컹! 음료수가 잔뜩 나왔습니다. 식량 +20'; }
            if (r < 0.7) { s.res.crystal += 2; return '...결정이 굴러 나왔습니다?! 결정 +2'; }
            return '자판기는 고철만 삼키고 조용해졌습니다.';
          },
        },
        { label: '지나친다', run: () => '언젠가 다시 와 보기로 합니다.' },
      ],
    },
    {
      id: 'radio', icon: '📻', title: '낡은 라디오',
      text: '잔해 속에서 찾은 라디오. 잡음 사이로 희미한 목소리가 들립니다.',
      choices: [
        { label: '귀 기울여 듣는다', run: (s, g) => { g.callSurvivor(); return '잡음 사이로 누군가의 구조 신호가 들립니다! 지도에 위치가 표시됐어요.'; } },
        { label: '분해한다', run: (s) => { s.res.scrap += 30; return '쓸 만한 부품을 얻었습니다. 고철 +30'; } },
      ],
    },
    {
      id: 'shrine', icon: '⛩️', title: '이끼 낀 작은 사당',
      text: '무너진 빌딩 틈에 작은 사당이 있습니다. 누군가 아직 꽃을 놓고 간 모양입니다.',
      choices: [
        { label: '결정 2개를 바친다', need: { crystal: 2 }, run: (s) => { s.bonus.hp += 25; s.player.maxHp += 25; s.player.hp = s.player.maxHp; return '숲의 정령이 축복합니다. 최대 체력 +25, 완전 회복'; } },
        { label: '두 손 모아 기도한다', run: (s) => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + s.player.maxHp * 0.3); return '마음이 가벼워졌습니다. 체력 회복'; } },
      ],
    },
  ];

  G.WEATHER = {
    clear: { name: '맑음', icon: '☀️' },
    wind: { name: '바람', icon: '🍃' },
    rain: { name: '비', icon: '🌧️', note: '허기가 천천히 집니다' },
    fog: { name: '안개', icon: '🌫️', note: '시야가 흐립니다' },
  };
})();
