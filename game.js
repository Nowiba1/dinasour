

"use strict";

// ─── إضافة favicon مباشرة لتفادي 404 ───
(function addFavicon() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🦕</text></svg>';
  document.head.appendChild(link);
})();

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
  WEATHER_CHANGE_INTERVAL: 3600, // عدد frames قبل تغيير الطقس (~60 ثانية عند 60fps)
};

// ─── رسائل الموت بالتونسي ───
const FUNNY_MSGS = [
  "متّت. skill issue!",
  "حتى الكاكتوس حسّ بيك بالزهر.",
  "الديناصور طار من الشات.",
  "أجدادك خيّبين فيك.",
  "Speedrun أي%: صفر ثانية",
  "النيزك ماحتاجش يحاول.",
  "انقرضت. مرة ثانية.",
  "Google كانت تعيد تحميل على طول.",
  "لحظة pro gamer: FAILED",
  "الكاكتوس يبعثلك سلام.",
  "انهزمت من نبتة. شفيق!",
  "انتهت اللعبة. حاولت تطفي وتعيد تشغيل؟",
  "ماعندكش حق تلعب هذي اللعبة أصلاً 😂",
  "حتى أمك تعرف تعدى هذا الكاكتوس!",
  "اللعبة قررت تخلصك من معاناتك.",
  "طيّب خليها، روح تاكل لبلابي 🫒",
  "الكاكتوس: 1 - أنت: 0",
  "جرّب مرة ثانية يا حبيبي 💀",
  "واش هذا؟! ديناصور ولا جبن؟ 🧀",
  "هههه حتى الطفل يعرف يعدى هذا!",
];

// ─── تعليقات الذكاء الاصطناعي ───
const AI_TAUNTS_AHEAD = [
  "زلت نسخن 😴",
  "اجري ورايا إذا قدرت! 🦕",
  "السرعة = مسافتي / مهارتك",
  "404: مهارة اللاعب غير موجودة",
  "أنا وصلت لقمتي في الجوراسيك، وأنت؟",
  "يزي بيك، بطيء كيف الحلزون 🐌",
  "حتى الكاكتوس أسرع منك!",
];
const AI_TAUNTS_BEHIND = [
  "حسنا حسنا، أنت سريع.",
  "خليتك تفوز. واضح. 😤",
  "استراتيجية جديدة: خلّيهم يتعبوا.",
  "هذا مخطط. ثق بي.",
  "نحسب انتقام... 🤔",
  "واش هذا؟! أنت تغشش؟ 😡",
  "بالصدفة تقدم عليّ، ما يدوم!",
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

// ── متغير لمنع تكرار صوت النقاط (هذا كان سبب تجميد اللعبة!) ──
let lastMilestonePlayed = -1;

// ── الطقس ──
const WEATHERS = [
  { name:'صافي', icon:'☀️', id:'sunny' },
  { name:'غيوم', icon:'⛅', id:'cloudy' },
  { name:'عاصفة رملية', icon:'🌪️', id:'storm' },
  { name:'مطر', icon:'🌧️', id:'rain' },
  { name:'ليل نجمي', icon:'🌙', id:'night' },
  { name:'حرارة لهيب', icon:'🔥', id:'hot' },
  { name:'ضباب', icon:'🌫️', id:'fog' },
];
let currentWeatherIdx = 0;
let weatherFrameTimer = 0;
let rainDrops = [], sandParts = [];

// اللاعب
const dino = {
  x:0, y:0, vy:0,
  w:CFG.DINO_W, h:CFG.DINO_H,
  grounded:true, jumping:false,
  jumpCount:0, ducking:false,
  dead:false, frame:0, frameTimer:0,
  skin:'classic', powerups:[], shieldHits:0,
};

// الذكاء الاصطناعي
const aiDino = {
  x:0, y:0, vy:0,
  grounded:true, jumpCount:0,
  ducking:false, dead:false,
  respawnScene:null, respawnProgress:0,
  personality:'rival', name:'Ghost',
  frame:0, frameTimer:0, active:false,
  lastTauntTime:0,
  sleeperBurst:false, sleeperTimer:0,
};

let obstacles=[], bones=[], powerupItems=[];
let clouds=[], mountains=[], stars=[];
let particles=[];
let bgOffset=0;

// الأحداث العشوائية
let currentEvent=null, eventEndTime=0;
let nextEventScore = CFG.EVENT_MIN_SCORE + Math.random()*80;

// ── الأونلاين ──
let onlineMode=false, roomId=null, myPlayerId=null;
let isHost=false, roomRef=null, roomListener=null;
let onlinePlayers={};

// ─────────────────────────────────────────────────────────
//  UPGRADES & SKINS
// ─────────────────────────────────────────────────────────
const UPGRADES = [
  { id:'speed',  name:'Speed Control', icon:'⚙️', desc:'Reduces max speed. Easier to survive.', levels:[50,80,120], effects:[2,4,6], maxLevel:3 },
  { id:'jump',   name:'Power Jump',    icon:'🦘', desc:'Higher jump arc (+15% per level).',      levels:[40,65,100], effects:[1.15,1.3,1.5], maxLevel:3 },
  { id:'eye',    name:'Eagle Eye',     icon:'👁️', desc:'Warns 0.5s before obstacle.',            levels:[80,120,180], effects:[1,1,1], maxLevel:3 },
  { id:'luck',   name:'Lucky Paws',    icon:'🍀', desc:'Powerups appear 30% more often.',        levels:[60,90,130], effects:[0.7,0.5,0.35], maxLevel:3 },
  { id:'shield', name:'Iron Scales',   icon:'🛡️', desc:'Start each run with a free shield.',     levels:[100,150,220], effects:[1,1,1], maxLevel:3 },
];

const SKINS = [
  { id:'classic',    name:'Classic',      emoji:'🦕', unlockDesc:'Default',           unlocked:true  },
  { id:'cool',       name:'Cool Dino',    emoji:'🕶️', unlockDesc:'Score 1000+',       unlocked:false },
  { id:'corporate',  name:'Corporate',    emoji:'🤵', unlockDesc:'Beat AI 5 times',   unlocked:false },
  { id:'chad',       name:'Chad Dino',    emoji:'👑', unlockDesc:'Daily high score',  unlocked:false },
  { id:'ninja',      name:'Ninja',        emoji:'🥷', unlockDesc:'500 no powerups',   unlocked:false },
  { id:'cactus',     name:'Cactus Dino',  emoji:'🌵', unlockDesc:'Smash 10 shields',  unlocked:false },
];

let upgradeLevels = {speed:0,jump:0,eye:0,luck:0,shield:0};
let activeSkin = 'classic';
let aiBeatenCount = 0;
let noPoweupRun = true;
let sessionBones = 0;
let warningShown = false, warningTimer = 0;

// ─────────────────────────────────────────────────────────
//  AUDIO — Web Audio API procedural SFX
// ─────────────────────────────────────────────────────────
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// إصلاح: كل case يجب أن يعمل start() قبل stop()
function playSound(type) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    switch(type) {
      case 'jump': {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(200,now);
        o.frequency.exponentialRampToValueAtTime(500,now+0.12);
        g.gain.setValueAtTime(0.3,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
        o.start(now); o.stop(now+0.15); break;
      }
      case 'death': {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type='sawtooth'; o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(400,now);
        o.frequency.exponentialRampToValueAtTime(60,now+0.5);
        g.gain.setValueAtTime(0.4,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
        o.start(now); o.stop(now+0.5); break;
      }
      case 'score': {
        // إصلاح: لا نستخدم oscillator رئيسي هنا
        [523,659,784].forEach((f,i) => {
          const t2=audioCtx.createOscillator(), g2=audioCtx.createGain();
          t2.connect(g2); g2.connect(audioCtx.destination);
          t2.frequency.value=f;
          g2.gain.setValueAtTime(0.25,now+i*0.08);
          g2.gain.exponentialRampToValueAtTime(0.001,now+i*0.08+0.12);
          t2.start(now+i*0.08); t2.stop(now+i*0.08+0.15);
        });
        break;
      }
      case 'powerup': {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type='triangle'; o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(300,now);
        o.frequency.exponentialRampToValueAtTime(900,now+0.2);
        g.gain.setValueAtTime(0.3,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
        o.start(now); o.stop(now+0.25); break;
      }
      case 'shield_break': {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type='square'; o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(800,now);
        o.frequency.exponentialRampToValueAtTime(100,now+0.3);
        g.gain.setValueAtTime(0.4,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
        o.start(now); o.stop(now+0.3); break;
      }
      case 'bone': {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(600,now);
        o.frequency.exponentialRampToValueAtTime(800,now+0.06);
        g.gain.setValueAtTime(0.15,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.08);
        o.start(now); o.stop(now+0.08); break;
      }
      case 'rave': {
        // إصلاح: لا oscillator رئيسي غير مشغّل
        [200,300,400,600].forEach((f,i) => {
          const t2=audioCtx.createOscillator(), g2=audioCtx.createGain();
          t2.type='square'; t2.connect(g2); g2.connect(audioCtx.destination);
          t2.frequency.value=f;
          g2.gain.setValueAtTime(0.1,now+i*0.1);
          g2.gain.exponentialRampToValueAtTime(0.001,now+i*0.1+0.09);
          t2.start(now+i*0.1); t2.stop(now+i*0.1+0.1);
        });
        break;
      }
      case 'milestone': {
        // صوت خاص للمئيات
        [392,523,659,784].forEach((f,i) => {
          const t2=audioCtx.createOscillator(), g2=audioCtx.createGain();
          t2.type='triangle'; t2.connect(g2); g2.connect(audioCtx.destination);
          t2.frequency.value=f;
          g2.gain.setValueAtTime(0.3,now+i*0.1);
          g2.gain.exponentialRampToValueAtTime(0.001,now+i*0.1+0.2);
          t2.start(now+i*0.1); t2.stop(now+i*0.1+0.25);
        });
        break;
      }
    }
  } catch(e) { /* صوت فشل، نكمل */ }
}

// ─────────────────────────────────────────────────────────
//  MUSIC — SoundHelix (مجاني، بدون CORS، بدون تسجيل)
// ─────────────────────────────────────────────────────────
let musicEnabled = true;
let currentTrackAudio = null;
let currentTrackIdx = 0;
let musicVolume = 0.2;

// مقاطع موسيقية بأنماط مختلفة
const MUSIC_LIBRARY = [
  { name:'Upbeat Runner 🎮',     style:'Upbeat',   url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name:'Epic Chase 🔥',        style:'Epic',     url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { name:'Jazzy Dino 🎷',        style:'Jazz',     url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { name:'Pixel Adventure 🕹️',  style:'Pixel',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { name:'Desert Wind 🌵',       style:'Chill',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { name:'Funky Bounce 🎉',      style:'Funky',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { name:'Retro Quest 👾',       style:'Retro',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { name:'Cactus Boogie 🌵',     style:'Boogie',   url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { name:'Night Runner 🌙',      style:'Night',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { name:'Sunrise Sprint ☀️',    style:'Morning',  url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { name:'Turbo Dino 🚀',        style:'Turbo',    url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { name:'Mystery Jungle 🌴',    style:'Mystery',  url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  { name:'Silly Race 😂',        style:'Comedy',   url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
  { name:'Bone Collector 🦴',    style:'Rock',     url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' },
  { name:'Extinction Rave 💀',   style:'Rave',     url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
  { name:'Tunis Night 🌃',       style:'Ambient',  url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
];

function playTrack(idx) {
  if (!musicEnabled) return;
  if (currentTrackAudio) {
    try { currentTrackAudio.pause(); currentTrackAudio.src=''; } catch(e){}
    currentTrackAudio = null;
  }
  if (idx < 0) idx = MUSIC_LIBRARY.length - 1;
  if (idx >= MUSIC_LIBRARY.length) idx = 0;
  currentTrackIdx = idx;
  const track = MUSIC_LIBRARY[idx];
  const audio = new Audio(track.url);
  audio.volume = musicVolume;
  audio.loop = true;
  audio.play().catch(()=>{});
  currentTrackAudio = audio;
  showToast(`🎵 ${track.name} (${track.style})`, 2500);
  updateMusicUI();
}

function nextTrack() { playTrack(currentTrackIdx + 1); }
function prevTrack() { playTrack(currentTrackIdx - 1); }

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    playTrack(currentTrackIdx);
  } else {
    if (currentTrackAudio) { try { currentTrackAudio.pause(); } catch(e){} }
    showToast('🔇 Music OFF', 1500);
  }
  updateMusicUI();
}

function setMusicVolume(v) {
  musicVolume = v;
  if (currentTrackAudio) currentTrackAudio.volume = v;
}

function updateMusicUI() {
  const t = MUSIC_LIBRARY[currentTrackIdx];
  const el = document.getElementById('musicBtnText');
  if (el) el.textContent = musicEnabled ? `Music: ON` : 'Music: OFF';
  const nameEl = document.getElementById('currentTrackName');
  if (nameEl) nameEl.textContent = t ? `${t.name}` : '';
}

// ─────────────────────────────────────────────────────────
//  SOUNDPAD — أصوات ميم مضمّنة عبر Web Audio API
//  (بدون API خارجي، بدون CORS)
// ─────────────────────────────────────────────────────────
const MEME_SOUNDS = {
  // كل صوت هو دالة تولّده procedurally
  vine_boom: () => {
    if (!audioCtx) return;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    const dist=audioCtx.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++) curve[i]=Math.tanh((i/128-1)*5);
    dist.curve=curve;
    o.connect(dist); dist.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(80,audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(30,audioCtx.currentTime+0.4);
    g.gain.setValueAtTime(0.8,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.5);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime+0.5);
  },
  bruh: () => {
    if (!audioCtx) return;
    [80,82,78].forEach((f,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='sawtooth'; o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(0,audioCtx.currentTime+i*0.15);
      g.gain.linearRampToValueAtTime(0.3,audioCtx.currentTime+i*0.15+0.05);
      g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+i*0.15+0.4);
      o.start(audioCtx.currentTime+i*0.15); o.stop(audioCtx.currentTime+i*0.15+0.4);
    });
  },
  airhorn: () => {
    if (!audioCtx) return;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sawtooth'; o.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(466,audioCtx.currentTime);
    o.frequency.setValueAtTime(523,audioCtx.currentTime+0.05);
    g.gain.setValueAtTime(0.5,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.8);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime+0.8);
  },
  sad_trombone: () => {
    if (!audioCtx) return;
    [466,440,415,392].forEach((f,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='sawtooth'; o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(0.3,audioCtx.currentTime+i*0.2);
      g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+i*0.2+0.25);
      o.start(audioCtx.currentTime+i*0.2); o.stop(audioCtx.currentTime+i*0.2+0.25);
    });
  },
  wow: () => {
    if (!audioCtx) return;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(200,audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600,audioCtx.currentTime+0.1);
    o.frequency.exponentialRampToValueAtTime(400,audioCtx.currentTime+0.3);
    g.gain.setValueAtTime(0.4,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.4);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime+0.4);
  },
  gg: () => {
    if (!audioCtx) return;
    [523,659,784,1047].forEach((f,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='triangle'; o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(0.25,audioCtx.currentTime+i*0.08);
      g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+i*0.08+0.15);
      o.start(audioCtx.currentTime+i*0.08); o.stop(audioCtx.currentTime+i*0.08+0.15);
    });
  },
  nah: () => {
    if (!audioCtx) return;
    [300,280,260].forEach((f,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='square'; o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(0.2,audioCtx.currentTime+i*0.1);
      g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+i*0.1+0.12);
      o.start(audioCtx.currentTime+i*0.1); o.stop(audioCtx.currentTime+i*0.1+0.12);
    });
  },
  level_up: () => {
    if (!audioCtx) return;
    [262,330,392,523,659].forEach((f,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='triangle'; o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value=f;
      g.gain.setValueAtTime(0.3,audioCtx.currentTime+i*0.07);
      g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+i*0.07+0.1);
      o.start(audioCtx.currentTime+i*0.07); o.stop(audioCtx.currentTime+i*0.07+0.1);
    });
  },
};

// ربط الأحداث بالأصوات
const SOUNDPAD_MAP = {
  death:      { sound:'vine_boom',    msg:'💀 انتهى!' },
  score100:   { sound:'wow',          msg:'🎉 100 نقطة!' },
  score500:   { sound:'airhorn',      msg:'🔥 500 GOAT!' },
  score1000:  { sound:'level_up',     msg:'👑 1000 أسطورة!' },
  powerup:    { sound:'gg',           msg:'💪 Power UP!' },
  bone:       null,  // صامت
  nearMiss:   { sound:'bruh',         msg:'😅 كاد!' },
  nightStart: { sound:'wow',          msg:'🌙 الليل جاء!' },
  event_rave: { sound:'airhorn',      msg:'🎉 RAVE!' },
  event_tax:  { sound:'sad_trombone', msg:'💸 ضرائب!' },
  event_chicken:{ sound:'nah',        msg:'🐔 دجاج!' },
  doubleJump: { sound:'wow',          msg:'🦘 Double!' },
  respawn:    { sound:'wow',          msg:'🪂 رجع!' },
  weather:    { sound:'nah',          msg:'🌪️ طقس جديد!' },
  banana_slip:{ sound:'bruh',         msg:'🍌 زلقت!' },
  shield_hit: { sound:'nah',          msg:'🛡️ الدرع صدّ!' },
};

let soundpadTimer = null;
function triggerSoundpad(eventKey) {
  const entry = SOUNDPAD_MAP[eventKey];
  if (!entry) return;
  if (entry.sound && MEME_SOUNDS[entry.sound]) {
    try { MEME_SOUNDS[entry.sound](); } catch(e){}
  }
  if (entry.msg) {
    const el = document.getElementById('soundpad');
    if (!el) return;
    el.textContent = entry.msg;
    el.classList.add('show');
    if (soundpadTimer) clearTimeout(soundpadTimer);
    soundpadTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }
}

// ─────────────────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────────────────
function saveData() {
  const d = {
    bestScore, bones:getTotalBones(),
    upgradeLevels, activeSkin,
    skinUnlocks: SKINS.reduce((a,s)=>({...a,[s.id]:s.unlocked}),{}),
    aiBeaten:aiBeatenCount,
    leaderboard:getLeaderboard(),
    shieldHits:dino.shieldHits,
    musicIdx:currentTrackIdx,
  };
  localStorage.setItem('dinoplus_v3', JSON.stringify(d));
}

function loadData() {
  try {
    const raw = localStorage.getItem('dinoplus_v3')
              || localStorage.getItem('dinoplus_v2')
              || localStorage.getItem('dinoplus_v1') || '{}';
    const d = JSON.parse(raw);
    bestScore = d.bestScore||0;
    bonesCollected = d.bones||0;
    upgradeLevels = d.upgradeLevels||{speed:0,jump:0,eye:0,luck:0,shield:0};
    activeSkin = d.activeSkin||'classic';
    dino.skin = activeSkin;
    aiBeatenCount = d.aiBeaten||0;
    dino.shieldHits = d.shieldHits||0;
    currentTrackIdx = d.musicIdx||0;
    if (d.skinUnlocks) SKINS.forEach(s=>s.unlocked=d.skinUnlocks[s.id]??s.unlocked);
    if (d.leaderboard) localStorage.setItem('dinoplus_lb', JSON.stringify(d.leaderboard));
  } catch(e){}
}

function getTotalBones() { return bonesCollected+sessionBones; }
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('dinoplus_lb')||'[]'); } catch(e){ return []; }
}
function addLeaderboardEntry(name, sc, skin) {
  const lb=getLeaderboard();
  lb.push({name,score:sc,skin,date:new Date().toLocaleDateString('fr-TN')});
  lb.sort((a,b)=>b.score-a.score);
  localStorage.setItem('dinoplus_lb',JSON.stringify(lb.slice(0,10)));
}
function seedLeaderboard() {
  const lb=getLeaderboard();
  if(lb.length<5){
    const seeds=[
      {name:'DinoKing تونس',score:4280,skin:'chad',date:'01/01/2025'},
      {name:'TunisDino99',score:3150,skin:'ninja',date:'02/01/2025'},
      {name:'SpeedRex',score:2800,skin:'cool',date:'03/01/2025'},
      {name:'CactusMan',score:1900,skin:'cactus',date:'04/01/2025'},
      {name:'NewbDino',score:420,skin:'classic',date:'05/01/2025'},
    ];
    seeds.forEach(s=>{if(!lb.find(e=>e.name===s.name))lb.push(s);});
    lb.sort((a,b)=>b.score-a.score);
    localStorage.setItem('dinoplus_lb',JSON.stringify(lb));
  }
}

// ─────────────────────────────────────────────────────────
//  CANVAS SETUP
// ─────────────────────────────────────────────────────────
function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', ()=>setTimeout(resize,200));
}

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  groundY = H * CFG.GROUND_H_RATIO;
  dino.x = W * 0.12;
  if (!dino.dead) dino.y = groundY - dino.h;
  aiDino.x = W * 0.12;
  if (!aiDino.dead) aiDino.y = groundY - dino.h;
  generateBackground();
  // حجم الديناصور يتأقلم مع الشاشة
  const scale = Math.min(W, H) / 600;
  CFG.DINO_W = Math.max(36, Math.round(52 * scale));
  CFG.DINO_H = Math.max(42, Math.round(60 * scale));
  dino.w = CFG.DINO_W; dino.h = CFG.DINO_H;
}

// ─────────────────────────────────────────────────────────
//  BACKGROUND GENERATION
// ─────────────────────────────────────────────────────────
function generateBackground() {
  stars=[];
  for(let i=0;i<CFG.STAR_COUNT;i++){
    stars.push({
      x:Math.random()*W, y:Math.random()*groundY*0.9,
      r:Math.random()*1.8+0.3,
      speed:Math.random()*0.3+0.1,
      twinkleOffset:Math.random()*Math.PI*2,
    });
  }
  clouds=[];
  for(let i=0;i<CFG.CLOUD_COUNT;i++) clouds.push(newCloud(Math.random()*W));
  mountains=[];
  for(let i=0;i<CFG.MOUNTAIN_COUNT;i++){
    mountains.push({
      x:(W/CFG.MOUNTAIN_COUNT)*i+Math.random()*120-60,
      h:Math.random()*groundY*0.35+groundY*0.1,
      w:Math.random()*180+100,
      speed:0.4,
    });
  }
}

function newCloud(x) {
  return {
    x:x??W+100,
    y:Math.random()*groundY*0.35+20,
    w:Math.random()*120+60,
    h:Math.random()*40+20,
    speed:Math.random()*0.5+0.2,
  };
}

// ─────────────────────────────────────────────────────────
//  WEATHER SYSTEM
// ─────────────────────────────────────────────────────────
function updateWeather() {
  if(gameState!=='playing') return;
  weatherFrameTimer++;
  if(weatherFrameTimer >= CFG.WEATHER_CHANGE_INTERVAL) {
    weatherFrameTimer = 0;
    currentWeatherIdx = (currentWeatherIdx+1) % WEATHERS.length;
    const w = WEATHERS[currentWeatherIdx];
    showToast(`${w.icon} Weather: ${w.name}`, 3000);
    triggerSoundpad('weather');
    // أثر الطقس الحار على السرعة
    CFG.SPEED_INC = (w.id==='hot') ? 0.005 : 0.003;
  }
  const w = WEATHERS[currentWeatherIdx];
  // مطر
  if(w.id==='rain'){
    if(Math.random()<0.3) rainDrops.push({x:Math.random()*W,y:-10,speed:9+Math.random()*4,len:12+Math.random()*10});
    rainDrops.forEach(r=>{r.y+=r.speed;r.x-=1;});
    rainDrops=rainDrops.filter(r=>r.y<H);
  } else { rainDrops=[]; }
  // رمال
  if(w.id==='storm'){
    if(Math.random()<0.4) sandParts.push({x:W,y:Math.random()*groundY,speed:7+Math.random()*5,r:Math.random()*3+1,alpha:0.6});
    sandParts.forEach(s=>{s.x-=s.speed;s.alpha-=0.004;});
    sandParts=sandParts.filter(s=>s.x>0&&s.alpha>0);
  } else { sandParts=[]; }
}

// ─────────────────────────────────────────────────────────
//  RENDERING
// ─────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0,0,W,H);
  const w=WEATHERS[currentWeatherIdx];

  // سماء
  let skyTop, skyMid, skyBot;
  if(w.id==='rain'){     skyTop='#3a5070'; skyMid='#4a6080'; skyBot='#607090'; }
  else if(w.id==='storm'){skyTop='#8b6914';skyMid='#a07830';skyBot='#c49030'; }
  else if(w.id==='fog'){ skyTop='#b0b8c0'; skyMid='#c0c8d0'; skyBot='#d0d8e0'; }
  else if(w.id==='hot'){ skyTop='#c05621'; skyMid='#e85d04'; skyBot='#f9c74f'; }
  else if(w.id==='night'||isNight){ skyTop='#0d1b2a'; skyMid='#1b2838'; skyBot='#16213e'; }
  else {                 skyTop='#87CEEB'; skyMid='#a8d8ea'; skyBot='#d4f1f9'; }

  const skyGrad=ctx.createLinearGradient(0,0,0,groundY);
  skyGrad.addColorStop(0,skyTop);
  skyGrad.addColorStop(0.5,skyMid);
  skyGrad.addColorStop(1,skyBot);
  ctx.fillStyle=skyGrad;
  ctx.fillRect(0,0,W,groundY);

  // نجوم
  if(isNight||w.id==='night'){
    stars.forEach(s=>{
      const alpha=0.4+0.6*Math.sin(frame*0.03+s.twinkleOffset);
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });
  }

  // قمر / شمس
  if(isNight||w.id==='night') drawMoon(W-80,60);
  else if(w.id!=='storm'&&w.id!=='fog') drawSun(W-80,60);

  // جبال
  mountains.forEach(m=>{
    const grad=ctx.createLinearGradient(m.x,groundY-m.h,m.x,groundY);
    if(isNight){ grad.addColorStop(0,'#2d3a5e'); grad.addColorStop(1,'#1a2240'); }
    else if(w.id==='storm'){ grad.addColorStop(0,'#8b7030'); grad.addColorStop(1,'#6b5020'); }
    else { grad.addColorStop(0,'#8fa8c8'); grad.addColorStop(1,'#7090b0'); }
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(m.x-m.w/2,groundY);
    ctx.lineTo(m.x,groundY-m.h);
    ctx.lineTo(m.x+m.w/2,groundY);
    ctx.closePath(); ctx.fill();
    if(!isNight&&w.id!=='storm'){
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(m.x-m.w*0.1,groundY-m.h*0.75);
      ctx.lineTo(m.x,groundY-m.h);
      ctx.lineTo(m.x+m.w*0.1,groundY-m.h*0.75);
      ctx.closePath(); ctx.fill();
    }
  });

  clouds.forEach(c=>drawCloud(c));
  drawGround();
  renderEventOverlay();

  // مطر
  if(w.id==='rain'){
    ctx.save(); ctx.strokeStyle='rgba(150,180,255,0.6)'; ctx.lineWidth=1;
    rainDrops.forEach(r=>{ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-2,r.y+r.len);ctx.stroke();});
    ctx.restore();
  }
  // رمال
  if(w.id==='storm'){
    sandParts.forEach(s=>{
      ctx.save(); ctx.globalAlpha=s.alpha; ctx.fillStyle='#c49030';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });
    // موجة رمل في الأسفل
    ctx.save();
    ctx.globalAlpha=0.15+0.05*Math.sin(frame*0.05);
    ctx.fillStyle='#c49030';
    ctx.fillRect(0,groundY-8,W,12);
    ctx.restore();
  }
  // ضباب
  if(w.id==='fog'){
    const fogGrad=ctx.createLinearGradient(0,0,W,0);
    fogGrad.addColorStop(0,'rgba(200,210,220,0.35)');
    fogGrad.addColorStop(0.5,'rgba(200,210,220,0.15)');
    fogGrad.addColorStop(1,'rgba(200,210,220,0.35)');
    ctx.fillStyle=fogGrad; ctx.fillRect(0,0,W,groundY);
  }

  bones.forEach(b=>drawBone(b));
  powerupItems.forEach(p=>drawPowerupItem(p));

  // تحذير Eagle Eye
  if(warningShown&&warningTimer>0){
    ctx.save();
    ctx.globalAlpha=0.5+0.5*Math.sin(frame*0.4);
    ctx.fillStyle='#f9c74f';
    ctx.font=`bold ${Math.max(14,W/45)}px monospace`;
    ctx.textAlign='center';
    ctx.fillText('⚠️ Obstacle Ahead!',W*0.5,groundY-80);
    ctx.textAlign='left';
    ctx.restore();
  }

  obstacles.forEach(o=>drawObstacle(o));

  // رسم اللاعب
  if(!dino.dead) drawDino(dino,false);

  // رسم الذكاء الاصطناعي
  if(aiDino.active){
    if(aiDino.dead&&aiDino.respawnScene) drawRespawnScene(aiDino);
    else if(!aiDino.dead) drawDino(aiDino,true);
  }

  // لاعبو الأونلاين على الكانفاس
  if(onlineMode) drawOnlinePlayers();

  particles.forEach(p=>drawParticle(p));
  drawGroundDetails();
  drawDistanceMarker();
}

function drawOnlinePlayers() {
  Object.entries(onlinePlayers).forEach(([pid,p])=>{
    if(pid===myPlayerId||p.dead) return;
    const ox=W*0.12+30;
    const oy=groundY-dino.h;
    ctx.save();
    ctx.globalAlpha=0.55;
    ctx.shadowBlur=10; ctx.shadowColor='#4361ee';
    ctx.fillStyle='#7c3aed';
    roundRect(ctx,ox+5,oy+5,dino.w-10,dino.h-10,6);
    ctx.fill();
    ctx.globalAlpha=1; ctx.shadowBlur=0;
    // اسم فوق الرأس
    const nameW=Math.max(p.name.length*7+10,55);
    ctx.fillStyle='rgba(0,0,0,0.75)';
    roundRect(ctx,ox+dino.w/2-nameW/2,oy-24,nameW,17,4); ctx.fill();
    ctx.fillStyle='#a78bfa';
    ctx.font=`bold ${Math.max(9,W/120)}px monospace`;
    ctx.textAlign='center';
    ctx.fillText(p.name,ox+dino.w/2,oy-11);
    ctx.textAlign='left';
    ctx.restore();
  });
}

function drawSun(x,y){
  const r=Math.max(18,W/40);
  ctx.save();
  ctx.shadowBlur=20; ctx.shadowColor='#f9c74f';
  ctx.fillStyle='#FFD700';
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  for(let i=0;i<8;i++){
    const angle=(i/8)*Math.PI*2+frame*0.005;
    ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x+Math.cos(angle)*(r+4),y+Math.sin(angle)*(r+4));
    ctx.lineTo(x+Math.cos(angle)*(r+14),y+Math.sin(angle)*(r+14));
    ctx.stroke();
  }
  ctx.restore();
}

function drawMoon(x,y){
  ctx.save();
  ctx.shadowBlur=30; ctx.shadowColor='#c8c8ff';
  ctx.fillStyle='#e8e8f0';
  ctx.beginPath(); ctx.arc(x,y,22,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.08)';
  [[x-6,y-4,5],[x+8,y+6,3],[x+2,y-10,4]].forEach(([cx,cy,cr])=>{
    ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function drawCloud(c){
  ctx.save();
  ctx.globalAlpha=isNight?0.15:0.75;
  ctx.fillStyle=isNight?'#4a5568':'#ffffff';
  ctx.beginPath(); ctx.ellipse(c.x,c.y,c.w/2,c.h/2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(c.x-c.w*0.25,c.y+c.h*0.1,c.w*0.3,c.h*0.4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(c.x+c.w*0.25,c.y+c.h*0.1,c.w*0.35,c.h*0.45,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawGround(){
  const grad=ctx.createLinearGradient(0,groundY,0,H);
  const w=WEATHERS[currentWeatherIdx];
  if(isNight||w.id==='night'){ grad.addColorStop(0,'#2d3a2e'); grad.addColorStop(1,'#0f1a10'); }
  else if(w.id==='rain'){ grad.addColorStop(0,'#5a7040'); grad.addColorStop(1,'#3a5020'); }
  else { grad.addColorStop(0,'#c8a96e'); grad.addColorStop(0.2,'#b8914e'); grad.addColorStop(1,'#8b6914'); }
  ctx.fillStyle=grad; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.strokeStyle=isNight?'#3d5c3e':'#a07840'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(W,groundY); ctx.stroke();
  ctx.strokeStyle=isNight?'rgba(80,120,80,0.3)':'rgba(140,100,40,0.3)';
  ctx.lineWidth=1;
  for(let i=0;i<6;i++){
    const gx=((bgOffset*0.8+i*140)%(W+140))-140;
    ctx.beginPath(); ctx.moveTo(gx,groundY+5); ctx.lineTo(gx+60,groundY+5); ctx.stroke();
  }
}

function drawGroundDetails(){
  ctx.fillStyle=isNight?'rgba(100,140,100,0.4)':'rgba(160,120,60,0.5)';
  for(let i=0;i<8;i++){
    const px=((bgOffset*0.9+i*W/8+20)%(W+20))-10;
    const py=groundY+10+(i%3)*4;
    ctx.beginPath(); ctx.ellipse(px,py,4,2,0,0,Math.PI*2); ctx.fill();
  }
}

function drawDistanceMarker(){
  const m=Math.floor(distancePx/100);
  ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#fff';
  ctx.font=`${Math.max(10,W/80)}px monospace`;
  ctx.fillText(`${m}m`,16,groundY-8);
  ctx.restore();
}

// ─── رسم الديناصور ───
function drawDino(d,isAI){
  const x=Math.round(d.x);
  const y=Math.round(d.y);
  const w=d.ducking?d.w*1.4:d.w;
  const h=d.ducking?d.h*0.55:d.h;
  const actualY=d.ducking?groundY-h:y;
  ctx.save();
  if(!isAI&&hasPowerup('shield')){
    const pulse=Math.sin(frame*0.15)*4;
    ctx.save(); ctx.globalAlpha=0.35;
    const sg=ctx.createRadialGradient(x+w/2,actualY+h/2,0,x+w/2,actualY+h/2,w*0.8+pulse);
    sg.addColorStop(0,'rgba(67,97,238,0)');
    sg.addColorStop(0.7,'rgba(67,97,238,0.4)');
    sg.addColorStop(1,'rgba(67,97,238,0.8)');
    ctx.fillStyle=sg;
    ctx.beginPath(); ctx.ellipse(x+w/2,actualY+h/2,w*0.8+pulse,h*0.6+pulse,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if(isAI){ ctx.globalAlpha=0.45; ctx.shadowBlur=12; ctx.shadowColor='#a78bfa'; }
  if(!isAI&&hasPowerup('jetpack')) drawJetpackFire(x,actualY+h,d);
  if(d.grounded&&!d.ducking&&!d.dead&&frame%8===0) spawnDustParticles(x,groundY);
  drawDinoBody(x,actualY,w,h,d.skin||activeSkin,isAI,d.ducking,d.frame);
  // اسم فوق الرأس
  if(isAI){
    ctx.globalAlpha=0.9;
    ctx.fillStyle='rgba(0,0,0,0.6)';
    roundRect(ctx,x-2,actualY-22,w+4,18,4); ctx.fill();
    ctx.fillStyle='#a78bfa';
    ctx.font=`bold ${Math.max(9,W/120)}px monospace`;
    ctx.textAlign='center';
    ctx.fillText(aiDino.name,x+w/2,actualY-8);
    ctx.textAlign='left';
  }
  ctx.restore();
}

// ─── مشاهد الإعادة المضحكة ───
const RESPAWN_SCENES=['parachute','helicopter','car','rocket','catapult','ufo','ambulance'];

function drawRespawnScene(d){
  const prog=d.respawnProgress;
  const scene=d.respawnScene;
  const targetX=d.x;
  const targetY=groundY-dino.h;
  ctx.save();
  const alpha=Math.min(prog*3,1);
  ctx.globalAlpha=alpha;

  if(scene==='parachute'){
    const y=-100+prog*(targetY+120);
    ctx.strokeStyle='#f9c74f'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(targetX+dino.w/2,y-30,35,Math.PI,0); ctx.stroke();
    for(let i=-25;i<=25;i+=12.5){
      ctx.beginPath(); ctx.moveTo(targetX+dino.w/2+i,y-30); ctx.lineTo(targetX+dino.w/2,y); ctx.stroke();
    }
    drawDinoBody(targetX,y,dino.w,dino.h,d.skin||activeSkin,true,false,0);

  } else if(scene==='helicopter'){
    const hx=W+100-prog*(W+100-targetX-40);
    const hy=groundY*0.25;
    ctx.fillStyle='#4361ee';
    roundRect(ctx,hx,hy,80,30,8); ctx.fill();
    ctx.fillStyle='#e63946';
    roundRect(ctx,hx+60,hy+10,30,15,4); ctx.fill();
    ctx.save(); ctx.translate(hx+40,hy-5); ctx.rotate(frame*0.3);
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(-30,-3,60,6); ctx.restore();
    ctx.strokeStyle='#f9c74f'; ctx.lineWidth=2;
    const dinoRopeY=Math.min(hy+30+prog*100,targetY);
    ctx.beginPath(); ctx.moveTo(hx+40,hy+30); ctx.lineTo(targetX+dino.w/2,dinoRopeY); ctx.stroke();
    drawDinoBody(targetX,dinoRopeY,dino.w*0.8,dino.h*0.8,d.skin||activeSkin,true,false,0);

  } else if(scene==='car'){
    const cx=-120+prog*(targetX+150);
    ctx.fillStyle='#e63946';
    roundRect(ctx,cx-20,groundY-45,80,30,8); ctx.fill();
    ctx.fillStyle='#c1121f';
    roundRect(ctx,cx-5,groundY-60,55,20,6); ctx.fill();
    ctx.fillStyle='#1a1a2e';
    [cx-5,cx+45].forEach(wx=>{ctx.beginPath();ctx.arc(wx,groundY-16,10,0,Math.PI*2);ctx.fill();});
    if(prog>0.5){
      const ep=(prog-0.5)*2;
      drawDinoBody(cx+20+ep*50,groundY-dino.h-ep*50,dino.w*0.8,dino.h*0.8,d.skin||activeSkin,true,false,0);
    }

  } else if(scene==='rocket'){
    const ry=-120+prog*(groundY-60);
    ctx.fillStyle='#f3722c';
    roundRect(ctx,targetX+8,ry,30,60,10); ctx.fill();
    ctx.fillStyle='#e85d04';
    ctx.beginPath(); ctx.moveTo(targetX+8,ry); ctx.lineTo(targetX+23,ry-20); ctx.lineTo(targetX+38,ry); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#f9c74f';
    ctx.beginPath(); ctx.arc(targetX+23,ry+65,10+Math.random()*3,0,Math.PI*2); ctx.fill();
    drawDinoBody(targetX+5,ry+5,dino.w*0.7,dino.h*0.7,d.skin||activeSkin,true,false,0);

  } else if(scene==='catapult'){
    const rx=W*0.05+prog*(targetX-W*0.05);
    const ry=groundY-(4*(Math.abs(targetY)+200)*prog*(1-prog))-30;
    ctx.save(); ctx.translate(rx,ry); ctx.rotate(prog*Math.PI*2);
    drawDinoBody(0,0,dino.w*0.8,dino.h*0.8,d.skin||activeSkin,true,false,0);
    ctx.restore();

  } else if(scene==='ufo'){
    const uy=-60+prog*0.35*groundY;
    ctx.fillStyle='#4361ee';
    ctx.beginPath(); ctx.ellipse(targetX+dino.w/2,uy,50,18,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2dc653';
    ctx.beginPath(); ctx.ellipse(targetX+dino.w/2,uy-10,25,14,0,0,Math.PI*2); ctx.fill();
    const bg=ctx.createLinearGradient(targetX+dino.w/2,uy+18,targetX+dino.w/2,targetY);
    bg.addColorStop(0,'rgba(45,198,83,0.4)'); bg.addColorStop(1,'rgba(45,198,83,0)');
    ctx.fillStyle=bg;
    ctx.beginPath();
    ctx.moveTo(targetX+dino.w/2-30,uy+18); ctx.lineTo(targetX+dino.w/2+30,uy+18);
    ctx.lineTo(targetX+dino.w/2+15,targetY); ctx.lineTo(targetX+dino.w/2-15,targetY);
    ctx.closePath(); ctx.fill();
    if(prog>0.3){
      const dp=(prog-0.3)/0.7;
      drawDinoBody(targetX,uy+18+dp*(targetY-uy-18),dino.w*0.8,dino.h*0.8,d.skin||activeSkin,true,false,0);
    }

  } else { // ambulance
    const ax=-150+prog*(targetX+200);
    ctx.fillStyle='#fff';
    roundRect(ctx,ax-20,groundY-50,90,35,8); ctx.fill();
    ctx.fillStyle='#e63946';
    ctx.fillRect(ax+5,groundY-45,20,10); ctx.fillRect(ax+10,groundY-50,10,20);
    // إضاءة وميض
    if(Math.floor(frame/8)%2===0){ ctx.fillStyle='#e63946'; ctx.beginPath(); ctx.arc(ax,groundY-52,8,0,Math.PI*2); ctx.fill(); }
    else { ctx.fillStyle='#4361ee'; ctx.beginPath(); ctx.arc(ax+50,groundY-52,8,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#1a1a2e';
    [ax-5,ax+55].forEach(wx=>{ctx.beginPath();ctx.arc(wx,groundY-16,10,0,Math.PI*2);ctx.fill();});
    if(prog>0.6){
      const ep=(prog-0.6)/0.4;
      drawDinoBody(ax+30+ep*40,groundY-dino.h-ep*30,dino.w*0.8,dino.h*0.8,d.skin||activeSkin,true,false,0);
    }
  }
  ctx.restore();
}

function drawDinoBody(x,y,w,h,skin,isAI,ducking,frameIdx){
  const colors=getSkinColors(skin,isAI);
  const runOffset=ducking?0:(frameIdx===0?2:-2);
  ctx.fillStyle=colors.body;
  roundRect(ctx,x+w*0.15,y+h*0.1,w*0.7,h*0.55,6); ctx.fill();
  if(!ducking){
    ctx.fillStyle=colors.head;
    roundRect(ctx,x+w*0.4,y,w*0.55,h*0.42,8); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(x+w*0.78,y+h*0.12,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a1a2e';
    ctx.beginPath(); ctx.arc(x+w*0.8,y+h*0.13,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(x+w*0.81,y+h*0.12,1.2,0,Math.PI*2); ctx.fill();
    // تعبيرات المظهر
    if(colors.expression==='sunglasses'){
      ctx.fillStyle='#1a1a2e';
      roundRect(ctx,x+w*0.6,y+h*0.1,w*0.38,h*0.12,4); ctx.fill();
      ctx.fillStyle='#4361ee';
      roundRect(ctx,x+w*0.61,y+h*0.105,w*0.17,h*0.10,3); ctx.fill();
      roundRect(ctx,x+w*0.8,y+h*0.105,w*0.17,h*0.10,3); ctx.fill();
    } else if(colors.expression==='crown'){
      ctx.fillStyle='#f9c74f';
      ctx.beginPath();
      ctx.moveTo(x+w*0.45,y); ctx.lineTo(x+w*0.5,y-12);
      ctx.lineTo(x+w*0.6,y-6); ctx.lineTo(x+w*0.7,y-14);
      ctx.lineTo(x+w*0.85,y-5); ctx.lineTo(x+w*0.9,y);
      ctx.closePath(); ctx.fill();
    } else if(colors.expression==='tie'){
      ctx.fillStyle='#e63946';
      ctx.beginPath();
      ctx.moveTo(x+w*0.55,y+h*0.42); ctx.lineTo(x+w*0.48,y+h*0.62);
      ctx.lineTo(x+w*0.55,y+h*0.68); ctx.lineTo(x+w*0.62,y+h*0.62);
      ctx.closePath(); ctx.fill();
    } else if(colors.expression==='mask'){
      ctx.fillStyle='#1a1a2e';
      roundRect(ctx,x+w*0.55,y+h*0.18,w*0.38,h*0.18,3); ctx.fill();
    }
    ctx.fillStyle=colors.dark;
    ctx.beginPath(); ctx.arc(x+w*0.9,y+h*0.2,2,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(x+w*0.7,y+h*0.2,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a1a2e';
    ctx.beginPath(); ctx.arc(x+w*0.72,y+h*0.21,3,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle=colors.body;
  ctx.beginPath();
  ctx.moveTo(x+w*0.15,y+h*0.35);
  ctx.lineTo(x-w*0.1,y+h*0.5);
  ctx.lineTo(x+w*0.05,y+h*0.55);
  ctx.lineTo(x+w*0.2,y+h*0.5);
  ctx.closePath(); ctx.fill();
  const legY=y+h*0.6;
  ctx.fillStyle=colors.legs;
  roundRect(ctx,x+w*0.2,legY,w*0.18,h*0.35+runOffset,4); ctx.fill();
  roundRect(ctx,x+w*0.45,legY+(ducking?0:(frameIdx===0?0:6)-3),w*0.18,h*0.35-runOffset,4); ctx.fill();
  if(!ducking){ ctx.fillStyle=colors.body; roundRect(ctx,x+w*0.6,y+h*0.35,w*0.15,h*0.18,3); ctx.fill(); }
  if(skin==='cactus'){
    ctx.fillStyle='#2a7a2a';
    [[0.3,0.15],[0.7,0.05],[0.9,0.2],[0.1,0.4]].forEach(([ox,oy])=>{
      ctx.beginPath(); ctx.moveTo(x+w*ox-3,y+h*oy+4); ctx.lineTo(x+w*ox,y+h*oy-5); ctx.lineTo(x+w*ox+3,y+h*oy+4); ctx.closePath(); ctx.fill();
    });
  }
}

function getSkinColors(skin,isAI){
  if(isAI) return{body:'#7c3aed',head:'#6d28d9',legs:'#5b21b6',dark:'#4c1d95',expression:'default'};
  const map={
    classic:  {body:'#4a4a4a',head:'#3a3a3a',legs:'#2a2a2a',dark:'#1a1a1a',expression:'default'},
    cool:     {body:'#2d6a8a',head:'#1d5a7a',legs:'#1a4a6a',dark:'#0d3a5a',expression:'sunglasses'},
    corporate:{body:'#2d3748',head:'#1a202c',legs:'#171923',dark:'#0d1117',expression:'tie'},
    chad:     {body:'#c05621',head:'#9c4a1a',legs:'#7b3a12',dark:'#5a2a0c',expression:'crown'},
    ninja:    {body:'#1a1a1a',head:'#111111',legs:'#0a0a0a',dark:'#050505',expression:'mask'},
    cactus:   {body:'#2f6b2f',head:'#1e5c1e',legs:'#1a4e1a',dark:'#0f3a0f',expression:'default'},
  };
  return map[skin]||map.classic;
}

function drawJetpackFire(x,y,d){
  for(let i=0;i<3;i++){
    ctx.save(); ctx.globalAlpha=0.6-i*0.15;
    const fGrad=ctx.createLinearGradient(x+16,y,x+16,y+10+i*4);
    fGrad.addColorStop(0,'#f9c74f'); fGrad.addColorStop(1,'rgba(232,93,4,0)');
    ctx.fillStyle=fGrad;
    ctx.beginPath(); ctx.ellipse(x+16-i*3,y+(10+i*4)/2,4+i*3,(10+i*4)/2,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

// ─── العقبات ───
function drawObstacle(o){
  if(o.type==='cactus') drawCactus(o);
  else if(o.type==='ptero') drawPtero(o);
  else if(o.type==='chicken') drawChicken(o);
}

function drawCactus(o){
  const g1='#2d6a2d',g2='#1e4e1e',dk='#163a16';
  for(let i=0;i<o.count;i++){
    const cx=o.x+i*(o.w/o.count+4);
    const ch=o.h-(i%2===0?0:o.h*0.2);
    const cy=groundY-ch;
    ctx.fillStyle=g1; roundRect(ctx,cx,cy,o.w/o.count-2,ch,4); ctx.fill();
    ctx.fillStyle=g2; roundRect(ctx,cx+o.w/o.count*0.4-1,cy+8,o.w/o.count*0.2,ch-16,2); ctx.fill();
    if(i===0||o.count===1){
      ctx.fillStyle=g1;
      roundRect(ctx,cx-10,cy+ch*0.25,12,o.h*0.15,3); ctx.fill();
      roundRect(ctx,cx-10,cy+ch*0.1,8,o.h*0.18,3); ctx.fill();
      roundRect(ctx,cx+o.w/o.count-2,cy+ch*0.35,10,o.h*0.12,3); ctx.fill();
    }
    ctx.strokeStyle=dk; ctx.lineWidth=1;
    for(let s=0;s<4;s++){
      const sy=cy+ch*0.15+s*ch*0.2;
      ctx.beginPath(); ctx.moveTo(cx-1,sy); ctx.lineTo(cx-5,sy-3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+o.w/o.count-3,sy); ctx.lineTo(cx+o.w/o.count+2,sy-3); ctx.stroke();
    }
  }
}

function drawPtero(o){
  ctx.save();
  const flapAng=Math.sin(frame*0.15)*0.4;
  ctx.fillStyle='#6b4226';
  ctx.beginPath(); ctx.ellipse(o.x+o.w/2,o.y+o.h/2,o.w/2,o.h/2,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#8b5e3c';
  ['left','right'].forEach((side,si)=>{
    ctx.save(); ctx.translate(o.x+o.w/2,o.y+o.h/2); ctx.rotate(si===0?flapAng:-flapAng);
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(si===0?-o.w*0.9:o.w*0.9,-o.h*0.5);
    ctx.lineTo(si===0?-o.w*0.7:o.w*0.7,o.h*0.2);
    ctx.closePath(); ctx.fill(); ctx.restore();
  });
  ctx.fillStyle='#f9c74f';
  ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h*0.4); ctx.lineTo(o.x-14,o.y+o.h*0.5); ctx.lineTo(o.x,o.y+o.h*0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(o.x+o.w*0.2,o.y+o.h*0.35,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e63946'; ctx.beginPath(); ctx.arc(o.x+o.w*0.2,o.y+o.h*0.35,2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawChicken(o){
  const bounce=Math.abs(Math.sin(frame*0.2))*6;
  ctx.save();
  ctx.fillStyle='#f5e6c8';
  ctx.beginPath(); ctx.ellipse(o.x+12,groundY-20-bounce,12,14,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(o.x+20,groundY-32-bounce,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e63946';
  ctx.beginPath(); ctx.ellipse(o.x+20,groundY-40-bounce,4,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a1a2e'; ctx.beginPath(); ctx.arc(o.x+23,groundY-33-bounce,2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f9c74f';
  ctx.beginPath(); ctx.moveTo(o.x+28,groundY-32-bounce); ctx.lineTo(o.x+34,groundY-30-bounce); ctx.lineTo(o.x+28,groundY-28-bounce); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBone(b){
  const by=b.y??groundY-30;
  ctx.save(); ctx.translate(b.x,by); ctx.rotate(b.rot||0);
  ctx.fillStyle='#e8d5a3'; ctx.strokeStyle='#c4a55a'; ctx.lineWidth=1;
  roundRect(ctx,-14,-3,28,6,3); ctx.fill(); ctx.stroke();
  [[-14,0],[14,0]].forEach(([ex,ey])=>{
    [[-4,-4],[4,-4],[4,4],[-4,4]].forEach(([dx,dy])=>{
      ctx.beginPath(); ctx.arc(ex+dx,ey+dy,4,0,Math.PI*2); ctx.fill(); ctx.stroke();
    });
  });
  ctx.restore();
}

function drawPowerupItem(p){
  const bob=Math.sin(frame*0.08+p.phase)*5;
  const py=groundY-50+bob;
  ctx.save();
  ctx.shadowBlur=14; ctx.shadowColor=p.color;
  ctx.globalAlpha=0.3+Math.sin(frame*0.1)*0.1;
  ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x+18,py+16,22,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  roundRect(ctx,p.x,py,36,36,8);
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill();
  ctx.strokeStyle=p.color; ctx.lineWidth=2; ctx.stroke();
  ctx.font='22px serif'; ctx.fillText(p.emoji,p.x+7,py+27);
  ctx.restore();
}

function drawParticle(p){
  ctx.save(); ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
  ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function spawnDeathParticles(x,y){
  const colors=['#e63946','#f9c74f','#2dc653','#4361ee','#f3722c','#fff'];
  for(let i=0;i<40;i++){
    const angle=Math.random()*Math.PI*2;
    const spd=Math.random()*8+2;
    particles.push({x:x+26,y:y+30,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd-3,r:Math.random()*6+2,alpha:1,color:colors[Math.floor(Math.random()*colors.length)]});
  }
}

function spawnDustParticles(x,y){
  for(let i=0;i<2;i++){
    particles.push({x:x+Math.random()*20,y,vx:-Math.random()*1.5,vy:-Math.random()*0.5,r:Math.random()*3+1,alpha:0.3,color:isNight?'#6b7280':'#c8a96e'});
  }
}

// ─── طبقة الأحداث ───
function renderEventOverlay(){
  if(!currentEvent) return;
  if(currentEvent.type==='rave'){
    ctx.save(); ctx.globalAlpha=0.12+Math.sin(frame*0.15)*0.05;
    ctx.fillStyle=`hsl(${(frame*3)%360},100%,50%)`; ctx.fillRect(0,0,W,groundY);
    ctx.restore();
    for(let i=0;i<3;i++){
      const sx=((frame*(2+i)+i*200)%W);
      const sy=(Math.sin(frame*0.04+i)*0.3+0.3)*groundY;
      ctx.save(); ctx.globalAlpha=0.8;
      ctx.fillStyle=`hsl(${(frame*5+i*120)%360},100%,70%)`;
      ctx.font='20px serif'; ctx.fillText('✦',sx,sy); ctx.restore();
    }
  } else if(currentEvent.type==='phone'){
    ctx.save(); ctx.globalAlpha=0.85;
    ctx.fillStyle='rgba(0,0,0,0.5)';
    const bw=Math.min(340,W*0.8);
    roundRect(ctx,W/2-bw/2,H*0.04,bw,H*0.14,12); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font=`bold ${Math.min(W/25,15)}px monospace`;
    ctx.textAlign='center';
    ctx.fillText('📱 WhatsApp: 99 messages from mama',W/2,H*0.1);
    ctx.font='11px monospace'; ctx.fillStyle='#9ca3af';
    ctx.fillText('CactusGov, MeteorAlert, TaxBot, Dino...',W/2,H*0.16);
    ctx.textAlign='left'; ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────
//  GAME LOGIC
// ─────────────────────────────────────────────────────────
function update(dt){
  if(gameState!=='playing') return;

  frame++;
  bgOffset+=speed;
  distancePx+=speed;

  // سرعة
  speed=Math.min(
    CFG.MAX_SPEED-(upgradeLevels.speed*2),
    CFG.INIT_SPEED+score*CFG.SPEED_INC
  );

  // ── النقاط تزيد بلا توقف (الإصلاح الرئيسي!) ──
  score+=0.1*(speed/CFG.INIT_SPEED);
  const roundedScore=Math.round(score);

  // عظام
  const newBones=Math.floor(roundedScore/CFG.SCORE_BONE_RATIO);
  if(newBones>sessionBones){
    const diff=newBones-sessionBones;
    sessionBones=newBones;
    showHUDBones(diff);
  }

  // ── الإصلاح الأساسي: نشغّل صوت الـ milestone مرة واحدة فقط ──
  if(roundedScore>0 && roundedScore%100===0 && roundedScore!==lastMilestonePlayed){
    lastMilestonePlayed=roundedScore;
    playSound('milestone');
    if(roundedScore===100)  triggerSoundpad('score100');
    else if(roundedScore===500)  triggerSoundpad('score500');
    else if(roundedScore===1000) triggerSoundpad('score1000');
  }

  // ليل/نهار
  const newNight=Math.floor(roundedScore/CFG.DAY_NIGHT_INTERVAL)%2===1;
  if(newNight!==isNight){
    isNight=newNight;
    document.getElementById('gameWrapper').style.background=isNight?'#0d1b2a':'#87CEEB';
    if(isNight) triggerSoundpad('nightStart');
  }

  updateWeather();

  // HUD
  document.getElementById('scoreHud').textContent=roundedScore;
  document.getElementById('bestHud').textContent=Math.max(bestScore,roundedScore);
  document.getElementById('bonesHud').textContent=getTotalBones();

  updateDinoPhysics(dino);

  // Eagle Eye
  if(upgradeLevels.eye>0){
    warningShown=false;
    for(const o of obstacles){
      if(o.x-dino.x<200&&o.x-dino.x>0){ warningShown=true; warningTimer=30; break; }
    }
    if(warningTimer>0) warningTimer--;
  }

  if(aiDino.active) updateAI();

  // تمرير الخلفية
  clouds.forEach(c=>{ c.x-=c.speed*(speed*0.2); });
  clouds=clouds.filter(c=>c.x>-300);
  while(clouds.length<CFG.CLOUD_COUNT) clouds.push(newCloud(W+50));
  mountains.forEach(m=>{
    m.x-=m.speed*(speed*0.15);
    if(m.x<-m.w){ m.x=W+m.w; m.h=Math.random()*groundY*0.35+groundY*0.1; m.w=Math.random()*180+100; }
  });
  stars.forEach(s=>{ s.x-=s.speed*0.5; if(s.x<0) s.x=W; });

  spawnObstacles();
  obstacles.forEach(o=>{
    if(currentEvent?.type==='gravity'){
      o.waveOffset=(o.waveOffset||0)+0.05;
      o.y=(o.baseY||o.y)+Math.sin(o.waveOffset)*20;
      if(!o.baseY) o.baseY=o.y;
    }
    o.x-=speed;
  });
  obstacles=obstacles.filter(o=>o.x>-200);

  spawnBones();
  bones.forEach(b=>{ b.x-=speed; if(b.rot!==undefined) b.rot+=0.05; });
  if(hasPowerup('magnet')){
    bones.forEach(b=>{
      const dx=dino.x+dino.w/2-b.x, dy=(groundY-30)-(b.y??groundY-30);
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<200){ b.x+=dx*0.08; if(b.y!==undefined) b.y+=dy*0.08; }
    });
  }
  bones=bones.filter(b=>{
    const bx=b.x,by=b.y??groundY-30;
    if(rectsOverlap(dino.x,dino.y,dino.w,dino.h,bx-14,by-6,28,12)){
      sessionBones++;
      document.getElementById('bonesHud').textContent=getTotalBones();
      playSound('bone');
      return false;
    }
    return b.x>-30;
  });

  spawnPowerupItems();
  powerupItems.forEach(p=>p.x-=speed);
  powerupItems=powerupItems.filter(p=>{
    if(rectsOverlap(dino.x,dino.y,dino.w,dino.h,p.x,groundY-70,36,50)){
      activatePowerup(p.type); noPoweupRun=false; playSound('powerup'); triggerSoundpad('powerup');
      return false;
    }
    return p.x>-50;
  });

  dino.powerups=dino.powerups.filter(p=>{
    if(Date.now()>p.endTime){ if(p.timerEl) p.timerEl.remove(); return false; }
    if(p.timerEl){
      const remaining=(p.endTime-Date.now())/p.duration;
      const bar=p.timerEl.querySelector('.powerup-timer');
      if(bar) bar.style.transform=`scaleX(${remaining})`;
    }
    return true;
  });

  // تصادم
  if(!hasPowerup('jetpack')&&!hasPowerup('shield')){
    for(const o of obstacles){
      if(o.type==='chicken') continue;
      const hitbox=getObstacleHitbox(o);
      const dinoBox=dino.ducking
        ?{x:dino.x+4,y:groundY-dino.h*0.55+2,w:dino.w*1.35,h:dino.h*0.5}
        :{x:dino.x+4,y:dino.y+4,w:dino.w-8,h:dino.h-8};
      if(rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h,hitbox.x,hitbox.y,hitbox.w,hitbox.h)){
        killDino(); return;
      }
    }
  } else if(hasPowerup('shield')){
    for(const o of obstacles){
      const hitbox=getObstacleHitbox(o);
      const dinoBox=dino.ducking
        ?{x:dino.x+4,y:groundY-dino.h*0.55+2,w:dino.w*1.35,h:dino.h*0.5}
        :{x:dino.x+4,y:dino.y+4,w:dino.w-8,h:dino.h-8};
      if(rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h,hitbox.x,hitbox.y,hitbox.w,hitbox.h)){
        dino.powerups=dino.powerups.filter(p=>{ if(p.type==='shield'){if(p.timerEl)p.timerEl.remove();return false;} return true; });
        dino.shieldHits++; playSound('shield_break'); triggerSoundpad('shield_hit');
        showToast('🛡️ Shield absorbed the hit!',1500);
        obstacles.splice(obstacles.indexOf(o),1);
        if(dino.shieldHits>=10) unlockSkin('cactus');
        break;
      }
    }
  }

  // near miss
  for(const o of obstacles){
    if(o.type==='chicken') continue;
    const dist=o.x-(dino.x+dino.w);
    if(dist>-5&&dist<15&&!o._nearMissed){ o._nearMissed=true; triggerSoundpad('nearMiss'); }
  }

  updateEvents();

  particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.alpha-=0.025; p.r*=0.97; });
  particles=particles.filter(p=>p.alpha>0.02&&p.r>0.2);

  checkSkinUnlocks();
  if(onlineMode&&roundedScore%5===0) pushOnlineScore(roundedScore);
}

function updateDinoPhysics(d){
  const isPlayer=d===dino;
  if(hasPowerup('jetpack')&&isPlayer){ d.y=groundY*0.2; d.vy=0; d.grounded=false; }
  else{
    d.vy+=CFG.GRAVITY;
    const vy=hasPowerup('slowmo')&&isPlayer?d.vy*0.5:d.vy;
    d.y+=vy;
  }
  const floorY=d.ducking?groundY-d.h*0.55:groundY-d.h;
  if(d.y>=floorY){ d.y=floorY; d.vy=0; d.grounded=true; d.jumpCount=0; }
  if(d.grounded&&!d.ducking){ d.frameTimer++; if(d.frameTimer>8){d.frame=d.frame===0?1:0;d.frameTimer=0;} }
}

function getObstacleHitbox(o){
  if(o.type==='ptero') return{x:o.x+8,y:o.y+6,w:o.w-16,h:o.h-8};
  return{x:o.x+4,y:groundY-o.h+2,w:o.w*o.count-6,h:o.h-2};
}

function updateAI(){
  if(aiDino.dead){
    aiDino.respawnProgress+=0.013;
    if(aiDino.respawnProgress>=1){
      aiDino.dead=false;
      aiDino.y=groundY-dino.h;
      aiDino.vy=0; aiDino.grounded=true;
      aiDino.respawnScene=null; aiDino.respawnProgress=0;
      showToast(`${aiDino.name} is back! 😤`,1500);
      triggerSoundpad('respawn');
    }
    return;
  }
  updateDinoPhysics(aiDino);
  const lookAhead=180+speed*8;
  const threat=obstacles.find(o=>o.x>aiDino.x&&o.x-aiDino.x<lookAhead);
  if(threat){
    const dist=threat.x-aiDino.x;
    let shouldJump=false, shouldDuck=false;
    if(threat.type==='ptero'){
      const pteroMidY=threat.y+threat.h/2;
      if(pteroMidY>groundY-dino.h*0.7) shouldDuck=true; else shouldJump=true;
    } else { shouldJump=true; }
    if(aiDino.personality==='clown'&&Math.random()<0.1) shouldJump=!shouldJump;
    if(dist<140&&shouldJump&&aiDino.grounded&&aiDino.jumpCount===0) aiJump();
    aiDino.ducking=shouldDuck;
  } else { aiDino.ducking=false; }

  // تصادم الذكاء الاصطناعي
  for(const o of obstacles){
    if(o.type==='chicken') continue;
    const hitbox=getObstacleHitbox(o);
    const aiBox={x:aiDino.x+4,y:aiDino.y+4,w:dino.w-8,h:dino.h-8};
    if(rectsOverlap(aiBox.x,aiBox.y,aiBox.w,aiBox.h,hitbox.x,hitbox.y,hitbox.w,hitbox.h)){
      killAIDino(); break;
    }
  }

  const now=Date.now();
  if(now-aiDino.lastTauntTime>CFG.AI_TAUNT_INTERVAL){
    aiDino.lastTauntTime=now;
    const ahead=aiDino.x>dino.x+50;
    const taunts=ahead?AI_TAUNTS_AHEAD:AI_TAUNTS_BEHIND;
    showAIBubble(taunts[Math.floor(Math.random()*taunts.length)]);
    if(!ahead){ aiBeatenCount++; if(aiBeatenCount>=5) unlockSkin('corporate'); }
  }
}

function killAIDino(){
  if(aiDino.dead) return;
  aiDino.dead=true; aiDino.respawnProgress=0;
  aiDino.respawnScene=RESPAWN_SCENES[Math.floor(Math.random()*RESPAWN_SCENES.length)];
  spawnDeathParticles(aiDino.x,aiDino.y);
  if(onlineMode) aiDino.x=Math.max(dino.x+50,W*0.1);
}

function aiJump(){
  if(aiDino.jumpCount<2){ aiDino.vy=CFG.JUMP_FORCE*0.9; aiDino.grounded=false; aiDino.jumpCount++; }
}

// ─── Spawn ───
function spawnObstacles(){
  const rightmost=obstacles.reduce((m,o)=>Math.max(m,o.x),-Infinity);
  if(rightmost<W*1.2&&(obstacles.length===0||W-rightmost>CFG.OBSTACLE_MIN_GAP+Math.random()*300)){
    if(score<5) return;
    const roll=Math.random();
    if(roll<0.65){
      const count=Math.random()<0.4?2:(Math.random()<0.3?3:1);
      const h=40+Math.random()*40;
      obstacles.push({type:'cactus',x:W+60,y:groundY-h,w:24,h,count});
    } else if(score>30){
      const heightFrac=CFG.PTERO_HEIGHTS[Math.floor(Math.random()*CFG.PTERO_HEIGHTS.length)];
      obstacles.push({type:'ptero',x:W+60,y:groundY-dino.h*(2-heightFrac),w:60,h:36});
    }
  }
  if(currentEvent?.type==='chicken'){
    const rightmostC=obstacles.filter(o=>o.type==='chicken').reduce((m,o)=>Math.max(m,o.x),-Infinity);
    if(rightmostC<W*0.8) obstacles.push({type:'chicken',x:W+40,y:groundY-40,w:38,h:40,count:1});
  }
}

function spawnBones(){
  if(Math.random()<0.012*(1+upgradeLevels.luck*0.2))
    bones.push({x:W+20,y:groundY-28-Math.random()*30,rot:Math.random()*Math.PI});
}

function spawnPowerupItems(){
  if(score<CFG.POWERUP_SPAWN_SCORE) return;
  const sc=0.003*(upgradeLevels.luck>0?1/UPGRADES[3].effects[upgradeLevels.luck-1]:1);
  if(Math.random()<sc){
    const types=[
      {type:'jetpack',emoji:'🚀',color:'#f3722c'},
      {type:'magnet',emoji:'🧲',color:'#4361ee'},
      {type:'slowmo',emoji:'☕',color:'#8b5e3c'},
      {type:'shield',emoji:'🛡️',color:'#4361ee'},
      {type:'banana',emoji:'🍌',color:'#f9c74f'},
      {type:'ghost',emoji:'👻',color:'#a78bfa'},   // جديد: مرحلة الشبح
    ];
    const t=types[Math.floor(Math.random()*types.length)];
    powerupItems.push({...t,x:W+20,phase:Math.random()*Math.PI*2});
  }
}

function activatePowerup(type){
  dino.powerups=dino.powerups.filter(p=>{ if(p.type===type){if(p.timerEl)p.timerEl.remove();return false;} return true; });
  const dur=type==='jetpack'?5000:type==='slowmo'?6000:type==='ghost'?4000:7000;
  const el=document.createElement('div');
  el.className='powerup-icon';
  const emojis={jetpack:'🚀',magnet:'🧲',slowmo:'☕',shield:'🛡️',banana:'🍌',ghost:'👻'};
  el.innerHTML=`${emojis[type]||'✨'}<div class="powerup-timer"></div>`;
  document.getElementById('powerupBar').appendChild(el);
  dino.powerups.push({type,endTime:Date.now()+dur,duration:dur,timerEl:el});
  const msgs={jetpack:'🚀 JETPACK! WOOOO!',slowmo:'☕ Slow-Mo activated!',banana:'🍌 Banana Power! (slippery)',shield:'🛡️ Shield ON!',magnet:'🧲 Magnet ON!',ghost:'👻 Ghost Mode — pass through!'};
  showToast(msgs[type]||'✨ Power Up!',2000);
  if(type==='jetpack') dino.vy=CFG.JUMP_FORCE*1.5;
}

function hasPowerup(type){ return dino.powerups.some(p=>p.type===type&&Date.now()<p.endTime); }

// ─── الأحداث ───
const RANDOM_EVENTS=[
  {type:'chicken',  name:'🐔 CHICKEN INVASION!',    msg:'Chickens took the highway!'},
  {type:'rave',     name:'🎉 RAVE MODE!',            msg:'DJ dropped the beat!'},
  {type:'phone',    name:'📱 WhatsApp Notification', msg:'Mama is looking for you. Jump first.'},
  {type:'tax',      name:'💸 TAX COLLECTION!',       msg:'Cactus Government thanks you (-15%)'},
  {type:'gravity',  name:'🌀 GRAVITY GLITCH!',       msg:'physics.exe stopped working'},
  {type:'kebab',    name:'🥙 FREE KEBAB!',           msg:'Cactus has kebab! Don\'t stop!'},
  {type:'mirror',   name:'🔄 MIRROR WORLD!',         msg:'Everything reversed! Good luck.'},
];

function updateEvents(){
  if(currentEvent&&Date.now()>eventEndTime){
    if(currentEvent.type==='tax') score*=0.85;
    currentEvent=null; hideBanner();
  }
  if(!currentEvent&&Math.round(score)>nextEventScore){
    currentEvent=RANDOM_EVENTS[Math.floor(Math.random()*RANDOM_EVENTS.length)];
    eventEndTime=Date.now()+8000;
    nextEventScore=Math.round(score)+CFG.EVENT_MIN_SCORE+Math.random()*120;
    showBanner(currentEvent.name);
    showToast(currentEvent.msg,3000);
    if(currentEvent.type==='rave'){playSound('rave');triggerSoundpad('event_rave');}
    else if(currentEvent.type==='tax'){showToast('💸 Score -15%!',2000);triggerSoundpad('event_tax');}
    else if(currentEvent.type==='chicken') triggerSoundpad('event_chicken');
  }
}

function checkSkinUnlocks(){
  if(Math.round(score)>=1000) unlockSkin('cool');
  if(noPoweupRun&&Math.round(score)>=500) unlockSkin('ninja');
  const today=new Date().toDateString();
  const saved=localStorage.getItem('dinoplus_daily');
  if(saved){
    const {date,score:ds}=JSON.parse(saved);
    if(date===today&&score>ds){ localStorage.setItem('dinoplus_daily',JSON.stringify({date:today,score:Math.round(score)})); unlockSkin('chad'); }
  } else { localStorage.setItem('dinoplus_daily',JSON.stringify({date:today,score:Math.round(score)})); }
}

function unlockSkin(id){
  const s=SKINS.find(s=>s.id===id);
  if(s&&!s.unlocked){ s.unlocked=true; showToast(`🎉 Skin unlocked: ${s.name}!`,3000); saveData(); }
}

// ─── الموت ───
function killDino(){
  if(dino.dead) return;
  dino.dead=true; gameState='dead';
  playSound('death'); triggerSoundpad('death');
  spawnDeathParticles(dino.x,dino.y); screenShake(8);
  dino.powerups.forEach(p=>{if(p.timerEl)p.timerEl.remove();}); dino.powerups=[];
  const roundedScore=Math.round(score);
  const isNewBest=roundedScore>bestScore;
  if(isNewBest) bestScore=roundedScore;
  bonesCollected+=sessionBones;
  const lb=getLeaderboard();
  const qualifies=lb.length<10||roundedScore>(lb[lb.length-1]?.score??0);
  if(qualifies){ const name=localStorage.getItem('dinoplus_pname')||'Anonymous'; addLeaderboardEntry(name,roundedScore,activeSkin); }
  saveData();
  if(onlineMode) pushOnlineScore(roundedScore,true);
  setTimeout(()=>showGameOver(roundedScore,isNewBest),700);
}

function showGameOver(sc,isNewBest){
  document.getElementById('gameoverEmoji').textContent=isNewBest?'🏆':['💀','😵','🦖','😤'][Math.floor(Math.random()*4)];
  document.getElementById('goScore').textContent=sc;
  document.getElementById('goBest').textContent=bestScore;
  document.getElementById('goBones').textContent=bonesCollected;
  document.getElementById('goDist').textContent=Math.floor(distancePx/100)+'m';
  document.getElementById('funnyMsg').textContent=FUNNY_MSGS[Math.floor(Math.random()*FUNNY_MSGS.length)];
  showScreen('gameoverScreen');
}

function screenShake(intensity){
  const wrapper=document.getElementById('gameWrapper');
  let s=0;
  const si=setInterval(()=>{
    s++; const dx=(Math.random()-0.5)*intensity*(1-s/10); const dy=(Math.random()-0.5)*intensity*(1-s/10);
    wrapper.style.transform=`translate(${dx}px,${dy}px)`;
    if(s>=10){wrapper.style.transform='';clearInterval(si);}
  },30);
}

// ─────────────────────────────────────────────────────────
//  MOBILE INPUT — Swipe + Tap Zones
// ─────────────────────────────────────────────────────────
let touchStartY=0, touchStartX=0, touchStartTime=0;
let holdDuckTimeout=null;

function setupMobileControls(){
  const gameWrapper=document.getElementById('gameWrapper');

  gameWrapper.addEventListener('touchstart',e=>{
    if(gameState==='menu'||gameState==='dead') return;
    const t=e.touches[0];
    touchStartY=t.clientY; touchStartX=t.clientX; touchStartTime=Date.now();
    // Long press = duck
    holdDuckTimeout=setTimeout(()=>{ onDuck(true); },150);
  },{passive:true});

  gameWrapper.addEventListener('touchend',e=>{
    clearTimeout(holdDuckTimeout);
    if(dino.ducking){ onDuck(false); return; }
    const t=e.changedTouches[0];
    const dy=touchStartY-t.clientY;
    const dx=t.clientX-touchStartX;
    const dt=Date.now()-touchStartTime;
    // Swipe up = jump
    if(dy>30&&dt<400){ onJump(); return; }
    // Swipe down = duck
    if(dy<-30&&dt<400){ onDuck(true); setTimeout(()=>onDuck(false),500); return; }
    // Quick tap = jump
    if(dt<200) onJump();
  },{passive:true});

  gameWrapper.addEventListener('touchmove',e=>{
    if(gameState!=='playing') return;
    const t=e.touches[0];
    const dy=touchStartY-t.clientY;
    // Continuous swipe down = hold duck
    if(dy<-40){ clearTimeout(holdDuckTimeout); onDuck(true); }
  },{passive:true});

  // إضافة hint للموبايل
  const hint=document.getElementById('mobileHint');
  if(hint&&'ontouchstart' in window) hint.style.display='block';
}

// ─────────────────────────────────────────────────────────
//  KEYBOARD
// ─────────────────────────────────────────────────────────
function onJump(){
  initAudio();
  if(gameState==='menu'){startGame('solo');return;}
  if(gameState==='dead') return;
  if(gameState!=='playing') return;
  if(dino.ducking){dino.ducking=false;return;}
  if(hasPowerup('banana')&&Math.random()<0.3){
    dino.x+=(Math.random()-0.5)*30; showToast('🍌 SLIPPED!',1000); triggerSoundpad('banana_slip'); return;
  }
  if(dino.jumpCount<2){
    const jumpMult=upgradeLevels.jump>0?UPGRADES[1].effects[upgradeLevels.jump-1]:1;
    dino.vy=CFG.JUMP_FORCE*jumpMult;
    dino.grounded=false; dino.jumpCount++;
    playSound('jump');
    if(dino.jumpCount===2) triggerSoundpad('doubleJump');
  }
}

function onDuck(pressed){
  if(gameState!=='playing') return;
  dino.ducking=pressed;
  if(pressed&&!dino.grounded) dino.vy+=3;
}

document.addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();onJump();}
  if(e.code==='ArrowDown'){e.preventDefault();onDuck(true);}
  if(e.code==='KeyR'&&gameState==='dead') restartGame();
  if(e.code==='Escape') goMenu();
  if(e.code==='ArrowRight') nextTrack();
  if(e.code==='ArrowLeft') prevTrack();
});
document.addEventListener('keyup',e=>{
  if(e.code==='ArrowDown') onDuck(false);
});

// ─────────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────────
function gameLoop(ts){
  const dt=Math.min((ts-lastTime)/(1000/CFG.FPS),3);
  lastTime=ts;
  if(gameState==='menu') animateMenuDino();
  if(gameState==='playing'||gameState==='dead'){ update(dt); render(); }
  animId=requestAnimationFrame(gameLoop);
}

let menuDinoFrame=0, menuDinoFrameTimer=0;
function animateMenuDino(){
  const mc=document.getElementById('menuDinoCanvas');
  if(!mc) return;
  const mctx=mc.getContext('2d');
  mctx.clearRect(0,0,mc.width,mc.height);
  menuDinoFrameTimer++;
  if(menuDinoFrameTimer>10){menuDinoFrame=menuDinoFrame===0?1:0;menuDinoFrameTimer=0;}
  const savedCtx=ctx; ctx=mctx;
  drawDinoBody(70,10,CFG.DINO_W,CFG.DINO_H,activeSkin,false,false,menuDinoFrame);
  ctx=savedCtx;
}

// ─────────────────────────────────────────────────────────
//  GAME FLOW
// ─────────────────────────────────────────────────────────
function startGame(mode){
  initAudio();
  gameState='playing';
  score=0; sessionBones=0; distancePx=0;
  speed=CFG.INIT_SPEED; frame=0; isNight=false;
  noPoweupRun=true; warningShown=false; warningTimer=0;
  currentEvent=null; nextEventScore=CFG.EVENT_MIN_SCORE+Math.random()*80;
  obstacles=[]; bones=[]; powerupItems=[]; particles=[];
  rainDrops=[]; sandParts=[]; weatherFrameTimer=0; currentWeatherIdx=0;
  lastMilestonePlayed=-1; // ← إعادة تعيين لمنع bug الـ 100
  document.getElementById('powerupBar').innerHTML='';
  document.getElementById('gameWrapper').style.background='#87CEEB';
  dino.dead=false; dino.x=W*0.12; dino.y=groundY-dino.h;
  dino.vy=0; dino.grounded=true; dino.jumpCount=0;
  dino.ducking=false; dino.frame=0; dino.frameTimer=0;
  dino.powerups=[]; dino.skin=activeSkin;
  if(upgradeLevels.shield>0) activatePowerup('shield');

  if(mode==='solo'){
    const personalities=['rival','clown','nerd','sleeper'];
    aiDino.personality=personalities[Math.floor(Math.random()*personalities.length)];
    const names={rival:'RivalRex',clown:'ChaosRex',nerd:'Dino3000',sleeper:'ZombieRex'};
    aiDino.name=names[aiDino.personality];
    aiDino.active=true; aiDino.dead=false;
    aiDino.respawnScene=null; aiDino.respawnProgress=0;
    aiDino.x=W*0.12; aiDino.y=groundY-dino.h;
    aiDino.vy=0; aiDino.grounded=true; aiDino.jumpCount=0;
    aiDino.ducking=false; aiDino.frame=0; aiDino.frameTimer=0;
    aiDino.lastTauntTime=Date.now();
  }

  showScreen('playing');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('onlineBoard').classList.add('hidden');
  hideBanner();
  if(musicEnabled) playTrack(currentTrackIdx);
}

function restartGame(){
  showScreen('playing');
  if(onlineMode) startOnlineGame(); else startGame('solo');
}

function goMenu(){
  if(onlineMode) leaveRoom();
  gameState='menu'; aiDino.active=false;
  dino.powerups.forEach(p=>{if(p.timerEl)p.timerEl.remove();}); dino.powerups=[];
  document.getElementById('powerupBar').innerHTML='';
  showScreen('menuScreen');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('onlineBoard').classList.add('hidden');
  updateMenuBones(); hideBanner();
}

function showHUDBones(count){
  const el=document.createElement('div');
  el.style.cssText=`position:absolute;left:${dino.x+10}px;top:${dino.y-20}px;color:#f9c74f;font-weight:700;font-size:14px;font-family:monospace;z-index:40;pointer-events:none;animation:bonePop .6s ease forwards;`;
  el.textContent=`+${count}🦴`;
  document.getElementById('gameWrapper').appendChild(el);
  setTimeout(()=>el.remove(),700);
}

// ─────────────────────────────────────────────────────────
//  FIREBASE ONLINE MULTIPLAYER
// ─────────────────────────────────────────────────────────
function waitForFirebase(cb){ if(window._fbReady){cb();}else{setTimeout(()=>waitForFirebase(cb),100);} }
function generateRoomCode(){ return Math.random().toString(36).substring(2,7).toUpperCase(); }
function generatePlayerId(){ return 'p_'+Math.random().toString(36).substring(2,10); }

function createRoom(){
  const name=document.getElementById('playerNameInput').value.trim()||'Anonymous';
  if(name) localStorage.setItem('dinoplus_pname',name);
  waitForFirebase(()=>{
    const db=window._db,ref=window._fbRef,set=window._fbSet;
    const code=generateRoomCode(); myPlayerId=generatePlayerId(); isHost=true; roomId=code;
    const roomData={code,host:myPlayerId,status:'waiting',created:Date.now(),players:{[myPlayerId]:{name,score:0,dead:false,skin:activeSkin,host:true}}};
    roomRef=ref(db,`dinoRooms/${code}`);
    set(roomRef,roomData).then(()=>{showRoomLobby(code,true);listenToRoom(code);})
      .catch(err=>showStatus('❌ Error: '+err.message,'danger'));
  });
}

function joinRoom(){
  const code=document.getElementById('joinCodeInput').value.trim().toUpperCase();
  const name=document.getElementById('playerNameInput').value.trim()||'Anonymous';
  if(!code){showStatus('Enter a room code!','warning');return;}
  if(name) localStorage.setItem('dinoplus_pname',name);
  waitForFirebase(()=>{
    const db=window._db,ref=window._fbRef,get=window._fbGet,update=window._fbUpdate;
    myPlayerId=generatePlayerId(); isHost=false;
    const rRef=ref(db,`dinoRooms/${code}`);
    get(rRef).then(snap=>{
      if(!snap.exists()){showStatus('❌ Room not found!','danger');return;}
      const data=snap.val();
      if(data.status==='playing'){showStatus('❌ Game already started!','danger');return;}
      if(Object.keys(data.players||{}).length>=4){showStatus('❌ Room full!','danger');return;}
      roomId=code; roomRef=ref(db,`dinoRooms/${code}`);
      update(ref(db,`dinoRooms/${code}/players/${myPlayerId}`),{name,score:0,dead:false,skin:activeSkin,host:false})
        .then(()=>{showRoomLobby(code,false);listenToRoom(code);});
    }).catch(err=>showStatus('❌ '+err.message,'danger'));
  });
}

function listenToRoom(code){
  const db=window._db,ref=window._fbRef,onValue=window._fbOnValue;
  if(roomListener) window._fbOff(roomRef,'value',roomListener);
  roomRef=ref(db,`dinoRooms/${code}`);
  roomListener=onValue(roomRef,snap=>{
    if(!snap.exists()){showToast('Room was deleted.',2000);leaveRoom();return;}
    const data=snap.val(); onlinePlayers=data.players||{};
    updateRoomLobbyUI(data);
    if(data.status==='playing'&&gameState!=='playing') startOnlineRun();
    if(gameState==='playing'&&onlineMode) updateOnlineScoreboard();
  });
}

function updateRoomLobbyUI(data){
  const list=document.getElementById('roomPlayersList');
  if(!list) return;
  list.innerHTML='';
  Object.entries(data.players||{}).forEach(([pid,p])=>{
    const el=document.createElement('div'); el.className='room-player';
    el.innerHTML=`<div class="player-dot" style="background:${p.host?'#f9c74f':'#2dc653'}"></div><span style="color:#fff;flex:1">${p.name}</span>${p.host?'<span class="player-host-badge">HOST</span>':''}${pid===myPlayerId?'<span style="color:#9ca3af;font-size:.7rem">(you)</span>':''}`;
    list.appendChild(el);
  });
  if(isHost){
    const count=Object.keys(data.players||{}).length;
    const btn=document.getElementById('startOnlineBtn');
    if(btn){btn.disabled=count<2;btn.textContent=count<2?'⏳ Waiting...':'▶ Start Game ('+count+' players)';}
  }
}

function showRoomLobby(code,hosting){
  document.getElementById('onlinePanelContent').classList.add('hidden');
  document.getElementById('roomLobby').classList.remove('hidden');
  document.getElementById('roomCodeDisplay').textContent=code;
  document.getElementById('hostActions').classList.toggle('hidden',!hosting);
  document.getElementById('guestWaiting').classList.toggle('hidden',hosting);
}

function copyRoomCode(){ navigator.clipboard.writeText(roomId||''); showToast('📋 Copied!',1500); }
window.copyRoomCode=copyRoomCode;

function startOnlineGame(){
  if(!isHost||!roomId) return;
  const db=window._db,ref=window._fbRef,update=window._fbUpdate;
  update(ref(db,`dinoRooms/${roomId}`),{status:'playing'});
}

function startOnlineRun(){
  onlineMode=true; hidePanel('onlinePanel');
  startGame('online'); aiDino.active=false;
  document.getElementById('onlineBoard').classList.remove('hidden');
  updateOnlineScoreboard();
}

function pushOnlineScore(sc,dead=false){
  if(!roomId||!myPlayerId) return;
  const db=window._db,ref=window._fbRef,update=window._fbUpdate;
  update(ref(db,`dinoRooms/${roomId}/players/${myPlayerId}`),{score:sc,dead,skin:activeSkin});
}

function updateOnlineScoreboard(){
  const rows=document.getElementById('obRows');
  if(!rows) return;
  const sorted=Object.entries(onlinePlayers).sort((a,b)=>b[1].score-a[1].score);
  rows.innerHTML='';
  sorted.forEach(([pid,p],i)=>{
    const row=document.createElement('div'); row.className='ob-row'+(p.dead?' ob-dead':'');
    const medal=['🥇','🥈','🥉','4️⃣'][i]||(i+1);
    row.innerHTML=`<span class="ob-rank">${medal}</span><span class="ob-name">${p.name}${pid===myPlayerId?'<span style="color:#4361ee"> ★</span>':''}</span><span class="ob-score">${Math.round(p.score)}</span>${p.dead?'💀':''}`;
    rows.appendChild(row);
  });
}

function leaveRoom(){
  if(roomRef&&myPlayerId){
    const db=window._db,ref=window._fbRef,remove=window._fbRemove;
    remove(ref(db,`dinoRooms/${roomId}/players/${myPlayerId}`)).catch(()=>{});
    if(isHost) remove(ref(db,`dinoRooms/${roomId}`)).catch(()=>{});
  }
  if(roomListener&&roomRef){window._fbOff(roomRef,'value',roomListener);roomListener=null;}
  roomId=null;myPlayerId=null;isHost=false;onlineMode=false;onlinePlayers={};
  document.getElementById('onlinePanelContent').classList.remove('hidden');
  document.getElementById('roomLobby').classList.add('hidden');
  hidePanel('onlinePanel');
  document.getElementById('onlineBoard').classList.add('hidden');
  showToast('👋 Left the room.',1500);
}

// ─────────────────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────────────────
function showScreen(name){
  ['loadingScreen','menuScreen','gameoverScreen'].forEach(s=>{
    const el=document.getElementById(s);
    if(s===name+'Screen'||s===name) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  if(name==='playing'){
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameoverScreen').classList.add('hidden');
  }
}

function showPanel(id){ document.getElementById(id).classList.remove('hidden'); if(id==='upgradesPanel')renderUpgrades(); if(id==='skinsPanel')renderSkins(); if(id==='leaderboardPanel')renderLeaderboard(); if(id==='musicPanel')renderMusicPanel(); }
window.showPanel=showPanel;
function hidePanel(id){ document.getElementById(id).classList.add('hidden'); }
window.hidePanel=hidePanel;
function showBanner(text){ const b=document.getElementById('eventBanner'); b.textContent=text; b.classList.add('show'); }
function hideBanner(){ document.getElementById('eventBanner').classList.remove('show'); }
function showAIBubble(msg){
  const b=document.getElementById('aiBubble');
  b.textContent=msg; b.style.left=(dino.x+60)+'px'; b.style.top=(dino.y-40)+'px';
  b.classList.add('show'); setTimeout(()=>b.classList.remove('show'),3000);
}
let toastTimer=null;
function showToast(msg,dur=2000){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}
window.showToast=showToast;
function showStatus(msg,type){
  const el=document.getElementById('roomStatus');
  const colors={danger:'#e63946',warning:'#f9c74f',success:'#2dc653'};
  el.innerHTML=`<div style="color:${colors[type]||'#fff'};font-size:.85rem;padding:8px;text-align:center">${msg}</div>`;
}
function updateMenuBones(){ document.getElementById('menuBones').textContent=`🦴 ${getTotalBones()}`; }

// ─── MUSIC PANEL ───
function renderMusicPanel(){
  const grid=document.getElementById('musicGrid');
  if(!grid) return;
  grid.innerHTML='';
  MUSIC_LIBRARY.forEach((t,i)=>{
    const card=document.createElement('div');
    card.className='music-card'+(i===currentTrackIdx?' active':'');
    card.innerHTML=`<div class="music-style">${t.style}</div><div class="music-name">${t.name}</div>`;
    card.onclick=()=>{ playTrack(i); renderMusicPanel(); };
    grid.appendChild(card);
  });
  const volEl=document.getElementById('volumeSlider');
  if(volEl) volEl.value=musicVolume;
}
window.nextTrack=nextTrack;
window.prevTrack=prevTrack;

// ─── UPGRADES ───
function renderUpgrades(){
  document.getElementById('bonesDisplay').textContent=getTotalBones();
  const grid=document.getElementById('upgradeGrid'); grid.innerHTML='';
  UPGRADES.forEach(u=>{
    const level=upgradeLevels[u.id]||0; const maxed=level>=u.maxLevel;
    const cost=maxed?'—':u.levels[level]; const canAfford=!maxed&&getTotalBones()>=cost;
    const dots=Array(u.maxLevel).fill(0).map((_,i)=>`<div class="upgrade-dot${i<level?' filled':''}"></div>`).join('');
    const item=document.createElement('div'); item.className='upgrade-item';
    item.innerHTML=`<div class="upgrade-icon">${u.icon}</div><div class="upgrade-info"><div class="upgrade-name">${u.name}</div><div class="upgrade-desc">${u.desc}</div><div class="upgrade-level">${dots}</div></div><button class="upgrade-buy" ${(!canAfford||maxed)?'disabled':''} onclick="buyUpgrade('${u.id}')">${maxed?'MAX':'🦴 '+cost}</button>`;
    grid.appendChild(item);
  });
}

function buyUpgrade(id){
  const u=UPGRADES.find(u=>u.id===id); const level=upgradeLevels[id]||0;
  if(level>=u.maxLevel) return; const cost=u.levels[level];
  if(getTotalBones()<cost){showToast('❌ Not enough bones!');return;}
  bonesCollected-=cost;
  if(bonesCollected<0){sessionBones+=bonesCollected;bonesCollected=0;}
  upgradeLevels[id]=level+1; saveData(); showToast(`✅ ${u.name} Level ${level+1}!`); renderUpgrades();
}
window.buyUpgrade=buyUpgrade;

// ─── SKINS ───
function renderSkins(){
  const grid=document.getElementById('skinsGrid'); grid.innerHTML='';
  SKINS.forEach(s=>{
    const isActive=activeSkin===s.id;
    const card=document.createElement('div');
    card.className='skin-card'+(s.unlocked?' unlocked':'')+(isActive?' active':'');
    const sc=document.createElement('canvas'); sc.className='skin-canvas'; sc.width=60; sc.height=50;
    card.appendChild(sc);
    card.innerHTML+=`<div class="skin-name">${s.emoji} ${s.name}</div><div class="skin-status">${isActive?'✅ Active':s.unlocked?'Unlocked':'🔒 '+s.unlockDesc}</div>`;
    if(s.unlocked) card.onclick=()=>{activeSkin=s.id;dino.skin=s.id;saveData();renderSkins();};
    grid.appendChild(card);
    const savedCtx=ctx; ctx=sc.getContext('2d');
    drawDinoBody(5,2,40,46,s.id,false,false,0); ctx=savedCtx;
  });
}

// ─── LEADERBOARD ───
function renderLeaderboard(){
  const lb=getLeaderboard(); const el=document.getElementById('leaderboardList'); el.innerHTML='';
  if(!lb.length){el.innerHTML='<div class="text-muted text-center">No scores yet. Be the first!</div>';return;}
  lb.forEach((e,i)=>{
    const row=document.createElement('div'); row.className='lb-row';
    const rankClass=i<3?'lb-rank-'+(i+1):'';
    const medal=['🥇','🥈','🥉'][i]||(i+1+'.');
    row.innerHTML=`<div class="lb-rank ${rankClass}">${medal}</div><div class="lb-name">${e.name} <span style="font-size:.7rem;color:#6b7280">${SKINS.find(s=>s.id===e.skin)?.emoji||'🦕'}</span></div><div class="lb-score">${e.score}</div><div class="lb-date">${e.date}</div>`;
    el.appendChild(row);
  });
}

// ─── Canvas helpers ───
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by; }

// ─── Menu Stars ───
function generateMenuStars(){
  const container=document.getElementById('menuStars'); if(!container) return;
  container.innerHTML='';
  for(let i=0;i<80;i++){
    const star=document.createElement('div'); const size=Math.random()*3+1;
    star.className='star';
    star.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*2}s;animation-duration:${1+Math.random()*2}s;`;
    container.appendChild(star);
  }
}

// ─────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────
const LOAD_STEPS=[
  'Waking up the dinosaur...',
  'Loading cactus database...',
  'Teaching AI to cheat...',
  'Calibrating bone collector...',
  'Connecting to Cactus Government...',
  'Applying silly Tunisian physics...',
  'Almost done (probably)...',
];

async function boot(){
  initCanvas();
  loadData();
  seedLeaderboard();
  generateMenuStars();
  setupMobileControls();
  const bar=document.getElementById('loadingBar'), txt=document.getElementById('loadingText');
  for(let i=0;i<LOAD_STEPS.length;i++){
    txt.textContent=LOAD_STEPS[i];
    bar.style.width=((i+1)/LOAD_STEPS.length*100)+'%';
    await new Promise(r=>setTimeout(r,180+Math.random()*150));
  }
  gameState='menu'; showScreen('menuScreen'); updateMenuBones();
  animId=requestAnimationFrame(gameLoop);
}

// ─── Global wires ───
window.startGame=startGame;
window.restartGame=restartGame;
window.goMenu=goMenu;
window.toggleMusic=toggleMusic;
window.onJump=onJump;
window.onDuck=onDuck;
window.createRoom=createRoom;
window.joinRoom=joinRoom;
window.startOnlineGame=startOnlineGame;
window.leaveRoom=leaveRoom;
window.setMusicVolume=setMusicVolume;

// بنيمشن العظمة
const styleEl=document.createElement('style');
styleEl.textContent=`
@keyframes bonePop{0%{transform:translateY(0);opacity:1;}100%{transform:translateY(-40px);opacity:0;}}
`;
document.head.appendChild(styleEl);

boot();
