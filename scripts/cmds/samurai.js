"use strict";
/**
 * ⚔️ VOIE DU SABRE — École de Kenjutsu, Duels au Premier Sang, Kōan Zen
 * Auteur: Christus
 * Direction artistique canvas : "ukiyo-e géométrique" (papier crème, cercle enso,
 * montagnes en aplats, trames de vagues, sceau rouge). AUCUN emoji dans le canvas.
 */

const fonts = require('../../func/font.js');
const numbers = require('../../func/number.js');
const fs = require("fs-extra");
const path = require("path");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
  const cv = require("canvas");
  loadImage = cv.loadImage;
  createCanvas = cv.createCanvas;
  registerFont = cv.registerFont;
  canvasAvailable = true;
} catch (e) {
  console.error("[samurai] Canvas indisponible:", e.message);
}

// ══════════════════════════════════════════════════════════════════════════
//  POLICES
// ══════════════════════════════════════════════════════════════════════════
let fontsLoaded = false;
function ensureFonts() {
  if (fontsLoaded || !canvasAvailable || !registerFont) return;
  fontsLoaded = true;
  try {
    const fd = path.join(__dirname, "assets", "font");
    if (!fs.existsSync(fd)) return;
    const fontFiles = [
      ["BeVietnamPro-Bold.ttf", "BK", "bold"],
      ["BeVietnamPro-Regular.ttf", "BK", "normal"],
      ["BeVietnamPro-SemiBold.ttf", "BK", "600"],
      ["NotoSans-Bold.ttf", "BK", "bold"],
      ["NotoSans-Regular.ttf", "BK", "normal"],
    ];
    for (const [f, fam, w] of fontFiles) {
      try {
        const fp = path.join(fd, f);
        if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
      } catch (_) {}
    }
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPERS CANVAS GÉNÉRIQUES
// ══════════════════════════════════════════════════════════════════════════
function rr(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y); ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr); ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h); ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl); ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y); ctx.closePath();
}

function T(ctx, s, x, y, sz, color, opts = {}) {
  const { align = "left", weight = "bold", alpha = 1, letterSpacing = 0, font = "BK" } = opts;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${sz}px ${font}, Arial`;
  ctx.textAlign = letterSpacing ? "left" : align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  s = String(s).toUpperCase();
  if (letterSpacing) {
    let cx = x;
    if (align === "center") {
      const w = [...s].reduce((acc, ch) => acc + ctx.measureText(ch).width + letterSpacing, -letterSpacing);
      cx = x - w / 2;
    } else if (align === "right") {
      const w = [...s].reduce((acc, ch) => acc + ctx.measureText(ch).width + letterSpacing, -letterSpacing);
      cx = x - w;
    }
    for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + letterSpacing; }
  } else {
    ctx.fillText(s, x, y);
  }
  ctx.restore();
}

async function fetchAvatar(uid) {
  try {
    const axios = require("axios");
    const url = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 8000 });
    return await loadImage(Buffer.from(res.data));
  } catch (_) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  PALETTE "UKIYO-E GÉOMÉTRIQUE"
// ══════════════════════════════════════════════════════════════════════════
const PALETTE = {
  papier: "#F4EAD5",
  papierFonce: "#E8D9B8",
  encre: "#231F1A",
  encreClaire: "#4A433A",
  montagne1: "#8AA6A3",
  montagne2: "#5C7A78",
  montagne3: "#33504E",
  vague: "#5F87A8",
  vagueClaire: "#9CC0D6",
  sceau: "#B23A2E",
  or: "#B08D48",
};

// ══════════════════════════════════════════════════════════════════════════
//  DONNÉES DE JEU — ÉCOLES DE KENJUTSU
// ══════════════════════════════════════════════════════════════════════════
const ECOLES = {
  ITTO:   { id: "ITTO",   nom: "Itto-Ryu (École du Coup Unique)",     bonusAtt: 0.15, bonusDef: -0.05, desc: "Frappe décisive, sacrifice la garde." },
  YAGYU:  { id: "YAGYU",  nom: "Yagyu Shinkage-Ryu",                  bonusAtt: 0.00, bonusDef: 0.15,  desc: "Équilibre parfait, patience du sabreur." },
  MUSASHI:{ id: "MUSASHI",nom: "Niten Ichi-Ryu (Deux Sabres)",        bonusAtt: 0.10, bonusDef: 0.05,  desc: "Double lame, polyvalence redoutable." },
  KASHIMA:{ id: "KASHIMA",nom: "Kashima Shinto-Ryu",                  bonusAtt: 0.05, bonusDef: 0.10,  desc: "Techniques divines, iaido rapide." },
  TENSHIN:{ id: "TENSHIN",nom: "Tenshin Shoden Katori",               bonusAtt: 0.08, bonusDef: 0.08,  desc: "Art ancien complet, équilibre du ki." },
};

// ══════════════════════════════════════════════════════════════════════════
//  POSTURES (KAMAE) — chacune module attaque/défense/vitesse
// ══════════════════════════════════════════════════════════════════════════
const POSTURES = {
  SEIGAN:  { id: "SEIGAN",  nom: "Seigan (Œil Droit)",      att: 1.00, def: 1.00, esquive: 0.05, desc: "Posture neutre, équilibrée en tout point." },
  JODAN:   { id: "JODAN",   nom: "Jodan (Position Haute)",  att: 1.30, def: 0.75, esquive: 0.00, desc: "Lame levée, puissance maximale, garde ouverte." },
  CHUDAN:  { id: "CHUDAN",  nom: "Chudan (Position Médiane)",att: 1.05, def: 1.05, esquive: 0.05, desc: "Compromis classique du duelliste prudent." },
  GEDAN:   { id: "GEDAN",   nom: "Gedan (Position Basse)",  att: 0.85, def: 1.25, esquive: 0.10, desc: "Lame basse, défense renforcée, contre-attaque." },
  HASSO:   { id: "HASSO",   nom: "Hasso (Position Épaule)", att: 1.15, def: 0.90, esquive: 0.15, desc: "Feintes rapides, mobilité accrue." },
  WAKI:    { id: "WAKI",    nom: "Waki (Position Cachée)",  att: 1.10, def: 0.95, esquive: 0.20, desc: "Lame dissimulée, trompe l'adversaire sur la portée." },
};

// ══════════════════════════════════════════════════════════════════════════
//  TECHNIQUES / KATAS — le moteur de combat pioche dedans
// ══════════════════════════════════════════════════════════════════════════
const TECHNIQUES = [
  { id: "KESA",     nom: "Kesa-Giri (Coupe Diagonale)",  type: "attaque", coutKi: 10, degats: [12, 20], precision: 0.85, desc: "Frappe diagonale classique du sabreur." },
  { id: "TSUKI",    nom: "Tsuki (Estocade)",              type: "attaque", coutKi: 8,  degats: [10, 16], precision: 0.90, desc: "Estocade rapide et précise vers la gorge." },
  { id: "MEN",      nom: "Men-Uchi (Coupe au Front)",     type: "attaque", coutKi: 14, degats: [16, 26], precision: 0.78, desc: "Coupe verticale puissante mais lente." },
  { id: "KOTE",     nom: "Kote-Uchi (Coupe au Poignet)",  type: "attaque", coutKi: 9,  degats: [8, 14],  precision: 0.92, desc: "Frappe précise pour désarmer." },
  { id: "DO",       nom: "Do-Uchi (Coupe au Flanc)",      type: "attaque", coutKi: 12, degats: [14, 22], precision: 0.82, desc: "Coupe horizontale au flanc découvert." },
  { id: "IAIDO",    nom: "Iaido (Dégainage Éclair)",      type: "special", coutKi: 25, degats: [25, 40], precision: 0.70, desc: "Coup fatal en un seul geste depuis le fourreau." },
  { id: "NUKI",     nom: "Nukitsuke (Dégainage-Coupe)",   type: "special", coutKi: 18, degats: [18, 28], precision: 0.80, desc: "Sortie de lame combinée à une coupe immédiate." },
  { id: "FEINTE",   nom: "Feinte du Roseau",              type: "feinte",  coutKi: 6,  degats: [0, 0],   precision: 1.00, desc: "Trompe la garde adverse, baisse sa défense." },
  { id: "GARDE",    nom: "Garde de l'Étang Calme",        type: "garde",   coutKi: 0,  degats: [0, 0],   precision: 1.00, desc: "Position défensive, régénère le ki." },
  { id: "PARADE",   nom: "Parade du Vent du Nord",        type: "garde",   coutKi: 4,  degats: [0, 0],   precision: 1.00, desc: "Bloque la prochaine attaque, contre-riposte possible." },
  { id: "COMBO1",   nom: "Enchaînement Sakura",           type: "combo",   coutKi: 20, degats: [22, 34], precision: 0.75, desc: "Kote puis Men enchaînés sans respiration." },
  { id: "COMBO2",   nom: "Enchaînement Tempête",          type: "combo",   coutKi: 28, degats: [30, 46], precision: 0.65, desc: "Triple frappe Do-Kesa-Tsuki, très risquée." },
];

// ══════════════════════════════════════════════════════════════════════════
//  STATUTS DE COMBAT
// ══════════════════════════════════════════════════════════════════════════
const STATUTS = {
  DESEQUILIBRE: { id: "DESEQUILIBRE", nom: "Déséquilibré",  duree: 1, effet: "def-30%" },
  SAIGNEMENT:   { id: "SAIGNEMENT",   nom: "Saignement",    duree: 3, effet: "pv-4/tour" },
  FOCUS:        { id: "FOCUS",        nom: "Concentration", duree: 2, effet: "precision+15%" },
  EPUISE:       { id: "EPUISE",       nom: "Épuisé",        duree: 2, effet: "ki_regen-50%" },
  BRISE:        { id: "BRISE",        nom: "Garde Brisée",  duree: 2, effet: "def-50%" },
};

// ══════════════════════════════════════════════════════════════════════════
//  FORGE — LAMES DISPONIBLES
// ══════════════════════════════════════════════════════════════════════════
const LAMES = {
  BAMBOU:   { id: "BAMBOU",   nom: "Shinai de Bambou",        cout: 0,        bonusDeg: 0,  bonusPrec: 0.00, tranchant: 1,  emoji_txt: "Lame d'entraînement" },
  FER:      { id: "FER",      nom: "Katana de Fer Battu",     cout: 5_000,    bonusDeg: 3,  bonusPrec: 0.02, tranchant: 2,  emoji_txt: "Lame de débutant sérieux" },
  ACIER:    { id: "ACIER",    nom: "Katana d'Acier Plié",     cout: 20_000,   bonusDeg: 6,  bonusPrec: 0.04, tranchant: 3,  emoji_txt: "Acier plié mille fois" },
  TAMAHAGANE:{id: "TAMAHAGANE",nom:"Lame de Tamahagane",      cout: 60_000,   bonusDeg: 10, bonusPrec: 0.06, tranchant: 4,  emoji_txt: "Acier traditionnel noble" },
  MASAMUNE: { id: "MASAMUNE", nom: "Réplique de Masamune",    cout: 150_000,  bonusDeg: 15, bonusPrec: 0.08, tranchant: 5,  emoji_txt: "Chef-d'œuvre légendaire" },
  MURAMASA: { id: "MURAMASA", nom: "Lame Maudite de Muramasa",cout: 300_000,  bonusDeg: 22, bonusPrec: 0.10, tranchant: 6,  emoji_txt: "Assoiffée de sang, instable" },
  KUSANAGI: { id: "KUSANAGI", nom: "Kusanagi Mythique",       cout: 800_000,  bonusDeg: 30, bonusPrec: 0.14, tranchant: 7,  emoji_txt: "Lame des légendes divines" },
};

const MATERIAUX_FORGE = {
  MINERAI:  { id: "MINERAI",  nom: "Minerai de Fer",     prix: 800,  utilite: "Base de toute forge" },
  CHARBON:  { id: "CHARBON",  nom: "Charbon de Bois",    prix: 400,  utilite: "Chauffe la forge" },
  EAU:      { id: "EAU",      nom: "Eau de Montagne",    prix: 200,  utilite: "Trempe la lame" },
  SOIE:     { id: "SOIE",     nom: "Soie pour la Poignée",prix: 600, utilite: "Finition de la garde" },
  RUBIS:    { id: "RUBIS",    nom: "Rubis Sacré",        prix: 5000, utilite: "Ornement de tsuba rare" },
};

// ══════════════════════════════════════════════════════════════════════════
//  GRADES DE L'ÉCOLE (progression par XP)
// ══════════════════════════════════════════════════════════════════════════
const GRADES = [
  { id: "MUDANSHA",  nom: "Mudansha (Sans Grade)",     min: 0,        emoji: "◇", bonusPV: 0,  bonusKi: 0 },
  { id: "SHODAN",     nom: "Shodan (1er Dan)",          min: 500,      emoji: "◆", bonusPV: 10, bonusKi: 5 },
  { id: "NIDAN",      nom: "Nidan (2ème Dan)",          min: 2_000,    emoji: "◆◆", bonusPV: 20, bonusKi: 10 },
  { id: "SANDAN",     nom: "Sandan (3ème Dan)",         min: 6_000,    emoji: "◆◆◆", bonusPV: 35, bonusKi: 15 },
  { id: "YONDAN",     nom: "Yondan (4ème Dan)",         min: 15_000,   emoji: "◆◆◆◆", bonusPV: 55, bonusKi: 25 },
  { id: "GODAN",      nom: "Godan (5ème Dan)",          min: 35_000,   emoji: "★", bonusPV: 80, bonusKi: 35 },
  { id: "RENSHI",     nom: "Renshi (Maître Instructeur)",min: 80_000,  emoji: "★★", bonusPV: 110,bonusKi: 50 },
  { id: "KYOSHI",     nom: "Kyoshi (Maître Enseignant)", min: 180_000, emoji: "★★★", bonusPV: 150,bonusKi: 70 },
  { id: "HANSHI",     nom: "Hanshi (Grand Maître)",      min: 400_000, emoji: "☯", bonusPV: 200,bonusKi: 100 },
  { id: "KENSEI",     nom: "Kensei (Saint du Sabre)",    min: 1_000_000, emoji: "卍", bonusPV: 280,bonusKi: 140 },
];

// ══════════════════════════════════════════════════════════════════════════
//  ENNEMIS DU DOJO (entraînement / duels)
// ══════════════════════════════════════════════════════════════════════════
const ENNEMIS = [
  { id: "E1",  nom: "Élève Débutant Kenji",        pv: 60,  ki: 40,  ecole: "ITTO",   xp: 30,   argent: [200, 500],    diff: 1 },
  { id: "E2",  nom: "Ronin Errant Sans Nom",        pv: 90,  ki: 55,  ecole: "YAGYU",  xp: 60,   argent: [400, 900],    diff: 2 },
  { id: "E3",  nom: "Samouraï du Clan Oda",         pv: 130, ki: 70,  ecole: "KASHIMA",xp: 120,  argent: [800, 1800],   diff: 3 },
  { id: "E4",  nom: "Duelliste Borgne Hattori",     pv: 170, ki: 90,  ecole: "MUSASHI",xp: 220,  argent: [1500, 3200],  diff: 4 },
  { id: "E5",  nom: "Maître d'Armes Yamamoto",      pv: 220, ki: 120, ecole: "TENSHIN",xp: 380,  argent: [2800, 5500],  diff: 5 },
  { id: "E6",  nom: "Sabreur Fou de la Montagne",   pv: 280, ki: 150, ecole: "ITTO",   xp: 600,  argent: [4500, 9000],  diff: 6 },
  { id: "E7",  nom: "Sensei Renégat Ibaraki",       pv: 340, ki: 180, ecole: "YAGYU",  xp: 900,  argent: [7000, 14000], diff: 7 },
  { id: "E8",  nom: "Le Sabre Silencieux",          pv: 420, ki: 220, ecole: "MUSASHI",xp: 1400, argent: [11000, 22000],diff: 8 },
  { id: "E9",  nom: "L'Ombre du Shogun",            pv: 520, ki: 260, ecole: "KASHIMA",xp: 2200, argent: [18000, 35000],diff: 9 },
  { id: "E10", nom: "Le Dernier Ronin Immortel",    pv: 700, ki: 320, ecole: "TENSHIN",xp: 4000, argent: [30000, 60000],diff: 10 },
];

// ══════════════════════════════════════════════════════════════════════════
//  KŌANS ZEN — énigmes résolues via onReply
// ══════════════════════════════════════════════════════════════════════════
const KOANS = [
  { id: "K1", texte: "Un moine demande : quel est le son d'une seule main qui frappe ?", reponses: ["silence", "le vide", "rien"], indice: "Pense à ce qu'il manque pour faire un bruit.", recompenseXp: 150, recompenseArgent: 800 },
  { id: "K2", texte: "Si tu rencontres le Bouddha sur la route, que dois-tu faire ?", reponses: ["le tuer", "tuer le bouddha"], indice: "L'attachement à l'image est un piège, même sacrée.", recompenseXp: 200, recompenseArgent: 1000 },
  { id: "K3", texte: "Quel est ton visage originel, avant la naissance de tes parents ?", reponses: ["le vide", "rien", "aucun visage", "le non-soi"], indice: "Cherche ce qui existe avant toute forme.", recompenseXp: 250, recompenseArgent: 1200 },
  { id: "K4", texte: "Deux mains claquent et il y a un son ; quel est le son d'une seule main ?", reponses: ["silence", "le vide", "rien"], indice: "Le paradoxe pointe vers l'absence.", recompenseXp: 150, recompenseArgent: 800 },
  { id: "K5", texte: "L'oie est dans la bouteille depuis l'œuf ; comment la faire sortir sans casser le verre ni blesser l'oie ?", reponses: ["elle est dehors", "elle est deja dehors", "l'oie est sortie"], indice: "Le maître répondit en frappant le sol et en s'exclamant qu'elle était déjà dehors.", recompenseXp: 300, recompenseArgent: 1500 },
  { id: "K6", texte: "Quand l'arbre tombe seul dans la forêt et que nul n'entend, fait-il un bruit ?", reponses: ["non", "aucun bruit", "le silence"], indice: "Le son n'existe que dans l'oreille qui écoute.", recompenseXp: 200, recompenseArgent: 1000 },
  { id: "K7", texte: "Qu'est-ce qui était ton visage avant que le sabre ne soit forgé ?", reponses: ["le vide", "rien", "le non-etre"], indice: "Avant la forme, il n'y a que le vide originel.", recompenseXp: 220, recompenseArgent: 1100 },
  { id: "K8", texte: "Un maître dit : 'Le sabre le plus tranchant ne coupe pas.' Que coupe-t-il alors ?", reponses: ["l'illusion", "l'ego", "le doute", "l'ignorance"], indice: "Le vrai tranchant agit sur l'esprit, pas sur la chair.", recompenseXp: 280, recompenseArgent: 1400 },
];

// ══════════════════════════════════════════════════════════════════════════
//  SUCCÈS (≥ 20)
// ══════════════════════════════════════════════════════════════════════════
const SUCCES = [
  { id: "S1",  nom: "Premier Pas sur la Voie",      cond: "u => u.duelsGagnes >= 1",       desc: "Remporter son premier duel." },
  { id: "S2",  nom: "Dix Lames Brisées",             cond: "u => u.duelsGagnes >= 10",      desc: "Remporter dix duels." },
  { id: "S3",  nom: "Cent Batailles",                cond: "u => u.duelsGagnes >= 100",     desc: "Remporter cent duels." },
  { id: "S4",  nom: "Le Sang Ne Ment Pas",           cond: "u => u.duelsJoues >= 50",       desc: "Participer à cinquante duels." },
  { id: "S5",  nom: "Esprit du Kōan",                cond: "u => u.koansResolus >= 1",      desc: "Résoudre son premier kōan." },
  { id: "S6",  nom: "Maître Zen",                    cond: "u => u.koansResolus >= 5",      desc: "Résoudre cinq kōans." },
  { id: "S7",  nom: "Illuminé Complet",              cond: "u => u.koansResolus >= 8",      desc: "Résoudre tous les kōans." },
  { id: "S8",  nom: "Forgeron Novice",               cond: "u => u.lamesForgees >= 1",      desc: "Forger sa première lame." },
  { id: "S9",  nom: "Maître Forgeron",               cond: "u => u.lamesForgees >= 5",      desc: "Forger cinq lames." },
  { id: "S10", nom: "Lame Légendaire",               cond: "u => u.lame === 'KUSANAGI'",    desc: "Posséder le Kusanagi." },
  { id: "S11", nom: "Ceinture Noire",                cond: "u => u.grade !== 'MUDANSHA'",   desc: "Obtenir le grade Shodan." },
  { id: "S12", nom: "Grand Maître",                  cond: "u => u.grade === 'HANSHI'",     desc: "Atteindre le rang Hanshi." },
  { id: "S13", nom: "Saint du Sabre",                cond: "u => u.grade === 'KENSEI'",     desc: "Atteindre le rang suprême Kensei." },
  { id: "S14", nom: "Champion du Tournoi",           cond: "u => u.tournoisGagnes >= 1",    desc: "Remporter un tournoi." },
  { id: "S15", nom: "Légende du Tournoi",            cond: "u => u.tournoisGagnes >= 5",    desc: "Remporter cinq tournois." },
  { id: "S16", nom: "Honneur Intact",                cond: "u => u.honneur >= 500",         desc: "Atteindre 500 points d'honneur." },
  { id: "S17", nom: "Chemin de la Rédemption",       cond: "u => u.honneur >= 1000",        desc: "Atteindre 1000 points d'honneur." },
  { id: "S18", nom: "Déchu",                         cond: "u => u.honneur <= -200",        desc: "Sombrer dans le déshonneur." },
  { id: "S19", nom: "Le Réformé",                    cond: "u => u.honneur >= 0 && u.dejaDeshonore",desc: "Retrouver l'honneur après une chute." },
  { id: "S20", nom: "Chasseur d'Immortels",          cond: "u => u.ennemisVaincus.includes('E10')",desc: "Vaincre le Dernier Ronin Immortel." },
  { id: "S21", nom: "Iaido Parfait",                 cond: "u => u.iaidoReussis >= 20",     desc: "Réussir vingt Iaido." },
  { id: "S22", nom: "Vétéran du Dojo",               cond: "u => u.jours >= 30",            desc: "Trente jours de pratique." },
  { id: "S23", nom: "Combo Master",                  cond: "u => u.combosReussis >= 15",    desc: "Réussir quinze enchaînements." },
  { id: "S24", nom: "Le Bien Équipé",                cond: "u => u.lame === 'MASAMUNE' || u.lame === 'MURAMASA' || u.lame === 'KUSANAGI'",desc: "Posséder une lame de légende." },
];

// ══════════════════════════════════════════════════════════════════════════
//  COOLDOWNS
// ══════════════════════════════════════════════════════════════════════════
const COOLDOWNS = {
  DUEL: 20 * 60 * 1000,       // 20 min
  ENTRAINEMENT: 45 * 60 * 1000,
  TOURNOI: 6 * 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  KOAN: 3 * 60 * 60 * 1000,
};

// ══════════════════════════════════════════════════════════════════════════
//  ÉTAT PAR DÉFAUT DU JOUEUR
// ══════════════════════════════════════════════════════════════════════════
function initSamurai() {
  return {
    creation: Date.now(),
    ecole: null,
    grade: "MUDANSHA",
    xp: 0,
    honneur: 0,
    dejaDeshonore: false,
    argent: 500,
    lame: "BAMBOU",
    lamesPossedees: ["BAMBOU"],
    lamesForgees: 0,
    materiaux: {},
    duelsJoues: 0,
    duelsGagnes: 0,
    duelsPerdus: 0,
    tournoisGagnes: 0,
    koansResolus: 0,
    koansEssayes: [],
    iaidoReussis: 0,
    combosReussis: 0,
    ennemisVaincus: [],
    jours: 0,
    dernierJour: 0,
    succesDebloques: [],
    cooldowns: { duel: 0, entrainement: 0, tournoi: 0, daily: 0, koan: 0 },
    historique: [],
    combatEnCours: null,
    tournoiEnCours: null,
    kataMaitrises: [],
  };
}

function migrerSamurai(s) {
  const base = initSamurai();
  for (const k in base) {
    if (s[k] === undefined) s[k] = base[k];
  }
  if (!s.cooldowns) s.cooldowns = base.cooldowns;
  for (const k in base.cooldowns) if (s.cooldowns[k] === undefined) s.cooldowns[k] = 0;
  return s;
}

function getGrade(s) {
  let g = GRADES[0];
  for (const gr of GRADES) if (s.xp >= gr.min) g = gr;
  return g;
}

function getEcole(s) {
  return ECOLES[s.ecole] || null;
}

function getLame(s) {
  return LAMES[s.lame] || LAMES.BAMBOU;
}

function pvMax(s) {
  const g = getGrade(s);
  return 100 + g.bonusPV;
}

function kiMax(s) {
  const g = getGrade(s);
  return 60 + g.bonusKi;
}

function fmtTemps(ms) {
  if (ms <= 0) return "disponible";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function ajouterHistorique(s, texte) {
  s.historique.unshift({ t: Date.now(), texte });
  if (s.historique.length > 25) s.historique.length = 25;
}

function verifierSucces(s) {
  const nouveaux = [];
  for (const suc of SUCCES) {
    if (s.succesDebloques.includes(suc.id)) continue;
    try {
      const fn = eval(`(${suc.cond})`);
      if (fn(s)) {
        s.succesDebloques.push(suc.id);
        nouveaux.push(suc);
      }
    } catch (_) {}
  }
  return nouveaux;
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ══════════════════════════════════════════════════════════════════════════
//  MOTEUR DE COMBAT TOUR PAR TOUR (inspiré de naruto-storm.js)
// ══════════════════════════════════════════════════════════════════════════
function nouveauCombattant(nom, pv, ki, ecoleId, estIA) {
  const ecole = ECOLES[ecoleId] || ECOLES.SEIGAN || Object.values(ECOLES)[0];
  return {
    nom, pv, pvMax: pv, ki, kiMax: ki,
    ecole: ecoleId,
    posture: "CHUDAN",
    statuts: [],
    estIA,
    gardeActive: false,
    dernierAction: null,
  };
}

function appliquerStatuts(c) {
  let malusDef = 0, malusAtt = 0, bonusPrec = 0, malusPrec = 0;
  const survivants = [];
  for (const st of c.statuts) {
    if (st.id === "SAIGNEMENT") c.pv = Math.max(0, c.pv - 4);
    if (st.id === "DESEQUILIBRE") malusDef += 0.30;
    if (st.id === "BRISE") malusDef += 0.50;
    if (st.id === "FOCUS") bonusPrec += 0.15;
    st.duree -= 1;
    if (st.duree > 0) survivants.push(st);
  }
  c.statuts = survivants;
  return { malusDef, malusAtt, bonusPrec, malusPrec };
}

function calculerDegats(attaquant, defenseur, technique, ecoleAtt, ecoleDef, lame) {
  const posture = POSTURES[attaquant.posture] || POSTURES.CHUDAN;
  const postureDef = POSTURES[defenseur.posture] || POSTURES.CHUDAN;
  let base = random(technique.degats[0], technique.degats[1]);
  base += lame ? lame.bonusDeg : 0;
  base *= posture.att;
  if (ecoleAtt) base *= 1 + ecoleAtt.bonusAtt;
  let precision = technique.precision + (lame ? lame.bonusPrec : 0);
  const effStAtt = appliquerStatuts(attaquant);
  precision += effStAtt.bonusPrec;
  const effStDef = appliquerStatuts(defenseur);
  const esquiveChance = postureDef.esquive - effStDef.malusDef * 0.3;
  const toucher = Math.random() < precision;
  if (!toucher) return { touche: false, degats: 0, esquive: false, critique: false };
  const esquive = Math.random() < Math.max(0, esquiveChance);
  if (esquive) return { touche: true, degats: 0, esquive: true, critique: false };
  let defMultiplicateur = postureDef.def;
  if (ecoleDef) defMultiplicateur *= 1 + ecoleDef.bonusDef;
  defMultiplicateur -= effStDef.malusDef;
  defMultiplicateur = Math.max(0.2, defMultiplicateur);
  let degatsFinaux = base / defMultiplicateur;
  const critique = Math.random() < 0.12;
  if (critique) degatsFinaux *= 1.8;
  degatsFinaux = Math.round(degatsFinaux);
  return { touche: true, degats: degatsFinaux, esquive: false, critique };
}

function tourIA(combatState) {
  const ia = combatState.adversaire;
  const joueur = combatState.joueur;
  // IA tactique : régénère le ki si bas, garde si PV faibles, sinon attaque proportionnellement à la difficulté
  if (ia.ki < 15) return { techId: "GARDE" };
  if (ia.pv < ia.pvMax * 0.25 && Math.random() < 0.5) return { techId: "PARADE" };
  const dispo = TECHNIQUES.filter(t => t.coutKi <= ia.ki && t.type !== "garde");
  if (!dispo.length) return { techId: "GARDE" };
  // priorité aux combos et spéciales si ki suffisant, sinon attaques basiques
  const puissantes = dispo.filter(t => t.type === "combo" || t.type === "special");
  if (puissantes.length && Math.random() < 0.35) return { techId: pick(puissantes).id };
  const basiques = dispo.filter(t => t.type === "attaque");
  if (basiques.length) return { techId: pick(basiques).id };
  return { techId: pick(dispo).id };
}

function executerTour(combatState, techIdJoueur, postureJoueur) {
  const { joueur, adversaire } = combatState;
  const log = [];
  if (postureJoueur && POSTURES[postureJoueur]) joueur.posture = postureJoueur;

  const techJ = TECHNIQUES.find(t => t.id === techIdJoueur) || TECHNIQUES.find(t => t.id === "GARDE");
  const techA_choix = tourIA(combatState);
  const techA = TECHNIQUES.find(t => t.id === techA_choix.techId) || TECHNIQUES.find(t => t.id === "GARDE");

  const ecoleJ = ECOLES[joueur.ecole];
  const ecoleA = ECOLES[adversaire.ecole];
  const lameJ = combatState.lameJoueur;

  // Résolution simultanée pondérée par vitesse de posture (Hasso/Waki plus rapides)
  const vitesseJ = (POSTURES[joueur.posture] || POSTURES.CHUDAN).esquive;
  const vitesseA = (POSTURES[adversaire.posture] || POSTURES.CHUDAN).esquive;
  const joueurAgitDabord = vitesseJ >= vitesseA;

  function agirJoueur() {
    if (joueur.ki < techJ.coutKi) {
      log.push(`Vous manquez de ki pour ${techJ.nom} ! Vous adoptez la Garde par défaut.`);
      joueur.ki = Math.min(joueur.kiMax, joueur.ki + 10);
      return;
    }
    joueur.ki -= techJ.coutKi;
    if (techJ.type === "garde") {
      joueur.ki = Math.min(joueur.kiMax, joueur.ki + 15);
      joueur.gardeActive = techJ.id === "PARADE";
      log.push(`Vous adoptez ${techJ.nom}. Votre ki se régénère (+15).`);
      return;
    }
    if (techJ.type === "feinte") {
      adversaire.statuts.push({ id: "DESEQUILIBRE", duree: 2 });
      log.push(`Vous exécutez ${techJ.nom} : l'adversaire est déséquilibré !`);
      return;
    }
    const res = calculerDegats(joueur, adversaire, techJ, ecoleJ, ecoleA, lameJ);
    if (adversaire.gardeActive) {
      log.push(`Votre ${techJ.nom} est parée par la garde adverse !`);
      adversaire.gardeActive = false;
      return;
    }
    if (!res.touche) { log.push(`Votre ${techJ.nom} manque sa cible.`); return; }
    if (res.esquive) { log.push(`L'adversaire esquive votre ${techJ.nom} !`); return; }
    adversaire.pv = Math.max(0, adversaire.pv - res.degats);
    let msg = `Votre ${techJ.nom} inflige ${res.degats} dégâts`;
    if (res.critique) msg += " (COUP CRITIQUE !)";
    log.push(msg + ".");
    if (techJ.type === "combo") combatState.combosReussisJoueur = (combatState.combosReussisJoueur || 0) + 1;
    if (techJ.id === "IAIDO" && res.degats > 0) combatState.iaidoReussisJoueur = (combatState.iaidoReussisJoueur || 0) + 1;
    if (res.critique && Math.random() < 0.4) adversaire.statuts.push({ id: "SAIGNEMENT", duree: 3 });
  }

  function agirAdversaire() {
    if (adversaire.pv <= 0) return;
    if (adversaire.ki < techA.coutKi) {
      adversaire.ki = Math.min(adversaire.kiMax, adversaire.ki + 10);
      log.push(`${adversaire.nom} manque de ki et se replie en garde.`);
      return;
    }
    adversaire.ki -= techA.coutKi;
    if (techA.type === "garde") {
      adversaire.ki = Math.min(adversaire.kiMax, adversaire.ki + 15);
      adversaire.gardeActive = techA.id === "PARADE";
      log.push(`${adversaire.nom} adopte ${techA.nom}.`);
      return;
    }
    if (techA.type === "feinte") {
      joueur.statuts.push({ id: "DESEQUILIBRE", duree: 2 });
      log.push(`${adversaire.nom} vous déséquilibre avec ${techA.nom} !`);
      return;
    }
    const res = calculerDegats(adversaire, joueur, techA, ecoleA, ecoleJ, null);
    if (joueur.gardeActive) {
      log.push(`Vous parez ${techA.nom} de ${adversaire.nom} !`);
      joueur.gardeActive = false;
      return;
    }
    if (!res.touche) { log.push(`${adversaire.nom} rate son ${techA.nom}.`); return; }
    if (res.esquive) { log.push(`Vous esquivez ${techA.nom} !`); return; }
    joueur.pv = Math.max(0, joueur.pv - res.degats);
    let msg = `${adversaire.nom} vous inflige ${res.degats} dégâts avec ${techA.nom}`;
    if (res.critique) msg += " (CRITIQUE !)";
    log.push(msg + ".");
    if (res.critique && Math.random() < 0.4) joueur.statuts.push({ id: "SAIGNEMENT", duree: 3 });
  }

  if (joueurAgitDabord) { agirJoueur(); if (adversaire.pv > 0) agirAdversaire(); }
  else { agirAdversaire(); if (joueur.pv > 0) agirJoueur(); }

  combatState.tour = (combatState.tour || 1) + 1;
  combatState.log = log;
  combatState.historiqueCombat = (combatState.historiqueCombat || []).concat(log);

  if (joueur.pv <= 0 || adversaire.pv <= 0) combatState.termine = true;
  return log;
}

// ══════════════════════════════════════════════════════════════════════════
//  CANVAS — "UKIYO-E GÉOMÉTRIQUE"
// ══════════════════════════════════════════════════════════════════════════
function fondUkiyoE(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PALETTE.papier);
  g.addColorStop(1, PALETTE.papierFonce);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // texture papier : légères fibres horizontales
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = PALETTE.encre;
  for (let y = 0; y < H; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.05) * 2);
    ctx.lineTo(W, y + Math.cos(y * 0.03) * 2);
    ctx.stroke();
  }
  ctx.restore();

  // montagnes en aplats successifs (arrière-plan géométrique)
  const baseY = H * 0.62;
  drawMontagne(ctx, W, baseY + 60, H, PALETTE.montagne1, 0.55, 4);
  drawMontagne(ctx, W, baseY + 30, H, PALETTE.montagne2, 0.7, 5);
  drawMontagne(ctx, W, baseY, H, PALETTE.montagne3, 0.85, 6);

  // cercle enso en haut à droite
  ctx.save();
  ctx.translate(W - 140, 130);
  ctx.rotate(-0.35);
  ctx.strokeStyle = PALETTE.encre;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, 85, 0.15, Math.PI * 2 - 0.4);
  ctx.stroke();
  ctx.restore();

  // trames de vagues en bas
  drawVagues(ctx, W, H);

  // sceau rouge (hanko) en bas à droite
  drawSceau(ctx, W - 90, H - 90, 46);

  // cadre géométrique
  ctx.save();
  ctx.strokeStyle = PALETTE.encre;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.restore();
}

function drawMontagne(ctx, W, baseY, H, color, amplitude, nbPics) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const step = W / nbPics;
  for (let i = 0; i <= nbPics; i++) {
    const x = i * step;
    const y = baseY - (Math.sin(i * 1.3) * 40 + 40) * amplitude;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVagues(ctx, W, H) {
  ctx.save();
  ctx.strokeStyle = PALETTE.vague;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y = H - 30 - row * 14;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const yy = y + Math.sin((x + row * 30) * 0.08) * 6;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSceau(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.sceau;
  rr(ctx, -size / 2, -size / 2, size, size, 6);
  ctx.fill();
  ctx.strokeStyle = "#7a2419";
  ctx.lineWidth = 2;
  rr(ctx, -size / 2, -size / 2, size, size, 6);
  ctx.stroke();
  ctx.fillStyle = "#F4EAD5";
  ctx.font = "bold 16px BK, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SAMURAI", 0, 1);
  ctx.restore();
}

function drawJaugeUkiyo(ctx, x, y, w, h, pct, colorFull, label, valTxt) {
  ctx.save();
  ctx.fillStyle = "#FFFFFF33";
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = PALETTE.encre; ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, h / 2); ctx.stroke();
  const wFill = Math.max(0, Math.min(1, pct)) * (w - 4);
  ctx.fillStyle = colorFull;
  rr(ctx, x + 2, y + 2, wFill, h - 4, (h - 4) / 2); ctx.fill();
  ctx.restore();
  T(ctx, label, x, y - 14, 15, PALETTE.encre, { align: "left" });
  T(ctx, valTxt, x + w, y - 14, 15, PALETTE.encre, { align: "right" });
}

function renderDashboardCanvas(s, nomJoueur) {
  if (!canvasAvailable) return null;
  ensureFonts();
  const W = 1000, H = 620;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  fondUkiyoE(ctx, W, H);

  T(ctx, "VOIE DU SABRE", W / 2, 62, 42, PALETTE.encre, { align: "center", letterSpacing: 6 });
  T(ctx, "DOSSIER DU SABREUR", W / 2, 96, 16, PALETTE.encreClaire, { align: "center", letterSpacing: 4, weight: "normal" });

  ctx.save();
  ctx.strokeStyle = PALETTE.or; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(220, 118); ctx.lineTo(W - 220, 118); ctx.stroke();
  ctx.restore();

  const g = getGrade(s);
  const ecole = getEcole(s);
  const lame = getLame(s);

  T(ctx, nomJoueur.toUpperCase(), 60, 160, 26, PALETTE.encre, { align: "left" });
  T(ctx, `GRADE : ${g.nom}`, 60, 195, 17, PALETTE.encreClaire, { align: "left", weight: "normal" });
  T(ctx, `ECOLE : ${ecole ? ecole.nom : "AUCUNE - CHOISIR AVEC samurai ecole"}`, 60, 220, 17, PALETTE.encreClaire, { align: "left", weight: "normal" });
  T(ctx, `LAME : ${lame.nom}`, 60, 245, 17, PALETTE.encreClaire, { align: "left", weight: "normal" });

  drawJaugeUkiyo(ctx, 60, 300, 380, 22, Math.min(1, s.xp / (GRADES.find(x => x.min > s.xp) || { min: s.xp + 1 }).min), PALETTE.or, "EXPERIENCE", `${numbers.format ? numbers.format(s.xp) : s.xp} XP`);
  const honneurPct = Math.max(0, Math.min(1, (s.honneur + 500) / 1500));
  drawJaugeUkiyo(ctx, 60, 360, 380, 22, honneurPct, s.honneur >= 0 ? PALETTE.montagne3 : PALETTE.sceau, "HONNEUR", `${s.honneur}`);

  // colonne droite : statistiques dans un cadre géométrique
  const bx = 520, by = 150, bw = 420, bh = 300;
  ctx.save();
  ctx.strokeStyle = PALETTE.encre; ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
  T(ctx, "REGISTRE DE COMBAT", bx + bw / 2, by + 30, 20, PALETTE.encre, { align: "center", letterSpacing: 3 });

  const stats = [
    ["DUELS LIVRES", s.duelsJoues],
    ["DUELS GAGNES", s.duelsGagnes],
    ["DUELS PERDUS", s.duelsPerdus],
    ["TOURNOIS REMPORTES", s.tournoisGagnes],
    ["KOANS RESOLUS", `${s.koansResolus} / ${KOANS.length}`],
    ["LAMES FORGEES", s.lamesForgees],
    ["SUCCES DEBLOQUES", `${s.succesDebloques.length} / ${SUCCES.length}`],
    ["ARGENT", `${numbers.format ? numbers.format(s.argent) : s.argent} RYO`],
  ];
  stats.forEach((row, i) => {
    const yy = by + 65 + i * 28;
    T(ctx, row[0], bx + 20, yy, 15, PALETTE.encreClaire, { align: "left", weight: "normal" });
    T(ctx, String(row[1]), bx + bw - 20, yy, 15, PALETTE.encre, { align: "right" });
  });

  // pied de page : montagne signature
  T(ctx, "QUE LA LAME REFLETE L'ESPRIT CALME", W / 2, H - 50, 14, PALETTE.encreClaire, { align: "center", weight: "normal", letterSpacing: 2 });

  return canvas;
}

function renderCombatCanvas(combatState, nomJoueur) {
  if (!canvasAvailable) return null;
  ensureFonts();
  const W = 1000, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  fondUkiyoE(ctx, W, H);

  const { joueur, adversaire } = combatState;

  T(ctx, "DUEL AU PREMIER SANG", W / 2, 58, 34, PALETTE.encre, { align: "center", letterSpacing: 5 });
  T(ctx, `TOUR ${combatState.tour || 1}`, W / 2, 92, 15, PALETTE.encreClaire, { align: "center", weight: "normal", letterSpacing: 3 });

  // Cadre joueur (gauche)
  T(ctx, nomJoueur.toUpperCase(), 60, 140, 22, PALETTE.encre, { align: "left" });
  drawJaugeUkiyo(ctx, 60, 175, 360, 20, joueur.pv / joueur.pvMax, PALETTE.montagne3, "VIE", `${joueur.pv}/${joueur.pvMax}`);
  drawJaugeUkiyo(ctx, 60, 220, 360, 16, joueur.ki / joueur.kiMax, PALETTE.vague, "KI", `${joueur.ki}/${joueur.kiMax}`);
  T(ctx, `POSTURE : ${(POSTURES[joueur.posture] || {}).nom || joueur.posture}`, 60, 260, 14, PALETTE.encreClaire, { align: "left", weight: "normal" });

  // Cadre adversaire (droite)
  T(ctx, adversaire.nom.toUpperCase(), W - 60, 140, 22, PALETTE.encre, { align: "right" });
  drawJaugeUkiyo(ctx, W - 420, 175, 360, 20, adversaire.pv / adversaire.pvMax, PALETTE.sceau, "VIE", `${adversaire.pv}/${adversaire.pvMax}`);
  drawJaugeUkiyo(ctx, W - 420, 220, 360, 16, adversaire.ki / adversaire.kiMax, PALETTE.vagueClaire, "KI", `${adversaire.ki}/${adversaire.kiMax}`);
  T(ctx, `POSTURE : ${(POSTURES[adversaire.posture] || {}).nom || adversaire.posture}`, W - 60, 260, 14, PALETTE.encreClaire, { align: "right", weight: "normal" });

  // symbole VS géométrique central (losange + traits)
  ctx.save();
  ctx.translate(W / 2, 200);
  ctx.strokeStyle = PALETTE.or; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(30, 0); ctx.lineTo(0, 30); ctx.lineTo(-30, 0); ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // journal de combat
  const logY = 320;
  ctx.save();
  ctx.strokeStyle = PALETTE.encre; ctx.lineWidth = 2;
  ctx.strokeRect(60, logY, W - 120, 170);
  ctx.restore();
  T(ctx, "JOURNAL DU DUEL", W / 2, logY + 24, 16, PALETTE.encre, { align: "center", letterSpacing: 3 });
  const lignes = (combatState.log || []).slice(0, 5);
  lignes.forEach((l, i) => {
    T(ctx, l.length > 78 ? l.slice(0, 75) + "..." : l, 80, logY + 55 + i * 22, 13, PALETTE.encreClaire, { align: "left", weight: "normal" });
  });

  return canvas;
}

function renderTournoiCanvas(tournoi) {
  if (!canvasAvailable) return null;
  ensureFonts();
  const W = 900, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  fondUkiyoE(ctx, W, H);

  T(ctx, "TOURNOI DU DOJO", W / 2, 56, 32, PALETTE.encre, { align: "center", letterSpacing: 5 });
  T(ctx, `PHASE : ${tournoi.phase.toUpperCase()}`, W / 2, 88, 15, PALETTE.encreClaire, { align: "center", weight: "normal", letterSpacing: 3 });

  const participants = tournoi.participants;
  const colX = 100, colW = W - 200;
  participants.forEach((p, i) => {
    const y = 140 + i * 40;
    const elimine = p.elimine;
    ctx.save();
    ctx.globalAlpha = elimine ? 0.35 : 1;
    ctx.strokeStyle = PALETTE.encre; ctx.lineWidth = 1.5;
    ctx.strokeRect(colX, y, colW, 30);
    T(ctx, p.nom.toUpperCase(), colX + 12, y + 15, 14, PALETTE.encre, { align: "left" });
    T(ctx, elimine ? "ELIMINE" : "EN LICE", colX + colW - 12, y + 15, 13, elimine ? PALETTE.sceau : PALETTE.montagne3, { align: "right", weight: "normal" });
    ctx.restore();
  });

  return canvas;
}

async function envoyerCanvas(message, canvas, texte, fallbackTexte) {
  if (!canvas) return message.reply(fallbackTexte || texte);
  const os = require("os");
  const tmp = path.join(os.tmpdir(), `samurai_${Date.now()}_${Math.floor(Math.random() * 9999)}.png`);
  try {
    fs.writeFileSync(tmp, canvas.toBuffer("image/png"));
    return new Promise(resolve => {
      message.reply({ body: texte, attachment: fs.createReadStream(tmp) }, (err, info) => {
        try { fs.unlinkSync(tmp); } catch (_) {}
        resolve(info);
      });
    });
  } catch (e) {
    return message.reply(texte);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  TEXTES / MISE EN PAGE (police unicode via fonts.js)
// ══════════════════════════════════════════════════════════════════════════
function renderAide() {
  const L = [];
  L.push(fonts.bold("⚔️ VOIE DU SABRE — GUIDE DE L'ÉCOLE ⚔️"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  L.push(fonts.bold("📜 PROGRESSION"));
  L.push("├─ samurai stat — Fiche du sabreur (canvas)");
  L.push("├─ samurai ecole [nom] — Choisir son école de kenjutsu");
  L.push("├─ samurai grades — Voir les grades de l'école");
  L.push("└─ samurai succes — Voir vos succès débloqués");
  L.push("");
  L.push(fonts.bold("🗡️ COMBAT"));
  L.push("├─ samurai duel — Affronter un ennemi du dojo (tour par tour)");
  L.push("├─ samurai posture [nom] — Changer de posture en duel");
  L.push("├─ samurai tournoi — Lancer un tournoi à élimination");
  L.push("└─ samurai entrainement — Entraînement gratuit (XP réduit)");
  L.push("");
  L.push(fonts.bold("🔨 FORGE"));
  L.push("├─ samurai forge — Voir les lames disponibles");
  L.push("└─ samurai forger [id] — Forger/acheter une lame");
  L.push("");
  L.push(fonts.bold("☯️ ESPRIT ZEN"));
  L.push("├─ samurai koan — Recevoir un kōan à résoudre (répondre au message)");
  L.push("└─ samurai honneur — Voir son niveau d'honneur/déshonneur");
  L.push("");
  L.push(fonts.bold("💰 AUTRE"));
  L.push("├─ samurai daily — Récompense quotidienne");
  L.push("├─ samurai classement — Classement des sabreurs");
  L.push("└─ samurai historique — Historique récent des actions");
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return L.join("\n");
}

function renderEcoles() {
  const L = [];
  L.push(fonts.bold("⛩️ ÉCOLES DE KENJUTSU DISPONIBLES ⛩️"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Object.values(ECOLES).forEach(e => {
    L.push(fonts.bold(`◆ ${e.nom}`));
    L.push(`  ├─ Attaque : ${e.bonusAtt >= 0 ? "+" : ""}${Math.round(e.bonusAtt * 100)}%`);
    L.push(`  ├─ Défense : ${e.bonusDef >= 0 ? "+" : ""}${Math.round(e.bonusDef * 100)}%`);
    L.push(`  └─ ${e.desc}`);
    L.push("");
  });
  L.push("Choisissez avec : samurai ecole <ITTO|YAGYU|MUSASHI|KASHIMA|TENSHIN>");
  return L.join("\n");
}

function renderGrades(s) {
  const L = [];
  L.push(fonts.bold("🎖️ HIÉRARCHIE DE L'ÉCOLE 🎖️"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  GRADES.forEach(g => {
    const actuel = g.id === getGrade(s).id ? "  ← VOUS" : "";
    L.push(`${g.emoji} ${g.nom} — dès ${numbers.format ? numbers.format(g.min) : g.min} XP${actuel}`);
  });
  return L.join("\n");
}

function renderForge(s) {
  const L = [];
  L.push(fonts.bold("🔨 FORGE DU DOJO 🔨"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Object.values(LAMES).forEach(l => {
    const possede = s.lamesPossedees.includes(l.id) ? " ✅ POSSÉDÉE" : "";
    L.push(fonts.bold(`⚔️ ${l.nom}`) + possede);
    L.push(`  ├─ Coût : ${numbers.format ? numbers.format(l.cout) : l.cout} ryō`);
    L.push(`  ├─ Bonus dégâts : +${l.bonusDeg} | Précision : +${Math.round(l.bonusPrec * 100)}%`);
    L.push(`  └─ ${l.emoji_txt}`);
  });
  L.push("");
  L.push(`Forgez avec : samurai forger <ID> (ex: samurai forger ACIER)`);
  L.push(`Votre bourse : ${numbers.format ? numbers.format(s.argent) : s.argent} ryō`);
  return L.join("\n");
}

function renderSucces(s) {
  const L = [];
  L.push(fonts.bold(`🏆 SUCCÈS (${s.succesDebloques.length}/${SUCCES.length}) 🏆`));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  SUCCES.forEach(suc => {
    const ok = s.succesDebloques.includes(suc.id);
    L.push(`${ok ? "✅" : "🔒"} ${suc.nom} — ${suc.desc}`);
  });
  return L.join("\n");
}

function renderClassement(all) {
  const L = [];
  L.push(fonts.bold("📊 CLASSEMENT DES SABREURS 📊"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  all.slice(0, 15).forEach((u, i) => {
    const medaille = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
    L.push(`${medaille} ${u.nom} — ${getGrade(u.s).nom} (${numbers.format ? numbers.format(u.s.xp) : u.s.xp} XP)`);
  });
  return L.join("\n");
}

function renderKoanTexte(koan) {
  const L = [];
  L.push(fonts.bold("☯️ KŌAN ZEN ☯️"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  L.push(fonts.italic(koan.texte));
  L.push("");
  L.push("🧘 Répondez à ce message avec votre interprétation.");
  L.push(`💡 Indice : ${koan.indice}`);
  L.push(`🎁 Récompense : ${koan.recompenseXp} XP et ${koan.recompenseArgent} ryō`);
  return L.join("\n");
}

function renderHonneur(s) {
  const L = [];
  L.push(fonts.bold("🎋 HONNEUR DU SABREUR 🎋"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  L.push(`Points d'honneur actuels : ${s.honneur}`);
  let statut;
  if (s.honneur >= 1000) statut = "☯️ Sabreur Illuminé — Respecté de tous";
  else if (s.honneur >= 500) statut = "🎖️ Sabreur Honorable";
  else if (s.honneur >= 0) statut = "⚖️ Équilibre";
  else if (s.honneur >= -200) statut = "⚠️ Chemin Trouble";
  else statut = "💀 Sabreur Déchu — Déshonneur";
  L.push(`Statut : ${statut}`);
  L.push("");
  L.push("L'honneur augmente en gagnant des duels loyaux, en résolvant des kōans.");
  L.push("Il diminue en fuyant un duel ou en trahissant l'esprit du bushido.");
  return L.join("\n");
}

function renderHistorique(s) {
  const L = [];
  L.push(fonts.bold("📜 HISTORIQUE RÉCENT 📜"));
  L.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (!s.historique.length) L.push("Aucun événement enregistré pour l'instant.");
  s.historique.slice(0, 15).forEach(h => {
    const d = new Date(h.t);
    L.push(`[${d.toLocaleTimeString("fr-FR")}] ${h.texte}`);
  });
  return L.join("\n");
}

// ══════════════════════════════════════════════════════════════════════════
//  GESTION DES COMBATS (persistant en mémoire par thread+user)
// ══════════════════════════════════════════════════════════════════════════
const combatsActifs = new Map(); // clé = senderID -> combatState
const tournoisActifs = new Map(); // clé = senderID -> tournoi
const koansEnAttente = new Map(); // clé = messageID -> { senderID, koan }

function clefCombat(senderID) { return `duel_${senderID}`; }

// ══════════════════════════════════════════════════════════════════════════
//  SOUS-COMMANDES
// ══════════════════════════════════════════════════════════════════════════
async function cmdStat(message, s, senderID, api) {
  const nom = (await getNomUtilisateur(api, senderID)) || "Sabreur";
  const canvas = renderDashboardCanvas(s, nom);
  const texte = [
    fonts.bold(`⚔️ FICHE DE ${nom.toUpperCase()} ⚔️`),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `🎖️ Grade : ${getGrade(s).nom}`,
    `⛩️ École : ${getEcole(s) ? getEcole(s).nom : "aucune (samurai ecole)"}`,
    `🗡️ Lame : ${getLame(s).nom}`,
    `☯️ Honneur : ${s.honneur}`,
    `💰 Bourse : ${numbers.format ? numbers.format(s.argent) : s.argent} ryō`,
  ].join("\n");
  return envoyerCanvas(message, canvas, texte);
}

async function getNomUtilisateur(api, uid) {
  try {
    const info = await api.getUserInfo(uid);
    return info[uid] ? info[uid].name : null;
  } catch (_) { return null; }
}

async function cmdEcole(message, args, s, save) {
  const choix = (args[1] || "").toUpperCase();
  if (!choix) return message.reply(renderEcoles());
  if (!ECOLES[choix]) return message.reply(fonts.bold("❌ École inconnue. Tapez 'samurai ecole' pour voir la liste."));
  if (s.ecole) return message.reply(fonts.bold("⚠️ Vous avez déjà choisi une école. Un sabreur ne renie pas son maître."));
  s.ecole = choix;
  ajouterHistorique(s, `A rejoint l'école ${ECOLES[choix].nom}.`);
  await save();
  return message.reply(fonts.bold(`✅ Vous rejoignez l'école : ${ECOLES[choix].nom} !\n${ECOLES[choix].desc}`));
}

async function cmdGrades(message, s) {
  return message.reply(renderGrades(s));
}

async function cmdForge(message, args, s, save) {
  const id = (args[1] || "").toUpperCase();
  if (!id) return message.reply(renderForge(s));
  const lame = LAMES[id];
  if (!lame) return message.reply(fonts.bold("❌ Lame inconnue. Tapez 'samurai forge' pour la liste."));
  if (s.lamesPossedees.includes(id)) return message.reply(fonts.bold("⚠️ Vous possédez déjà cette lame."));
  if (s.argent < lame.cout) return message.reply(fonts.bold(`❌ Fonds insuffisants. Il vous faut ${numbers.format ? numbers.format(lame.cout) : lame.cout} ryō.`));
  s.argent -= lame.cout;
  s.lamesPossedees.push(id);
  s.lame = id;
  s.lamesForgees += 1;
  ajouterHistorique(s, `A forgé la lame ${lame.nom}.`);
  const nouveaux = verifierSucces(s);
  await save();
  let txt = fonts.bold(`⚒️ Vous avez forgé : ${lame.nom} !`) + `\nElle est maintenant équipée.`;
  if (nouveaux.length) txt += "\n\n🏆 Succès débloqué(s) : " + nouveaux.map(n => n.nom).join(", ");
  return message.reply(txt);
}

async function cmdSucces(message, s) {
  return message.reply(renderSucces(s));
}

async function cmdHonneur(message, s) {
  return message.reply(renderHonneur(s));
}

async function cmdHistorique(message, s) {
  return message.reply(renderHistorique(s));
}

async function cmdDaily(message, s, save) {
  const now = Date.now();
  const cd = s.cooldowns.daily || 0;
  if (now < cd) return message.reply(fonts.bold(`⏳ Revenez dans ${fmtTemps(cd - now)} pour votre récompense quotidienne.`));
  const gain = random(500, 1500);
  const xp = random(30, 80);
  s.argent += gain;
  s.xp += xp;
  s.cooldowns.daily = now + COOLDOWNS.DAILY;
  s.jours += 1;
  ajouterHistorique(s, `A récupéré sa récompense quotidienne (+${gain} ryō, +${xp} XP).`);
  const nouveaux = verifierSucces(s);
  await save();
  let txt = fonts.bold("🎁 RÉCOMPENSE QUOTIDIENNE") + `\n💰 +${gain} ryō\n✨ +${xp} XP`;
  if (nouveaux.length) txt += "\n\n🏆 Succès : " + nouveaux.map(n => n.nom).join(", ");
  return message.reply(txt);
}

async function cmdClassement(message, usersData) {
  try {
    const all = await usersData.getAll();
    const liste = Object.values(all)
      .filter(u => u.data && u.data.samurai && u.data.samurai.ecole)
      .map(u => ({ nom: u.name || "Sabreur", s: migrerSamurai(u.data.samurai) }))
      .sort((a, b) => b.s.xp - a.s.xp);
    return message.reply(renderClassement(liste));
  } catch (e) {
    return message.reply(fonts.bold("❌ Impossible de charger le classement pour le moment."));
  }
}

async function cmdKoan(message, s, senderID, save) {
  const now = Date.now();
  const cd = s.cooldowns.koan || 0;
  if (now < cd) return message.reply(fonts.bold(`⏳ Le maître zen médite encore. Revenez dans ${fmtTemps(cd - now)}.`));
  const disponibles = KOANS.filter(k => !s.koansEssayes.includes(k.id));
  const koan = disponibles.length ? pick(disponibles) : pick(KOANS);
  s.cooldowns.koan = now + COOLDOWNS.KOAN;
  await save();
  const info = await message.reply(renderKoanTexte(koan));
  if (info && info.messageID && global.GoatBot && global.GoatBot.onReply) {
    global.GoatBot.onReply.set(info.messageID, {
      commandName: "samurai",
      messageID: info.messageID,
      author: senderID,
      type: "koan",
      koanId: koan.id,
    });
  }
}

function normaliserTexte(t) {
  return String(t).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").trim();
}

async function traiterReponseKoan(message, event, Reply, s, save) {
  const koan = KOANS.find(k => k.id === Reply.koanId);
  if (!koan) return message.reply(fonts.bold("❌ Ce kōan n'existe plus."));
  const reponseUser = normaliserTexte(event.body || "");
  const correct = koan.reponses.some(r => reponseUser.includes(normaliserTexte(r)));
  if (!s.koansEssayes.includes(koan.id)) s.koansEssayes.push(koan.id);
  if (correct) {
    s.koansResolus += 1;
    s.xp += koan.recompenseXp;
    s.argent += koan.recompenseArgent;
    s.honneur += 30;
    ajouterHistorique(s, `A résolu le kōan "${koan.texte.slice(0, 30)}..."`);
    const nouveaux = verifierSucces(s);
    await save();
    let txt = fonts.bold("☯️ ILLUMINATION ! Vous avez percé le kōan.") +
      `\n✨ +${koan.recompenseXp} XP\n💰 +${koan.recompenseArgent} ryō\n🎋 +30 Honneur`;
    if (nouveaux.length) txt += "\n\n🏆 Succès : " + nouveaux.map(n => n.nom).join(", ");
    return message.reply(txt);
  } else {
    ajouterHistorique(s, `A échoué à résoudre un kōan.`);
    await save();
    return message.reply(fonts.bold("🌫️ Votre esprit n'est pas encore prêt.") + `\nIndice : ${koan.indice}\nRéessayez avec 'samurai koan' plus tard.`);
  }
}

async function cmdDuel(message, args, s, senderID, save, api) {
  const now = Date.now();
  if (!s.ecole) return message.reply(fonts.bold("⚠️ Choisissez d'abord une école avec : samurai ecole"));
  const cd = s.cooldowns.duel || 0;
  if (now < cd) return message.reply(fonts.bold(`⏳ Votre corps a besoin de repos. Revenez dans ${fmtTemps(cd - now)}.`));
  if (combatsActifs.has(senderID)) return message.reply(fonts.bold("⚔️ Un duel est déjà en cours ! Utilisez 'samurai action <technique>'."));

  const gradeIdx = GRADES.findIndex(g => g.id === s.grade);
  const ennemisPossibles = ENNEMIS.filter(e => e.diff <= gradeIdx + 3);
  const ennemi = pick(ennemisPossibles.length ? ennemisPossibles : [ENNEMIS[0]]);

  const joueur = nouveauCombattant("Vous", pvMax(s), kiMax(s), s.ecole, false);
  const adversaire = nouveauCombattant(ennemi.nom, ennemi.pv, ennemi.ki, ennemi.ecole, true);

  const combatState = {
    joueur, adversaire, tour: 1, log: [], termine: false,
    ennemiId: ennemi.id, ennemiData: ennemi,
    lameJoueur: getLame(s),
    combosReussisJoueur: 0, iaidoReussisJoueur: 0,
  };
  combatsActifs.set(senderID, combatState);
  s.cooldowns.duel = now + COOLDOWNS.DUEL;
  await save();

  const nom = (await getNomUtilisateur(api, senderID)) || "Vous";
  const canvas = renderCombatCanvas(combatState, nom);
  const texte = [
    fonts.bold(`⚔️ DUEL ENGAGÉ CONTRE : ${ennemi.nom} ⚔️`),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "🗡️ Techniques : KESA, TSUKI, MEN, KOTE, DO, IAIDO, NUKI, FEINTE, GARDE, PARADE, COMBO1, COMBO2",
    "🧭 Postures : SEIGAN, JODAN, CHUDAN, GEDAN, HASSO, WAKI",
    "",
    "👉 Jouez avec : samurai action <TECHNIQUE> [POSTURE]",
    "Exemple : samurai action KESA HASSO",
  ].join("\n");
  return envoyerCanvas(message, canvas, texte);
}

async function cmdAction(message, args, s, senderID, save, api) {
  const combatState = combatsActifs.get(senderID);
  if (!combatState) return message.reply(fonts.bold("❌ Aucun duel en cours. Lancez-en un avec 'samurai duel'."));
  const techId = (args[1] || "").toUpperCase();
  const postureId = (args[2] || "").toUpperCase();
  const tech = TECHNIQUES.find(t => t.id === techId);
  if (!tech) return message.reply(fonts.bold("❌ Technique inconnue. Voir 'samurai help' pour la liste."));
  const posture = POSTURES[postureId] ? postureId : null;

  executerTour(combatState, techId, posture);

  const nom = (await getNomUtilisateur(api, senderID)) || "Vous";
  const canvas = renderCombatCanvas(combatState, nom);
  let texte = [fonts.bold("⚔️ TOUR RÉSOLU ⚔️"), "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", ...combatState.log].join("\n");

  if (combatState.termine) {
    combatsActifs.delete(senderID);
    if (combatState.joueur.pv <= 0 && combatState.adversaire.pv <= 0) {
      texte += "\n\n🤝 Double chute ! Duel nul.";
      s.duelsJoues += 1;
      s.honneur += 5;
    } else if (combatState.adversaire.pv <= 0) {
      const ennemi = combatState.ennemiData;
      s.duelsJoues += 1; s.duelsGagnes += 1;
      s.xp += ennemi.xp;
      const gain = random(ennemi.argent[0], ennemi.argent[1]);
      s.argent += gain;
      s.honneur += 15;
      if (!s.ennemisVaincus.includes(ennemi.id)) s.ennemisVaincus.push(ennemi.id);
      s.combosReussis += combatState.combosReussisJoueur || 0;
      s.iaidoReussis += combatState.iaidoReussisJoueur || 0;
      ajouterHistorique(s, `A vaincu ${ennemi.nom} en duel (+${ennemi.xp} XP, +${gain} ryō).`);
      texte += `\n\n🏅 VICTOIRE ! +${ennemi.xp} XP, +${gain} ryō, +15 Honneur.`;
      const ancienGrade = s.grade;
      s.grade = getGrade(s).id;
      if (ancienGrade !== s.grade) texte += `\n🎖️ NOUVEAU GRADE : ${getGrade(s).nom} !`;
    } else {
      s.duelsJoues += 1; s.duelsPerdus += 1;
      s.honneur -= 5;
      ajouterHistorique(s, `A été vaincu en duel par ${combatState.ennemiData.nom}.`);
      texte += `\n\n💀 DÉFAITE. Vous devez vous entraîner davantage. -5 Honneur.`;
    }
    const nouveaux = verifierSucces(s);
    if (nouveaux.length) texte += "\n\n🏆 Succès débloqué(s) : " + nouveaux.map(n => n.nom).join(", ");
    await save();
  }
  return envoyerCanvas(message, canvas, texte);
}

async function cmdEntrainement(message, s, senderID, save) {
  const now = Date.now();
  const cd = s.cooldowns.entrainement || 0;
  if (now < cd) return message.reply(fonts.bold(`⏳ Récupérez encore ${fmtTemps(cd - now)} avant de vous entraîner.`));
  const xp = random(15, 40);
  const kata = pick(TECHNIQUES.filter(t => t.type === "attaque" || t.type === "combo"));
  if (!s.kataMaitrises.includes(kata.id)) s.kataMaitrises.push(kata.id);
  s.xp += xp;
  s.cooldowns.entrainement = now + COOLDOWNS.ENTRAINEMENT;
  ajouterHistorique(s, `S'est entraîné au kata ${kata.nom} (+${xp} XP).`);
  const nouveaux = verifierSucces(s);
  await save();
  let txt = fonts.bold(`🧘 ENTRAÎNEMENT TERMINÉ`) + `\nVous répétez le kata : ${kata.nom}\n✨ +${xp} XP`;
  if (nouveaux.length) txt += "\n\n🏆 Succès : " + nouveaux.map(n => n.nom).join(", ");
  return message.reply(txt);
}

async function cmdTournoi(message, args, s, senderID, save) {
  const now = Date.now();
  if (!s.ecole) return message.reply(fonts.bold("⚠️ Choisissez d'abord une école avec : samurai ecole"));
  const cd = s.cooldowns.tournoi || 0;
  if (now < cd) return message.reply(fonts.bold(`⏳ Le prochain tournoi ouvre dans ${fmtTemps(cd - now)}.`));
  if (tournoisActifs.has(senderID)) return message.reply(fonts.bold("🏆 Un tournoi est déjà en cours ! Utilisez 'samurai tournoi combattre'."));

  const nbParticipants = 8;
  const participants = [{ nom: "Vous", id: senderID, elimine: false, estJoueur: true }];
  for (let i = 1; i < nbParticipants; i++) {
    participants.push({ nom: pick(ENNEMIS).nom + ` #${i}`, id: `ia_${i}`, elimine: false, estJoueur: false });
  }
  const tournoi = { participants, phase: "huitièmes", round: 1, senderID };
  tournoisActifs.set(senderID, tournoi);
  s.cooldowns.tournoi = now + COOLDOWNS.TOURNOI;
  await save();
  const canvas = renderTournoiCanvas(tournoi);
  const texte = [
    fonts.bold("🏆 TOURNOI DU DOJO OUVERT ! 🏆"),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `8 sabreurs s'affrontent en élimination directe.`,
    `Utilisez 'samurai tournoi combattre' pour lancer votre prochain match.`,
  ].join("\n");
  return envoyerCanvas(message, canvas, texte);
}

async function cmdTournoiCombattre(message, args, s, senderID, save, api) {
  const tournoi = tournoisActifs.get(senderID);
  if (!tournoi) return message.reply(fonts.bold("❌ Aucun tournoi en cours. Lancez-en un avec 'samurai tournoi'."));
  const joueur = tournoi.participants.find(p => p.estJoueur);
  if (joueur.elimine) return message.reply(fonts.bold("💀 Vous avez déjà été éliminé de ce tournoi."));

  const restants = tournoi.participants.filter(p => !p.elimine);
  if (restants.length <= 1) {
    tournoisActifs.delete(senderID);
    s.tournoisGagnes += 1;
    s.xp += 800;
    s.argent += 5000;
    s.honneur += 50;
    ajouterHistorique(s, `A remporté le tournoi du dojo !`);
    const nouveaux = verifierSucces(s);
    await save();
    let txt = fonts.bold("🏆 VOUS REMPORTEZ LE TOURNOI DU DOJO ! 🏆") + `\n✨ +800 XP\n💰 +5000 ryō\n🎋 +50 Honneur`;
    if (nouveaux.length) txt += "\n\n🏆 Succès : " + nouveaux.map(n => n.nom).join(", ");
    return message.reply(txt);
  }

  // simuler le match du joueur contre un adversaire aléatoire restant
  const adversairesPossibles = restants.filter(p => !p.estJoueur);
  const adv = pick(adversairesPossibles.length ? adversairesPossibles : restants);
  const ennemi = pick(ENNEMIS);
  const jComb = nouveauCombattant("Vous", pvMax(s), kiMax(s), s.ecole, false);
  const aComb = nouveauCombattant(adv.nom, ennemi.pv, ennemi.ki, ennemi.ecole, true);
  const combatState = { joueur: jComb, adversaire: aComb, tour: 1, log: [], termine: false, lameJoueur: getLame(s) };

  let tours = 0;
  while (!combatState.termine && tours < 30) {
    executerTour(combatState, pick(["KESA", "TSUKI", "MEN", "DO", "COMBO1", "GARDE"]), pick(Object.keys(POSTURES)));
    tours++;
  }

  const texteLog = combatState.historiqueCombat.slice(-6).join("\n");
  if (combatState.joueur.pv <= 0) {
    joueur.elimine = true;
    tournoisActifs.set(senderID, tournoi);
    ajouterHistorique(s, `Éliminé du tournoi par ${adv.nom}.`);
    await save();
    return message.reply(fonts.bold(`💀 ÉLIMINÉ DU TOURNOI par ${adv.nom} !`) + "\n\n" + texteLog);
  } else {
    adv.elimine = true;
    tournoi.round += 1;
    tournoisActifs.set(senderID, tournoi);
    const canvas = renderTournoiCanvas(tournoi);
    return envoyerCanvas(message, canvas, fonts.bold(`✅ VICTOIRE contre ${adv.nom} ! Vous avancez dans le tournoi.`) + "\n\n" + texteLog + "\n\nRelancez 'samurai tournoi combattre' pour le prochain round.");
  }
}

async function cmdPosture(message, args, senderID) {
  const combatState = combatsActifs.get(senderID);
  if (!combatState) return message.reply(fonts.bold("❌ Aucun duel en cours."));
  const p = (args[1] || "").toUpperCase();
  if (!POSTURES[p]) return message.reply(fonts.bold("❌ Posture inconnue. Postures: " + Object.keys(POSTURES).join(", ")));
  combatState.joueur.posture = p;
  return message.reply(fonts.bold(`🧭 Posture changée : ${POSTURES[p].nom}`) + `\n${POSTURES[p].desc}`);
}

// ══════════════════════════════════════════════════════════════════════════
//  EXPORT GOATBOT
// ══════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "samurai",
    aliases: ["sabre", "kenjutsu", "bushido"],
    version: "1.0",
    author: "Christus",
    countDown: 3,
    role: 0,
    category: "game",
    description: {
      fr: "⚔️ Voie du Sabre — École de kenjutsu, duels tactiques au premier sang, forge de lames et kōans zen.",
    },
    guide: {
      fr: "{p}samurai help — Voir toutes les sous-commandes de l'école de kenjutsu.",
    },
  },

  onStart: async function ({ message, event, args, api, usersData, threadsData, commandName }) {
    const { senderID } = event;
    const sub = (args[0] || "help").toLowerCase();

    let user = await usersData.get(senderID);
    if (!user) user = { money: 0, exp: 0, data: {} };
    if (!user.data) user.data = {};
    if (!user.data.samurai) user.data.samurai = initSamurai();
    const s = migrerSamurai(user.data.samurai);

    const save = async () => {
      user.data.samurai = s;
      await usersData.set(senderID, user);
    };

    switch (sub) {
      case "help":
      case "aide":
        return message.reply(renderAide());

      case "stat":
      case "status":
      case "fiche":
        return cmdStat(message, s, senderID, api);

      case "ecole":
      case "school":
        return cmdEcole(message, args, s, save);

      case "grades":
      case "grade":
        return cmdGrades(message, s);

      case "forge":
        return cmdForge(message, args, s, save);

      case "forger":
        return cmdForge(message, ["forge", args[1]], s, save);

      case "succes":
      case "achievements":
        return cmdSucces(message, s);

      case "honneur":
        return cmdHonneur(message, s);

      case "historique":
      case "history":
        return cmdHistorique(message, s);

      case "daily":
        return cmdDaily(message, s, save);

      case "classement":
      case "leaderboard":
        return cmdClassement(message, usersData);

      case "koan":
        return cmdKoan(message, s, senderID, save);

      case "duel":
        return cmdDuel(message, args, s, senderID, save, api);

      case "action":
        return cmdAction(message, args, s, senderID, save, api);

      case "posture":
        return cmdPosture(message, args, senderID);

      case "entrainement":
      case "training":
        return cmdEntrainement(message, s, senderID, save);

      case "tournoi":
        if ((args[1] || "").toLowerCase() === "combattre") return cmdTournoiCombattre(message, args, s, senderID, save, api);
        return cmdTournoi(message, args, s, senderID, save);

      default:
        return message.reply(fonts.bold("❓ Commande inconnue. Tapez 'samurai help' pour voir la liste des ordres."));
    }
  },

  onReply: async function ({ message, event, Reply, api, usersData }) {
    const { senderID } = event;
    if (Reply.author && Reply.author !== senderID) return;

    let user = await usersData.get(senderID);
    if (!user) user = { money: 0, exp: 0, data: {} };
    if (!user.data) user.data = {};
    if (!user.data.samurai) user.data.samurai = initSamurai();
    const s = migrerSamurai(user.data.samurai);

    const save = async () => {
      user.data.samurai = s;
      await usersData.set(senderID, user);
    };

    if (Reply.type === "koan") {
      if (global.GoatBot && global.GoatBot.onReply) global.GoatBot.onReply.delete(Reply.messageID);
      return traiterReponseKoan(message, event, Reply, s, save);
    }
  },
};
