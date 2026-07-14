"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  BALANCE HOLO v12.0 — Terminal holographique / panneau de contrôle spatial
//  Auteur   : Christus
//  Concept  : Interface de surveillance de compte style "salle de contrôle".
//             TOTALEMENT different du coffre-fort mécanique (v11).
//             Layout : panneau gauche radar + bio-scan | centre: données HEX |
//                      droite: barres de signal + stats verticales
//  Canvas   : 1500 × 720 px
//  20 thèmes inédits — zéro émoji, zéro ressemblance avec les versions précédentes
// ═══════════════════════════════════════════════════════════════════════════════

const fs     = require("fs-extra");
const path   = require("path");
const axios  = require("axios");
const moment = require("moment-timezone");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
  const cv = require("canvas");
  loadImage    = cv.loadImage;
  createCanvas = cv.createCanvas;
  registerFont = cv.registerFont;
  canvasAvailable = true;
} catch (e) { console.error("Canvas indisponible :", e.message); }

let fontsLoaded = false;
function ensureFonts() {
  if (fontsLoaded || !canvasAvailable || !registerFont) return;
  fontsLoaded = true;
  try {
    const fd = path.join(__dirname, "assets", "font");
    if (!fs.existsSync(fd)) return;
    const ff = [
      ["JetBrainsMono-Bold.ttf",    "HF", "bold"],
      ["JetBrainsMono-Regular.ttf", "HF", "normal"],
      ["BeVietnamPro-Bold.ttf",     "HF", "bold"],
      ["BeVietnamPro-Regular.ttf",  "HF", "normal"],
      ["NotoSans-Bold.ttf",         "HF", "bold"],
    ];
    for (const [f, fam, w] of ff) {
      try {
        const fp = path.join(fd, f);
        if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
      } catch (_) {}
    }
  } catch (_) {}
}

const FB_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

// ─── Économie ──────────────────────────────────────────────────────────────────
const TIERS = [
  { name:"Starter", min:0,       max:999,      color:"#CD7F32", sym:"[I]",   mult:1.0 },
  { name:"Rookie",  min:1_000,   max:4_999,    color:"#C0C0C0", sym:"[II]",  mult:1.1 },
  { name:"Pro",     min:5_000,   max:19_999,   color:"#FFD700", sym:"[III]", mult:1.2 },
  { name:"Elite",   min:20_000,  max:49_999,   color:"#E8E8FF", sym:"[IV]",  mult:1.3 },
  { name:"Master",  min:50_000,  max:99_999,   color:"#00FFFF", sym:"[V]",   mult:1.5 },
  { name:"Legend",  min:100_000, max:499_999,  color:"#FF00FF", sym:"[VI]",  mult:2.0 },
  { name:"GOD",     min:500_000, max:Infinity,  color:"#FF2020", sym:"[VII]", mult:3.0 },
];
const TAXES = [
  { max:1_000,    rate:2  }, { max:10_000,  rate:5  }, { max:50_000,  rate:8  },
  { max:100_000,  rate:10 }, { max:500_000, rate:12 }, { max:Infinity, rate:15 },
];

function fmt(n) {
  if (n == null || isNaN(n)) return "$0";
  n = Number(n); if (!isFinite(n)) return "$MAX";
  const S = [{v:1e18,s:"Qi"},{v:1e15,s:"Qa"},{v:1e12,s:"T"},{v:1e9,s:"B"},{v:1e6,s:"M"},{v:1e3,s:"K"}];
  const sc = S.find(s => Math.abs(n) >= s.v);
  if (sc) return `${n<0?"-":""}$${(Math.abs(n)/sc.v).toFixed(2).replace(/\.00$/,"")}${sc.s}`;
  const p = Math.abs(n).toFixed(2).split(".");
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n<0?"-":""}$${p.join(".")}`;
}
function getTier(b) {
  const t = TIERS.find(t => (b||0) >= t.min && (b||0) <= t.max) || TIERS[0];
  const idx = TIERS.indexOf(t);
  const next = TIERS[idx+1] || null;
  const prog = t.max === Infinity ? 100 : Math.min(100, ((b-t.min)/(t.max-t.min))*100);
  return { ...t, next, prog, idx };
}
function calcTax(a) {
  const {rate} = TAXES.find(r => a <= r.max) || TAXES.at(-1);
  const tax = Math.ceil(a*rate/100);
  return { rate, tax, total: a+tax };
}
function txID() { return ("TX"+Date.now().toString(36)+Math.random().toString(36).substr(2,5)).toUpperCase(); }
function seededRng(seed) {
  let s = typeof seed === "string" ? [...seed].reduce((a,c)=>(a*31+c.charCodeAt(0))%2147483647,1) : (Math.abs(seed)||1);
  return () => { s=(s*16807)%2147483647; return (s-1)/2147483646; };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  20 THÈMES "TERMINAL HOLOGRAPHIQUE"
// ═══════════════════════════════════════════════════════════════════════════════
const THEMES = {
  // ── COSMOS ────────────────────────────────────────────────────────────────
  ion_drive:    { name:"Ion Drive",     bg:"#020510", panel:"#06091A", scan:"#3366FF", scanGlow:"#5588FF", primary:"#4477FF", accent:"#88AAFF", data:"#AABBFF", dim:"#223366", text:"#D0DDFF", alert:"#FF5533" },
  xenon_arc:    { name:"Xenon Arc",     bg:"#000A06", panel:"#001814", scan:"#00CC66", scanGlow:"#00FF88", primary:"#00DD77", accent:"#88FFCC", data:"#CCFFE8", dim:"#004422", text:"#D0FFE8", alert:"#FF4422" },
  pulsar_red:   { name:"Pulsar Red",    bg:"#0E0202", panel:"#1A0404", scan:"#FF2244", scanGlow:"#FF5566", primary:"#FF3355", accent:"#FF8899", data:"#FFCCCC", dim:"#440011", text:"#FFE0E0", alert:"#FFEE00" },
  nebula_gold:  { name:"Nebula Gold",   bg:"#0A0800", panel:"#180E00", scan:"#CC8800", scanGlow:"#FFBB00", primary:"#EEA800", accent:"#FFD066", data:"#FFF0AA", dim:"#442200", text:"#FFF8E0", alert:"#FF4400" },
  dark_plasma:  { name:"Dark Plasma",   bg:"#08000E", panel:"#12001E", scan:"#AA00FF", scanGlow:"#CC44FF", primary:"#BB22FF", accent:"#DD88FF", data:"#EECCFF", dim:"#330055", text:"#F0E0FF", alert:"#FF0066" },
  // ── CYBER ─────────────────────────────────────────────────────────────────
  matrix_core:  { name:"Matrix Core",   bg:"#000800", panel:"#001200", scan:"#00FF41", scanGlow:"#55FF66", primary:"#00EE33", accent:"#88FF99", data:"#CCFFCC", dim:"#003311", text:"#E8FFE8", alert:"#FF2200" },
  ghost_blue:   { name:"Ghost Blue",    bg:"#010812", panel:"#020E1E", scan:"#00AADD", scanGlow:"#00DDFF", primary:"#00BBEE", accent:"#77DDFF", data:"#CCEEEE", dim:"#003355", text:"#DDEEFF", alert:"#FF6600" },
  rust_circuit: { name:"Rust Circuit",  bg:"#100600", panel:"#1C0A00", scan:"#FF5500", scanGlow:"#FF8833", primary:"#EE6600", accent:"#FFAA55", data:"#FFE0BB", dim:"#441100", text:"#FFF0E0", alert:"#FFFF00" },
  ice_protocol: { name:"Ice Protocol",  bg:"#020810", panel:"#04101C", scan:"#44AAFF", scanGlow:"#88CCFF", primary:"#66BBFF", accent:"#AADDFF", data:"#DDEEFF", dim:"#112244", text:"#EEEEFF", alert:"#FF4444" },
  binary_pink:  { name:"Binary Pink",   bg:"#0C0006", panel:"#180010", scan:"#FF44AA", scanGlow:"#FF88CC", primary:"#FF55BB", accent:"#FFAADD", data:"#FFDDEE", dim:"#441133", text:"#FFE8F8", alert:"#FFEE00" },
  // ── RETRO TERMINAL ────────────────────────────────────────────────────────
  amber_crt:    { name:"Amber CRT",     bg:"#080600", panel:"#140C00", scan:"#FF9900", scanGlow:"#FFBB44", primary:"#EE8800", accent:"#FFCC55", data:"#FFE8AA", dim:"#442200", text:"#FFF0CC", alert:"#FF0000" },
  green_crt:    { name:"Green CRT",     bg:"#020A02", panel:"#041404", scan:"#33FF33", scanGlow:"#66FF66", primary:"#22EE22", accent:"#88FF88", data:"#CCFFCC", dim:"#114411", text:"#E8FFE8", alert:"#FF3300" },
  phosphor_bl:  { name:"Phosphor Blue", bg:"#020408", panel:"#040810", scan:"#4488FF", scanGlow:"#7799FF", primary:"#5577EE", accent:"#99BBFF", data:"#CCDEFF", dim:"#112244", text:"#E8EEFF", alert:"#FF5500" },
  red_terminal: { name:"Red Terminal",  bg:"#0A0000", panel:"#140000", scan:"#FF2200", scanGlow:"#FF5533", primary:"#EE1100", accent:"#FF7755", data:"#FFCCBB", dim:"#330000", text:"#FFE8E0", alert:"#FFFF00" },
  teal_sys:     { name:"Teal System",   bg:"#020C0A", panel:"#041810", scan:"#00BBAA", scanGlow:"#00DDCC", primary:"#00AAAA", accent:"#55DDCC", data:"#AAEEDD", dim:"#003333", text:"#DAFFFF", alert:"#FF5500" },
  // ── EXOTIC ────────────────────────────────────────────────────────────────
  crimson_net:  { name:"Crimson Net",   bg:"#0C0004", panel:"#180008", scan:"#FF0055", scanGlow:"#FF4488", primary:"#EE1166", accent:"#FF77AA", data:"#FFCCDD", dim:"#440011", text:"#FFE0EE", alert:"#FFCC00" },
  aurora_sys:   { name:"Aurora System", bg:"#030A06", panel:"#051410", scan:"#00FFAA", scanGlow:"#55FFCC", primary:"#00EE99", accent:"#88FFD0", data:"#CCFFE8", dim:"#003322", text:"#E0FFF5", alert:"#FF5500" },
  violet_holo:  { name:"Violet Holo",   bg:"#060008", panel:"#0E0012", scan:"#9944FF", scanGlow:"#BB77FF", primary:"#AA55FF", accent:"#CC99FF", data:"#EEE0FF", dim:"#330055", text:"#F0E8FF", alert:"#FF4400" },
  chrome_sys:   { name:"Chrome System", bg:"#060808", panel:"#0C1010", scan:"#AABBCC", scanGlow:"#CCDDE8", primary:"#BBCCDD", accent:"#DDEEFF", data:"#EEEEFF", dim:"#334455", text:"#F0F4F8", alert:"#FF5500" },
  solar_flare:  { name:"Solar Flare",   bg:"#0A0600", panel:"#140A00", scan:"#FFAA00", scanGlow:"#FFCC44", primary:"#FF9900", accent:"#FFCC66", data:"#FFF0BB", dim:"#442200", text:"#FFFBE8", alert:"#FF2200" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════
function rr(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = [r,r,r,r];
  const [tl,tr,br,bl] = r;
  ctx.beginPath();
  ctx.moveTo(x+tl,y); ctx.lineTo(x+w-tr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+tr);
  ctx.lineTo(x+w,y+h-br); ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
  ctx.lineTo(x+bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-bl);
  ctx.lineTo(x,y+tl); ctx.quadraticCurveTo(x,y,x+tl,y); ctx.closePath();
}

function T(ctx, s, x, y, sz, color, {align="left",weight="bold",glow=null,alpha=1,blur=12}={}) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${sz}px HF, "JetBrains Mono", "Courier New", monospace`;
  ctx.textAlign = align; ctx.textBaseline = "middle";
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }
  ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
}

// ─── Fond du terminal ─────────────────────────────────────────────────────────
function drawHoloBg(ctx, W, H, t, seed) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg); g.addColorStop(0.5, t.panel); g.addColorStop(1, t.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Grille hexagonale fine (style terminal)
  ctx.save();
  ctx.strokeStyle = t.scan + "18"; ctx.lineWidth = 0.6;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  // Points aux intersections de la grille
  ctx.save(); ctx.fillStyle = t.scan; ctx.globalAlpha = 0.07;
  for (let x = 0; x < W; x += 40)
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI*2); ctx.fill();
    }
  ctx.restore();

  // Scanlines CRT légères
  ctx.save(); ctx.fillStyle = "#000"; ctx.globalAlpha = 0.06;
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.restore();

  // Particules de données flottantes
  const rng = seededRng(seed);
  ctx.save();
  for (let i = 0; i < 120; i++) {
    const px = rng() * W, py = rng() * H, pr = rng() * 1.5 + 0.3;
    ctx.fillStyle = t.data; ctx.globalAlpha = rng() * 0.18 + 0.04;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

// ─── Panel (carte) avec bordure holographique ─────────────────────────────────
function drawHoloPanel(ctx, x, y, w, h, t, { corner=16, glow=true }={}) {
  // Ombre
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 4;
  ctx.fillStyle = t.panel + "EE"; rr(ctx, x, y, w, h, corner); ctx.fill(); ctx.restore();

  // Fond interne
  const bg = ctx.createLinearGradient(x, y, x+w, y+h);
  bg.addColorStop(0, t.panel); bg.addColorStop(1, t.bg);
  ctx.fillStyle = bg; rr(ctx, x, y, w, h, corner); ctx.fill();

  // Bordure lumineuse
  ctx.save();
  if (glow) { ctx.shadowColor = t.scan; ctx.shadowBlur = 14; }
  ctx.strokeStyle = t.scan + "88"; ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, corner); ctx.stroke(); ctx.restore();

  // Bordure intérieure plus fine
  ctx.save(); ctx.strokeStyle = t.primary + "30"; ctx.lineWidth = 0.8;
  rr(ctx, x+4, y+4, w-8, h-8, corner-2); ctx.stroke(); ctx.restore();

  // Coins accent (L-shapes)
  const CL = 20;
  [[x+10,y+10,1,1],[x+w-10,y+10,-1,1],[x+10,y+h-10,1,-1],[x+w-10,y+h-10,-1,-1]].forEach(([cx,cy,dx,dy]) => {
    ctx.save(); ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    ctx.shadowColor = t.scanGlow; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(cx,cy+dy*CL); ctx.lineTo(cx,cy); ctx.lineTo(cx+dx*CL,cy); ctx.stroke(); ctx.restore();
  });
}

// ─── RADAR circulaire (remplace le cadran de combinaison) ─────────────────────
function drawRadar(ctx, cx, cy, R, tier, t, seed) {
  // Anneaux concentriques (grille radar)
  [1.0, 0.75, 0.5, 0.25].forEach((f, i) => {
    ctx.save();
    ctx.strokeStyle = t.scan + ["55","44","33","22"][i]; ctx.lineWidth = [1.5,1,0.8,0.6][i];
    if (i === 0) { ctx.shadowColor = t.scan; ctx.shadowBlur = 6; }
    ctx.beginPath(); ctx.arc(cx, cy, R*f, 0, Math.PI*2); ctx.stroke(); ctx.restore();
  });

  // Lignes croisées du radar (+ diagonales)
  ctx.save(); ctx.strokeStyle = t.scan + "30"; ctx.lineWidth = 0.8;
  for (let a = 0; a < Math.PI; a += Math.PI/4) {
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R, cy+Math.sin(a)*R);
    ctx.lineTo(cx-Math.cos(a)*R, cy-Math.sin(a)*R); ctx.stroke();
  }
  ctx.restore();

  // Secteur rempli (balayage) correspondant à la progression du palier
  const prog = tier.prog / 100;
  const sweepAngle = prog * Math.PI * 2;
  const startA = -Math.PI / 2;
  ctx.save();
  const sweepG = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  sweepG.addColorStop(0, t.scan + "44"); sweepG.addColorStop(1, t.scan + "08");
  ctx.fillStyle = sweepG;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, startA, startA + sweepAngle); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Ligne de balayage (aiguille du radar)
  const needleEnd = startA + sweepAngle;
  ctx.save();
  const ng = ctx.createLinearGradient(cx, cy, cx+Math.cos(needleEnd)*R, cy+Math.sin(needleEnd)*R);
  ng.addColorStop(0, t.scan + "AA"); ng.addColorStop(1, t.scan);
  ctx.strokeStyle = ng; ctx.lineWidth = 2.5;
  ctx.shadowColor = t.scanGlow; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(needleEnd)*R, cy+Math.sin(needleEnd)*R); ctx.stroke();
  ctx.restore();

  // "Blips" radar (points clignotants seedés)
  const rng = seededRng(seed + "_radar");
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const a = rng() * Math.PI*2;
    const r = rng() * R * 0.85;
    const bx = cx + Math.cos(a)*r, by = cy + Math.sin(a)*r;
    const inSweep = ((a - startA + Math.PI*4) % (Math.PI*2)) < sweepAngle;
    ctx.fillStyle = inSweep ? t.accent : t.dim;
    ctx.globalAlpha = inSweep ? 0.9 : 0.35;
    ctx.shadowColor = t.scanGlow; ctx.shadowBlur = inSweep ? 8 : 2;
    ctx.beginPath(); ctx.arc(bx, by, inSweep ? 4 : 2.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Centre du radar
  ctx.save();
  ctx.fillStyle = t.scan; ctx.shadowColor = t.scanGlow; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#FFF"; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(cx-1, cy-1, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ─── Bio-scan : avatar avec grille de scan et lignes de lecture ───────────────
async function drawBioScan(ctx, avatarImg, cx, cy, R, t) {
  // Halo de scan
  const hg = ctx.createRadialGradient(cx, cy, R-10, cx, cy, R+28);
  hg.addColorStop(0, t.scan + "55"); hg.addColorStop(1, "transparent");
  ctx.save(); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, R+28, 0, Math.PI*2); ctx.fill(); ctx.restore();

  // Image avatar
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, cx-R, cy-R, R*2, R*2);
  else {
    ctx.fillStyle = t.panel; ctx.fillRect(cx-R, cy-R, R*2, R*2);
    T(ctx, "?", cx, cy, R*0.7, t.scan, { align:"center", weight:"900" });
  }
  ctx.restore();

  // Surcouche "scan" : lignes horizontales espacées
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
  ctx.fillStyle = t.scan + "18";
  for (let y = cy-R; y < cy+R; y += 6) ctx.fillRect(cx-R, y, R*2, 3);
  ctx.restore();

  // Ligne de scan animée (barre horizontale fixe — seedée)
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
  const scanY = cy - R + (R * 0.6);
  const scanG = ctx.createLinearGradient(cx-R, scanY, cx+R, scanY+4);
  scanG.addColorStop(0, "transparent"); scanG.addColorStop(0.5, t.scan + "EE"); scanG.addColorStop(1, "transparent");
  ctx.fillStyle = scanG; ctx.fillRect(cx-R, scanY, R*2, 4);
  ctx.restore();

  // Anneaux de bio-lock
  [R+2, R+12, R+22].forEach((r2, i) => {
    ctx.save();
    ctx.strokeStyle = t.scan + ["CC","66","33"][i]; ctx.lineWidth = [2.5,1.5,0.8][i];
    ctx.shadowColor = t.scanGlow; ctx.shadowBlur = [14,6,2][i];
    ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI*2); ctx.stroke(); ctx.restore();
  });

  // Cibles aux 4 coins (réticule)
  [[-R*0.7,-R*0.7],[R*0.7,-R*0.7],[-R*0.7,R*0.7],[R*0.7,R*0.7]].forEach(([dx,dy]) => {
    const tx = cx+dx, ty = cy+dy;
    ctx.save(); ctx.strokeStyle = t.accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(tx-10,ty); ctx.lineTo(tx+10,ty);
    ctx.moveTo(tx,ty-10); ctx.lineTo(tx,ty+10); ctx.stroke(); ctx.restore();
  });
}

// ─── Bloc de données HEX (chaîne de caractères pseudo-hex) ────────────────────
function drawHexBlock(ctx, x, y, w, seed, t, lines=4) {
  const rng = seededRng(seed);
  const chars = "0123456789ABCDEF";
  ctx.save(); ctx.globalAlpha = 0.22;
  ctx.font = `700 11px HF, "JetBrains Mono", monospace`;
  ctx.fillStyle = t.data; ctx.textBaseline = "top";
  for (let l = 0; l < lines; l++) {
    let row = "";
    const cols = Math.floor(w / 8);
    for (let c = 0; c < cols; c++) row += chars[Math.floor(rng()*16)];
    ctx.fillText(row, x, y + l*15);
  }
  ctx.restore();
}

// ─── Barre de signal verticale (style EQ audio) ──────────────────────────────
function drawSignalBars(ctx, x, y, w, h, value, maxVal, t, label) {
  const COLS = 10;
  const GAP  = 3;
  const colW = (w - GAP*(COLS-1)) / COLS;
  const filled = Math.round((value/maxVal) * COLS);

  for (let i = 0; i < COLS; i++) {
    const bx = x + i*(colW+GAP);
    const barH = h * (0.3 + (i/COLS)*0.7);
    const barY = y + h - barH;
    const isFilled = i < filled;
    const colColor = i >= COLS*0.7 ? t.alert : i >= COLS*0.4 ? t.accent : t.scan;

    ctx.save();
    ctx.fillStyle = isFilled ? colColor : t.dim + "50";
    ctx.globalAlpha = isFilled ? 0.9 : 0.3;
    if (isFilled) { ctx.shadowColor = colColor; ctx.shadowBlur = 6; }
    ctx.fillRect(bx, barY, colW, barH);
    ctx.restore();
  }

  T(ctx, label, x + w/2, y + h + 16, 10, t.dim, { align:"center", weight:"700" });
}

// ─── Stat row style terminal (ligne de donnée mono) ───────────────────────────
function drawStatRow(ctx, x, y, w, key, val, t, valColor=null) {
  // Fond alterné subtil
  ctx.save(); ctx.fillStyle = t.scan + "0A"; ctx.fillRect(x, y-1, w, 24); ctx.restore();
  // Tiret de connexion entre clé et valeur
  T(ctx, key, x+10, y+12, 12, t.dim, { weight:"700" });
  T(ctx, ".", x+10+ctx.measureText?.(key)??0, y+12, 12, t.dim, { weight:"700", alpha:0.3 });
  T(ctx, val, x+w-10, y+12, 13, valColor || t.data, { align:"right", weight:"800" });
  // Ligne de séparation pointillée
  ctx.save(); ctx.strokeStyle = t.dim + "50"; ctx.lineWidth = 0.5; ctx.setLineDash([3,5]);
  ctx.beginPath(); ctx.moveTo(x, y+24); ctx.lineTo(x+w, y+24); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

// ─── Grande valeur du solde (style "readout" de terminal) ──────────────────────
function drawBalanceReadout(ctx, x, y, w, balance, t) {
  const str = fmt(balance);
  const CELL_W = 58, CELL_H = 80, GAP = 6;
  const chars = str.split("");
  const totalW = chars.reduce((acc, ch) => acc + (ch.match(/[$,.]/) ? 28+GAP : CELL_W+GAP), 0) - GAP;
  let cx = x + (w - totalW) / 2;

  for (const ch of chars) {
    const isSep = ch.match(/[$,.]/);
    const cw = isSep ? 28 : CELL_W;

    if (!isSep) {
      // Cellule terminal (fond + bordure)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.5)"; rr(ctx, cx, y, cw, CELL_H, 4); ctx.fill();
      ctx.strokeStyle = t.scan + "66"; ctx.lineWidth = 1.5;
      ctx.shadowColor = t.scan; ctx.shadowBlur = 8;
      rr(ctx, cx, y, cw, CELL_H, 4); ctx.stroke();
      ctx.restore();

      // Tirets de "LCD" en haut et bas
      ctx.save(); ctx.strokeStyle = t.scan + "30"; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(cx+6, y+CELL_H*0.45); ctx.lineTo(cx+cw-6, y+CELL_H*0.45); ctx.stroke();
      ctx.restore();
    }

    // Caractère
    const fSize = isSep ? 30 : 46;
    ctx.save();
    const cg = ctx.createLinearGradient(cx, y, cx, y+CELL_H);
    cg.addColorStop(0, t.accent); cg.addColorStop(0.5, t.data); cg.addColorStop(1, t.scan);
    ctx.font = `900 ${fSize}px HF, "JetBrains Mono", monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = t.scanGlow; ctx.shadowBlur = 20;
    ctx.fillStyle = cg; ctx.fillText(ch, cx + cw/2, y + CELL_H/2);
    ctx.restore();

    cx += cw + GAP;
  }
}

// ─── Header du terminal ────────────────────────────────────────────────────────
function drawTerminalHeader(ctx, W, t, themeName, sym) {
  // Bande header
  ctx.save(); ctx.fillStyle = t.panel + "F0"; ctx.fillRect(0, 0, W, 68); ctx.restore();

  // Separateur bas
  const hl = ctx.createLinearGradient(0, 67, W, 67);
  hl.addColorStop(0,"transparent"); hl.addColorStop(0.5, t.scan); hl.addColorStop(1,"transparent");
  ctx.save(); ctx.strokeStyle = hl; ctx.lineWidth = 1.5;
  ctx.shadowColor = t.scan; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(0,67); ctx.lineTo(W,67); ctx.stroke(); ctx.restore();

  // "Pastilles" de système (rouge/jaune/vert style macOS terminal)
  [[44,34,"#FF5F57"],[74,34,"#FFBD2E"],[104,34,"#28C840"]].forEach(([px,py,col]) => {
    ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI*2); ctx.fill(); ctx.restore();
  });

  // Titre central
  ctx.save();
  const hg = ctx.createLinearGradient(W*0.25, 0, W*0.75, 0);
  hg.addColorStop(0, t.scan); hg.addColorStop(0.5, t.accent); hg.addColorStop(1, t.scan);
  ctx.font = "900 24px HF, 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = t.scanGlow; ctx.shadowBlur = 18;
  ctx.fillStyle = hg; ctx.fillText(`${sym}  TERMINAL FINANCIER  ${sym}`, W/2, 34);
  ctx.restore();

  // Infos système droite
  const now = moment().tz("Asia/Dhaka").format("DD.MM.YYYY  HH:mm:ss");
  T(ctx, `SYS ${themeName.toUpperCase()}  >>  ${now}`, W-28, 34, 10, t.dim, { align:"right", weight:"700" });
}

// ─── Chargement avatar ────────────────────────────────────────────────────────
async function loadAvatar(uid, name) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${uid}/picture?width=400&height=400&access_token=${FB_TOKEN}`,
      { responseType:"arraybuffer", timeout:8000 }
    );
    return await loadImage(Buffer.from(res.data));
  } catch (_) {
    const cv = createCanvas(400,400);
    const c  = cv.getContext("2d");
    const rng = seededRng(uid || "0");
    c.fillStyle = `hsl(${Math.round(rng()*360)},70%,30%)`; c.fillRect(0,0,400,400);
    c.fillStyle = "#FFF"; c.font = "bold 150px monospace";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText((name||"?").charAt(0).toUpperCase(), 200, 200);
    return await loadImage(cv.toBuffer());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS PRINCIPAL — 1500 × 720
//
//  Layout 3 colonnes :
//  ┌─────────────────────────────────────────────────────┐
//  │  HEADER TERMINAL (68px)                             │
//  ├──────────────┬──────────────────────┬───────────────┤
//  │  COL GAUCHE  │   COL CENTRE         │   COL DROITE  │
//  │  radar 260r  │   readout balance    │   barres sig  │
//  │  bioscan av  │   stats terminales   │   stat rows   │
//  │              │   hex blocks         │               │
//  └──────────────┴──────────────────────┴───────────────┘
// ═══════════════════════════════════════════════════════════════════════════════
const CW = 1500, CH = 720;
const PAD = 22;

async function buildCanvas(data, theme, avatarImg) {
  ensureFonts();
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

  const seed = String(data.uid);

  // ── 1. Fond ───────────────────────────────────────────────────────────────
  drawHoloBg(ctx, CW, CH, theme, seed);

  // ── 2. Header ─────────────────────────────────────────────────────────────
  drawTerminalHeader(ctx, CW, theme, theme.name, theme.sym);

  // ── Layout ────────────────────────────────────────────────────────────────
  const HEADER_H = 68;
  const BODY_Y   = HEADER_H + PAD;
  const BODY_H   = CH - BODY_Y - PAD;

  const COL_L_W  = 300;
  const COL_R_W  = 280;
  const COL_C_W  = CW - PAD*2 - COL_L_W - COL_R_W - PAD*2;

  const COL_L_X  = PAD;
  const COL_C_X  = COL_L_X + COL_L_W + PAD;
  const COL_R_X  = COL_C_X + COL_C_W + PAD;

  // ── 3. Panneau gauche ─────────────────────────────────────────────────────
  drawHoloPanel(ctx, COL_L_X, BODY_Y, COL_L_W, BODY_H, theme);

  // Label col gauche
  T(ctx, "[  BIO-SCAN  ]", COL_L_X + COL_L_W/2, BODY_Y + 20, 10, theme.dim, { align:"center", weight:"700" });

  // Bio-scan (avatar)
  const tier   = getTier(data.balance);
  const AV_CX  = COL_L_X + COL_L_W/2;
  const AV_CY  = BODY_Y + 30 + 90;
  const AV_R   = 82;
  await drawBioScan(ctx, avatarImg, AV_CX, AV_CY, AV_R, theme);

  // Nom et palier
  ctx.save();
  ctx.font = "bold 18px HF, 'JetBrains Mono', monospace";
  let dispName = data.name || "Utilisateur";
  while (ctx.measureText(dispName).width > COL_L_W - 30 && dispName.length > 2)
    dispName = dispName.slice(0,-1);
  if (dispName !== data.name) dispName += "~";
  ctx.restore();
  T(ctx, dispName, AV_CX, AV_CY + AV_R + 30, 17, theme.text, { align:"center", weight:"800" });
  T(ctx, `${tier.sym}  ${tier.name.toUpperCase()}`, AV_CX, AV_CY + AV_R + 54, 13, tier.color, { align:"center", weight:"700", glow:tier.color, blur:8 });

  // Radar en bas du panneau gauche
  const RADAR_CX = AV_CX;
  const RADAR_CY = BODY_Y + BODY_H - 120;
  const RADAR_R  = 88;
  T(ctx, "[  RADAR PALIER  ]", AV_CX, RADAR_CY - RADAR_R - 14, 9, theme.dim, { align:"center", weight:"700" });
  drawRadar(ctx, RADAR_CX, RADAR_CY, RADAR_R, tier, theme, seed);
  T(ctx, `${tier.prog.toFixed(1)}%  ->  ${tier.next?.name || "MAX"}`, AV_CX, RADAR_CY + RADAR_R + 16, 10, theme.accent, { align:"center", weight:"700", glow:theme.scan, blur:6 });

  // ── 4. Panneau central ────────────────────────────────────────────────────
  drawHoloPanel(ctx, COL_C_X, BODY_Y, COL_C_W, BODY_H, theme);

  // Label
  T(ctx, "[  READOUT FINANCIER  ]", COL_C_X + COL_C_W/2, BODY_Y + 20, 10, theme.dim, { align:"center", weight:"700" });

  // Grande valeur du solde
  drawBalanceReadout(ctx, COL_C_X + 10, BODY_Y + 38, COL_C_W - 20, data.balance, theme);

  // Bloc HEX décoratif
  drawHexBlock(ctx, COL_C_X + 16, BODY_Y + 134, COL_C_W - 32, seed + "_hex1", theme, 2);

  // Séparateur
  const SEP1_Y = BODY_Y + 168;
  ctx.save(); const sl = ctx.createLinearGradient(COL_C_X, SEP1_Y, COL_C_X+COL_C_W, SEP1_Y);
  sl.addColorStop(0,"transparent"); sl.addColorStop(0.5, theme.scan+"88"); sl.addColorStop(1,"transparent");
  ctx.strokeStyle = sl; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(COL_C_X+20, SEP1_Y); ctx.lineTo(COL_C_X+COL_C_W-20, SEP1_Y); ctx.stroke(); ctx.restore();

  // Stats en grille 2×3
  const STAT_Y0 = SEP1_Y + 14;
  const STAT_W  = (COL_C_W - 40 - 10) / 2;
  const STAT_H  = 62;
  const STAT_GAP= 10;
  const statItems = [
    { k:"RANG GLOBAL", v:`#${data.globalRank}`, c:theme.accent },
    { k:"TOP",         v:`${data.topPct}%`,     c:theme.scan  },
    { k:"MEMBRES",     v:String(data.totalUsers), c:theme.data },
    { k:"STREAK",      v:`${data.streak}J`,      c:tier.color  },
    { k:"MULTIPLICATEUR", v:`x${tier.mult}`,     c:theme.accent},
    { k:"TX PENDING",  v:"0",                    c:theme.dim   },
  ];
  statItems.forEach((s, i) => {
    const col = i%2, row = Math.floor(i/2);
    const sx = COL_C_X + 20 + col*(STAT_W+STAT_GAP);
    const sy = STAT_Y0 + row*(STAT_H+STAT_GAP);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, sx, sy, STAT_W, STAT_H, 6); ctx.fill();
    ctx.strokeStyle = theme.dim + "50"; ctx.lineWidth = 1;
    rr(ctx, sx, sy, STAT_W, STAT_H, 6); ctx.stroke(); ctx.restore();
    T(ctx, s.k, sx+10, sy+20, 9, theme.dim, { weight:"700" });
    T(ctx, s.v, sx+10, sy+STAT_H-18, 18, s.c, { weight:"900", glow:s.c, blur:8 });
  });

  // Bloc HEX bas
  const HEX2_Y = STAT_Y0 + 3*(STAT_H+STAT_GAP) + 10;
  drawHexBlock(ctx, COL_C_X + 16, HEX2_Y, COL_C_W - 32, seed + "_hex2", theme, 3);

  // Barre de progression palier (bas du panel centre)
  const BAR_Y  = BODY_Y + BODY_H - 46;
  const BAR_W  = COL_C_W - 40;
  const BAR_H2 = 18;
  const BAR_X  = COL_C_X + 20;
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.4)"; rr(ctx, BAR_X, BAR_Y, BAR_W, BAR_H2, 9); ctx.fill(); ctx.restore();
  ctx.save();
  const pg = ctx.createLinearGradient(BAR_X, BAR_Y, BAR_X+BAR_W, BAR_Y);
  pg.addColorStop(0, theme.scan); pg.addColorStop(1, theme.accent);
  ctx.shadowColor = theme.scanGlow; ctx.shadowBlur = 10; ctx.fillStyle = pg;
  rr(ctx, BAR_X, BAR_Y, Math.max(BAR_W*(tier.prog/100), 14), BAR_H2, 9); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = theme.scan + "66"; ctx.lineWidth = 1;
  rr(ctx, BAR_X, BAR_Y, BAR_W, BAR_H2, 9); ctx.stroke(); ctx.restore();
  T(ctx, `PROGRESSION  ${tier.prog.toFixed(1)}%  >>  ${tier.next ? fmt(tier.next.min - data.balance) + " RESTANTS" : "PALIER MAX"}`,
    BAR_X + BAR_W/2, BAR_Y + BAR_H2/2, 10, theme.bg, { align:"center", weight:"800" });

  // ── 5. Panneau droit ──────────────────────────────────────────────────────
  drawHoloPanel(ctx, COL_R_X, BODY_Y, COL_R_W, BODY_H, theme);
  T(ctx, "[  SIGNAL MONITOR  ]", COL_R_X + COL_R_W/2, BODY_Y + 20, 10, theme.dim, { align:"center", weight:"700" });

  // Barres de signal (3 indicateurs)
  const SIG_Y   = BODY_Y + 38;
  const SIG_H   = 90;
  const SIG_W   = (COL_R_W - 44) / 3;
  const SIG_GAP = 10;
  const sigData = [
    { val: tier.prog,   max:100, label:"PALIER" },
    { val: Math.min(100, (data.balance/500000)*100), max:100, label:"RICHESSE" },
    { val: Math.min(100, (data.streak/30)*100),      max:100, label:"STREAK"  },
  ];
  sigData.forEach((s, i) => {
    drawSignalBars(ctx, COL_R_X + 18 + i*(SIG_W+SIG_GAP), SIG_Y, SIG_W, SIG_H, s.val, s.max, theme, s.label);
  });

  // Bloc HEX décoratif droite
  drawHexBlock(ctx, COL_R_X + 16, SIG_Y + SIG_H + 30, COL_R_W - 32, seed + "_hexR", theme, 2);

  // Lignes de stat
  const ROWS_Y = SIG_Y + SIG_H + 72;
  const ROW_H  = 28;
  const ROWS_W = COL_R_W - 32;
  const rows = [
    { k:"SOLDE",        v: fmt(data.balance),    c: theme.accent },
    { k:"PALIER",       v: tier.name,            c: tier.color   },
    { k:"RANG",         v: `#${data.globalRank}`, c: theme.scan  },
    { k:"MULT",         v: `x${tier.mult}`,      c: theme.data   },
    { k:"VERS NEXT",    v: tier.next ? fmt(tier.next.min - data.balance) : "MAX", c: theme.dim },
    { k:"MEMBRES",      v: String(data.totalUsers), c: theme.dim  },
  ];
  rows.forEach((r, i) => drawStatRow(ctx, COL_R_X+16, ROWS_Y + i*ROW_H, ROWS_W, r.k, r.v, theme, r.c));

  // Pied panneau droit
  const FOOT_Y = BODY_Y + BODY_H - 32;
  T(ctx, `ID:${data.uid.toString().slice(-8)}  //  CHRISTUS`, COL_R_X + COL_R_W/2, FOOT_Y, 9, theme.dim, { align:"center", weight:"700" });

  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name:        "balance",
    aliases:     ["bal","$","cash","solde","holo","terminal"],
    version:     "12.0",
    author:      "Christus",
    countDown:   3,
    role:        0,
    description: { fr: "Balance Holo v12 — Terminal holographique, 20 themes, 3 panneaux." },
    category:    "economy",
    guide: {
      fr: [
        "BALANCE HOLO v12",
        "",
        "  bal                   — Votre terminal",
        "  bal @mention          — Terminal d un autre",
        "  bal <uid>             — Par identifiant",
        "  bal daily             — Bonus quotidien",
        "  bal t @mention <mnt>  — Virement",
        "  bal top [page]        — Classement",
        "  bal rank              — Votre rang",
        "  bal themes            — 20 themes",
        "  bal theme <1-20>      — Appliquer un theme",
        "",
        "Taxes : 2% 5% 8% 10% 12% 15%",
      ].join("\n"),
    },
  },

  onStart: async function ({ message, event, args, usersData, api }) {
    const { senderID, mentions, messageReply } = event;
    const cmd = args[0]?.toLowerCase();

    // ─── DAILY ────────────────────────────────────────────────────────────────
    if (cmd === "daily") {
      const ud = await usersData.get(senderID);
      const now = Date.now(), hours = (now-(ud.lastDaily||0))/3_600_000;
      const streak = ud.dailyStreak||0;
      if (hours < 21) return message.reply(`DAILY DEJA RECLAME\n${"─".repeat(20)}\nProchain bonus dans : ${Math.ceil(21-hours)}h\nStreak : ${streak}J`);
      const base = 100, sBonus = Math.min(streak*0.1*base, base*5), total = Math.round(base+sBonus);
      const newStr = hours<42?streak+1:1;
      await usersData.set(senderID, { money:(ud.money||0)+total, lastDaily:now, dailyStreak:newStr });
      return message.reply(`BONUS RECU : ${fmt(total)}\nStreak : ${newStr}J\nSolde : ${fmt((ud.money||0)+total)}`);
    }

    // ─── RANK ────────────────────────────────────────────────────────────────
    if (cmd === "rank") {
      const ud = await usersData.get(senderID);
      const tier = getTier(ud.money||0);
      const all = await usersData.getAll();
      const sorted = [...all].sort((a,b)=>(b.money||0)-(a.money||0));
      const rank = sorted.findIndex(u=>u.userID===senderID)+1;
      return message.reply(
        `RANG FINANCIER\n${"─".repeat(22)}\nSolde : ${fmt(ud.money||0)}\nPalier : ${tier.sym} ${tier.name}\nRang : #${rank}/${sorted.length}\nTop : ${(((sorted.length-rank+1)/sorted.length)*100).toFixed(1)}%\nProgress : ${tier.prog.toFixed(1)}% -> ${tier.next?.name||"MAX"}\nMult : x${tier.mult}`
      );
    }

    // ─── TOP ─────────────────────────────────────────────────────────────────
    if (cmd === "top") {
      const page = parseInt(args[1])||1, PER = 10;
      const all = await usersData.getAll();
      const rich = [...all].filter(u=>(u.money||0)>0).sort((a,b)=>(b.money||0)-(a.money||0));
      const slice = rich.slice((page-1)*PER, page*PER);
      if (!slice.length) return message.reply("Aucun utilisateur sur cette page.");
      let txt = `CLASSEMENT — Page ${page}/${Math.ceil(rich.length/PER)}\n${"─".repeat(28)}\n`;
      slice.forEach((u,i) => { const gr=(page-1)*PER+i+1; txt += `#${gr}  ${u.name||"?"}  ${fmt(u.money||0)}\n`; });
      return message.reply(txt);
    }

    // ─── TRANSFER ────────────────────────────────────────────────────────────
    if (["t","transfer","virement","send","pay"].includes(cmd)) {
      const tid = Object.keys(mentions)[0]||messageReply?.senderID||args[1];
      const amount = parseFloat(args.find(a=>!isNaN(parseFloat(a))&&parseFloat(a)>0));
      if (!tid||isNaN(amount)) return message.reply(`VIREMENT\nbal t @user montant`);
      if (tid===senderID) return message.reply("Impossible de s envoyer a soi-meme.");
      if (amount<10) return message.reply("Minimum : $10");
      const [s,r] = await Promise.all([usersData.get(senderID),usersData.get(tid)]);
      if (!r) return message.reply("Destinataire introuvable.");
      const tax = calcTax(amount);
      if ((s.money||0)<tax.total) return message.reply(`FONDS INSUFFISANTS\nNecessaire : ${fmt(tax.total)}\nSolde : ${fmt(s.money||0)}`);
      await Promise.all([usersData.set(senderID,{money:(s.money||0)-tax.total}),usersData.set(tid,{money:(r.money||0)+amount})]);
      const [sn,rn] = await Promise.all([usersData.getName(senderID).catch(()=>senderID),usersData.getName(tid).catch(()=>tid)]);
      return message.reply(`VIREMENT REUSSI\nID : ${txID()}\nDe : ${sn} -> ${rn}\nMontant : ${fmt(amount)}\nTaxe (${tax.rate}%) : ${fmt(tax.tax)}\nSolde : ${fmt((s.money||0)-tax.total)}`);
    }

    // ─── THEMES ──────────────────────────────────────────────────────────────
    if (cmd==="themes"||(cmd==="theme"&&!args[1])) {
      const keys = Object.keys(THEMES);
      let txt = `BALANCE HOLO — 20 THEMES\n${"─".repeat(26)}\n`;
      keys.forEach((k,i)=>{ txt+=`${i+1}. ${THEMES[k].sym}  ${THEMES[k].name}\n`; });
      return message.reply(txt);
    }
    if (cmd==="theme"&&args[1]) {
      const keys = Object.keys(THEMES), n=parseInt(args[1]);
      const key = (!isNaN(n)&&n>=1&&n<=keys.length)?keys[n-1]:args[1].toLowerCase();
      if (!THEMES[key]) return message.reply("Theme introuvable.");
      const ud = await usersData.get(senderID); ud.balHoloTheme=key; await usersData.set(senderID,ud);
      return message.reply(`Theme applique : ${THEMES[key].sym} ${THEMES[key].name}`);
    }

    // ─── CARTE PRINCIPALE ────────────────────────────────────────────────────
    let targetID = senderID;
    if (Object.keys(mentions).length>0) targetID=Object.keys(mentions)[0];
    else if (messageReply) targetID=messageReply.senderID;
    else if (args[0]&&!isNaN(args[0])&&parseInt(args[0])>10000) targetID=args[0];

    const senderUD  = await usersData.get(senderID);
    const themeKeys = Object.keys(THEMES);
    let themeKey    = senderUD?.balHoloTheme&&THEMES[senderUD.balHoloTheme]?senderUD.balHoloTheme:themeKeys[Math.floor(Math.random()*themeKeys.length)];
    for (const a of args) {
      const n=parseInt(a);
      if (!isNaN(n)&&n>=1&&n<=themeKeys.length){themeKey=themeKeys[n-1];break;}
      if (themeKeys.includes(a.toLowerCase())){themeKey=a.toLowerCase();break;}
    }
    const theme = THEMES[themeKey];

    if (!canvasAvailable) {
      const ud  = await usersData.get(targetID).catch(()=>null);
      if (!ud) return message.reply("Utilisateur introuvable.");
      const tier = getTier(ud.money||0);
      const all  = await usersData.getAll();
      const sorted = [...all].sort((a,b)=>(b.money||0)-(a.money||0));
      const rank = sorted.findIndex(u=>u.userID===targetID)+1;
      return message.reply(`BALANCE HOLO — ${ud.name||"?"}\n${"─".repeat(22)}\nSolde : ${fmt(ud.money||0)}\nPalier : ${tier.sym} ${tier.name}\nRang : #${rank}\nProg : ${tier.prog.toFixed(1)}% -> ${tier.next?.name||"MAX"}`);
    }

    const [userData, allUsers] = await Promise.all([usersData.get(targetID).catch(()=>null), usersData.getAll().catch(()=>[])]);
    if (!userData) return message.reply("Utilisateur introuvable.");

    let userInfo = {};
    try { const fb=await api.getUserInfo(targetID); userInfo=fb[targetID]||{}; } catch(_){ userInfo={name:userData.name||`User_${targetID}`,vanity:""}; }

    const sorted = [...allUsers].sort((a,b)=>(b.money||0)-(a.money||0));
    const globalRank = sorted.findIndex(u=>u.userID===targetID)+1||sorted.length;
    const topPct = (((sorted.length-globalRank+1)/sorted.length)*100).toFixed(1);

    const renderData = {
      uid: targetID, name: userInfo.name||userData.name||"Utilisateur",
      balance: userData.money||0, globalRank, topPct,
      totalUsers: sorted.length, streak: userData.dailyStreak||0,
    };

    const cacheDir = path.join(__dirname,"cache");
    if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
    const outPath = path.join(cacheDir,`bal_${targetID}_${Date.now()}.png`);

    const avatarImg = await loadAvatar(targetID, renderData.name);
    const cvs = await buildCanvas(renderData, theme, avatarImg);
    fs.writeFileSync(outPath, cvs.toBuffer("image/png"));

    const tier = getTier(renderData.balance);
    const body = [
      targetID===senderID ? "VOTRE TERMINAL FINANCIER" : `TERMINAL DE ${renderData.name}`,
      "─".repeat(28),
      `Solde   : ${fmt(renderData.balance)}`,
      `Palier  : ${tier.sym} ${tier.name}`,
      `Rang    : #${globalRank} (Top ${topPct}%)`,
      `Prog    : ${tier.prog.toFixed(1)}% -> ${tier.next?.name||"MAX"}`,
      `Theme   : ${theme.sym} ${theme.name}`,
    ].join("\n");

    await message.reply({ body, attachment: fs.createReadStream(outPath) });
    setTimeout(()=>{ try{if(fs.existsSync(outPath))fs.unlinkSync(outPath);}catch(_){} }, 30_000);
  },
};
