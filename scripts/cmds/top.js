"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  TOP ARCADE v5.0 — Tableau de scores rétro-futuriste néon, design inédit
//  Auteur   : Christus
//  Concept  : Chaque membre est une "entrée" d'un scoreboard d'arcade années 80/90
//             Barres de progression horizontales, podium en blocs empilés style
//             pixel-art, typographie monospace stylisée, grille CRT vibrante.
//             Totalement différent de la v4 (terminal boursier)
//  Canvas   : 1300 × dynamique
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
    if (typeof __dirname !== "string") return;
    const fd = path.join(__dirname, "assets", "font");
    if (!fs.existsSync(fd)) return;
    const fontFiles = [
      ["JetBrainsMono-Bold.ttf",    "Mono", "bold"],
      ["JetBrainsMono-Regular.ttf", "Mono", "normal"],
      ["RobotoMono-Bold.ttf",       "Mono", "bold"],
      ["RobotoMono-Regular.ttf",    "Mono", "normal"],
    ];
    for (const [f, fam, w] of fontFiles) {
      try {
        if (typeof f !== "string") continue;
        const fp = path.join(fd, f);
        if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
      } catch (_) {}
    }
  } catch (_) {}
}

const FB_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

// ─── Formatage monnaie compacte ──────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return "$0";
  n = Number(n);
  if (!isFinite(n)) return "$MAX";
  const S = [{v:1e12,s:"T"},{v:1e9,s:"B"},{v:1e6,s:"M"},{v:1e3,s:"K"}];
  const sc = S.find(s => Math.abs(n) >= s.v);
  if (sc) return `$${(Math.abs(n)/sc.v).toFixed(1)}${sc.s}`;
  return `$${Math.round(n)}`;
}

// ─── Pseudo-aléatoire seedé ──────────────────────────────────────────────────
function seededRandom(seedStr) {
  let s = 0;
  for (const c of String(seedStr)) s = (s * 31 + c.charCodeAt(0)) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ─── Score normalisé (pour la barre de progression) ──────────────────────────
function scoreBar(money, maxMoney) {
  if (!maxMoney) return 0;
  return Math.max(0.04, Math.min(1, money / maxMoney));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  20 THÈMES ARCADE NEON — chaque thème a sa propre ambiance
// ═══════════════════════════════════════════════════════════════════════════════
const PALETTES = {
  // --- NEON / CYBERPUNK ---
  neon_magenta:   { name:"Neon Magenta",    bg:"#0A0010", panel:"#120018", primary:"#FF00CC", secondary:"#00FFFF", accent:"#FFE000", text:"#F0E8FF", dim:"#7A5580" },
  cyber_lime:     { name:"Cyber Lime",      bg:"#050A00", panel:"#0C1400", primary:"#AAFF00", secondary:"#FF6600", accent:"#00FFCC", text:"#EFFFDF", dim:"#4A6030" },
  plasma_blue:    { name:"Plasma Blue",     bg:"#00050F", panel:"#000D1E", primary:"#00AAFF", secondary:"#FF0080", accent:"#FFFF00", text:"#D8EEFF", dim:"#20406A" },
  toxic_green:    { name:"Toxic Green",     bg:"#020802", panel:"#061006", primary:"#00FF44", secondary:"#FF2200", accent:"#FFEE00", text:"#E0FFE8", dim:"#1E4428" },
  sunset_arcade:  { name:"Sunset Arcade",   bg:"#0F0505", panel:"#1A0808", primary:"#FF6B00", secondary:"#FF00AA", accent:"#FFE500", text:"#FFEEDD", dim:"#6A3020" },
  // --- RETRO / 8-BIT ---
  gameboy_green:  { name:"Game Boy",        bg:"#0F1A0F", panel:"#1A2A1A", primary:"#8BAC0F", secondary:"#306230", accent:"#9BBC0F", text:"#DFFFFF", dim:"#304830" },
  amiga_copper:   { name:"Amiga Copper",    bg:"#000030", panel:"#000848", primary:"#FF8800", secondary:"#00CCFF", accent:"#FFFF00", text:"#EEF8FF", dim:"#203060" },
  cga_hot:        { name:"CGA Hot",         bg:"#000010", panel:"#00001C", primary:"#FF55FF", secondary:"#55FFFF", accent:"#FFFF55", text:"#FFFFFF", dim:"#444488" },
  vga_classic:    { name:"VGA Classic",     bg:"#0A0008", panel:"#160010", primary:"#AA00FF", secondary:"#00FF88", accent:"#FFAA00", text:"#EEDDFF", dim:"#503070" },
  dos_amber:      { name:"DOS Amber",       bg:"#0C0800", panel:"#1A1200", primary:"#FF9900", secondary:"#FFCC00", accent:"#FF6600", text:"#FFF0CC", dim:"#604020" },
  // --- SYNTH / LO-FI ---
  vaporwave:      { name:"Vaporwave",       bg:"#0A0018", panel:"#14002C", primary:"#FF71CE", secondary:"#05FFA1", accent:"#B967FF", text:"#FFE4FF", dim:"#5A2060" },
  outrun_dusk:    { name:"Outrun Dusk",     bg:"#0C0010", panel:"#180020", primary:"#FF3864", secondary:"#2DE2E6", accent:"#FFE74C", text:"#FFDDF0", dim:"#602040" },
  lo_fi_indigo:   { name:"Lo-Fi Indigo",   bg:"#060814", panel:"#0C1028", primary:"#6C8EFF", secondary:"#FF9D6C", accent:"#AAFFCC", text:"#E0E4FF", dim:"#2A3060" },
  hologram:       { name:"Hologram",        bg:"#020C0E", panel:"#04181C", primary:"#00F5FF", secondary:"#FF007A", accent:"#F5FF00", text:"#CCFFFF", dim:"#1A4850" },
  retro_wave:     { name:"Retro Wave",      bg:"#080010", panel:"#120020", primary:"#F72585", secondary:"#7209B7", accent:"#4CC9F0", text:"#FFD6F0", dim:"#501060" },
  // --- METAL / DARK ---
  iron_core:      { name:"Iron Core",       bg:"#0A0A0A", panel:"#161616", primary:"#FF4400", secondary:"#FF9900", accent:"#CCCCCC", text:"#EEEEEE", dim:"#443333" },
  chrome_night:   { name:"Chrome Night",    bg:"#080C10", panel:"#101820", primary:"#C8D8E8", secondary:"#6699CC", accent:"#FFD700", text:"#EEEEFF", dim:"#304060" },
  acid_rain:      { name:"Acid Rain",       bg:"#050A06", panel:"#0A1408", primary:"#39FF14", secondary:"#FF073A", accent:"#FFCB47", text:"#E8FFE8", dim:"#1A3C1A" },
  deep_space:     { name:"Deep Space",      bg:"#04020A", panel:"#08050E", primary:"#9B5DE5", secondary:"#F15BB5", accent:"#FEE440", text:"#E8E0FF", dim:"#3A2060" },
  blood_moon:     { name:"Blood Moon",      bg:"#0E0404", panel:"#180808", primary:"#FF1744", secondary:"#FF6D00", accent:"#FFD600", text:"#FFE0E0", dim:"#5A1C1C" },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PRIMITIVES DE DESSIN
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

function T(ctx, s, x, y, sz, color, {align="left",weight="bold",glow=null,alpha=1,blur=8}={}) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${sz}px Mono, "Courier New", monospace`;
  ctx.textAlign = align; ctx.textBaseline = "middle";
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }
  ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
}

function fitText(ctx, text, maxWidth, size) {
  ctx.font = `700 ${size}px Mono, "Courier New", monospace`;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (ctx.measureText(t + "~").width > maxWidth && t.length > 1) t = t.slice(0, -1);
  return t + "~";
}

// ─── Fond arcade : scanlines + grille CRT + lueurs d'angle ───────────────────
function drawArcadeBg(ctx, W, H, p) {
  // Fond de base
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.bg); g.addColorStop(0.5, p.panel); g.addColorStop(1, p.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Grille CRT fine (points lumineux aux intersections)
  ctx.save();
  ctx.strokeStyle = p.primary; ctx.globalAlpha = 0.05; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  // Points aux intersections (matrice de phosphore)
  ctx.save();
  ctx.fillStyle = p.primary; ctx.globalAlpha = 0.06;
  for (let x = 0; x < W; x += 32) {
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();

  // Scanlines horizontales (lignes sombres espacées — écran CRT)
  ctx.save();
  ctx.fillStyle = "#000"; ctx.globalAlpha = 0.08;
  for (let y = 0; y < H; y += 4) { ctx.fillRect(0, y, W, 2); }
  ctx.restore();

  // Lueurs aux 4 coins (halo d'écran)
  [[0, 0],[W, 0],[0, H],[W, H]].forEach(([cx, cy]) => {
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
    grd.addColorStop(0, p.primary + "18"); grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  });

  // Vignette centrale (renforce le centre)
  const vig = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

// ─── En-tête style "INSERT COIN / HIGH SCORE" ───────────────────────────────
function drawArcadeHeader(ctx, W, p, totalPlayers, paletteName) {
  // Bande titre
  ctx.save();
  ctx.fillStyle = p.primary + "22"; ctx.fillRect(0, 0, W, 90);
  ctx.strokeStyle = p.primary; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 89); ctx.lineTo(W, 89); ctx.stroke();
  ctx.restore();

  // Effet "lumière de scène" sur le titre
  const titleGlow = ctx.createLinearGradient(W*0.2, 0, W*0.8, 0);
  titleGlow.addColorStop(0, "transparent"); titleGlow.addColorStop(0.5, p.primary + "18"); titleGlow.addColorStop(1, "transparent");
  ctx.fillStyle = titleGlow; ctx.fillRect(0, 0, W, 90);

  // Tirets décoratifs de chaque côté du titre
  const DASH = "--- ";
  T(ctx, DASH.repeat(4), 30, 36, 13, p.dim, { weight:"700", alpha:0.7 });
  T(ctx, DASH.repeat(4), W - 30, 36, 13, p.dim, { weight:"700", align:"right", alpha:0.7 });

  // Titre principal
  T(ctx, "HIGH  SCORE  BOARD", W/2, 35, 34, p.primary, { align:"center", weight:"900", glow:p.primary, blur:18 });

  // Sous-ligne info
  const now = moment().tz("Asia/Dhaka").format("DD.MM.YYYY  HH:mm");
  T(ctx, `${totalPlayers} PLAYERS  //  ${paletteName.toUpperCase()}  //  ${now}`, W/2, 70, 12, p.text, { align:"center", weight:"600", alpha:0.55 });
}

// ─── Bloc podium "pixel-art" empilé — socle en blocs, pas de médaille ───────
async function drawArcadePodium(ctx, W, y, top3, p, maxMoney) {
  const PAD = 36;
  const CARD_W = Math.floor((W - PAD*2 - 32) / 3);
  const CARD_H = 220;
  const GAP = 16;

  // Hauteurs de socles : #1 le plus haut, #2 médian, #3 le plus bas
  const sockleH = [120, 80, 50]; // #1, #2, #3
  const rankColors = [p.accent, p.secondary, p.primary];
  const order = [1, 0, 2]; // dessin : #2 gauche, #1 centre, #3 droite

  for (const idx of order) {
    const user = top3[idx];
    if (!user) continue;
    const cardX = PAD + idx * (CARD_W + GAP);
    const sH = sockleH[idx];
    const cardY = y + (CARD_H - sH);
    const rc = rankColors[idx];

    // Socle en blocs pixelisés (dessiné en couches horizontales)
    const blockRows = Math.round(sH / 18);
    for (let b = 0; b < blockRows; b++) {
      const by = cardY + sH - (b + 1) * 18;
      const intensity = 0.15 + (b / blockRows) * 0.55;
      ctx.save();
      ctx.fillStyle = rc; ctx.globalAlpha = intensity;
      ctx.fillRect(cardX, by, CARD_W, 17);
      // Bordure de bloc
      ctx.strokeStyle = rc; ctx.globalAlpha = intensity * 0.6; ctx.lineWidth = 0.5;
      ctx.strokeRect(cardX, by, CARD_W, 17);
      ctx.restore();
    }
    // Trait brillant en haut du socle
    ctx.save();
    ctx.strokeStyle = rc; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85;
    ctx.shadowColor = rc; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(cardX, cardY); ctx.lineTo(cardX + CARD_W, cardY); ctx.stroke();
    ctx.restore();

    // Zone avatar (fond)
    const avatarY = y + 10;
    const AV_R = 38;
    const avatarCX = cardX + CARD_W / 2;
    const avatarCY = avatarY + AV_R + 8;

    // Halo de rang autour de l'avatar
    ctx.save();
    const haloG = ctx.createRadialGradient(avatarCX, avatarCY, AV_R-4, avatarCX, avatarCY, AV_R+20);
    haloG.addColorStop(0, rc + "60"); haloG.addColorStop(1, "transparent");
    ctx.fillStyle = haloG; ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AV_R+20, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Avatar
    if (user.avatarImg) {
      ctx.save();
      ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AV_R, 0, Math.PI*2); ctx.clip();
      ctx.drawImage(user.avatarImg, avatarCX - AV_R, avatarCY - AV_R, AV_R*2, AV_R*2);
      ctx.restore();
    }
    // Contour avatar
    ctx.save();
    ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AV_R, 0, Math.PI*2);
    ctx.strokeStyle = rc; ctx.lineWidth = 2.5; ctx.shadowColor = rc; ctx.shadowBlur = 12; ctx.stroke();
    ctx.restore();

    // Rang en chiffre romain pixelisé
    const rankStr = idx === 0 ? "1ST" : idx === 1 ? "2ND" : "3RD";
    T(ctx, rankStr, avatarCX, avatarCY + AV_R + 18, 15, rc, { align:"center", weight:"900", glow:rc, blur:10 });

    // Nom tronqué
    T(ctx, fitText(ctx, user.name || "???", CARD_W - 16, 14), avatarCX, avatarCY + AV_R + 38, 14, p.text, { align:"center", weight:"700" });

    // Montant
    T(ctx, fmt(user.money || 0), avatarCX, avatarCY + AV_R + 60, 17, rc, { align:"center", weight:"800", glow:rc, blur:8 });
  }
}

// ─── Ligne de liste arcade avec barre de progression ─────────────────────────
function drawArcadeRow(ctx, x, y, w, h, user, globalRank, maxMoney, p, isHighlighted) {
  const BAR_MAX_W = Math.floor(w * 0.35);
  const barPct = scoreBar(user.money || 0, maxMoney);

  // Fond de ligne alterné + surlignage
  ctx.save();
  if (isHighlighted) {
    ctx.fillStyle = p.primary + "14"; ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = p.text; ctx.globalAlpha = 0.03; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // Liseré gauche coloré (épaisseur variable selon rang)
  const barColor = globalRank <= 3 ? p.accent : globalRank <= 10 ? p.primary : p.secondary;
  ctx.fillStyle = barColor; ctx.globalAlpha = 0.8;
  ctx.fillRect(x, y + 4, globalRank <= 3 ? 5 : 3, h - 8);
  ctx.globalAlpha = 1;

  const midY = y + h / 2;

  // Numéro de rang avec padding (style arcade "00X")
  const rankStr = String(globalRank).padStart(3, "0");
  T(ctx, rankStr, x + 22, midY, 18, barColor, { weight:"900", glow:barColor, blur:6 });

  // Avatar miniature (cercle)
  const AV_X = x + 80, AV_R = 22;
  if (user.avatarImg) {
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_X, midY, AV_R, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(user.avatarImg, AV_X - AV_R, midY - AV_R, AV_R*2, AV_R*2);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(AV_X, midY, AV_R, 0, Math.PI*2);
    ctx.strokeStyle = barColor; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke();
    ctx.restore();
  }

  // Nom
  const NAME_X = AV_X + AV_R + 14;
  const NAME_MAX = Math.floor(w * 0.22);
  T(ctx, fitText(ctx, user.name || "???", NAME_MAX, 16), NAME_X, midY, 16, p.text, { weight:"700" });

  // Score (argent)
  const SCORE_X = NAME_X + NAME_MAX + 24;
  T(ctx, fmt(user.money || 0), SCORE_X, midY, 18, p.accent, { weight:"800" });

  // Barre de progression de type arcade (fond + remplissage segmenté)
  const BAR_X = SCORE_X + 130;
  const BAR_H = 14;
  const BAR_Y = midY - BAR_H / 2;

  // Fond barre
  ctx.save();
  ctx.fillStyle = p.dim + "50"; rr(ctx, BAR_X, BAR_Y, BAR_MAX_W, BAR_H, 2); ctx.fill();
  ctx.restore();

  // Remplissage segmenté (blocs de 8px espacés de 2px, façon vie dans un jeu)
  const filledW = Math.round(BAR_MAX_W * barPct);
  const SEG_W = 8, SEG_GAP = 2, SEG_UNIT = SEG_W + SEG_GAP;
  const totalSegs = Math.floor(BAR_MAX_W / SEG_UNIT);
  const filledSegs = Math.round(totalSegs * barPct);
  ctx.save();
  ctx.shadowColor = barColor; ctx.shadowBlur = 5;
  for (let s = 0; s < totalSegs; s++) {
    ctx.fillStyle = s < filledSegs ? barColor : (p.dim + "40");
    ctx.globalAlpha = s < filledSegs ? 0.9 : 0.35;
    ctx.fillRect(BAR_X + s * SEG_UNIT, BAR_Y + 2, SEG_W, BAR_H - 4);
  }
  ctx.restore();

  // Pourcentage à droite de la barre
  const pctStr = `${(barPct * 100).toFixed(0)}%`;
  T(ctx, pctStr, BAR_X + BAR_MAX_W + 10, midY, 11, p.dim, { weight:"600", alpha:0.7 });
}

// ─── Séparateur de section style "===== TITRE =====" ────────────────────────
function drawArcadeSep(ctx, x, y, w, label, p) {
  const LINE_Y = y + 10;
  ctx.save();
  ctx.strokeStyle = p.primary; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(x, LINE_Y); ctx.lineTo(x + w, LINE_Y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.fillStyle = p.bg;
    const tw = ctx.measureText(label).width + 20;
    ctx.fillRect(x + w/2 - tw/2 - 2, y, tw + 4, 20);
    ctx.restore();
    T(ctx, label, x + w/2, LINE_Y, 11, p.primary, { align:"center", weight:"700", alpha:0.8 });
  }
}

// ─── Pied de page de style arcade ───────────────────────────────────────────
function drawArcadeFooter(ctx, W, y, senderRank, total, p) {
  ctx.save();
  ctx.fillStyle = p.primary + "18"; ctx.fillRect(0, y, W, 64);
  ctx.strokeStyle = p.primary; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  ctx.restore();

  if (senderRank > 0) {
    T(ctx, `YOUR POSITION : ${String(senderRank).padStart(3,"0")}  /  ${String(total).padStart(3,"0")} PLAYERS`, W/2, y + 22, 14, p.accent, { align:"center", weight:"800", glow:p.accent, blur:6 });
  }
  T(ctx, "REPLY WITH PAGE NUMBER TO CONTINUE  //  CHRISTUS ARCADE", W/2, y + 46, 11, p.text, { align:"center", alpha:0.4, weight:"600" });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT AVATAR
// ═══════════════════════════════════════════════════════════════════════════════
async function loadAvatarImg(uid, name) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${uid}/picture?width=200&height=200&access_token=${FB_TOKEN}`,
      { responseType: "arraybuffer", timeout: 8000 }
    );
    return await loadImage(Buffer.from(res.data));
  } catch (_) {
    const cv = createCanvas(200, 200);
    const c = cv.getContext("2d");
    const rnd = seededRandom(uid || "0");
    const h = Math.round(rnd() * 360);
    c.fillStyle = `hsl(${h},80%,35%)`;
    c.fillRect(0, 0, 200, 200);
    c.fillStyle = "#FFF"; c.font = "bold 80px monospace";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText((name || "?").charAt(0).toUpperCase(), 100, 100);
    return await loadImage(cv.toBuffer());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const CW = 1300;
const PAD = 36;

async function buildCanvas(richList, pageUsers, startIndex, page, totalPages, senderRank, palette) {
  ensureFonts();
  const p = palette;

  // Calcul du max de richesse (pour les barres de progression)
  const maxMoney = richList.length > 0 ? (richList[0].money || 1) : 1;

  // Dimensions dynamiques
  const HEADER_H   = 90;
  const SEP1_H     = 24;
  const PODIUM_H   = startIndex === 0 ? 260 : 0; // podium seulement page 1
  const SEP2_H     = startIndex === 0 ? 28 : 0;
  const ROW_H      = 72;
  const ROW_GAP    = 5;
  const FOOTER_H   = 64;
  const CH = HEADER_H + SEP1_H + PODIUM_H + SEP2_H +
             pageUsers.length * (ROW_H + ROW_GAP) + FOOTER_H + 20;

  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

  // 1. Fond
  drawArcadeBg(ctx, CW, CH, p);

  // 2. En-tête
  drawArcadeHeader(ctx, CW, p, richList.length, p.name);

  let curY = HEADER_H + SEP1_H;

  // 3. Podium (page 1 uniquement)
  if (startIndex === 0 && richList.length >= 1) {
    const top3 = richList.slice(0, 3);
    // Charger les avatars du podium
    const avatarImgs = await Promise.all(top3.map(u => loadAvatarImg(u.userID, u.name)));
    const top3WithAv = top3.map((u, i) => ({ ...u, avatarImg: avatarImgs[i] }));

    drawArcadeSep(ctx, PAD, curY - 18, CW - PAD*2, `--- TOP 3 HALL OF FAME ---`, p);
    await drawArcadePodium(ctx, CW, curY, top3WithAv, p, maxMoney);
    curY += PODIUM_H + SEP2_H;
  }

  // 4. Séparateur avant la liste
  drawArcadeSep(ctx, PAD, curY - 16, CW - PAD*2, `--- PAGE ${page} / ${totalPages} ---`, p);

  // 5. En-tête de colonne (style table de score)
  const COL_Y = curY + 10;
  T(ctx, "RANK", PAD + 18, COL_Y, 10, p.dim, { weight:"700", alpha:0.6 });
  T(ctx, "PLAYER", PAD + 80, COL_Y, 10, p.dim, { weight:"700", alpha:0.6 });
  T(ctx, "SCORE", PAD + 80 + 44 + 14 + Math.floor(CW * 0.22), COL_Y, 10, p.dim, { weight:"700", alpha:0.6 });
  T(ctx, "POWER BAR", CW - PAD - Math.floor(CW*0.35) - 20, COL_Y, 10, p.dim, { weight:"700", alpha:0.6 });
  curY += 24;

  // 6. Lignes de liste
  for (let i = 0; i < pageUsers.length; i++) {
    const user = pageUsers[i];
    const gRank = startIndex + i + 1;
    const avatarImg = await loadAvatarImg(user.userID, user.name);
    const userWithAv = { ...user, avatarImg };
    const isHighlighted = false; // senderRank peut être utilisé ici si besoin
    drawArcadeRow(ctx, PAD, curY, CW - PAD*2, ROW_H, userWithAv, gRank, maxMoney, p, isHighlighted);
    curY += ROW_H + ROW_GAP;
  }

  // 7. Pied de page
  drawArcadeFooter(ctx, CW, curY + 8, senderRank, richList.length, p);

  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name:        "top",
    aliases:     ["leaderboard","lb","classement","arcade","score"],
    version:     "5.0",
    author:      "Christus",
    countDown:   5,
    role:        0,
    description: { fr: "◈ Top Arcade v5 — Tableau de scores rétro-futuriste, 20 thèmes néon." },
    category:    "economy",
    guide: {
      fr: [
        "HIGH SCORE BOARD",
        "",
        "  top [page]         — Classement des joueurs",
        "  top <1-20>         — Choisir un thème néon",
        "  top themes         — Liste des 20 thèmes",
        "",
        "  Chaque membre est un joueur avec sa barre de score.",
        "  Répondez avec un numéro de page pour naviguer.",
      ].join("\n"),
    },
  },

  onStart: async function ({ message, event, args, usersData, api }) {
    const { senderID, threadID } = event;
    const PER_PAGE = 10;

    if (args[0]?.toLowerCase() === "themes") {
      const keys = Object.keys(PALETTES);
      let txt = `HIGH SCORE BOARD — THEMES DISPONIBLES\n${"─".repeat(36)}\n`;
      keys.forEach((k, i) => { txt += `${i+1}. ${PALETTES[k].name}\n`; });
      txt += `\ntop <numero> pour appliquer un theme.`;
      return message.reply(txt);
    }

    const themeKeys = Object.keys(PALETTES);
    const senderUD  = await usersData.get(senderID).catch(() => ({}));
    let themeKey    = senderUD?.topArcadeTheme && PALETTES[senderUD.topArcadeTheme]
      ? senderUD.topArcadeTheme
      : themeKeys[Math.floor(Math.random() * themeKeys.length)];
    let page = 1;

    for (const a of args) {
      const n = parseInt(a);
      if (!isNaN(n) && n >= 1 && n <= themeKeys.length) { themeKey = themeKeys[n-1]; continue; }
      if (themeKeys.includes(a.toLowerCase())) { themeKey = a.toLowerCase(); continue; }
      if (!isNaN(n) && n > 0) page = n;
    }

    if (args[0]?.toLowerCase() === "theme") {
      const ud = await usersData.get(senderID);
      ud.topArcadeTheme = themeKey;
      await usersData.set(senderID, ud);
      return message.reply(`Theme applique : ${PALETTES[themeKey].name}`);
    }

    const palette = PALETTES[themeKey];

    const allUsers   = await usersData.getAll();
    const richList   = allUsers.filter(u => (u.money||0) > 0).sort((a,b) => (b.money||0)-(a.money||0));
    const totalPages = Math.max(1, Math.ceil(richList.length / PER_PAGE));
    page = Math.max(1, Math.min(page, totalPages));

    const startIndex = (page - 1) * PER_PAGE;
    const pageUsers  = richList.slice(startIndex, startIndex + PER_PAGE);
    const senderRank = richList.findIndex(u => u.userID === senderID) + 1;

    if (!pageUsers.length) {
      return message.reply("Aucun joueur enregistre pour l instant.");
    }

    if (!canvasAvailable) {
      let txt = `HIGH SCORE BOARD — Page ${page}/${totalPages}\n${"─".repeat(32)}\n`;
      pageUsers.forEach((u, i) => {
        const gr = startIndex + i + 1;
        txt += `${String(gr).padStart(3,"0")}  ${u.name||"???"} — ${fmt(u.money||0)}\n`;
      });
      if (senderRank > 0) txt += `\nVotre position : ${String(senderRank).padStart(3,"0")}`;
      return message.reply(txt);
    }

    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
    const outPath = path.join(cacheDir, `top_${threadID}_${Date.now()}.png`);

    const canvas = await buildCanvas(richList, pageUsers, startIndex, page, totalPages, senderRank, palette);
    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));

    const sent = await message.reply({
      body:       `HIGH SCORE BOARD — Page ${page}/${totalPages} — ${palette.name}`,
      attachment: fs.createReadStream(outPath),
    });

    setTimeout(() => { try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {} }, 60_000);

    global.GoatBot.onReply.set(sent.messageID, {
      commandName: this.config.name,
      author:      senderID,
      type:        "top_nav",
      totalPages,
      threadID,
      themeKey,
    });
  },

  onReply: async function ({ message, event, Reply, usersData }) {
    if (Reply.author !== event.senderID) return;
    if (Reply.type  !== "top_nav") return;

    const page = parseInt(event.body);
    if (isNaN(page) || page < 1 || page > Reply.totalPages) {
      return message.reply(`Page invalide. Entrez un numero entre 1 et ${Reply.totalPages}.`);
    }

    const PER_PAGE = 10;
    const palette  = PALETTES[Reply.themeKey] || PALETTES[Object.keys(PALETTES)[0]];

    const allUsers   = await usersData.getAll();
    const richList   = allUsers.filter(u => (u.money||0) > 0).sort((a,b) => (b.money||0)-(a.money||0));
    const startIndex = (page - 1) * PER_PAGE;
    const pageUsers  = richList.slice(startIndex, startIndex + PER_PAGE);
    const senderRank = richList.findIndex(u => u.userID === event.senderID) + 1;

    if (!pageUsers.length) return message.reply("Aucun joueur sur cette page.");

    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.ensureDirSync(cacheDir);
    const outPath = path.join(cacheDir, `top_${Reply.threadID}_${Date.now()}.png`);

    const canvas = await buildCanvas(richList, pageUsers, startIndex, page, Reply.totalPages, senderRank, palette);
    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));

    await message.reply({
      body:       `HIGH SCORE BOARD — Page ${page}/${Reply.totalPages}`,
      attachment: fs.createReadStream(outPath),
    });

    setTimeout(() => { try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {} }, 60_000);
    global.GoatBot.onReply.delete(Reply.messageID);
  },
};
