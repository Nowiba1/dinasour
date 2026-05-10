/* ═══════════════════════════════════════════════════════════
   ديناصور تونس+ — game.js
   محرك اللعبة الكامل: Canvas، فيزياء، ذكاء اصطناعي، باور أبس،
   أحداث، ترقيات، مظاهر، Firebase أونلاين، موسيقى، طقس
   
   الإصلاحات:
   ✅ موسيقى SoundHelix (بدون CORS، مجانية، بدون تسجيل)
   ✅ موسيقى متنوعة تتغير حسب أحداث اللعبة
   ✅ النقاط بلا حدود حتى الموت
   ✅ إعادة ظهور مضحكة في اللعب الجماعي
   ✅ أسماء اللاعبين فوق رؤوسهم في الكانفاس
   ✅ تغيير الطقس والسماء كل دقيقة
   ✅ أحداث مضحكة تونسية
   ✅ soundpad أوتوماتيكي حسب أحداث اللعبة
   ✅ كل النصوص بالعربي التونسي
═══════════════════════════════════════════════════════════ */

"use strict";

// ─────────────────────────────────────────────────────────
//  الإعدادات الأساسية
// ─────────────────────────────────────────────────────────
const CFG = {
  FPS: 60,
  GROUND_H_RATIO: 0.72,
  DINO_W: 52, DINO_H: 60,
  GRAVITY: 0.65,
  JUMP_FORCE: -16,
  INIT_SPEED: 6,
  MAX_SPEED: 22,
  SPEED_INC: 0.003,
  SCORE_BONE_RATIO: 80,
  OBSTACLE_MIN_GAP: 320,
  PTERO_HEIGHTS: [0.3, 0.5, 0.75],
  STAR_COUNT: 120,
  CLOUD_COUNT: 6,
  MOUNTAIN_COUNT: 5,
  DAY_NIGHT_INTERVAL: 300,
  EVENT_MIN_SCORE: 60,
  POWERUP_SPAWN_SCORE: 50,
  AI_TAUNT_INTERVAL: 8000,
  WEATHER_CHANGE_INTERVAL: 60000, // كل دقيقة يتغير الطقس
};

// ─── رسائل مضحكة بالتونسي ───
const FUNNY_MSGS = [
  "متّ. مشكلة في المهارة.",
  "حتى الكاكتوس حسّ بيك بالزهر.",
  "الديناصور طار من الشات.",
  "أجدادك خيّبين فيك.",
  "Speedrun أي%: صفر ثانية",
  "النيزك ماحتاجش يحاول.",
  "انقرضت. مرة ثانية.",
  "Google كانت تعيد تحميل على طول.",
  "لحظة pro gamer: فشلت",
  "الكاكتوس يبعثلك سلام.",
  "انهزمت من نبتة. شفيق!",
  "انتهت اللعبة. حاولت تطفي وتعيد تشغيل؟",
  "ماعندكش حق تلعب هذي اللعبة أصلاً 😂",
  "حتى أمك تعرف تعدى هذا الكاكتوس!",
  "اش دخل الديناصور وين تعيش؟",
  "اللعبة قررت تخلصك من معاناتك.",
  "طيّب خليها، روح تاكل لبلابي",
];

// ─── تحديات الذكاء الاصطناعي بالتونسي ───
const AI_TAUNTS_AHEAD = [
  "زلت نسخن 😴",
  "اجري ورايا إذا قدرت! 🦕",
  "السرعة = المسافة / مهارتك",
  "404: مهارة اللاعب مو موجودة",
  "أنا وصلت لقمتي في الجوراسيك، وأنت؟",
  "يزي بيك، بطيء كيف الحلزون 🐌",
];
const AI_TAUNTS_BEHIND = [
  "حسنا حسنا، أنت سريع.",
  "خليتك تفوز. واضح. 😤",
  "استراتيجية جديدة: خلّيهم يتعبوا.",
  "هذا مخطط. ثق بي.",
  "نحسب انتقام... 🤔",
  "واش هذا؟! أنت تغشش؟ 😡",
];

// ─────────────────────────────────────────────────────────
//  الحالة العامة
// ─────────────────────────────────────────────────────────
let canvas, ctx;
let W, H, groundY;
let gameState = 'loading';
let score = 0, bestScore = 0, bonesCollected = 0, distancePx = 0;
let speed = CFG.INIT_SPEED;
let frame = 0;
let isNight = false;
let lastTime = 0;
let animId = null;

// حالة الطقس
const WEATHERS = ['صافي ☀️','غيوم ⛅','عاصفة رملية 🌪️','مطر 🌧️','ليل نجمي 🌙','حرارة لهيب 🔥','ضباب 🌫️'];
let currentWeather = 'صافي ☀️';
let weatherTimer = 0;
let weatherIndex = 0;
let rainDrops = [];
let sandParticlesWeather = [];

// اللاعب
const dino = {
  x: 0, y: 0,
  vy: 0,
  w: CFG.DINO_W, h: CFG.DINO_H,
  grounded: true,
  jumping: false,
  jumpCount: 0,
  ducking: false,
  dead: false,
  frame: 0,
  frameTimer: 0,
  skin: 'classic',
  powerups: [],
  shieldHits: 0,
};

// الذكاء الاصطناعي المنافس
const aiDino = {
  x: 0, y: 0,
  vy: 0,
  grounded: true,
  jumpCount: 0,
  ducking: false,
  dead: false,
  deadTimer: 0,
  respawnTimer: 0,
  respawnScene: null, // مشهد الإعادة الحالي
  personality: 'rival',
  name: 'Ghost',
  frame: 0,
  frameTimer: 0,
  active: false,
  lastTauntTime: 0,
  sleeperBurst: false,
  sleeperTimer: 0,
  // للرسم خلال الإعادة
  respawnY: -200,
  respawnProgress: 0,
};

// عناصر العالم
let obstacles = [];
let bones = [];
let powerupItems = [];
let clouds = [], mountains = [], stars = [];
let particles = [];
let bgOffset = 0;

// الأحداث العشوائية
let currentEvent = null;
let eventEndTime = 0;
let nextEventScore = CFG.EVENT_MIN_SCORE + Math.random() * 80;

// ─── حالة اللعب الجماعي أونلاين ───
let onlineMode = false;
let roomId = null;
let myPlayerId = null;
let isHost = false;
let roomRef = null;
let roomListener = null;
let onlinePlayers = {};
let onlineScoreInterval = null;

// ─── الترقيات والمظاهر ───
const UPGRADES = [
  { id:'speed',  name:'التحكم بالسرعة', icon:'⚙️', desc:'يقلّل السرعة القصوى. أسهل للبقاء.', levels:[50,80,120], effects:[2,4,6], maxLevel:3 },
  { id:'jump',   name:'قفزة قوية',    icon:'🦘', desc:'قفزة أعلى (+15% لكل مستوى).',      levels:[40,65,100], effects:[1.15,1.3,1.5], maxLevel:3 },
  { id:'eye',    name:'عين النسر',     icon:'👁️', desc:'يحذّرك 0.5ث قبل العقبة.',            levels:[80,120,180], effects:[1,1,1], maxLevel:3 },
  { id:'luck',   name:'مخالب الحظ',   icon:'🍀', desc:'الباور أبس تظهر 30% أكثر.',        levels:[60,90,130], effects:[0.7,0.5,0.35], maxLevel:3 },
  { id:'shield', name:'حراشف الحديد',   icon:'🛡️', desc:'تبدأ كل جولة بدرع مجاني.',     levels:[100,150,220], effects:[1,1,1], maxLevel:3 },
];

const SKINS = [
  { id:'classic',    name:'الكلاسيكي',    emoji:'🦕', unlockDesc:'افتراضي',          unlocked:true  },
  { id:'cool',       name:'الكوول دينو',  emoji:'🕶️', unlockDesc:'1000+ نقطة',      unlocked:false },
  { id:'corporate',  name:'البدلة',  emoji:'🤵', unlockDesc:'اهزم الذكاء 5 مرات',  unlocked:false },
  { id:'chad',       name:'الشاد',  emoji:'👑', unlockDesc:'أعلى نقطة يومية', unlocked:false },
  { id:'ninja',      name:'النينجا',      emoji:'🥷', unlockDesc:'500 بدون باور أبس',  unlocked:false },
  { id:'cactus',     name:'كاكتوس دينو',emoji:'🌵', unlockDesc:'اكسر 10 دروع', unlocked:false },
];

let upgradeLevels = { speed:0, jump:0, eye:0, luck:0, shield:0 };
let activeSkin = 'classic';
let aiBeatenCount = 0;
let noPoweupRun = true;
let sessionBones = 0;
let warningShown = false;
let warningTimer = 0;

// ─────────────────────────────────────────────────────────
//  الصوت - SoundHelix (مجاني، بدون CORS، بدون تسجيل)
// ─────────────────────────────────────────────────────────
let audioCtx = null;
let musicEnabled = true;
let currentTrack = null;
let musicPlaying = false;
let currentMusicMood = 'normal'; // normal | action | funny | intense

// مقاطع SoundHelix المتنوعة - مجانية تماماً، بدون CORS
const MUSIC_TRACKS = {
  funny: [
    { name: 'الموسيقى المرحة 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { name: 'الموسيقى المرحة 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
    { name: 'الموسيقى المرحة 3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  ],
  action: [
    { name: 'موسيقى الحركة 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { name: 'موسيقى الحركة 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { name: 'موسيقى الحركة 3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  ],
  intense: [
    { name: 'موسيقى مكثفة 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { name: 'موسيقى مكثفة 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
    { name: 'موسيقى مكثفة 3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  ],
  normal: [
    { name: 'موسيقى عادية 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
    { name: 'موسيقى عادية 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
    { name: 'موسيقى عادية 3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  ],
};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  playMusicForMood('funny');
}

// تشغيل موسيقى حسب الحالة
function playMusicForMood(mood) {
  if (!musicEnabled) return;
  if (mood === currentMusicMood && musicPlaying) return;
  currentMusicMood = mood;

  if (currentTrack) {
    try { currentTrack.pause(); currentTrack.src = ''; } catch(e) {}
    currentTrack = null;
    musicPlaying = false;
  }

  const tracks = MUSIC_TRACKS[mood] || MUSIC_TRACKS.normal;
  const t = tracks[Math.floor(Math.random() * tracks.length)];
  const audio = new Audio(t.url);
  audio.volume = 0.2;
  audio.loop = false;
  audio.onended = () => {
    musicPlaying = false;
    setTimeout(() => playMusicForMood(currentMusicMood), 1500);
  };
  audio.onerror = () => {
    musicPlaying = false;
    // جرب موسيقى أخرى
    setTimeout(() => {
      const fallback = MUSIC_TRACKS.normal[0];
      const fb = new Audio(fallback.url);
      fb.volume = 0.2;
      fb.loop = true;
      fb.play().catch(()=>{});
      currentTrack = fb;
      musicPlaying = true;
    }, 2000);
  };
  audio.play().then(() => {
    musicPlaying = true;
    currentTrack = audio;
    showToast(`🎵 ${t.name}`, 2000);
  }).catch(() => {
    musicPlaying = false;
  });
  currentTrack = audio;
}

// تغيير الموسيقى حسب أحداث اللعبة
function updateMusicMood() {
  if (!musicEnabled || !audioCtx) return;
  let newMood = 'normal';
  if (score > 500) newMood = 'intense';
  else if (score > 200) newMood = 'action';
  else if (currentEvent?.type === 'rave' || currentEvent?.type === 'chicken') newMood = 'funny';
  else if (score > 50) newMood = 'normal';
  else newMood = 'funny';

  if (newMood !== currentMusicMood) {
    playMusicForMood(newMood);
  }
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  const btn = document.getElementById('musicBtnText');
  if (btn) btn.textContent = musicEnabled ? 'الموسيقى: شغّالة' : 'الموسيقى: مطفية';
  if (musicEnabled) {
    playMusicForMood(currentMusicMood);
  } else {
    if (currentTrack) { try { currentTrack.pause(); } catch(e){} }
    musicPlaying = false;
  }
}

// ─── الساوند باد الأوتوماتيكي ───
let soundpadTimer = null;

const SOUNDPAD_EVENTS = {
  jump:        ['واو!', 'وثب!', 'يطير! 🚀', 'قفز الراجل!'],
  death:       ['آآآخ! 💀', 'هههههه 😂', 'مات الديناصور!', 'الله يرحمو!', 'يزي بيك!', 'كاكتوس 1 - أنت 0'],
  bone:        ['🦴 عظمة!', 'خذها!', 'ربحنا!'],
  powerup:     ['باور أب! 💪', 'يلا بينا!', 'مزيان!'],
  score100:    ['100 نقطة! 🎉', 'مزيان صاحبي!', 'ها هو! 💯'],
  score500:    ['500!!! 🔥', 'ماشاء الله!', 'أنت أسطورة!'],
  score1000:   ['1000 نقطة! 👑', 'تاريخي!', 'أنت ما تصدقش!'],
  nearMiss:    ['واش هذا؟!', 'كاد!', 'فلت بالعافية 😅'],
  nightStart:  ['الليل جاء 🌙', 'نمت؟ لا!', 'ليل تونس جميل'],
  event_rave:  ['🎉 RAVE!!!', 'يلا نرقص!', 'DJ قرر يحرق!'],
  event_tax:   ['💸 الضرائب!', 'الحكومة رصدتك!', 'الكاكتوس حكومة!'],
  event_chicken:['🐔 ديجاج!', 'ديجاج من وين؟!', 'تونس عندها ديجاج!'],
  doubleJump:  ['مرتين! 🦘', 'قفز على القفزة!'],
  weather_storm:['عاصفة! 🌪️', 'الهوا حار بزاف!'],
  respawn_parachute: ['🪂 جاء من السما!', 'مظلة نجدة!'],
  respawn_helicopter: ['🚁 هليكوبتر!', 'إنقاذ الديناصور!'],
  respawn_car: ['🚗 من السيارة!', 'يلا يطلع!'],
};

function triggerSoundpad(eventKey) {
  const msgs = SOUNDPAD_EVENTS[eventKey];
  if (!msgs) return;
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  const el = document.getElementById('soundpad');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (soundpadTimer) clearTimeout(soundpadTimer);
  soundpadTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ─────────────────────────────────────────────────────────
//  التخزين
// ─────────────────────────────────────────────────────────
function saveData() {
  const d = {
    bestScore, bones: getTotalBones(),
    upgradeLevels, activeSkin,
    skinUnlocks: SKINS.reduce((a,s)=>({...a,[s.id]:s.unlocked}),{}),
    aiBeaten: aiBeatenCount,
    leaderboard: getLeaderboard(),
    shieldHits: dino.shieldHits,
  };
  localStorage.setItem('dinoplus_v2', JSON.stringify(d));
}

function loadData() {
  try {
    // دعم النسخة القديمة
    const raw = localStorage.getItem('dinoplus_v2') || localStorage.getItem('dinoplus_v1') || '{}';
    const d = JSON.parse(raw);
    bestScore = d.bestScore || 0;
    bonesCollected = d.bones || 0;
    upgradeLevels = d.upgradeLevels || { speed:0, jump:0, eye:0, luck:0, shield:0 };
    activeSkin = d.activeSkin || 'classic';
    dino.skin = activeSkin;
    aiBeatenCount = d.aiBeaten || 0;
    dino.shieldHits = d.shieldHits || 0;
    if (d.skinUnlocks) SKINS.forEach(s => s.unlocked = d.skinUnlocks[s.id] ?? s.unlocked);
    if (d.leaderboard) localStorage.setItem('dinoplus_lb', JSON.stringify(d.leaderboard));
  } catch(e) {}
}

function getTotalBones() { return bonesCollected + sessionBones; }

function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('dinoplus_lb') || '[]'); } catch(e){ return []; }
}

function addLeaderboardEntry(name, sc, skin) {
  const lb = getLeaderboard();
  lb.push({ name, score: sc, skin, date: new Date().toLocaleDateString('ar-TN') });
  lb.sort((a,b) => b.score - a.score);
  localStorage.setItem('dinoplus_lb', JSON.stringify(lb.slice(0, 10)));
}

function seedLeaderboard() {
  const lb = getLeaderboard();
  if (lb.length < 5) {
    const seeds = [
      { name:'DinoKing تونس', score:4280, skin:'chad',   date:'1/1/2025' },
      { name:'TunisDino99',   score:3150, skin:'ninja',  date:'1/2/2025' },
      { name:'SpeedRex',      score:2800, skin:'cool',   date:'1/3/2025' },
      { name:'CactusMan',     score:1900, skin:'cactus', date:'1/4/2025' },
      { name:'NewbDino',      score:420,  skin:'classic',date:'1/5/2025' },
    ];
    seeds.forEach(s => { if (!lb.find(e=>e.name===s.name)) lb.push(s); });
    lb.sort((a,b)=>b.score-a.score);
    localStorage.setItem('dinoplus_lb', JSON.stringify(lb));
  }
}

// ─────────────────────────────────────────────────────────
//  إعداد الكانفاس
// ─────────────────────────────────────────────────────────
function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  groundY = H * CFG.GROUND_H_RATIO;
  dino.x = W * 0.12;
  dino.y = groundY - dino.h;
  aiDino.x = W * 0.12;
  aiDino.y = groundY - dino.h;
  generateBackground();
}

// ─────────────────────────────────────────────────────────
//  توليد الخلفية
// ─────────────────────────────────────────────────────────
function generateBackground() {
  stars = [];
  for (let i = 0; i < CFG.STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * groundY * 0.9,
      r: Math.random() * 1.8 + 0.3,
      speed: Math.random() * 0.3 + 0.1,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  clouds = [];
  for (let i = 0; i < CFG.CLOUD_COUNT; i++) clouds.push(newCloud(Math.random() * W));
  mountains = [];
  for (let i = 0; i < CFG.MOUNTAIN_COUNT; i++) {
    mountains.push({
      x: (W / CFG.MOUNTAIN_COUNT) * i + Math.random() * 120 - 60,
      h: Math.random() * groundY * 0.35 + groundY * 0.1,
      w: Math.random() * 180 + 100,
      speed: 0.4,
    });
  }
}

function newCloud(x) {
  return {
    x: x ?? W + 100,
    y: Math.random() * groundY * 0.35 + 20,
    w: Math.random() * 120 + 60,
    h: Math.random() * 40 + 20,
    speed: Math.random() * 0.5 + 0.2,
  };
}

// ─────────────────────────────────────────────────────────
//  الطقس والسماء
// ─────────────────────────────────────────────────────────
function updateWeather(dt) {
  if (gameState !== 'playing') return;
  weatherTimer += 16; // تقريبي لكل frame
  if (weatherTimer >= CFG.WEATHER_CHANGE_INTERVAL) {
    weatherTimer = 0;
    weatherIndex = (weatherIndex + 1) % WEATHERS.length;
    currentWeather = WEATHERS[weatherIndex];
    showWeatherBadge(currentWeather);
    applyWeatherEffects(currentWeather);
  }
  // أمطار
  if (currentWeather === 'مطر 🌧️') {
    if (Math.random() < 0.3) {
      rainDrops.push({ x: Math.random() * W, y: -10, speed: 8 + Math.random() * 4, len: 10 + Math.random()*10 });
    }
    rainDrops.forEach(r => { r.y += r.speed; r.x -= 1; });
    rainDrops = rainDrops.filter(r => r.y < H);
  } else {
    rainDrops = [];
  }
  // رمال
  if (currentWeather === 'عاصفة رملية 🌪️') {
    if (Math.random() < 0.4) {
      sandParticlesWeather.push({ x: W, y: Math.random() * groundY, speed: 6+Math.random()*4, r: Math.random()*3+1, alpha: 0.5+Math.random()*0.5 });
    }
    sandParticlesWeather.forEach(s => { s.x -= s.speed; s.alpha -= 0.005; });
    sandParticlesWeather = sandParticlesWeather.filter(s => s.x > 0 && s.alpha > 0);
  } else {
    sandParticlesWeather = [];
  }
}

function showWeatherBadge(weather) {
  const el = document.getElementById('weatherBadge');
  if (!el) return;
  el.textContent = `الطقس: ${weather}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
  if (weather === 'عاصفة رملية 🌪️') triggerSoundpad('weather_storm');
}

function applyWeatherEffects(weather) {
  showToast(`الطقس تغيّر: ${weather}`, 3000);
  // أثر الطقس الحار
  if (weather === 'حرارة لهيب 🔥') {
    CFG.SPEED_INC = 0.005; // أسرع
  } else {
    CFG.SPEED_INC = 0.003;
  }
}

// ─────────────────────────────────────────────────────────
//  الرسم
// ─────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  // ألوان السماء حسب الطقس
  let skyColors;
  if (currentWeather === 'مطر 🌧️') {
    skyColors = ['#3a5070', '#4a6080', '#607090'];
  } else if (currentWeather === 'عاصفة رملية 🌪️') {
    skyColors = ['#8b6914', '#a07830', '#c49030'];
  } else if (currentWeather === 'ضباب 🌫️') {
    skyColors = ['#b0b8c0', '#c0c8d0', '#d0d8e0'];
  } else if (currentWeather === 'حرارة لهيب 🔥') {
    skyColors = ['#e85d04', '#f3722c', '#f9c74f'];
  } else if (isNight || currentWeather === 'ليل نجمي 🌙') {
    skyColors = ['#0d1b2a','#1b2838','#16213e'];
  } else {
    skyColors = ['#87CEEB','#a8d8ea','#d4f1f9'];
  }
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, skyColors[0]);
  skyGrad.addColorStop(0.5, skyColors[1]);
  skyGrad.addColorStop(1, skyColors[2]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, groundY);

  // نجوم (ليل)
  if (isNight || currentWeather === 'ليل نجمي 🌙') {
    stars.forEach(s => {
      const alpha = 0.4 + 0.6 * Math.sin(frame * 0.03 + s.twinkleOffset);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }

  // قمر / شمس
  if (isNight || currentWeather === 'ليل نجمي 🌙') {
    drawMoon(W - 80, 60);
  } else if (currentWeather !== 'عاصفة رملية 🌪️' && currentWeather !== 'ضباب 🌫️') {
    drawSun(W - 80, 60);
  }

  // جبال (طبقة parallax)
  mountains.forEach(m => {
    const grad = ctx.createLinearGradient(m.x, groundY - m.h, m.x, groundY);
    if (isNight) {
      grad.addColorStop(0, '#2d3a5e');
      grad.addColorStop(1, '#1a2240');
    } else if (currentWeather === 'عاصفة رملية 🌪️') {
      grad.addColorStop(0, '#8b7030');
      grad.addColorStop(1, '#6b5020');
    } else {
      grad.addColorStop(0, '#8fa8c8');
      grad.addColorStop(1, '#7090b0');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(m.x - m.w/2, groundY);
    ctx.lineTo(m.x, groundY - m.h);
    ctx.lineTo(m.x + m.w/2, groundY);
    ctx.closePath();
    ctx.fill();
    if (!isNight && currentWeather !== 'عاصفة رملية 🌪️') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(m.x - m.w*0.1, groundY - m.h*0.75);
      ctx.lineTo(m.x, groundY - m.h);
      ctx.lineTo(m.x + m.w*0.1, groundY - m.h*0.75);
      ctx.closePath();
      ctx.fill();
    }
  });

  clouds.forEach(c => drawCloud(c));
  drawGround();
  renderEventOverlay();

  // مطر
  if (currentWeather === 'مطر 🌧️') {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,180,255,0.6)';
    ctx.lineWidth = 1;
    rainDrops.forEach(r => {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 2, r.y + r.len);
      ctx.stroke();
    });
    ctx.restore();
  }

  // رمال
  if (currentWeather === 'عاصفة رملية 🌪️') {
    sandParticlesWeather.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#c49030';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ضباب
  if (currentWeather === 'ضباب 🌫️') {
    const fogGrad = ctx.createLinearGradient(0, 0, W, 0);
    fogGrad.addColorStop(0, 'rgba(200,210,220,0.3)');
    fogGrad.addColorStop(0.5, 'rgba(200,210,220,0.15)');
    fogGrad.addColorStop(1, 'rgba(200,210,220,0.3)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, W, groundY);
  }

  bones.forEach(b => drawBone(b));
  powerupItems.forEach(p => drawPowerupItem(p));

  // تحذير عين النسر
  if (warningShown && warningTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frame * 0.4);
    ctx.fillStyle = '#f9c74f';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ عقبة قادمة!', W * 0.5, groundY - 80);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  obstacles.forEach(o => drawObstacle(o));

  // رسم اللاعب
  if (!dino.dead) drawDino(dino, false);

  // رسم الذكاء الاصطناعي
  if (aiDino.active) {
    if (aiDino.dead && aiDino.respawnScene) {
      drawRespawnScene(aiDino);
    } else if (!aiDino.dead) {
      drawDino(aiDino, true);
    }
  }

  // رسم لاعبي الأونلاين على الكانفاس
  if (onlineMode) {
    drawOnlinePlayers();
  }

  particles.forEach(p => drawParticle(p));
  drawGroundDetails();
  drawDistanceMarker();
}

// ─── رسم اللاعبين الأونلاين على الكانفاس ───
function drawOnlinePlayers() {
  Object.entries(onlinePlayers).forEach(([pid, p]) => {
    if (pid === myPlayerId || p.dead) return;
    // موضع تقريبي للاعبين الآخرين (نعرضهم على اليسار بفارق)
    const ox = W * 0.12 + 20; // نفس الموضع الأفقي
    const oy = groundY - dino.h;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#4361ee';
    // جسم بسيط
    ctx.fillStyle = '#7c3aed';
    roundRect(ctx, ox + 5, oy + 5, dino.w - 10, dino.h - 10, 6);
    ctx.fill();
    // اسم اللاعب
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const nameW = Math.max(p.name.length * 7 + 8, 50);
    roundRect(ctx, ox + dino.w/2 - nameW/2, oy - 22, nameW, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, ox + dino.w/2, oy - 10);
    ctx.textAlign = 'left';
    ctx.restore();
  });
}

function drawSun(x, y) {
  const r = 30;
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#f9c74f';
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + frame * 0.005;
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * (r+4), y + Math.sin(angle) * (r+4));
    ctx.lineTo(x + Math.cos(angle) * (r+14), y + Math.sin(angle) * (r+14));
    ctx.stroke();
  }
  ctx.restore();
}

function drawMoon(x, y) {
  ctx.save();
  ctx.shadowBlur = 30;
  ctx.shadowColor = '#c8c8ff';
  ctx.fillStyle = '#e8e8f0';
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  [[x-6,y-4,5],[x+8,y+6,3],[x+2,y-10,4]].forEach(([cx,cy,cr]) => {
    ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function drawCloud(c) {
  ctx.save();
  ctx.globalAlpha = isNight ? 0.15 : 0.75;
  ctx.fillStyle = isNight ? '#4a5568' : '#ffffff';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x - c.w*0.25, c.y + c.h*0.1, c.w*0.3, c.h*0.4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x + c.w*0.25, c.y + c.h*0.1, c.w*0.35, c.h*0.45, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawGround() {
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  if (isNight) {
    groundGrad.addColorStop(0, '#2d3a2e');
    groundGrad.addColorStop(0.3, '#1a2a1b');
    groundGrad.addColorStop(1, '#0f1a10');
  } else if (currentWeather === 'مطر 🌧️') {
    groundGrad.addColorStop(0, '#5a7040');
    groundGrad.addColorStop(1, '#3a5020');
  } else {
    groundGrad.addColorStop(0, '#c8a96e');
    groundGrad.addColorStop(0.2, '#b8914e');
    groundGrad.addColorStop(1, '#8b6914');
  }
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = isNight ? '#3d5c3e' : '#a07840';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
  ctx.strokeStyle = isNight ? 'rgba(80,120,80,0.3)' : 'rgba(140,100,40,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const gx = ((bgOffset * 0.8 + i * 140) % (W + 140)) - 140;
    ctx.beginPath();
    ctx.moveTo(gx, groundY + 5);
    ctx.lineTo(gx + 60, groundY + 5);
    ctx.stroke();
  }
}

function drawGroundDetails() {
  ctx.fillStyle = isNight ? 'rgba(100,140,100,0.4)' : 'rgba(160,120,60,0.5)';
  for (let i = 0; i < 8; i++) {
    const px = ((bgOffset * 0.9 + i * W/8 + 20) % (W + 20)) - 10;
    const py = groundY + 10 + (i % 3) * 4;
    ctx.beginPath();
    ctx.ellipse(px, py, 4, 2, 0, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawDistanceMarker() {
  const m = Math.floor(distancePx / 100);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(`${m}م`, 16, groundY - 8);
  ctx.restore();
}

// ─── رسم الديناصور ───
function drawDino(d, isAI) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const w = d.ducking ? d.w * 1.4 : d.w;
  const h = d.ducking ? d.h * 0.55 : d.h;
  const actualY = d.ducking ? groundY - h : y;

  ctx.save();

  // درع
  if (!isAI && hasPowerup('shield')) {
    const pulse = Math.sin(frame * 0.15) * 4;
    ctx.save();
    ctx.globalAlpha = 0.35;
    const shieldGrad = ctx.createRadialGradient(x + w/2, actualY + h/2, 0, x + w/2, actualY + h/2, w*0.8 + pulse);
    shieldGrad.addColorStop(0, 'rgba(67,97,238,0)');
    shieldGrad.addColorStop(0.7, 'rgba(67,97,238,0.4)');
    shieldGrad.addColorStop(1, 'rgba(67,97,238,0.8)');
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.ellipse(x+w/2, actualY+h/2, w*0.8+pulse, h*0.6+pulse, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  if (isAI) {
    ctx.globalAlpha = 0.45;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#a78bfa';
  }

  if (!isAI && hasPowerup('jetpack')) drawJetpackFire(x, actualY + h, d);
  if (d.grounded && !d.ducking && !d.dead && frame % 8 === 0) spawnDustParticles(x, groundY);

  drawDinoBody(x, actualY, w, h, d.skin || activeSkin, isAI, d.ducking, d.frame);

  // اسم اللاعب فوقه (للذكاء الاصطناعي)
  if (isAI) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - 2, actualY - 22, w + 4, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(aiDino.name, x + w/2, actualY - 8);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

// ─── مشاهد الإعادة المضحكة ───
const RESPAWN_SCENES = ['parachute', 'helicopter', 'car', 'rocket', 'catapult', 'ufo'];

function drawRespawnScene(d) {
  const prog = d.respawnProgress; // 0 → 1
  const scene = d.respawnScene;
  const targetX = d.x;
  const targetY = groundY - dino.h;

  ctx.save();

  if (scene === 'parachute') {
    // يهبط من السماء بمظلة
    const y = -100 + prog * (targetY + 120);
    const alpha = Math.min(prog * 3, 1);
    ctx.globalAlpha = alpha;
    // مظلة
    ctx.strokeStyle = '#f9c74f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX + dino.w/2, y - 30, 35, Math.PI, 0);
    ctx.stroke();
    // خيوط
    for (let i = -25; i <= 25; i += 12.5) {
      ctx.beginPath();
      ctx.moveTo(targetX + dino.w/2 + i, y - 30);
      ctx.lineTo(targetX + dino.w/2, y);
      ctx.stroke();
    }
    // الديناصور
    drawDinoBody(targetX, y, dino.w, dino.h, d.skin || activeSkin, true, false, 0);

  } else if (scene === 'helicopter') {
    // يطير من اليمين بهليكوبتر
    const hx = W + 100 - prog * (W + 100 - targetX - 40);
    const hy = groundY * 0.3;
    const alpha = Math.min(prog * 2, 1);
    ctx.globalAlpha = alpha;
    // جسم الهليكوبتر
    ctx.fillStyle = '#4361ee';
    roundRect(ctx, hx, hy, 80, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#e63946';
    roundRect(ctx, hx + 60, hy + 10, 30, 15, 4);
    ctx.fill();
    // مروحة
    ctx.save();
    ctx.translate(hx + 40, hy - 5);
    ctx.rotate(frame * 0.3);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-30, -3, 60, 6);
    ctx.restore();
    // حبل
    ctx.strokeStyle = '#f9c74f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + 40, hy + 30);
    ctx.lineTo(targetX + dino.w/2, hy + 30 + prog * 80);
    ctx.stroke();
    // الديناصور
    const ropeDinoY = Math.min(hy + 30 + prog * 80 - dino.h, targetY);
    drawDinoBody(targetX, ropeDinoY, dino.w, dino.h, d.skin || activeSkin, true, false, 0);

  } else if (scene === 'car') {
    // يخرج من سيارة
    const cx = -150 + prog * (targetX + 200);
    const alpha = Math.min(prog * 2, 1);
    ctx.globalAlpha = alpha;
    // سيارة
    ctx.fillStyle = '#e63946';
    roundRect(ctx, cx - 20, groundY - 45, 80, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#c1121f';
    roundRect(ctx, cx - 5, groundY - 60, 55, 20, 6);
    ctx.fill();
    // عجلات
    ctx.fillStyle = '#1a1a2e';
    [cx - 5, cx + 45].forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, groundY - 16, 10, 0, Math.PI*2);
      ctx.fill();
    });
    // الديناصور يخرج
    if (prog > 0.5) {
      const exitProg = (prog - 0.5) * 2;
      drawDinoBody(cx + 20 + exitProg * 40, groundY - dino.h - exitProg * 40, dino.w * 0.8, dino.h * 0.8, d.skin || activeSkin, true, false, 0);
    }

  } else if (scene === 'rocket') {
    // ينزل بصاروخ من السماء
    const ry = -120 + prog * (groundY - 50);
    const alpha = Math.min(prog * 3, 1);
    ctx.globalAlpha = alpha;
    // الصاروخ
    ctx.fillStyle = '#f3722c';
    roundRect(ctx, targetX + 8, ry, 30, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#e85d04';
    ctx.beginPath();
    ctx.moveTo(targetX + 8, ry);
    ctx.lineTo(targetX + 23, ry - 20);
    ctx.lineTo(targetX + 38, ry);
    ctx.closePath();
    ctx.fill();
    // نار الصاروخ
    ctx.fillStyle = '#f9c74f';
    ctx.beginPath();
    ctx.arc(targetX + 23, ry + 65, 10, 0, Math.PI*2);
    ctx.fill();
    // الديناصور على الصاروخ
    drawDinoBody(targetX + 5, ry + 5, dino.w * 0.7, dino.h * 0.7, d.skin || activeSkin, true, false, 0);

  } else if (scene === 'catapult') {
    // يطير عبر المقلاع بقوس
    const t = prog;
    const rx = W * 0.1 + t * (targetX - W * 0.1);
    const ry = groundY - (4 * (targetY + 200) * t * (1 - t)) - 50;
    const alpha = Math.min(prog * 3, 1);
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(t * Math.PI * 2);
    drawDinoBody(0, 0, dino.w * 0.8, dino.h * 0.8, d.skin || activeSkin, true, false, 0);
    ctx.restore();

  } else { // ufo
    // يهبط من مركبة فضائية
    const uy = -80 + prog * 0.4 * groundY;
    const alpha = Math.min(prog * 3, 1);
    ctx.globalAlpha = alpha;
    // UFO
    ctx.fillStyle = '#4361ee';
    ctx.beginPath();
    ctx.ellipse(targetX + dino.w/2, uy, 50, 20, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#2dc653';
    ctx.beginPath();
    ctx.ellipse(targetX + dino.w/2, uy - 10, 25, 15, 0, 0, Math.PI*2);
    ctx.fill();
    // شعاع
    const beamGrad = ctx.createLinearGradient(targetX + dino.w/2, uy + 20, targetX + dino.w/2, targetY);
    beamGrad.addColorStop(0, 'rgba(45,198,83,0.5)');
    beamGrad.addColorStop(1, 'rgba(45,198,83,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(targetX + dino.w/2 - 30, uy + 20);
    ctx.lineTo(targetX + dino.w/2 + 30, uy + 20);
    ctx.lineTo(targetX + dino.w/2 + 15, targetY);
    ctx.lineTo(targetX + dino.w/2 - 15, targetY);
    ctx.closePath();
    ctx.fill();
    // الديناصور في الشعاع
    if (prog > 0.3) {
      const dropProg = (prog - 0.3) / 0.7;
      drawDinoBody(targetX, uy + 20 + dropProg * (targetY - uy - 20), dino.w * 0.8, dino.h * 0.8, d.skin || activeSkin, true, false, 0);
    }
  }

  ctx.restore();
}

function drawDinoBody(x, y, w, h, skin, isAI, ducking, frameIdx) {
  const colors = getSkinColors(skin, isAI);
  const runOffset = ducking ? 0 : (frameIdx === 0 ? 2 : -2);

  ctx.fillStyle = colors.body;
  roundRect(ctx, x + w*0.15, y + h*0.1, w*0.7, h*0.55, 6);
  ctx.fill();

  if (!ducking) {
    ctx.fillStyle = colors.head;
    roundRect(ctx, x + w*0.4, y, w*0.55, h*0.42, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.78, y + h*0.12, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w*0.8, y + h*0.13, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.81, y + h*0.12, 1.2, 0, Math.PI*2);
    ctx.fill();

    if (colors.expression === 'sunglasses') {
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, x + w*0.6, y + h*0.1, w*0.38, h*0.12, 4);
      ctx.fill();
      ctx.fillStyle = '#4361ee';
      roundRect(ctx, x + w*0.61, y + h*0.105, w*0.17, h*0.10, 3);
      ctx.fill();
      roundRect(ctx, x + w*0.8, y + h*0.105, w*0.17, h*0.10, 3);
      ctx.fill();
    } else if (colors.expression === 'crown') {
      ctx.fillStyle = '#f9c74f';
      ctx.beginPath();
      ctx.moveTo(x + w*0.45, y);
      ctx.lineTo(x + w*0.5, y - 12);
      ctx.lineTo(x + w*0.6, y - 6);
      ctx.lineTo(x + w*0.7, y - 14);
      ctx.lineTo(x + w*0.85, y - 5);
      ctx.lineTo(x + w*0.9, y);
      ctx.closePath();
      ctx.fill();
    } else if (colors.expression === 'tie') {
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.moveTo(x + w*0.55, y + h*0.42);
      ctx.lineTo(x + w*0.48, y + h*0.62);
      ctx.lineTo(x + w*0.55, y + h*0.68);
      ctx.lineTo(x + w*0.62, y + h*0.62);
      ctx.closePath();
      ctx.fill();
    } else if (colors.expression === 'mask') {
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, x + w*0.55, y + h*0.18, w*0.38, h*0.18, 3);
      ctx.fill();
    }

    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.arc(x + w*0.9, y + h*0.2, 2, 0, Math.PI*2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.7, y + h*0.2, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w*0.72, y + h*0.21, 3, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(x + w*0.15, y + h*0.35);
  ctx.lineTo(x - w*0.1, y + h*0.5);
  ctx.lineTo(x + w*0.05, y + h*0.55);
  ctx.lineTo(x + w*0.2, y + h*0.5);
  ctx.closePath();
  ctx.fill();

  const legY = y + h * 0.6;
  ctx.fillStyle = colors.legs;
  roundRect(ctx, x + w*0.2, legY, w*0.18, h*0.35 + runOffset, 4);
  ctx.fill();
  roundRect(ctx, x + w*0.45, legY + (ducking ? 0 : (frameIdx === 0 ? 0 : 6) - 3), w*0.18, h*0.35 - runOffset, 4);
  ctx.fill();

  if (!ducking) {
    ctx.fillStyle = colors.body;
    roundRect(ctx, x + w*0.6, y + h*0.35, w*0.15, h*0.18, 3);
    ctx.fill();
  }

  if (skin === 'cactus') {
    ctx.fillStyle = '#2a7a2a';
    [[0.3,0.15],[0.7,0.05],[0.9,0.2],[0.1,0.4]].forEach(([ox,oy]) => {
      ctx.beginPath();
      ctx.moveTo(x + w*ox - 3, y + h*oy + 4);
      ctx.lineTo(x + w*ox, y + h*oy - 5);
      ctx.lineTo(x + w*ox + 3, y + h*oy + 4);
      ctx.closePath();
      ctx.fill();
    });
  }
}

function getSkinColors(skin, isAI) {
  if (isAI) return { body:'#7c3aed', head:'#6d28d9', legs:'#5b21b6', dark:'#4c1d95', expression:'default' };
  const map = {
    classic:   { body:'#4a4a4a', head:'#3a3a3a', legs:'#2a2a2a', dark:'#1a1a1a', expression:'default' },
    cool:      { body:'#2d6a8a', head:'#1d5a7a', legs:'#1a4a6a', dark:'#0d3a5a', expression:'sunglasses' },
    corporate: { body:'#2d3748', head:'#1a202c', legs:'#171923', dark:'#0d1117', expression:'tie' },
    chad:      { body:'#c05621', head:'#9c4a1a', legs:'#7b3a12', dark:'#5a2a0c', expression:'crown' },
    ninja:     { body:'#1a1a1a', head:'#111111', legs:'#0a0a0a', dark:'#050505', expression:'mask' },
    cactus:    { body:'#2f6b2f', head:'#1e5c1e', legs:'#1a4e1a', dark:'#0f3a0f', expression:'default' },
  };
  return map[skin] || map.classic;
}

function drawJetpackFire(x, y, d) {
  for (let i = 0; i < 3; i++) {
    const alpha = 0.6 - i * 0.15;
    const h2 = 10 + i * 4;
    const spread = i * 3;
    ctx.save();
    ctx.globalAlpha = alpha;
    const fGrad = ctx.createLinearGradient(x + 16, y, x + 16, y + h2);
    fGrad.addColorStop(0, '#f9c74f');
    fGrad.addColorStop(1, 'rgba(232,93,4,0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.ellipse(x + 16 - spread, y + h2/2, 4 + spread, h2/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── العقبات ───
function drawObstacle(o) {
  if (o.type === 'cactus') drawCactus(o);
  else if (o.type === 'ptero') drawPtero(o);
  else if (o.type === 'chicken') drawChicken(o);
}

function drawCactus(o) {
  const green1 = '#2d6a2d', green2 = '#1e4e1e', dark = '#163a16';
  for (let i = 0; i < o.count; i++) {
    const cx = o.x + i * (o.w / o.count + 4);
    const ch = o.h - (i % 2 === 0 ? 0 : o.h * 0.2);
    const cy = groundY - ch;
    ctx.fillStyle = green1;
    roundRect(ctx, cx, cy, o.w / o.count - 2, ch, 4);
    ctx.fill();
    ctx.fillStyle = green2;
    roundRect(ctx, cx + o.w/o.count*0.4 - 1, cy + 8, o.w/o.count*0.2, ch - 16, 2);
    ctx.fill();
    if (i === 0 || o.count === 1) {
      ctx.fillStyle = green1;
      roundRect(ctx, cx - 10, cy + ch*0.25, 12, o.h*0.15, 3);
      ctx.fill();
      roundRect(ctx, cx - 10, cy + ch*0.1, 8, o.h*0.18, 3);
      ctx.fill();
      roundRect(ctx, cx + o.w/o.count - 2, cy + ch*0.35, 10, o.h*0.12, 3);
      ctx.fill();
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    for (let s = 0; s < 4; s++) {
      const sy = cy + ch * 0.15 + s * ch * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx - 1, sy);
      ctx.lineTo(cx - 5, sy - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + o.w/o.count - 3, sy);
      ctx.lineTo(cx + o.w/o.count + 2, sy - 3);
      ctx.stroke();
    }
  }
}

function drawPtero(o) {
  const color = '#6b4226', wing = '#8b5e3c';
  ctx.save();
  const flapAng = Math.sin(frame * 0.15) * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(o.x + o.w/2, o.y + o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = wing;
  ctx.save();
  ctx.translate(o.x + o.w/2, o.y + o.h/2);
  ctx.rotate(flapAng);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-o.w*0.9, -o.h*0.5);
  ctx.lineTo(-o.w*0.7, o.h*0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(o.x + o.w/2, o.y + o.h/2);
  ctx.rotate(-flapAng);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(o.w*0.9, -o.h*0.5);
  ctx.lineTo(o.w*0.7, o.h*0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f9c74f';
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + o.h*0.4);
  ctx.lineTo(o.x - 14, o.y + o.h*0.5);
  ctx.lineTo(o.x, o.y + o.h*0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(o.x + o.w*0.2, o.y + o.h*0.35, 4, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(o.x + o.w*0.2, o.y + o.h*0.35, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawChicken(o) {
  const bounce = Math.abs(Math.sin(frame * 0.2)) * 6;
  ctx.save();
  ctx.fillStyle = '#f5e6c8';
  ctx.beginPath();
  ctx.ellipse(o.x + 12, groundY - 20 - bounce, 12, 14, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o.x + 20, groundY - 32 - bounce, 8, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.ellipse(o.x + 20, groundY - 40 - bounce, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(o.x + 23, groundY - 33 - bounce, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#f9c74f';
  ctx.beginPath();
  ctx.moveTo(o.x + 28, groundY - 32 - bounce);
  ctx.lineTo(o.x + 34, groundY - 30 - bounce);
  ctx.lineTo(o.x + 28, groundY - 28 - bounce);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBone(b) {
  const by = b.y ?? groundY - 30;
  ctx.save();
  ctx.translate(b.x, by);
  ctx.rotate(b.rot || 0);
  ctx.fillStyle = '#e8d5a3';
  ctx.strokeStyle = '#c4a55a';
  ctx.lineWidth = 1;
  roundRect(ctx, -14, -3, 28, 6, 3);
  ctx.fill();
  ctx.stroke();
  [[-14,0],[14,0]].forEach(([ex,ey]) => {
    [[-4,-4],[4,-4],[4,4],[-4,4]].forEach(([dx,dy]) => {
      ctx.beginPath();
      ctx.arc(ex+dx, ey+dy, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawPowerupItem(p) {
  const bob = Math.sin(frame * 0.08 + p.phase) * 5;
  const py = groundY - 50 + bob;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = p.color;
  ctx.globalAlpha = 0.3 + Math.sin(frame * 0.1) * 0.1;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x + 18, py + 16, 22, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
  roundRect(ctx, p.x, py, 36, 36, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '22px serif';
  ctx.fillText(p.emoji, p.x + 7, py + 27);
  ctx.restore();
}

function drawParticle(p) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function spawnDeathParticles(x, y) {
  const colors = ['#e63946','#f9c74f','#2dc653','#4361ee','#f3722c','#fff'];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 8 + 2;
    particles.push({
      x: x + 26, y: y + 30,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 3,
      r: Math.random() * 6 + 2,
      alpha: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnDustParticles(x, y) {
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: x + Math.random() * 20,
      y: y,
      vx: -Math.random() * 1.5,
      vy: -Math.random() * 0.5,
      r: Math.random() * 3 + 1,
      alpha: 0.3,
      color: isNight ? '#6b7280' : '#c8a96e',
    });
  }
}

// ─── طبقة الحدث ───
function renderEventOverlay() {
  if (!currentEvent) return;
  if (currentEvent.type === 'rave') {
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(frame * 0.15) * 0.05;
    const hue = (frame * 3) % 360;
    ctx.fillStyle = `hsl(${hue},100%,50%)`;
    ctx.fillRect(0, 0, W, groundY);
    ctx.restore();
    // نجوم ديسكو
    for (let i = 0; i < 3; i++) {
      const sx = ((frame * (2+i) + i * 200) % W);
      const sy = (Math.sin(frame * 0.04 + i) * 0.3 + 0.3) * groundY;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = `hsl(${(frame*5+i*120)%360},100%,70%)`;
      ctx.font = '20px serif';
      ctx.fillText('✦', sx, sy);
      ctx.restore();
    }
  } else if (currentEvent.type === 'phone') {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, W/2 - 160, H * 0.04, 320, H * 0.16, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(W/25, 16)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('📱 عندك 99 رسالة في واتساب', W/2, H * 0.1);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('تباروك، أمك تدور عليك، مربي، حكومة الكاكتوس...', W/2, H * 0.16);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────
//  منطق اللعبة
// ─────────────────────────────────────────────────────────
function update(dt) {
  if (gameState !== 'playing') return;

  frame++;
  bgOffset += speed;
  distancePx += speed;

  // زيادة السرعة (بلا حد للنقاط، تتوقف فقط عند الموت)
  speed = Math.min(
    CFG.MAX_SPEED - (upgradeLevels.speed * 2),
    CFG.INIT_SPEED + score * CFG.SPEED_INC
  );

  // النقاط - لا يوجد حد، تزيد حتى الموت
  score += 0.1 * (speed / CFG.INIT_SPEED);
  const roundedScore = Math.round(score);

  // عظام من النقاط
  const newBones = Math.floor(roundedScore / CFG.SCORE_BONE_RATIO);
  if (newBones > sessionBones) {
    const diff = newBones - sessionBones;
    sessionBones = newBones;
    showHUDBones(diff);
  }

  // أصوات عند المعالم
  if (roundedScore > 0 && roundedScore % 100 === 0 && Math.abs(score - roundedScore) < 0.15) {
    playSound('score');
    if (roundedScore === 100) triggerSoundpad('score100');
    else if (roundedScore === 500) triggerSoundpad('score500');
    else if (roundedScore === 1000) triggerSoundpad('score1000');
  }

  // دورة الليل/النهار
  const newNight = Math.floor(roundedScore / CFG.DAY_NIGHT_INTERVAL) % 2 === 1;
  if (newNight !== isNight) {
    isNight = newNight;
    document.getElementById('gameWrapper').style.background = isNight ? '#0d1b2a' : '#87CEEB';
    if (isNight) { triggerSoundpad('nightStart'); }
  }

  // تحديث الطقس
  updateWeather(dt);

  // تحديث الموسيقى حسب اللعبة
  if (frame % 300 === 0) updateMusicMood();

  // تحديث HUD
  document.getElementById('scoreHud').textContent = roundedScore;
  document.getElementById('bestHud').textContent  = Math.max(bestScore, roundedScore);
  document.getElementById('bonesHud').textContent = getTotalBones();

  // فيزياء اللاعب
  updateDinoPhysics(dino);

  // تحذير عين النسر
  if (upgradeLevels.eye > 0) {
    warningShown = false;
    for (const o of obstacles) {
      if (o.x - dino.x < 200 && o.x - dino.x > 0) {
        warningShown = true;
        warningTimer = 30;
        break;
      }
    }
    if (warningTimer > 0) warningTimer--;
  }

  // تحديث الذكاء الاصطناعي
  if (aiDino.active) updateAI();

  // تمرير الخلفية
  clouds.forEach(c => { c.x -= c.speed * (speed * 0.2); });
  clouds = clouds.filter(c => c.x > -300);
  while (clouds.length < CFG.CLOUD_COUNT) clouds.push(newCloud(W + 50));

  mountains.forEach(m => {
    m.x -= m.speed * (speed * 0.15);
    if (m.x < -m.w) {
      m.x = W + m.w;
      m.h = Math.random() * groundY * 0.35 + groundY * 0.1;
      m.w = Math.random() * 180 + 100;
    }
  });

  stars.forEach(s => { s.x -= s.speed * 0.5; if (s.x < 0) s.x = W; });

  // العقبات
  spawnObstacles();
  obstacles.forEach(o => {
    if (currentEvent?.type === 'gravity') {
      o.waveOffset = (o.waveOffset || 0) + 0.05;
      o.y = (o.baseY || o.y) + Math.sin(o.waveOffset) * 20;
      if (!o.baseY) o.baseY = o.y;
    }
    o.x -= speed;
  });
  obstacles = obstacles.filter(o => o.x > -200);

  // العظام
  spawnBones();
  bones.forEach(b => { b.x -= speed; if(b.rot !== undefined) b.rot += 0.05; });
  if (hasPowerup('magnet')) {
    bones.forEach(b => {
      const dx = dino.x + dino.w/2 - b.x;
      const dy = (groundY - 30) - (b.y ?? groundY - 30);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 200) { b.x += dx * 0.08; if (b.y !== undefined) b.y += dy * 0.08; }
    });
  }
  bones = bones.filter(b => {
    const bx = b.x, by = b.y ?? groundY - 30;
    if (rectsOverlap(dino.x, dino.y, dino.w, dino.h, bx-14, by-6, 28, 12)) {
      sessionBones++;
      document.getElementById('bonesHud').textContent = getTotalBones();
      playSound('bone');
      triggerSoundpad('bone');
      return false;
    }
    return b.x > -30;
  });

  // باور أبس
  spawnPowerupItems();
  powerupItems.forEach(p => p.x -= speed);
  powerupItems = powerupItems.filter(p => {
    if (rectsOverlap(dino.x, dino.y, dino.w, dino.h, p.x, groundY - 70, 36, 50)) {
      activatePowerup(p.type);
      noPoweupRun = false;
      playSound('powerup');
      triggerSoundpad('powerup');
      return false;
    }
    return p.x > -50;
  });

  // مؤقتات الباور أبس
  dino.powerups = dino.powerups.filter(p => {
    if (Date.now() > p.endTime) {
      if (p.timerEl) p.timerEl.remove();
      return false;
    }
    if (p.timerEl) {
      const remaining = (p.endTime - Date.now()) / p.duration;
      const bar = p.timerEl.querySelector('.powerup-timer');
      if (bar) bar.style.transform = `scaleX(${remaining})`;
    }
    return true;
  });

  // التصادم
  if (!hasPowerup('jetpack') && !hasPowerup('shield')) {
    for (const o of obstacles) {
      if (o.type === 'chicken') continue;
      const hitbox = getObstacleHitbox(o);
      const dinoBox = dino.ducking
        ? { x: dino.x+4, y: groundY - dino.h*0.55 + 2, w: dino.w*1.35, h: dino.h*0.5 }
        : { x: dino.x+4, y: dino.y+4, w: dino.w-8, h: dino.h-8 };
      if (rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h, hitbox.x,hitbox.y,hitbox.w,hitbox.h)) {
        killDino(); return;
      }
    }
  } else if (hasPowerup('shield')) {
    for (const o of obstacles) {
      const hitbox = getObstacleHitbox(o);
      const dinoBox = dino.ducking
        ? { x: dino.x+4, y: groundY - dino.h*0.55 + 2, w: dino.w*1.35, h: dino.h*0.5 }
        : { x: dino.x+4, y: dino.y+4, w: dino.w-8, h: dino.h-8 };
      if (rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h, hitbox.x,hitbox.y,hitbox.w,hitbox.h)) {
        dino.powerups = dino.powerups.filter(p => {
          if (p.type === 'shield') { if(p.timerEl) p.timerEl.remove(); return false; }
          return true;
        });
        dino.shieldHits++;
        playSound('shield_break');
        showToast('🛡️ الدرع حمتك!', 1500);
        obstacles.splice(obstacles.indexOf(o), 1);
        if (dino.shieldHits >= 10) unlockSkin('cactus');
        break;
      }
    }
  }

  // اكتشاف التفادي القريب (near miss)
  for (const o of obstacles) {
    if (o.type === 'chicken') continue;
    const dist = o.x - (dino.x + dino.w);
    if (dist > -5 && dist < 15 && !o._nearMissed) {
      o._nearMissed = true;
      triggerSoundpad('nearMiss');
    }
  }

  updateEvents();

  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.2;
    p.alpha -= 0.025;
    p.r *= 0.97;
  });
  particles = particles.filter(p => p.alpha > 0.02 && p.r > 0.2);

  checkSkinUnlocks();

  // إرسال النقاط أونلاين
  if (onlineMode && roundedScore % 5 === 0) pushOnlineScore(roundedScore);
}

function updateDinoPhysics(d) {
  const isPlayer = d === dino;

  if (hasPowerup('jetpack') && isPlayer) {
    d.y = groundY * 0.2;
    d.vy = 0;
    d.grounded = false;
  } else {
    d.vy += CFG.GRAVITY;
    const vy = hasPowerup('slowmo') && isPlayer ? d.vy * 0.5 : d.vy;
    d.y += vy;
  }

  const floorY = d.ducking ? groundY - d.h * 0.55 : groundY - d.h;
  if (d.y >= floorY) {
    d.y = floorY;
    d.vy = 0;
    d.grounded = true;
    d.jumpCount = 0;
  }

  if (d.grounded && !d.ducking) {
    d.frameTimer++;
    if (d.frameTimer > 8) { d.frame = d.frame === 0 ? 1 : 0; d.frameTimer = 0; }
  }
}

function getObstacleHitbox(o) {
  if (o.type === 'ptero') return { x: o.x+8, y: o.y+6, w: o.w-16, h: o.h-8 };
  return { x: o.x+4, y: groundY - o.h + 2, w: o.w * o.count - 6, h: o.h - 2 };
}

// ─── تحديث الذكاء الاصطناعي مع إعادة الظهور المضحكة ───
function updateAI() {
  if (aiDino.dead) {
    aiDino.respawnProgress += 0.015;
    if (aiDino.respawnProgress >= 1) {
      // انتهى مشهد الإعادة
      aiDino.dead = false;
      aiDino.y = groundY - dino.h;
      aiDino.vy = 0;
      aiDino.grounded = true;
      aiDino.respawnScene = null;
      aiDino.respawnProgress = 0;
      showToast(`${aiDino.name} عاد! 😤`, 1500);
    }
    return;
  }

  updateDinoPhysics(aiDino);

  const lookAhead = 180 + speed * 8;
  const threat = obstacles.find(o => {
    const ox = o.x;
    return ox > aiDino.x && ox - aiDino.x < lookAhead;
  });

  if (threat) {
    const dist = threat.x - aiDino.x;
    let shouldJump = false, shouldDuck = false;

    if (threat.type === 'ptero') {
      const pteroMidY = threat.y + threat.h / 2;
      if (pteroMidY > groundY - dino.h * 0.7) shouldDuck = true;
      else shouldJump = true;
    } else {
      shouldJump = true;
    }

    if (aiDino.personality === 'clown' && Math.random() < 0.1) shouldJump = !shouldJump;

    if (aiDino.personality === 'nerd') {
      if (dist < 120 && shouldJump && aiDino.grounded && aiDino.jumpCount === 0) aiJump();
      aiDino.ducking = shouldDuck;
    } else if (aiDino.personality === 'sleeper') {
      if (!aiDino.sleeperBurst && Math.random() < 0.003) {
        aiDino.sleeperBurst = true;
        aiDino.sleeperTimer = 180;
      }
      if (aiDino.sleeperBurst) {
        aiDino.sleeperTimer--;
        if (aiDino.sleeperTimer <= 0) aiDino.sleeperBurst = false;
      }
      if (dist < 140 && shouldJump && aiDino.grounded && aiDino.jumpCount === 0) aiJump();
      aiDino.ducking = shouldDuck;
    } else {
      if (dist < 140 && shouldJump && aiDino.grounded && aiDino.jumpCount === 0) aiJump();
      aiDino.ducking = shouldDuck;
    }
  } else {
    aiDino.ducking = false;
  }

  // تصادم الذكاء الاصطناعي مع العقبات
  for (const o of obstacles) {
    if (o.type === 'chicken') continue;
    const hitbox = getObstacleHitbox(o);
    const aiBox = { x: aiDino.x+4, y: aiDino.y+4, w: dino.w-8, h: dino.h-8 };
    if (rectsOverlap(aiBox.x,aiBox.y,aiBox.w,aiBox.h, hitbox.x,hitbox.y,hitbox.w,hitbox.h)) {
      // الذكاء الاصطناعي مات - يعيد الظهور بمشهد مضحك
      killAIDino();
      break;
    }
  }

  // كلام الذكاء الاصطناعي
  const now = Date.now();
  if (now - aiDino.lastTauntTime > CFG.AI_TAUNT_INTERVAL) {
    aiDino.lastTauntTime = now;
    const ahead = aiDino.x > dino.x + 50;
    const taunts = ahead ? AI_TAUNTS_AHEAD : AI_TAUNTS_BEHIND;
    const msg = taunts[Math.floor(Math.random() * taunts.length)];
    showAIBubble(msg);
    if (!ahead) {
      aiBeatenCount++;
      if (aiBeatenCount >= 5) unlockSkin('corporate');
    }
  }
}

function killAIDino() {
  if (aiDino.dead) return;
  aiDino.dead = true;
  aiDino.respawnProgress = 0;
  // اختار مشهد إعادة عشوائي
  aiDino.respawnScene = RESPAWN_SCENES[Math.floor(Math.random() * RESPAWN_SCENES.length)];

  // soundpad للمشهد
  if (aiDino.respawnScene === 'parachute') triggerSoundpad('respawn_parachute');
  else if (aiDino.respawnScene === 'helicopter') triggerSoundpad('respawn_helicopter');
  else if (aiDino.respawnScene === 'car') triggerSoundpad('respawn_car');

  spawnDeathParticles(aiDino.x, aiDino.y);

  // في وضع أونلاين: يرجع قريب من رفيقه
  if (onlineMode) {
    aiDino.x = dino.x + 60 + Math.random() * 80;
  }
}

function aiJump() {
  if (aiDino.jumpCount < 2) {
    aiDino.vy = CFG.JUMP_FORCE * 0.9;
    aiDino.grounded = false;
    aiDino.jumpCount++;
  }
}

// ─── دوال الإنتاج ───
let lastObstacleX = 0;
let lastBoneX = 0;
let lastPowerupX = 0;

function spawnObstacles() {
  const rightmost = obstacles.reduce((m, o) => Math.max(m, o.x), -Infinity);
  if (rightmost < W * 1.2 && (obstacles.length === 0 || W - rightmost > CFG.OBSTACLE_MIN_GAP + Math.random() * 300)) {
    if (score < 5) return;
    const roll = Math.random();
    if (roll < 0.65) {
      const count = Math.random() < 0.4 ? 2 : (Math.random() < 0.3 ? 3 : 1);
      const h = 40 + Math.random() * 40;
      obstacles.push({ type:'cactus', x: W + 60, y: groundY - h, w: 24, h, count });
    } else if (score > 30) {
      const heightFrac = CFG.PTERO_HEIGHTS[Math.floor(Math.random() * CFG.PTERO_HEIGHTS.length)];
      obstacles.push({
        type:'ptero',
        x: W + 60,
        y: groundY - dino.h * (2 - heightFrac),
        w: 60, h: 36,
      });
    }
  }

  if (currentEvent?.type === 'chicken') {
    const rightmostC = obstacles.filter(o=>o.type==='chicken').reduce((m,o)=>Math.max(m,o.x),-Infinity);
    if (rightmostC < W * 0.8) {
      obstacles.push({ type:'chicken', x: W + 40, y: groundY - 40, w: 38, h: 40, count: 1 });
    }
  }
}

function spawnBones() {
  if (Math.random() < 0.012 * (1 + upgradeLevels.luck * 0.2)) {
    bones.push({ x: W + 20, y: groundY - 28 - Math.random() * 30, rot: Math.random() * Math.PI });
  }
}

function spawnPowerupItems() {
  if (score < CFG.POWERUP_SPAWN_SCORE) return;
  const spawnChance = 0.003 * (upgradeLevels.luck > 0 ? 1 / UPGRADES[3].effects[upgradeLevels.luck-1] : 1);
  if (Math.random() < spawnChance) {
    const types = [
      { type:'jetpack',  emoji:'🚀', color:'#f3722c' },
      { type:'magnet',   emoji:'🧲', color:'#4361ee' },
      { type:'slowmo',   emoji:'☕', color:'#8b5e3c' },
      { type:'shield',   emoji:'🛡️', color:'#4361ee' },
      { type:'banana',   emoji:'🍌', color:'#f9c74f' },
    ];
    const t = types[Math.floor(Math.random() * types.length)];
    powerupItems.push({ ...t, x: W + 20, phase: Math.random() * Math.PI * 2 });
  }
}

function activatePowerup(type) {
  dino.powerups = dino.powerups.filter(p => {
    if (p.type === type) { if(p.timerEl) p.timerEl.remove(); return false; }
    return true;
  });

  const duration = type === 'jetpack' ? 5000 : type === 'slowmo' ? 6000 : 7000;
  const el = document.createElement('div');
  el.className = 'powerup-icon';
  const emojis = { jetpack:'🚀', magnet:'🧲', slowmo:'☕', shield:'🛡️', banana:'🍌' };
  el.innerHTML = `${emojis[type]}<div class="powerup-timer"></div>`;
  document.getElementById('powerupBar').appendChild(el);
  dino.powerups.push({ type, endTime: Date.now() + duration, duration, timerEl: el });

  const msgs = {
    jetpack: '🚀 جت باك! واااو!',
    slowmo: '☕ قهوة بطيئة... ليش كل شي ثقيل؟!',
    banana: '🍌 موزة! (تحذير: زلق)',
    shield: '🛡️ درع شغّال!',
    magnet: '🧲 مغناطيس - وهو يجذب المشاكل كذلك.',
  };
  showToast(msgs[type] || '✨ باور أب!', 2000);
  if (type === 'jetpack') { dino.vy = CFG.JUMP_FORCE * 1.5; playMusicForMood('action'); }
}

function hasPowerup(type) {
  return dino.powerups.some(p => p.type === type && Date.now() < p.endTime);
}

// ─── الأحداث الجماعية ───
const RANDOM_EVENTS = [
  { type:'chicken',  name:'🐔 غزو الدجاج!',       msg:'الدجاج احتل الطريق السريع!' },
  { type:'rave',     name:'🎉 ريف مود!',            msg:'الدي جي أسقط البيت (ومعه نقاطك)' },
  { type:'phone',    name:'📱 واتساب يعيط عليك!',  msg:'ماما تبحث عليك. تعدى الكاكتوس أول.' },
  { type:'tax',      name:'💸 الضرائب!',            msg:'حكومة الكاكتوس تشكرك (-15%)' },
  { type:'gravity',  name:'🌀 فيزياء انكسرت!',     msg:'physics.exe توقف عن العمل' },
  { type:'kebab',    name:'🥙 شوارمة مجانية!',     msg:'لا تتوقف! الكاكتوس عنده شوارمة!' },
  { type:'football', name:'⚽ ماتش النادي!',        msg:'النادي يلعب! ركّز أو تخسر الاثنين!' },
];

function updateEvents() {
  if (currentEvent && Date.now() > eventEndTime) {
    if (currentEvent.type === 'tax') score *= 0.85;
    currentEvent = null;
    hideBanner();
  }

  if (!currentEvent && Math.round(score) > nextEventScore) {
    currentEvent = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    eventEndTime = Date.now() + 8000;
    nextEventScore = Math.round(score) + CFG.EVENT_MIN_SCORE + Math.random() * 120;
    showBanner(currentEvent.name);
    showToast(currentEvent.msg, 3000);

    if (currentEvent.type === 'rave') {
      playSound('rave');
      playMusicForMood('funny');
      triggerSoundpad('event_rave');
    } else if (currentEvent.type === 'tax') {
      showToast('💸 النقاط انقصت 15%!', 2000);
      triggerSoundpad('event_tax');
    } else if (currentEvent.type === 'chicken') {
      triggerSoundpad('event_chicken');
    }
  }
}

// ─── فتح المظاهر ───
function checkSkinUnlocks() {
  if (Math.round(score) >= 1000) unlockSkin('cool');
  if (noPoweupRun && Math.round(score) >= 500) unlockSkin('ninja');
  const today = new Date().toDateString();
  const saved = localStorage.getItem('dinoplus_daily');
  if (saved) {
    const { date, score: ds } = JSON.parse(saved);
    if (date === today && score > ds) {
      localStorage.setItem('dinoplus_daily', JSON.stringify({ date: today, score: Math.round(score) }));
      unlockSkin('chad');
    }
  } else {
    localStorage.setItem('dinoplus_daily', JSON.stringify({ date: today, score: Math.round(score) }));
  }
}

function unlockSkin(id) {
  const s = SKINS.find(s => s.id === id);
  if (s && !s.unlocked) {
    s.unlocked = true;
    showToast(`🎉 مظهر جديد: ${s.name}!`, 3000);
    saveData();
  }
}

// ─── الموت / انتهاء اللعبة ───
function killDino() {
  if (dino.dead) return;
  dino.dead = true;
  gameState = 'dead';
  playSound('death');
  triggerSoundpad('death');
  spawnDeathParticles(dino.x, dino.y);
  screenShake(8);

  dino.powerups.forEach(p => { if(p.timerEl) p.timerEl.remove(); });
  dino.powerups = [];

  const roundedScore = Math.round(score);
  const isNewBest = roundedScore > bestScore;
  if (isNewBest) bestScore = roundedScore;
  bonesCollected += sessionBones;

  const lb = getLeaderboard();
  const qualifies = lb.length < 10 || roundedScore > (lb[lb.length-1]?.score ?? 0);
  if (qualifies) {
    const name = localStorage.getItem('dinoplus_pname') || 'مجهول';
    addLeaderboardEntry(name, roundedScore, activeSkin);
  }
  saveData();

  if (onlineMode) pushOnlineScore(roundedScore, true);

  setTimeout(() => showGameOver(roundedScore, isNewBest), 700);
}

function showGameOver(sc, isNewBest) {
  document.getElementById('gameoverEmoji').textContent = isNewBest ? '🏆' : ['💀','😵','🦖','😤'][Math.floor(Math.random()*4)];
  document.getElementById('goScore').textContent = sc;
  document.getElementById('goBest').textContent  = bestScore;
  document.getElementById('goBones').textContent = bonesCollected;
  document.getElementById('goDist').textContent  = Math.floor(distancePx/100) + 'م';
  document.getElementById('funnyMsg').textContent = FUNNY_MSGS[Math.floor(Math.random()*FUNNY_MSGS.length)];
  showScreen('gameoverScreen');
  // عودة للموسيقى المرحة
  if (musicEnabled) playMusicForMood('funny');
}

function screenShake(intensity) {
  const wrapper = document.getElementById('gameWrapper');
  let s = 0;
  const shakeInterval = setInterval(() => {
    s++;
    const dx = (Math.random()-0.5) * intensity * (1 - s/10);
    const dy = (Math.random()-0.5) * intensity * (1 - s/10);
    wrapper.style.transform = `translate(${dx}px,${dy}px)`;
    if (s >= 10) { wrapper.style.transform = ''; clearInterval(shakeInterval); }
  }, 30);
}

// ─────────────────────────────────────────────────────────
//  أصوات إجرائية (Web Audio API)
// ─────────────────────────────────────────────────────────
function playSound(type) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  switch(type) {
    case 'jump':
      o.frequency.setValueAtTime(200, now);
      o.frequency.exponentialRampToValueAtTime(500, now + 0.12);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      o.start(now); o.stop(now + 0.15); break;
    case 'death':
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(400, now);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.5);
      g.gain.setValueAtTime(0.4, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      o.start(now); o.stop(now + 0.5); break;
    case 'score':
      o.type = 'sine';
      [523,659,784].forEach((f,i) => {
        const t2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        t2.connect(g2); g2.connect(audioCtx.destination);
        t2.frequency.value = f;
        g2.gain.setValueAtTime(0.25, now + i*0.08);
        g2.gain.exponentialRampToValueAtTime(0.001, now + i*0.08 + 0.12);
        t2.start(now + i*0.08); t2.stop(now + i*0.08 + 0.15);
      });
      o.stop(now); return;
    case 'powerup':
      o.type = 'triangle';
      o.frequency.setValueAtTime(300, now);
      o.frequency.exponentialRampToValueAtTime(900, now + 0.2);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      o.start(now); o.stop(now + 0.25); break;
    case 'shield_break':
      o.type = 'square';
      o.frequency.setValueAtTime(800, now);
      o.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      g.gain.setValueAtTime(0.4, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      o.start(now); o.stop(now + 0.3); break;
    case 'bone':
      o.type = 'sine';
      o.frequency.setValueAtTime(600, now);
      o.frequency.exponentialRampToValueAtTime(800, now + 0.06);
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      o.start(now); o.stop(now + 0.08); break;
    case 'rave':
      [200,300,400,600].forEach((f,i) => {
        const t2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        t2.type = 'square';
        t2.connect(g2); g2.connect(audioCtx.destination);
        t2.frequency.value = f;
        g2.gain.setValueAtTime(0.1, now + i*0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + i*0.1 + 0.09);
        t2.start(now + i*0.1); t2.stop(now + i*0.1 + 0.1);
      });
      o.stop(now); return;
    default:
      o.stop(now); return;
  }
}

// ─────────────────────────────────────────────────────────
//  المدخلات
// ─────────────────────────────────────────────────────────
function onJump() {
  initAudio();
  if (gameState === 'menu') { startGame('solo'); return; }
  if (gameState === 'dead') return;
  if (gameState !== 'playing') return;
  if (dino.ducking) { dino.ducking = false; return; }

  let maxJumps = 2;
  if (hasPowerup('banana') && Math.random() < 0.3) {
    dino.x += (Math.random()-0.5) * 30;
    showToast('🍌 زلقت!', 1000);
    return;
  }

  if (dino.jumpCount < maxJumps) {
    const jumpMult = upgradeLevels.jump > 0 ? UPGRADES[1].effects[upgradeLevels.jump-1] : 1;
    dino.vy = CFG.JUMP_FORCE * jumpMult;
    dino.grounded = false;
    dino.jumpCount++;
    playSound('jump');
    if (dino.jumpCount === 2) triggerSoundpad('doubleJump');
    else triggerSoundpad('jump');
  }
}

function onDuck(pressed) {
  if (gameState !== 'playing') return;
  dino.ducking = pressed;
  if (pressed && !dino.grounded) dino.vy += 3;
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onJump(); }
  if (e.code === 'ArrowDown') { e.preventDefault(); onDuck(true); }
  if (e.code === 'KeyR' && gameState === 'dead') restartGame();
  if (e.code === 'Escape') goMenu();
});
document.addEventListener('keyup', e => {
  if (e.code === 'ArrowDown') onDuck(false);
});

// ─────────────────────────────────────────────────────────
//  حلقة اللعبة الرئيسية
// ─────────────────────────────────────────────────────────
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / (1000/CFG.FPS), 3);
  lastTime = ts;

  if (gameState === 'menu') animateMenuDino();
  if (gameState === 'playing' || gameState === 'dead') {
    update(dt);
    render();
  }

  animId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────────────────
//  حركة ديناصور القائمة
// ─────────────────────────────────────────────────────────
let menuDinoFrame = 0, menuDinoFrameTimer = 0;
function animateMenuDino() {
  const mc = document.getElementById('menuDinoCanvas');
  if (!mc) return;
  const mctx = mc.getContext('2d');
  mctx.clearRect(0, 0, mc.width, mc.height);
  menuDinoFrameTimer++;
  if (menuDinoFrameTimer > 10) { menuDinoFrame = menuDinoFrame === 0 ? 1 : 0; menuDinoFrameTimer = 0; }
  const savedCtx = ctx;
  ctx = mctx;
  drawDinoBody(70, 10, CFG.DINO_W, CFG.DINO_H, activeSkin, false, false, menuDinoFrame);
  ctx = savedCtx;
}

// ─────────────────────────────────────────────────────────
//  تدفق اللعبة
// ─────────────────────────────────────────────────────────
function startGame(mode) {
  initAudio();
  gameState = 'playing';

  score = 0;
  sessionBones = 0;
  distancePx = 0;
  speed = CFG.INIT_SPEED;
  frame = 0;
  isNight = false;
  noPoweupRun = true;
  warningShown = false;
  warningTimer = 0;
  currentEvent = null;
  nextEventScore = CFG.EVENT_MIN_SCORE + Math.random() * 80;
  obstacles = [];
  bones = [];
  powerupItems = [];
  particles = [];
  rainDrops = [];
  sandParticlesWeather = [];
  weatherTimer = 0;
  currentWeather = WEATHERS[0];
  currentMusicMood = 'normal';
  document.getElementById('powerupBar').innerHTML = '';
  document.getElementById('gameWrapper').style.background = '#87CEEB';

  dino.dead = false;
  dino.x = W * 0.12;
  dino.y = groundY - dino.h;
  dino.vy = 0;
  dino.grounded = true;
  dino.jumpCount = 0;
  dino.ducking = false;
  dino.frame = 0;
  dino.frameTimer = 0;
  dino.powerups = [];
  dino.skin = activeSkin;

  if (upgradeLevels.shield > 0) activatePowerup('shield');

  if (mode === 'solo') {
    const personalities = ['rival','clown','nerd','sleeper'];
    aiDino.personality = personalities[Math.floor(Math.random() * personalities.length)];
    const names = { rival:'RivalRex', clown:'ChaosRex', nerd:'Dino3000', sleeper:'ZombieRex' };
    aiDino.name = names[aiDino.personality];
    aiDino.active = true;
    aiDino.dead = false;
    aiDino.respawnScene = null;
    aiDino.respawnProgress = 0;
    aiDino.x = W * 0.12;
    aiDino.y = groundY - dino.h;
    aiDino.vy = 0;
    aiDino.grounded = true;
    aiDino.jumpCount = 0;
    aiDino.ducking = false;
    aiDino.frame = 0;
    aiDino.frameTimer = 0;
    aiDino.lastTauntTime = Date.now();
  }

  showScreen('playing');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('onlineBoard').classList.add('hidden');
  hideBanner();

  // ابدأ بموسيقى مرحة
  playMusicForMood('funny');
}

function restartGame() {
  showScreen('playing');
  if (onlineMode) startOnlineGame();
  else startGame('solo');
}

function goMenu() {
  if (onlineMode) leaveRoom();
  gameState = 'menu';
  aiDino.active = false;
  dino.powerups.forEach(p => { if(p.timerEl) p.timerEl.remove(); });
  dino.powerups = [];
  document.getElementById('powerupBar').innerHTML = '';
  showScreen('menuScreen');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('onlineBoard').classList.add('hidden');
  updateMenuBones();
  hideBanner();
  if (musicEnabled) playMusicForMood('funny');
}

function showHUDBones(count) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:${dino.x+10}px;top:${dino.y-20}px;
    color:#f9c74f;font-weight:700;font-size:14px;font-family:monospace;
    z-index:40;pointer-events:none;animation:bonePop .6s ease forwards;`;
  el.textContent = `+${count}🦴`;
  document.getElementById('gameWrapper').appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ─────────────────────────────────────────────────────────
//  Firebase - اللعب الجماعي أونلاين
// ─────────────────────────────────────────────────────────
function waitForFirebase(cb) {
  if (window._fbReady) { cb(); }
  else { setTimeout(() => waitForFirebase(cb), 100); }
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2,7).toUpperCase();
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substring(2,10);
}

function createRoom() {
  const name = document.getElementById('playerNameInput').value.trim() || 'مجهول';
  if (name) localStorage.setItem('dinoplus_pname', name);

  waitForFirebase(() => {
    const db = window._db;
    const ref = window._fbRef;
    const set = window._fbSet;
    const onValue = window._fbOnValue;

    const code = generateRoomCode();
    myPlayerId = generatePlayerId();
    isHost = true;
    roomId = code;

    const roomData = {
      code,
      host: myPlayerId,
      status: 'waiting',
      created: Date.now(),
      players: {
        [myPlayerId]: { name, score: 0, dead: false, skin: activeSkin, host: true }
      }
    };

    roomRef = ref(db, `dinoRooms/${code}`);
    set(roomRef, roomData).then(() => {
      showRoomLobby(code, true);
      listenToRoom(code);
    }).catch(err => {
      showStatus('❌ خطأ في إنشاء الغرفة: ' + err.message, 'danger');
    });
  });
}

function joinRoom() {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('playerNameInput').value.trim() || 'مجهول';
  if (!code) { showStatus('ادخل كود الغرفة!', 'warning'); return; }
  if (name) localStorage.setItem('dinoplus_pname', name);

  waitForFirebase(() => {
    const db = window._db;
    const ref = window._fbRef;
    const get = window._fbGet;
    const update = window._fbUpdate;

    myPlayerId = generatePlayerId();
    isHost = false;

    const rRef = ref(db, `dinoRooms/${code}`);
    get(rRef).then(snap => {
      if (!snap.exists()) { showStatus('❌ الغرفة مو موجودة!', 'danger'); return; }
      const data = snap.val();
      if (data.status === 'playing') { showStatus('❌ اللعبة بدأت خلاص!', 'danger'); return; }
      const playerCount = Object.keys(data.players || {}).length;
      if (playerCount >= 4) { showStatus('❌ الغرفة ممتلئة (4 لاعبين كحد أقصى)!', 'danger'); return; }

      roomId = code;
      roomRef = ref(db, `dinoRooms/${code}`);

      update(ref(db, `dinoRooms/${code}/players/${myPlayerId}`), {
        name, score: 0, dead: false, skin: activeSkin, host: false
      }).then(() => {
        showRoomLobby(code, false);
        listenToRoom(code);
      });
    }).catch(err => {
      showStatus('❌ ' + err.message, 'danger');
    });
  });
}

function listenToRoom(code) {
  const db = window._db;
  const ref = window._fbRef;
  const onValue = window._fbOnValue;

  if (roomListener) window._fbOff(roomRef, 'value', roomListener);
  roomRef = ref(db, `dinoRooms/${code}`);
  roomListener = onValue(roomRef, snap => {
    if (!snap.exists()) { showToast('حذفت الغرفة.', 2000); leaveRoom(); return; }
    const data = snap.val();
    onlinePlayers = data.players || {};
    updateRoomLobbyUI(data);
    if (data.status === 'playing' && gameState !== 'playing') startOnlineRun();
    if (gameState === 'playing' && onlineMode) updateOnlineScoreboard();
  });
}

function updateRoomLobbyUI(data) {
  const list = document.getElementById('roomPlayersList');
  if (!list) return;
  const players = data.players || {};
  list.innerHTML = '';
  Object.entries(players).forEach(([pid, p]) => {
    const el = document.createElement('div');
    el.className = 'room-player';
    el.innerHTML = `
      <div class="player-dot" style="background:${p.host?'#f9c74f':'#2dc653'}"></div>
      <span style="color:#fff;flex:1">${p.name}</span>
      ${p.host ? '<span class="player-host-badge">هوست</span>' : ''}
      ${pid === myPlayerId ? '<span style="color:#9ca3af;font-size:.7rem">(أنت)</span>' : ''}
    `;
    list.appendChild(el);
  });

  if (isHost) {
    const count = Object.keys(players).length;
    const btn = document.getElementById('startOnlineBtn');
    if (btn) {
      btn.disabled = count < 2;
      btn.textContent = count < 2 ? '⏳ نستنى لاعبين...' : `▶ ابدأ اللعبة (${count} لاعبين)`;
    }
  }
}

function showRoomLobby(code, hosting) {
  document.getElementById('onlinePanelContent').classList.add('hidden');
  document.getElementById('roomLobby').classList.remove('hidden');
  document.getElementById('roomCodeDisplay').textContent = code;
  document.getElementById('hostActions').classList.toggle('hidden', !hosting);
  document.getElementById('guestWaiting').classList.toggle('hidden', hosting);
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomId || '');
  showToast('📋 نسخت الكود!', 1500);
}
window.copyRoomCode = copyRoomCode;

function startOnlineGame() {
  if (!isHost || !roomId) return;
  const db = window._db;
  const ref = window._fbRef;
  const update = window._fbUpdate;
  update(ref(db, `dinoRooms/${roomId}`), { status: 'playing' });
}

function startOnlineRun() {
  onlineMode = true;
  hidePanel('onlinePanel');
  startGame('online');
  aiDino.active = false;
  document.getElementById('onlineBoard').classList.remove('hidden');
  updateOnlineScoreboard();
}

function pushOnlineScore(sc, dead = false) {
  if (!roomId || !myPlayerId) return;
  const db = window._db;
  const ref = window._fbRef;
  const update = window._fbUpdate;
  update(ref(db, `dinoRooms/${roomId}/players/${myPlayerId}`), {
    score: sc,
    dead,
    skin: activeSkin,
  });
}

function updateOnlineScoreboard() {
  const rows = document.getElementById('obRows');
  if (!rows) return;
  const sorted = Object.entries(onlinePlayers).sort((a,b) => b[1].score - a[1].score);
  rows.innerHTML = '';
  sorted.forEach(([pid, p], i) => {
    const row = document.createElement('div');
    row.className = 'ob-row' + (p.dead ? ' ob-dead' : '');
    const medal = ['🥇','🥈','🥉','4️⃣'][i] || (i+1);
    row.innerHTML = `
      <span class="ob-rank">${medal}</span>
      <span class="ob-name">${p.name}${pid===myPlayerId?'<span style="color:#4361ee"> ★</span>':''}</span>
      <span class="ob-score">${Math.round(p.score)}</span>
      ${p.dead ? '💀' : ''}
    `;
    rows.appendChild(row);
  });
}

function leaveRoom() {
  if (roomRef && myPlayerId) {
    const db = window._db;
    const ref = window._fbRef;
    const remove = window._fbRemove;
    remove(ref(db, `dinoRooms/${roomId}/players/${myPlayerId}`)).catch(()=>{});
    if (isHost) remove(ref(db, `dinoRooms/${roomId}`)).catch(()=>{});
  }
  if (roomListener && roomRef) { window._fbOff(roomRef, 'value', roomListener); roomListener = null; }
  roomId = null;
  myPlayerId = null;
  isHost = false;
  onlineMode = false;
  onlinePlayers = {};
  document.getElementById('onlinePanelContent').classList.remove('hidden');
  document.getElementById('roomLobby').classList.add('hidden');
  hidePanel('onlinePanel');
  document.getElementById('onlineBoard').classList.add('hidden');
  showToast('👋 خرجت من الغرفة.', 1500);
}

// ─────────────────────────────────────────────────────────
//  واجهة المستخدم
// ─────────────────────────────────────────────────────────
function showScreen(name) {
  const screens = ['loadingScreen','menuScreen','gameoverScreen'];
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (s === name + 'Screen' || s === name) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  if (name === 'playing') {
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameoverScreen').classList.add('hidden');
    if ('ontouchstart' in window) {
      document.getElementById('touchControls').style.display = 'flex';
    }
  }
}

function showPanel(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'upgradesPanel') renderUpgrades();
  if (id === 'skinsPanel') renderSkins();
  if (id === 'leaderboardPanel') renderLeaderboard();
}
window.showPanel = showPanel;

function hidePanel(id) {
  document.getElementById(id).classList.add('hidden');
}
window.hidePanel = hidePanel;

function showBanner(text) {
  const b = document.getElementById('eventBanner');
  b.textContent = text;
  b.classList.add('show');
}
function hideBanner() {
  document.getElementById('eventBanner').classList.remove('show');
}

function showAIBubble(msg) {
  const b = document.getElementById('aiBubble');
  b.textContent = msg;
  b.style.left = (dino.x + 60) + 'px';
  b.style.top  = (dino.y - 40) + 'px';
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 3000);
}

let toastTimer = null;
function showToast(msg, dur = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}
window.showToast = showToast;

function showStatus(msg, type) {
  const el = document.getElementById('roomStatus');
  const colors = { danger:'#e63946', warning:'#f9c74f', success:'#2dc653' };
  el.innerHTML = `<div style="color:${colors[type]||'#fff'};font-size:.85rem;padding:8px;text-align:center">${msg}</div>`;
}

function updateMenuBones() {
  document.getElementById('menuBones').textContent = `🦴 ${getTotalBones()}`;
}

// ─── واجهة الترقيات ───
function renderUpgrades() {
  document.getElementById('bonesDisplay').textContent = getTotalBones();
  const grid = document.getElementById('upgradeGrid');
  grid.innerHTML = '';
  UPGRADES.forEach(u => {
    const level = upgradeLevels[u.id] || 0;
    const maxed = level >= u.maxLevel;
    const cost = maxed ? '—' : u.levels[level];
    const canAfford = !maxed && getTotalBones() >= cost;
    const dots = Array(u.maxLevel).fill(0).map((_,i) =>
      `<div class="upgrade-dot${i < level ? ' filled' : ''}"></div>`).join('');
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    item.innerHTML = `
      <div class="upgrade-icon">${u.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
        <div class="upgrade-level">${dots}</div>
      </div>
      <button class="upgrade-buy" ${(!canAfford || maxed)?'disabled':''} onclick="buyUpgrade('${u.id}')">
        ${maxed ? 'MAX' : `🦴 ${cost}`}
      </button>
    `;
    grid.appendChild(item);
  });
}

function buyUpgrade(id) {
  const u = UPGRADES.find(u => u.id === id);
  const level = upgradeLevels[id] || 0;
  if (level >= u.maxLevel) return;
  const cost = u.levels[level];
  if (getTotalBones() < cost) { showToast('❌ ماعندكش عظام كافية!'); return; }
  bonesCollected -= cost;
  if (bonesCollected < 0) { sessionBones += bonesCollected; bonesCollected = 0; }
  upgradeLevels[id] = level + 1;
  saveData();
  showToast(`✅ ${u.name} ترقّت للمستوى ${level+1}!`);
  renderUpgrades();
}
window.buyUpgrade = buyUpgrade;

// ─── واجهة المظاهر ───
function renderSkins() {
  const grid = document.getElementById('skinsGrid');
  grid.innerHTML = '';
  SKINS.forEach(s => {
    const isActive = activeSkin === s.id;
    const card = document.createElement('div');
    card.className = 'skin-card' + (s.unlocked ? ' unlocked' : '') + (isActive ? ' active' : '');
    const sc = document.createElement('canvas');
    sc.className = 'skin-canvas';
    sc.width = 60; sc.height = 50;
    card.appendChild(sc);
    card.innerHTML += `
      <div class="skin-name">${s.emoji} ${s.name}</div>
      <div class="skin-status">${isActive ? '✅ نشط' : s.unlocked ? 'مفتوح' : '🔒 ' + s.unlockDesc}</div>
    `;
    if (s.unlocked) {
      card.onclick = () => { activeSkin = s.id; dino.skin = s.id; saveData(); renderSkins(); };
    }
    grid.appendChild(card);
    const savedCtx = ctx;
    ctx = sc.getContext('2d');
    drawDinoBody(5, 2, 40, 46, s.id, false, false, 0);
    ctx = savedCtx;
  });
}

// ─── المتصدرون ───
function renderLeaderboard() {
  const lb = getLeaderboard();
  const el = document.getElementById('leaderboardList');
  el.innerHTML = '';
  if (!lb.length) {
    el.innerHTML = '<div class="text-muted text-center">لا نقاط بعد. كن الأول!</div>';
    return;
  }
  lb.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    const rankClass = i < 3 ? `lb-rank-${i+1}` : '';
    const medal = ['🥇','🥈','🥉'][i] || (i+1+'.');
    row.innerHTML = `
      <div class="lb-rank ${rankClass}">${medal}</div>
      <div class="lb-name">${e.name} <span style="font-size:.7rem;color:#6b7280">${SKINS.find(s=>s.id===e.skin)?.emoji||'🦕'}</span></div>
      <div class="lb-score">${e.score}</div>
      <div class="lb-date">${e.date}</div>
    `;
    el.appendChild(row);
  });
}

// ─── مساعدات الكانفاس ───
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

// ─── نجوم القائمة ───
function generateMenuStars() {
  const container = document.getElementById('menuStars');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    const size = Math.random() * 3 + 1;
    star.className = 'star';
    star.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      animation-delay:${Math.random()*2}s;
      animation-duration:${1+Math.random()*2}s;
    `;
    container.appendChild(star);
  }
}

// ─────────────────────────────────────────────────────────
//  تسلسل الإقلاع
// ─────────────────────────────────────────────────────────
const LOAD_STEPS = [
  'تحضير الديناصور...',
  'تحميل قاعدة بيانات الكاكتوس...',
  'حساب سرعة الهروب...',
  'تعليم الذكاء الاصطناعي يغش...',
  'تطبيق الفيزياء المضحكة...',
  'الاتصال بحكومة الكاكتوس...',
  'معايرة جامع العظام...',
  'قريباً (ربما)...',
];

async function boot() {
  initCanvas();
  loadData();
  seedLeaderboard();
  generateMenuStars();

  const bar = document.getElementById('loadingBar');
  const txt = document.getElementById('loadingText');

  for (let i = 0; i < LOAD_STEPS.length; i++) {
    txt.textContent = LOAD_STEPS[i];
    bar.style.width = ((i + 1) / LOAD_STEPS.length * 100) + '%';
    await new Promise(r => setTimeout(r, 180 + Math.random() * 150));
  }

  gameState = 'menu';
  showScreen('menuScreen');
  updateMenuBones();
  animId = requestAnimationFrame(gameLoop);
}

// ─── ربط الأزرار العالمية ───
window.startGame = startGame;
window.restartGame = restartGame;
window.goMenu = goMenu;
window.toggleMusic = toggleMusic;
window.onJump = onJump;
window.onDuck = onDuck;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.startOnlineGame = startOnlineGame;
window.leaveRoom = leaveRoom;

// إضافة أنيميشن العظام
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes bonePop {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-40px); opacity: 0; }
}
`;
document.head.appendChild(styleEl);

// انطلق!
boot();
