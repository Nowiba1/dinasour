/* ═══════════════════════════════════════════════════════════
   DINO RUNNER+ — game.js
   Full game engine: Canvas rendering, physics, AI, powerups,
   events, upgrades, skins, Firebase online multiplayer, music
═══════════════════════════════════════════════════════════ */

"use strict";

// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const CFG = {
  FPS: 60,
  GROUND_H_RATIO: 0.72,       // ground Y as fraction of canvas height
  DINO_W: 52, DINO_H: 60,
  GRAVITY: 0.65,
  JUMP_FORCE: -16,
  INIT_SPEED: 6,
  MAX_SPEED: 22,
  SPEED_INC: 0.003,
  SCORE_BONE_RATIO: 80,       // every N score → 1 bone
  OBSTACLE_MIN_GAP: 320,
  PTERO_HEIGHTS: [0.3, 0.5, 0.75], // fraction of ground from top
  STAR_COUNT: 120,
  CLOUD_COUNT: 6,
  MOUNTAIN_COUNT: 5,
  DAY_NIGHT_INTERVAL: 300,    // score points per day/night toggle
  EVENT_MIN_SCORE: 60,
  POWERUP_SPAWN_SCORE: 50,
  AI_TAUNT_INTERVAL: 8000,
};

// Funny messages
const FUNNY_MSGS = [
  "You died. Skill issue.",
  "Even the cactus felt bad for you.",
  "T-Rex has left the chat.",
  "Your ancestors are disappointed.",
  "Speedrun any%: 0m",
  "The meteor didn't even need to try.",
  "Extinct. Again.",
  "Google would have reloaded by now.",
  "Pro gamer moment: FAILED",
  "The cactus sends its regards.",
  "You just got outplayed by a plant.",
  "GAME OVER. Have you tried turning off and on again?",
];

const AI_TAUNTS_AHEAD = [
  "Still warming up 😴",
  "Catch me if you can! 🦕",
  "Speed = distance / your skill",
  "404: Player skill not found",
  "I peaked in the Jurassic, what's your excuse?",
];
const AI_TAUNTS_BEHIND = [
  "Okay okay, you're fast.",
  "I let you win. Obviously. 😤",
  "New strat: let them tire themselves out.",
  "This was planned. Trust.",
  "Calculating revenge... 🤔",
];

// ─────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────
let canvas, ctx;
let W, H, groundY;
let gameState = 'loading'; // loading | menu | playing | dead
let score = 0, bestScore = 0, bonesCollected = 0, distancePx = 0;
let speed = CFG.INIT_SPEED;
let frame = 0;
let isNight = false;
let lastTime = 0;
let animId = null;

// Player dino
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
  // active powerups: { type, endTime, timerEl }
  powerups: [],
  shieldHits: 0,
};

// AI rival
const aiDino = {
  x: 0, y: 0,
  vy: 0,
  grounded: true,
  jumpCount: 0,
  ducking: false,
  dead: false,
  deadTimer: 0,
  respawnTimer: 0,
  personality: 'rival', // rival|clown|nerd|sleeper
  name: 'Ghost',
  frame: 0,
  frameTimer: 0,
  active: false,
  lastTauntTime: 0,
  sleeperBurst: false,
  sleeperTimer: 0,
};

// World elements
let obstacles = [];
let bones = [];
let powerupItems = [];
let clouds = [], mountains = [], stars = [];
let particles = [];

// Scroll offset for parallelism
let bgOffset = 0;

// Random events
let currentEvent = null;
let eventEndTime = 0;
let nextEventScore = CFG.EVENT_MIN_SCORE + Math.random() * 80;

// ─── Online Multiplayer state ───
let onlineMode = false;
let roomId = null;
let myPlayerId = null;
let isHost = false;
let roomRef = null;
let roomListener = null;
let onlinePlayers = {}; // playerId → { name, score, dead, skin }
let onlineScoreInterval = null;

// ─── Upgrades & Skins ───
const UPGRADES = [
  { id:'speed',  name:'Speed Control', icon:'⚙️', desc:'Reduces max speed. Easier to survive.', levels:[50,80,120], effects:[2,4,6], maxLevel:3 },
  { id:'jump',   name:'Power Jump',    icon:'🦘', desc:'Higher jump arc (+15% per level).',      levels:[40,65,100], effects:[1.15,1.3,1.5], maxLevel:3 },
  { id:'eye',    name:'Eagle Eye',     icon:'👁️', desc:'Warns 0.5s before obstacle.',            levels:[80,120,180], effects:[1,1,1], maxLevel:3 },
  { id:'luck',   name:'Lucky Paws',    icon:'🍀', desc:'Powerups appear 30% more often.',        levels:[60,90,130], effects:[0.7,0.5,0.35], maxLevel:3 },
  { id:'shield', name:'Iron Scales',   icon:'🛡️', desc:'Start each run with a free shield.',     levels:[100,150,220], effects:[1,1,1], maxLevel:3 },
];

const SKINS = [
  { id:'classic',    name:'Classic',    emoji:'🦕', unlockDesc:'Default',          unlocked:true  },
  { id:'cool',       name:'Cool Dino',  emoji:'🕶️', unlockDesc:'Score 1000+',      unlocked:false },
  { id:'corporate',  name:'Corporate',  emoji:'🤵', unlockDesc:'Beat AI 5 times',  unlocked:false },
  { id:'chad',       name:'Chad Dino',  emoji:'👑', unlockDesc:'Daily high score', unlocked:false },
  { id:'ninja',      name:'Ninja',      emoji:'🥷', unlockDesc:'500 no powerups',  unlocked:false },
  { id:'cactus',     name:'Cactus Dino',emoji:'🌵', unlockDesc:'Smash 10 shields', unlocked:false },
];

let upgradeLevels = { speed:0, jump:0, eye:0, luck:0, shield:0 };
let activeSkin = 'classic';
let aiBeatenCount = 0;
let noPoweupRun = true;
let sessionBones = 0;
let warningShown = false;
let warningTimer = 0;

// ─────────────────────────────────────────────────────────
//  AUDIO (Web Audio API procedural + Music API)
// ─────────────────────────────────────────────────────────
let audioCtx = null;
let musicEnabled = true;
let musicNode = null;
let musicGain = null;
let currentTrack = null;
let musicQueue = [];
let musicPlaying = false;

// Funny/upbeat songs from Jamendo (CC-licensed public API)
const MUSIC_API_URL = 'https://api.jamendo.com/v3.0/tracks/?client_id=b6747d04&format=json&limit=10&tags=funny+upbeat&audioformat=mp32&include=musicinfo&order=popularity_total';
const FALLBACK_TRACKS = [
  { name:'Silly Adventure', artist:'DinoBeats', audio:'https://prod-1.storage.jamendo.com/?trackid=1554037&format=mp32&from=app-devsite'},
  { name:'Cactus Boogie',   artist:'RetroRex',  audio:'https://prod-1.storage.jamendo.com/?trackid=1213087&format=mp32&from=app-devsite'},
];

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(audioCtx.destination);
  fetchMusic();
}

async function fetchMusic() {
  try {
    const r = await fetch(MUSIC_API_URL);
    const data = await r.json();
    if (data.results && data.results.length) {
      musicQueue = data.results
        .filter(t => t.audio)
        .map(t => ({ name: t.name, artist: t.artist_name, audio: t.audio }));
    }
  } catch(e) {
    musicQueue = FALLBACK_TRACKS;
  }
  if (musicEnabled && musicQueue.length) playNextTrack();
}

function playNextTrack() {
  if (!musicEnabled || !audioCtx || !musicQueue.length) return;
  if (currentTrack) { try { currentTrack.pause(); } catch(e){} }
  const idx = Math.floor(Math.random() * musicQueue.length);
  const t = musicQueue[idx];
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.src = t.audio;
  audio.volume = 0.25;
  audio.onended = () => setTimeout(playNextTrack, 1000);
  audio.onerror = () => setTimeout(playNextTrack, 2000);
  audio.play().catch(()=>{});
  currentTrack = audio;
  musicPlaying = true;
  showToast(`🎵 Now playing: ${t.name} — ${t.artist}`, 3000);
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  document.getElementById('musicBtnText').textContent = musicEnabled ? 'Music: ON' : 'Music: OFF';
  if (musicEnabled) {
    if (musicQueue.length) playNextTrack(); else fetchMusic();
  } else {
    if (currentTrack) { try { currentTrack.pause(); } catch(e){} }
    musicPlaying = false;
  }
}

// Procedural SFX
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
  }
}

// ─────────────────────────────────────────────────────────
//  STORAGE
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
  localStorage.setItem('dinoplus_v1', JSON.stringify(d));
}

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem('dinoplus_v1') || '{}');
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
  lb.push({ name, score: sc, skin, date: new Date().toLocaleDateString() });
  lb.sort((a,b) => b.score - a.score);
  const top = lb.slice(0, 10);
  localStorage.setItem('dinoplus_lb', JSON.stringify(top));
}

// Seed leaderboard if empty
function seedLeaderboard() {
  const lb = getLeaderboard();
  if (lb.length < 5) {
    const seeds = [
      { name:'DinoKing99', score:4280, skin:'chad',   date:'1/1/2025' },
      { name:'TunisDino',  score:3150, skin:'ninja',  date:'1/2/2025' },
      { name:'SpeedRex',   score:2800, skin:'cool',   date:'1/3/2025' },
      { name:'CactusMan',  score:1900, skin:'cactus', date:'1/4/2025' },
      { name:'NewbDino',   score:420,  skin:'classic',date:'1/5/2025' },
    ];
    seeds.forEach(s => { if (!lb.find(e=>e.name===s.name)) lb.push(s); });
    lb.sort((a,b)=>b.score-a.score);
    localStorage.setItem('dinoplus_lb', JSON.stringify(lb));
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
//  BACKGROUND GENERATION
// ─────────────────────────────────────────────────────────
function generateBackground() {
  // Stars
  stars = [];
  for (let i = 0; i < CFG.STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * groundY * 0.9,
      r: Math.random() * 1.8 + 0.3,
      speed: Math.random() * 0.3 + 0.1,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  // Clouds
  clouds = [];
  for (let i = 0; i < CFG.CLOUD_COUNT; i++) {
    clouds.push(newCloud(Math.random() * W));
  }
  // Mountains
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
//  RENDERING
// ─────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const skyColors = isNight
    ? ['#0d1b2a','#1b2838','#16213e']
    : ['#87CEEB','#a8d8ea','#d4f1f9'];
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, skyColors[0]);
  skyGrad.addColorStop(0.5, skyColors[1]);
  skyGrad.addColorStop(1, skyColors[2]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, groundY);

  // Stars (night only)
  if (isNight) {
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

  // Moon / Sun
  if (isNight) {
    drawMoon(W - 80, 60);
  } else {
    drawSun(W - 80, 60);
  }

  // Mountains (parallax layer 1)
  mountains.forEach(m => {
    const grad = ctx.createLinearGradient(m.x, groundY - m.h, m.x, groundY);
    if (isNight) {
      grad.addColorStop(0, '#2d3a5e');
      grad.addColorStop(1, '#1a2240');
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
    // Snow cap
    if (!isNight) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(m.x - m.w*0.1, groundY - m.h*0.75);
      ctx.lineTo(m.x, groundY - m.h);
      ctx.lineTo(m.x + m.w*0.1, groundY - m.h*0.75);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Clouds
  clouds.forEach(c => drawCloud(c));

  // Ground
  drawGround();

  // Render event overlay
  renderEventOverlay();

  // Bones
  bones.forEach(b => drawBone(b));

  // Powerup items
  powerupItems.forEach(p => drawPowerupItem(p));

  // Eagle eye warning
  if (warningShown && warningTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frame * 0.4);
    ctx.fillStyle = '#f9c74f';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('⚠️ OBSTACLE AHEAD!', W * 0.5 - 100, groundY - 80);
    ctx.restore();
  }

  // Obstacles
  obstacles.forEach(o => drawObstacle(o));

  // AI dino
  if (aiDino.active && !aiDino.dead) {
    drawDino(aiDino, true);
  }

  // Player dino
  if (!dino.dead) {
    drawDino(dino, false);
  }

  // Particles
  particles.forEach(p => drawParticle(p));

  // Ground details (after dino so they appear on top of ground layer)
  drawGroundDetails();

  // Distance marker
  drawDistanceMarker();
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
  // Rays
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
  // Crater
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
  // Main body
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
  // Ground base
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  if (isNight) {
    groundGrad.addColorStop(0, '#2d3a2e');
    groundGrad.addColorStop(0.3, '#1a2a1b');
    groundGrad.addColorStop(1, '#0f1a10');
  } else {
    groundGrad.addColorStop(0, '#c8a96e');
    groundGrad.addColorStop(0.2, '#b8914e');
    groundGrad.addColorStop(1, '#8b6914');
  }
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Ground line
  ctx.strokeStyle = isNight ? '#3d5c3e' : '#a07840';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  // Ground texture lines (moving)
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
  // Pebbles
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
  ctx.fillText(`${m}m`, 16, groundY - 8);
  ctx.restore();
}

// ─── DINO DRAWING ───
function drawDino(d, isAI) {
  const x = Math.round(d.x);
  const y = Math.round(d.y);
  const w = d.ducking ? d.w * 1.4 : d.w;
  const h = d.ducking ? d.h * 0.55 : d.h;
  const actualY = d.ducking ? groundY - h : y;

  ctx.save();

  // Shield aura
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

  // AI ghost effect
  if (isAI) {
    ctx.globalAlpha = 0.45;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#a78bfa';
  }

  // Jetpack particles
  if (!isAI && hasPowerup('jetpack')) {
    drawJetpackFire(x, actualY + h, d);
  }

  // Dust particles while running
  if (d.grounded && !d.ducking && !d.dead) {
    if (frame % 8 === 0) {
      spawnDustParticles(x, groundY);
    }
  }

  // Draw the dino body based on skin
  drawDinoBody(x, actualY, w, h, d.skin || activeSkin, isAI, d.ducking, d.frame);

  // Name tag for AI
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

function drawDinoBody(x, y, w, h, skin, isAI, ducking, frameIdx) {
  const colors = getSkinColors(skin, isAI);
  const runOffset = ducking ? 0 : (frameIdx === 0 ? 2 : -2);

  // Body
  ctx.fillStyle = colors.body;
  roundRect(ctx, x + w*0.15, y + h*0.1, w*0.7, h*0.55, 6);
  ctx.fill();

  if (!ducking) {
    // Head
    ctx.fillStyle = colors.head;
    roundRect(ctx, x + w*0.4, y, w*0.55, h*0.42, 8);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.78, y + h*0.12, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w*0.8, y + h*0.13, 3.5, 0, Math.PI*2);
    ctx.fill();
    // Pupil shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.81, y + h*0.12, 1.2, 0, Math.PI*2);
    ctx.fill();

    // Mouth / expression
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
      ctx.fillStyle = '#e63946';
      ctx.font = '8px monospace';
      ctx.fillText('忍', x + w*0.64, y + h*0.3);
    }

    // Nostril
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.arc(x + w*0.9, y + h*0.2, 2, 0, Math.PI*2);
    ctx.fill();
  } else {
    // Ducking eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + w*0.7, y + h*0.2, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w*0.72, y + h*0.21, 3, 0, Math.PI*2);
    ctx.fill();
  }

  // Tail
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(x + w*0.15, y + h*0.35);
  ctx.lineTo(x - w*0.1, y + h*0.5);
  ctx.lineTo(x + w*0.05, y + h*0.55);
  ctx.lineTo(x + w*0.2, y + h*0.5);
  ctx.closePath();
  ctx.fill();

  // Legs
  const legY = y + h * 0.6;
  const legAnim = ducking ? 0 : (frameIdx === 0 ? 0 : 6);
  ctx.fillStyle = colors.legs;
  // Back leg
  roundRect(ctx, x + w*0.2, legY, w*0.18, h*0.35 + runOffset, 4);
  ctx.fill();
  // Front leg
  roundRect(ctx, x + w*0.45, legY + (ducking ? 0 : legAnim - 3), w*0.18, h*0.35 - runOffset, 4);
  ctx.fill();

  // Arm
  if (!ducking) {
    ctx.fillStyle = colors.body;
    roundRect(ctx, x + w*0.6, y + h*0.35, w*0.15, h*0.18, 3);
    ctx.fill();
  }

  // Cactus skin spikes
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

// ─── OBSTACLES ───
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
    // Main trunk
    ctx.fillStyle = green1;
    roundRect(ctx, cx, cy, o.w / o.count - 2, ch, 4);
    ctx.fill();
    // Trunk shade
    ctx.fillStyle = green2;
    roundRect(ctx, cx + o.w/o.count*0.4 - 1, cy + 8, o.w/o.count*0.2, ch - 16, 2);
    ctx.fill();
    // Arms
    if (i === 0 || o.count === 1) {
      ctx.fillStyle = green1;
      roundRect(ctx, cx - 10, cy + ch*0.25, 12, o.h*0.15, 3);
      ctx.fill();
      roundRect(ctx, cx - 10, cy + ch*0.1, 8, o.h*0.18, 3);
      ctx.fill();
      ctx.fillStyle = green1;
      roundRect(ctx, cx + o.w/o.count - 2, cy + ch*0.35, 10, o.h*0.12, 3);
      ctx.fill();
    }
    // Spines
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
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(o.x + o.w/2, o.y + o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
  ctx.fill();
  // Wings
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
  // Beak
  ctx.fillStyle = '#f9c74f';
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + o.h*0.4);
  ctx.lineTo(o.x - 14, o.y + o.h*0.5);
  ctx.lineTo(o.x, o.y + o.h*0.6);
  ctx.closePath();
  ctx.fill();
  // Eye
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
  // Body
  ctx.beginPath();
  ctx.ellipse(o.x + 12, groundY - 20 - bounce, 12, 14, 0, 0, Math.PI*2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#f5e6c8';
  ctx.beginPath();
  ctx.arc(o.x + 20, groundY - 32 - bounce, 8, 0, Math.PI*2);
  ctx.fill();
  // Comb
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.ellipse(o.x + 20, groundY - 40 - bounce, 4, 5, 0, 0, Math.PI*2);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(o.x + 23, groundY - 33 - bounce, 2, 0, Math.PI*2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#f9c74f';
  ctx.beginPath();
  ctx.moveTo(o.x + 28, groundY - 32 - bounce);
  ctx.lineTo(o.x + 34, groundY - 30 - bounce);
  ctx.lineTo(o.x + 28, groundY - 28 - bounce);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── BONE ───
function drawBone(b) {
  const by = b.y ?? groundY - 30;
  ctx.save();
  ctx.translate(b.x, by);
  ctx.rotate(b.rot || 0);
  ctx.fillStyle = '#e8d5a3';
  ctx.strokeStyle = '#c4a55a';
  ctx.lineWidth = 1;
  // Shaft
  roundRect(ctx, -14, -3, 28, 6, 3);
  ctx.fill();
  ctx.stroke();
  // End caps
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

// ─── POWERUP ITEMS ───
function drawPowerupItem(p) {
  const bob = Math.sin(frame * 0.08 + p.phase) * 5;
  const py = groundY - 50 + bob;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = p.color;
  // Glow circle
  ctx.globalAlpha = 0.3 + Math.sin(frame * 0.1) * 0.1;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x + 18, py + 16, 22, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Background
  roundRect(ctx, p.x, py, 36, 36, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Emoji
  ctx.font = '22px serif';
  ctx.fillText(p.emoji, p.x + 7, py + 27);
  ctx.restore();
}

// ─── PARTICLES ───
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
    const speed = Math.random() * 8 + 2;
    particles.push({
      x: x + 26, y: y + 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      alpha: 1, r: Math.random() * 5 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnDustParticles(x, y) {
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: x + Math.random() * 20, y,
      vx: -Math.random() * 2 - 0.5,
      vy: -Math.random() * 1,
      alpha: 0.5, r: Math.random() * 3 + 1,
      color: isNight ? '#4a5568' : '#c8a96e',
    });
  }
}

function renderEventOverlay() {
  if (!currentEvent) return;
  if (currentEvent.type === 'rave') {
    const h = Math.floor(frame * 2) % 360;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = `hsl(${h},100%,50%)`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (currentEvent.type === 'phone') {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H * 0.22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📱 You have 99 notifications', W/2, H * 0.12);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('DinoApp, TaxBot, CactusGov, MeteorAlert...', W/2, H * 0.17);
    ctx.textAlign = 'left';
    ctx.restore();
  } else if (currentEvent.type === 'gravity') {
    // obstacles already use sine path in update
  }
}

// ─────────────────────────────────────────────────────────
//  GAME LOGIC
// ─────────────────────────────────────────────────────────
function update(dt) {
  if (gameState !== 'playing') return;

  frame++;
  bgOffset += speed;
  distancePx += speed;

  // Speed increase
  speed = Math.min(
    CFG.MAX_SPEED - (upgradeLevels.speed * 2),
    CFG.INIT_SPEED + score * CFG.SPEED_INC
  );

  // Score
  score += 0.1 * (speed / CFG.INIT_SPEED);
  const roundedScore = Math.round(score);

  // Session bones from score
  const newBones = Math.floor(roundedScore / CFG.SCORE_BONE_RATIO);
  if (newBones > sessionBones) {
    const diff = newBones - sessionBones;
    sessionBones = newBones;
    showHUDBones(diff);
  }

  // Milestone sound
  if (roundedScore > 0 && roundedScore % 100 === 0 && Math.abs(score - roundedScore) < 0.15) {
    playSound('score');
  }

  // Day/night cycle
  const newNight = Math.floor(roundedScore / CFG.DAY_NIGHT_INTERVAL) % 2 === 1;
  if (newNight !== isNight) {
    isNight = newNight;
    document.getElementById('gameWrapper').style.background = isNight ? '#0d1b2a' : '#87CEEB';
  }

  // Update HUD
  document.getElementById('scoreHud').textContent = roundedScore;
  document.getElementById('bestHud').textContent  = Math.max(bestScore, roundedScore);
  document.getElementById('bonesHud').textContent = getTotalBones();

  // ─── PLAYER PHYSICS ───
  updateDinoPhysics(dino);

  // Eagle eye warning
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

  // ─── AI LOGIC ───
  if (aiDino.active) updateAI();

  // ─── BACKGROUND SCROLL ───
  clouds.forEach(c => {
    c.x -= c.speed * (speed * 0.2);
    if (c.x < -c.w * 2) clouds.push(newCloud(W + 50));
    if (c.x < -c.w * 2) clouds.splice(clouds.indexOf(c), 1);
  });
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

  // Stars scroll
  stars.forEach(s => {
    s.x -= s.speed * 0.5;
    if (s.x < 0) s.x = W;
  });

  // ─── OBSTACLES ───
  spawnObstacles();
  obstacles.forEach(o => {
    let dx = speed;
    if (currentEvent?.type === 'gravity') {
      o.waveOffset = (o.waveOffset || 0) + 0.05;
      o.y = (o.baseY || o.y) + Math.sin(o.waveOffset) * 20;
      if (!o.baseY) o.baseY = o.y;
    }
    o.x -= dx;
  });
  obstacles = obstacles.filter(o => o.x > -200);

  // ─── BONES ───
  spawnBones();
  bones.forEach(b => b.x -= speed);
  bones.forEach(b => { if(b.rot !== undefined) b.rot += 0.05; });
  // Magnet
  if (hasPowerup('magnet')) {
    bones.forEach(b => {
      const dx = dino.x + dino.w/2 - b.x;
      const dy = (groundY - 30) - (b.y ?? groundY - 30);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 200) {
        b.x += dx * 0.08;
        if (b.y !== undefined) b.y += dy * 0.08;
        // Funny: occasionally magnet pulls small cactus
        if (Math.random() < 0.0002) showToast('🧲 Whoops! Magnet also pulled a cactus!');
      }
    });
  }

  // Bone collection
  bones = bones.filter(b => {
    const bx = b.x, by = b.y ?? groundY - 30;
    if (rectsOverlap(dino.x, dino.y, dino.w, dino.h, bx-14, by-6, 28, 12)) {
      sessionBones++;
      document.getElementById('bonesHud').textContent = getTotalBones();
      playSound('bone');
      return false;
    }
    return b.x > -30;
  });

  // ─── POWERUP ITEMS ───
  spawnPowerupItems();
  powerupItems.forEach(p => p.x -= speed);
  powerupItems = powerupItems.filter(p => {
    if (rectsOverlap(dino.x, dino.y, dino.w, dino.h, p.x, groundY - 70, 36, 50)) {
      activatePowerup(p.type);
      noPoweupRun = false;
      playSound('powerup');
      return false;
    }
    return p.x > -50;
  });

  // ─── POWERUP TIMERS ───
  dino.powerups = dino.powerups.filter(p => {
    if (Date.now() > p.endTime) {
      if (p.timerEl) p.timerEl.remove();
      return false;
    }
    // Update timer bar
    if (p.timerEl) {
      const remaining = (p.endTime - Date.now()) / p.duration;
      const bar = p.timerEl.querySelector('.powerup-timer');
      if (bar) bar.style.transform = `scaleX(${remaining})`;
    }
    return true;
  });

  // ─── COLLISION ───
  if (!hasPowerup('jetpack') && !hasPowerup('shield')) {
    for (const o of obstacles) {
      if (o.type === 'chicken') continue; // chickens don't kill
      const hitbox = getObstacleHitbox(o);
      const dinoBox = dino.ducking
        ? { x: dino.x+4, y: groundY - dino.h*0.55 + 2, w: dino.w*1.35, h: dino.h*0.5 }
        : { x: dino.x+4, y: dino.y+4, w: dino.w-8, h: dino.h-8 };
      if (rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h, hitbox.x,hitbox.y,hitbox.w,hitbox.h)) {
        killDino();
        return;
      }
    }
  } else if (hasPowerup('shield')) {
    // Shield absorbs one hit
    for (const o of obstacles) {
      const hitbox = getObstacleHitbox(o);
      const dinoBox = dino.ducking
        ? { x: dino.x+4, y: groundY - dino.h*0.55 + 2, w: dino.w*1.35, h: dino.h*0.5 }
        : { x: dino.x+4, y: dino.y+4, w: dino.w-8, h: dino.h-8 };
      if (rectsOverlap(dinoBox.x,dinoBox.y,dinoBox.w,dinoBox.h, hitbox.x,hitbox.y,hitbox.w,hitbox.h)) {
        // Break shield
        dino.powerups = dino.powerups.filter(p => {
          if (p.type === 'shield') { if(p.timerEl) p.timerEl.remove(); return false; }
          return true;
        });
        dino.shieldHits++;
        playSound('shield_break');
        showToast('🛡️ Shield absorbed the hit!', 1500);
        obstacles.splice(obstacles.indexOf(o), 1);
        // Check cactus dino unlock
        if (dino.shieldHits >= 10) unlockSkin('cactus');
        break;
      }
    }
  }

  // ─── RANDOM EVENTS ───
  updateEvents();

  // ─── PARTICLES ───
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.2;
    p.alpha -= 0.025;
    p.r *= 0.97;
  });
  particles = particles.filter(p => p.alpha > 0.02 && p.r > 0.2);

  // ─── SKIN UNLOCKS ───
  checkSkinUnlocks();

  // ─── ONLINE SCORE PUSH ───
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
    // Slow-mo effect
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

  // Run animation
  if (d.grounded && !d.ducking) {
    d.frameTimer++;
    if (d.frameTimer > 8) {
      d.frame = d.frame === 0 ? 1 : 0;
      d.frameTimer = 0;
    }
  }
}

function getObstacleHitbox(o) {
  if (o.type === 'ptero') return { x: o.x+8, y: o.y+6, w: o.w-16, h: o.h-8 };
  return { x: o.x+4, y: groundY - o.h + 2, w: o.w * o.count - 6, h: o.h - 2 };
}

// ─── AI UPDATE ───
function updateAI() {
  if (aiDino.dead) {
    aiDino.deadTimer--;
    if (aiDino.deadTimer <= 0) {
      aiDino.dead = false;
      aiDino.y = groundY - dino.h;
      aiDino.vy = 0;
      aiDino.grounded = true;
    }
    return;
  }

  updateDinoPhysics(aiDino);

  // AI decision: look ahead at obstacles
  const lookAhead = 180 + speed * 8;
  const threat = obstacles.find(o => {
    const ox = o.type === 'ptero' ? o.x : o.x;
    return ox > aiDino.x && ox - aiDino.x < lookAhead;
  });

  if (threat) {
    const dist = threat.x - aiDino.x;
    let shouldJump = false, shouldDuck = false;

    if (threat.type === 'ptero') {
      // Low ptero → jump, high ptero → duck
      const pteroMidY = threat.y + threat.h / 2;
      if (pteroMidY > groundY - dino.h * 0.7) shouldDuck = true;
      else shouldJump = true;
    } else {
      shouldJump = true;
    }

    // Personality modifiers
    if (aiDino.personality === 'clown' && Math.random() < 0.1) {
      shouldJump = !shouldJump; // clown sometimes does the wrong thing
    }
    if (aiDino.personality === 'nerd') {
      // Nerd is perfect but shows calculation text
      if (dist < 120 && shouldJump && aiDino.grounded && aiDino.jumpCount === 0) {
        aiJump();
      }
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

  // Taunts
  const now = Date.now();
  if (now - aiDino.lastTauntTime > CFG.AI_TAUNT_INTERVAL) {
    aiDino.lastTauntTime = now;
    const ahead = aiDino.x > dino.x;
    const taunts = ahead ? AI_TAUNTS_AHEAD : AI_TAUNTS_BEHIND;
    const msg = taunts[Math.floor(Math.random() * taunts.length)];
    showAIBubble(msg);
    if (!ahead) {
      aiBeatenCount++;
      if (aiBeatenCount >= 5) unlockSkin('corporate');
    }
  }
}

function aiJump() {
  if (aiDino.jumpCount < 2) {
    aiDino.vy = CFG.JUMP_FORCE * 0.9;
    aiDino.grounded = false;
    aiDino.jumpCount++;
  }
}

// ─── SPAWN FUNCTIONS ───
let lastObstacleX = 0;
let lastBoneX = 0;
let lastPowerupX = 0;

function spawnObstacles() {
  const rightmost = obstacles.reduce((m, o) => Math.max(m, o.x), -Infinity);
  if (rightmost < W * 1.2 && (obstacles.length === 0 || W - rightmost > CFG.OBSTACLE_MIN_GAP + Math.random() * 300)) {
    if (score < 5) return; // grace period at start

    const roll = Math.random();
    if (roll < 0.65) {
      // Cactus
      const count = Math.random() < 0.4 ? 2 : (Math.random() < 0.3 ? 3 : 1);
      const h = 40 + Math.random() * 40;
      obstacles.push({ type:'cactus', x: W + 60, y: groundY - h, w: 24, h, count });
    } else if (score > 30) {
      // Pterodactyl
      const heightFrac = CFG.PTERO_HEIGHTS[Math.floor(Math.random() * CFG.PTERO_HEIGHTS.length)];
      obstacles.push({
        type:'ptero',
        x: W + 60,
        y: groundY - dino.h * (2 - heightFrac),
        w: 60, h: 36,
      });
    }
  }

  // Event-specific obstacles
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
  // Remove existing of same type
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

  // Special activation effects
  if (type === 'jetpack') {
    showToast('🚀 JETPACK ACTIVATED! WOOOOOO!', 2000);
    dino.vy = CFG.JUMP_FORCE * 1.5;
  } else if (type === 'slowmo') {
    showToast('☕ Slow-Mo Coffee... wait why is everything so heavy?!', 2500);
  } else if (type === 'banana') {
    showToast('🍌 Banana Power! (Disclaimer: slippery)', 2000);
  } else if (type === 'shield') {
    showToast('🛡️ Shield activated!', 1500);
  } else if (type === 'magnet') {
    showToast('🧲 Magnet ON — and yes it also attracts trouble.', 2000);
  }
}

function hasPowerup(type) {
  return dino.powerups.some(p => p.type === type && Date.now() < p.endTime);
}

// ─── EVENTS ───
const RANDOM_EVENTS = [
  { type:'chicken',  name:'🐔 CHICKEN INVASION!',   msg:'Chickens have taken the highway!' },
  { type:'rave',     name:'🎉 RAVE MODE!',           msg:'The DJ dropped the beat (and your score)' },
  { type:'phone',    name:'📱 PHONE NOTIFICATION',   msg:'WhatsApp can wait. You\'re dying.' },
  { type:'tax',      name:'💸 TAX COLLECTION!',      msg:'The Cactus Government thanks you (-15%)' },
  { type:'gravity',  name:'🌀 GRAVITY GLITCH!',      msg:'Physics.exe has stopped working' },
];

function updateEvents() {
  if (currentEvent && Date.now() > eventEndTime) {
    // Tax event: subtract score
    if (currentEvent.type === 'tax') {
      score *= 0.85;
    }
    currentEvent = null;
    hideBanner();
  }

  if (!currentEvent && Math.round(score) > nextEventScore) {
    currentEvent = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    eventEndTime = Date.now() + 8000;
    nextEventScore = Math.round(score) + CFG.EVENT_MIN_SCORE + Math.random() * 120;
    showBanner(currentEvent.name);
    showToast(currentEvent.msg, 3000);
    if (currentEvent.type === 'rave') playSound('rave');
    else if (currentEvent.type === 'tax') showToast('💸 Score reduced by 15%!', 2000);
  }
}

// ─── SKIN UNLOCKS ───
function checkSkinUnlocks() {
  if (Math.round(score) >= 1000) unlockSkin('cool');
  if (noPoweupRun && Math.round(score) >= 500) unlockSkin('ninja');
  // Daily high score
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
    showToast(`🎉 Skin unlocked: ${s.name}!`, 3000);
    saveData();
  }
}

// ─── KILL / GAME OVER ───
function killDino() {
  if (dino.dead) return;
  dino.dead = true;
  gameState = 'dead';
  playSound('death');
  spawnDeathParticles(dino.x, dino.y);
  screenShake(8);

  // Clear powerups
  dino.powerups.forEach(p => { if(p.timerEl) p.timerEl.remove(); });
  dino.powerups = [];

  const roundedScore = Math.round(score);
  const isNewBest = roundedScore > bestScore;
  if (isNewBest) bestScore = roundedScore;
  bonesCollected += sessionBones;

  // Check for leaderboard
  const lb = getLeaderboard();
  const qualifies = lb.length < 10 || roundedScore > (lb[lb.length-1]?.score ?? 0);
  if (qualifies) {
    const name = localStorage.getItem('dinoplus_pname') || 'Anonymous';
    addLeaderboardEntry(name, roundedScore, activeSkin);
    if (isNewBest) showToast('🏆 New personal best!', 2000);
  }

  saveData();

  // Online: push death
  if (onlineMode) {
    pushOnlineScore(roundedScore, true);
  }

  // Delay to show death animation
  setTimeout(() => showGameOver(roundedScore, isNewBest), 700);
}

function showGameOver(sc, isNewBest) {
  document.getElementById('gameoverEmoji').textContent = isNewBest ? '🏆' : ['💀','😵','🦖','😤'][Math.floor(Math.random()*4)];
  document.getElementById('goScore').textContent = sc;
  document.getElementById('goBest').textContent  = bestScore;
  document.getElementById('goBones').textContent = bonesCollected;
  document.getElementById('goDist').textContent  = Math.floor(distancePx/100) + 'm';
  document.getElementById('funnyMsg').textContent = FUNNY_MSGS[Math.floor(Math.random()*FUNNY_MSGS.length)];
  showScreen('gameoverScreen');
}

function screenShake(intensity) {
  const wrapper = document.getElementById('gameWrapper');
  let s = 0;
  const shakeInterval = setInterval(() => {
    s++;
    const dx = (Math.random()-0.5) * intensity * (1 - s/10);
    const dy = (Math.random()-0.5) * intensity * (1 - s/10);
    wrapper.style.transform = `translate(${dx}px,${dy}px)`;
    if (s >= 10) {
      wrapper.style.transform = '';
      clearInterval(shakeInterval);
    }
  }, 30);
}

// ─────────────────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────────────────
function onJump() {
  initAudio();
  if (gameState === 'menu') { startGame('solo'); return; }
  if (gameState === 'dead') return;
  if (gameState !== 'playing') return;

  if (dino.ducking) { dino.ducking = false; return; }

  let maxJumps = 2;
  if (hasPowerup('banana') && Math.random() < 0.3) {
    // Slip! Funny side effect
    dino.x += (Math.random()-0.5) * 30;
    showToast('🍌 SLIPPED!', 1000);
    return;
  }

  if (dino.jumpCount < maxJumps) {
    const jumpMult = upgradeLevels.jump > 0 ? UPGRADES[1].effects[upgradeLevels.jump-1] : 1;
    dino.vy = CFG.JUMP_FORCE * jumpMult;
    dino.grounded = false;
    dino.jumpCount++;
    playSound('jump');
  }
}

function onDuck(pressed) {
  if (gameState !== 'playing') return;
  dino.ducking = pressed;
  if (pressed && !dino.grounded) {
    dino.vy += 3; // fast drop
  }
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
//  MAIN LOOP
// ─────────────────────────────────────────────────────────
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / (1000/CFG.FPS), 3);
  lastTime = ts;

  // Draw menu dino animation
  if (gameState === 'menu') {
    animateMenuDino();
  }

  if (gameState === 'playing' || gameState === 'dead') {
    update(dt);
    render();
  }

  animId = requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────────────────
//  MENU DINO ANIMATION
// ─────────────────────────────────────────────────────────
let menuDinoFrame = 0, menuDinoFrameTimer = 0;
function animateMenuDino() {
  const mc = document.getElementById('menuDinoCanvas');
  if (!mc) return;
  const mctx = mc.getContext('2d');
  mctx.clearRect(0, 0, mc.width, mc.height);
  menuDinoFrameTimer++;
  if (menuDinoFrameTimer > 10) { menuDinoFrame = menuDinoFrame === 0 ? 1 : 0; menuDinoFrameTimer = 0; }
  const mockDino = { w: CFG.DINO_W, h: CFG.DINO_H, skin: activeSkin, ducking: false, frame: menuDinoFrame };
  // Draw in context
  const savedCtx = ctx;
  ctx = mctx;
  drawDinoBody(70, 10, CFG.DINO_W, CFG.DINO_H, activeSkin, false, false, menuDinoFrame);
  ctx = savedCtx;
}

// ─────────────────────────────────────────────────────────
//  GAME FLOW
// ─────────────────────────────────────────────────────────
function startGame(mode) {
  initAudio();
  gameState = 'playing';

  // Reset state
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
  document.getElementById('powerupBar').innerHTML = '';
  document.getElementById('gameWrapper').style.background = '#87CEEB';

  // Player
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

  // Free shield from upgrade
  if (upgradeLevels.shield > 0) {
    activatePowerup('shield');
  }

  // AI rival (only in solo mode)
  if (mode === 'solo') {
    const personalities = ['rival','clown','nerd','sleeper'];
    aiDino.personality = personalities[Math.floor(Math.random() * personalities.length)];
    const names = { rival:'RivalRex', clown:'ChaosRex', nerd:'Dino3000', sleeper:'ZombieRex' };
    aiDino.name = names[aiDino.personality];
    aiDino.active = true;
    aiDino.dead = false;
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
}

function restartGame() {
  showScreen('playing');
  if (onlineMode) {
    startOnlineGame();
  } else {
    startGame('solo');
  }
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
//  FIREBASE ONLINE MULTIPLAYER
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
  const name = document.getElementById('playerNameInput').value.trim() || 'Anonymous';
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
      showStatus('❌ Error creating room: ' + err.message, 'danger');
    });
  });
}

function joinRoom() {
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
  const name = document.getElementById('playerNameInput').value.trim() || 'Anonymous';
  if (!code) { showStatus('Enter a room code!', 'warning'); return; }
  if (name) localStorage.setItem('dinoplus_pname', name);

  waitForFirebase(() => {
    const db = window._db;
    const ref = window._fbRef;
    const get = window._fbGet;
    const update = window._fbUpdate;
    const onValue = window._fbOnValue;

    myPlayerId = generatePlayerId();
    isHost = false;

    const rRef = ref(db, `dinoRooms/${code}`);
    get(rRef).then(snap => {
      if (!snap.exists()) { showStatus('❌ Room not found!', 'danger'); return; }
      const data = snap.val();
      if (data.status === 'playing') { showStatus('❌ Game already started!', 'danger'); return; }
      const playerCount = Object.keys(data.players || {}).length;
      if (playerCount >= 4) { showStatus('❌ Room is full (max 4 players)!', 'danger'); return; }

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
    if (!snap.exists()) {
      showToast('Room was deleted.', 2000);
      leaveRoom(); return;
    }
    const data = snap.val();
    onlinePlayers = data.players || {};
    updateRoomLobbyUI(data);

    // Host starts → all guests start
    if (data.status === 'playing' && gameState !== 'playing') {
      startOnlineRun();
    }

    // Update online scoreboard in-game
    if (gameState === 'playing' && onlineMode) {
      updateOnlineScoreboard();
    }
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
      ${p.host ? '<span class="player-host-badge">HOST</span>' : ''}
      ${pid === myPlayerId ? '<span style="color:#9ca3af;font-size:.7rem">(you)</span>' : ''}
    `;
    list.appendChild(el);
  });

  // Host controls
  if (isHost) {
    const count = Object.keys(players).length;
    const btn = document.getElementById('startOnlineBtn');
    if (btn) {
      btn.disabled = count < 2;
      btn.textContent = count < 2 ? '⏳ Waiting for players...' : `▶ Start Game (${count} players)`;
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
  showToast('📋 Room code copied!', 1500);
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
  aiDino.active = false; // no AI in real online mode
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
  const sorted = Object.entries(onlinePlayers)
    .sort((a,b) => b[1].score - a[1].score);
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
    // If host, delete room
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
  showToast('👋 Left the room.', 1500);
}

// ─────────────────────────────────────────────────────────
//  UI HELPERS
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
    // Show touch controls on mobile
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

// ─── UPGRADES UI ───
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
  if (getTotalBones() < cost) { showToast('❌ Not enough bones!'); return; }
  bonesCollected -= cost;
  if (bonesCollected < 0) { sessionBones += bonesCollected; bonesCollected = 0; }
  upgradeLevels[id] = level + 1;
  saveData();
  showToast(`✅ ${u.name} upgraded to level ${level+1}!`);
  renderUpgrades();
}
window.buyUpgrade = buyUpgrade;

// ─── SKINS UI ───
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
      <div class="skin-status">${isActive ? '✅ Active' : s.unlocked ? 'Unlocked' : '🔒 ' + s.unlockDesc}</div>
    `;
    if (s.unlocked) {
      card.onclick = () => { activeSkin = s.id; dino.skin = s.id; saveData(); renderSkins(); };
    }
    grid.appendChild(card);
    // Draw preview
    const savedCtx = ctx;
    ctx = sc.getContext('2d');
    drawDinoBody(5, 2, 40, 46, s.id, false, false, 0);
    ctx = savedCtx;
  });
}

// ─── LEADERBOARD UI ───
function renderLeaderboard() {
  const lb = getLeaderboard();
  const el = document.getElementById('leaderboardList');
  el.innerHTML = '';
  if (!lb.length) {
    el.innerHTML = '<div class="text-muted text-center">No scores yet. Be the first!</div>';
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

// ─── CANVAS HELPERS ───
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

// ─────────────────────────────────────────────────────────
//  MENU STARS
// ─────────────────────────────────────────────────────────
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
//  BOOT SEQUENCE
// ─────────────────────────────────────────────────────────
const LOAD_STEPS = [
  'Waking up the dinosaur...',
  'Loading cactus database...',
  'Calculating escape velocity...',
  'Teaching AI to cheat...',
  'Applying silly physics...',
  'Connecting to Cactus Government...',
  'Calibrating bone collector...',
  'Almost done (probably)...',
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

// ─── Global button wires ───
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

// Add inline style for bone pop animation
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes bonePop {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-40px); opacity: 0; }
}
`;
document.head.appendChild(styleEl);

// Boot!
boot();
