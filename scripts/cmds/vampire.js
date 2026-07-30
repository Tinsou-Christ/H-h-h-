"use strict";
/**
 * ══════════════════════════════════════════════════════════════════════
 *  🩸 COUR DES SANGS — Intrigue nocturne, clans vampiriques, complots
 *  Auteur : Christus | Version 1.0
 *  Genre  : Politique de cour + déduction sociale + duels tour par tour
 *  Direction artistique canvas : Art Déco Baroque (or / bordeaux, arabesques
 *  symétriques, cadres en biseau, motifs en éventail) — SANS EMOJI dans le canvas.
 * ══════════════════════════════════════════════════════════════════════
 */

const fonts = require('../../func/font.js');
const numbers = require('../../func/number.js');

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
	const cv = require("canvas");
	loadImage = cv.loadImage;
	createCanvas = cv.createCanvas;
	registerFont = cv.registerFont;
	canvasAvailable = true;
} catch (e) {
	console.error("[COUR DES SANGS] Canvas indisponible, bascule en mode texte :", e.message);
}

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
			["NotoSans-Regular.ttf", "BK", "normal"]
		];
		for (const [f, fam, w] of fontFiles) {
			try {
				const fp = path.join(fd, f);
				if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
			} catch (_) {}
		}
	} catch (_) {}
}

const TMP_DIR = path.join(__dirname, "cache_vampire");
try { fs.ensureDirSync(TMP_DIR); } catch (_) {}

/* ═══════════════════════════════════════════════════════════════════
 *  OUTILS CANVAS GÉNÉRIQUES (art déco baroque)
 * ═══════════════════════════════════════════════════════════════════ */

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

function T(ctx, s, x, y, sz, color, { align = "left", weight = "bold", alpha = 1, letterSpacing = 0 } = {}) {
	ctx.save(); ctx.globalAlpha = alpha;
	ctx.font = `${weight} ${sz}px BK, Arial`;
	ctx.textAlign = letterSpacing ? "left" : align;
	ctx.textBaseline = "middle";
	ctx.fillStyle = color;
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

function GL(ctx, x1, y1, x2, y2, color, w = 1.2) {
	ctx.save();
	ctx.strokeStyle = color; ctx.lineWidth = w;
	ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
	ctx.restore();
}

// Palette Art Déco Baroque : or profond + bordeaux + noir laqué
const PALETTE = {
	bg1: "#0C0406",
	bg2: "#1A0A0E",
	bordeaux: "#5A0E1C",
	bordeauxDark: "#2E0710",
	or: "#D4AF37",
	orClair: "#F1D98B",
	orFonce: "#8A6A1E",
	ivoire: "#E9DFC8",
	sang: "#7A0C1E",
	ombre: "#050203",
};

/** Dessine un motif d'arabesque symétrique (courbes miroir) dans un rectangle */
function drawArabesque(ctx, cx, cy, radius, color, alpha = 0.5) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.4;
	for (let side = -1; side <= 1; side += 2) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(side, 1);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.bezierCurveTo(radius * 0.3, -radius * 0.6, radius * 0.7, -radius * 0.2, radius, 0);
		ctx.bezierCurveTo(radius * 0.7, radius * 0.2, radius * 0.3, radius * 0.6, 0, 0);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(radius * 0.55, 0, radius * 0.10, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
}

/** Motif en éventail (fan) — pointe en bas, rayons symétriques */
function drawFan(ctx, cx, cy, r, rayCount, color, alpha = 0.35, spread = Math.PI * 0.8) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	const start = -Math.PI / 2 - spread / 2;
	for (let i = 0; i <= rayCount; i++) {
		const a = start + (spread * i) / rayCount;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		ctx.stroke();
	}
	for (let rr2 = r * 0.35; rr2 <= r; rr2 += r * 0.22) {
		ctx.beginPath();
		ctx.arc(cx, cy, rr2, start, start + spread);
		ctx.stroke();
	}
	ctx.restore();
}

/** Cadre en biseau (double liseré or/bordeaux avec coins taillés) */
function drawBevelFrame(ctx, x, y, w, h, cut = 18) {
	ctx.save();
	ctx.strokeStyle = PALETTE.or;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x + cut, y);
	ctx.lineTo(x + w - cut, y);
	ctx.lineTo(x + w, y + cut);
	ctx.lineTo(x + w, y + h - cut);
	ctx.lineTo(x + w - cut, y + h);
	ctx.lineTo(x + cut, y + h);
	ctx.lineTo(x, y + h - cut);
	ctx.lineTo(x, y + cut);
	ctx.closePath();
	ctx.stroke();
	ctx.strokeStyle = PALETTE.bordeaux;
	ctx.lineWidth = 1;
	ctx.save(); ctx.beginPath();
	ctx.moveTo(x + cut + 5, y + 5);
	ctx.lineTo(x + w - cut - 5, y + 5);
	ctx.lineTo(x + w - 5, y + cut + 5);
	ctx.lineTo(x + w - 5, y + h - cut - 5);
	ctx.lineTo(x + w - cut - 5, y + h - 5);
	ctx.lineTo(x + cut + 5, y + h - 5);
	ctx.lineTo(x + 5, y + h - cut - 5);
	ctx.lineTo(x + 5, y + cut + 5);
	ctx.closePath();
	ctx.stroke();
	ctx.restore();
	ctx.restore();
}

function drawBackground(ctx, W, H) {
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, PALETTE.bg1);
	g.addColorStop(0.5, PALETTE.bordeauxDark);
	g.addColorStop(1, PALETTE.bg1);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// arabesques symétriques en fond, grille régulière
	for (let y = 60; y < H; y += 140) {
		for (let x = 80; x < W; x += 220) {
			drawArabesque(ctx, x, y, 60, PALETTE.orFonce, 0.10);
		}
	}
	// vignette
	const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
	v.addColorStop(0, "rgba(0,0,0,0)");
	v.addColorStop(1, "rgba(0,0,0,0.55)");
	ctx.fillStyle = v;
	ctx.fillRect(0, 0, W, H);
	// fine bordure générale
	ctx.strokeStyle = PALETTE.or;
	ctx.lineWidth = 6;
	ctx.strokeRect(6, 6, W - 12, H - 12);
	ctx.strokeStyle = PALETTE.bordeaux;
	ctx.lineWidth = 2;
	ctx.strokeRect(16, 16, W - 32, H - 32);
}

/** Barre de jauge (PV / sang / humanité) façon corniche dorée */
function drawGauge(ctx, x, y, w, h, ratio, colorA, colorB, label, valueText) {
	ratio = Math.max(0, Math.min(1, ratio));
	rr(ctx, x, y, w, h, 6);
	ctx.fillStyle = "rgba(0,0,0,0.55)";
	ctx.fill();
	const g = ctx.createLinearGradient(x, y, x + w, y);
	g.addColorStop(0, colorA);
	g.addColorStop(1, colorB);
	rr(ctx, x + 2, y + 2, Math.max(0, (w - 4) * ratio), h - 4, 5);
	ctx.fillStyle = g;
	ctx.fill();
	rr(ctx, x, y, w, h, 6);
	ctx.strokeStyle = PALETTE.or;
	ctx.lineWidth = 1.5;
	ctx.stroke();
	T(ctx, label, x + 8, y - 11, 15, PALETTE.orClair, { align: "left", weight: "700" });
	T(ctx, valueText, x + w - 8, y - 11, 14, PALETTE.ivoire, { align: "right", weight: "600" });
}

async function fetchAvatar(uid) {
	try {
		const url = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
		const res = await axios.get(url, { responseType: "arraybuffer", timeout: 8000 });
		return await loadImage(Buffer.from(res.data));
	} catch (_) { return null; }
}

function drawAvatarMedallion(ctx, img, cx, cy, r) {
	ctx.save();
	ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
	if (img) {
		ctx.save(); ctx.clip();
		ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
		ctx.restore();
	} else {
		ctx.fillStyle = PALETTE.bordeauxDark;
		ctx.fill();
	}
	ctx.lineWidth = 4;
	ctx.strokeStyle = PALETTE.or;
	ctx.stroke();
	ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
	ctx.lineWidth = 1.4; ctx.strokeStyle = PALETTE.orFonce; ctx.stroke();
	ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════════
 *  DONNÉES DE JEU
 * ═══════════════════════════════════════════════════════════════════ */

const CLANS = {
	DRACONIS:  { id: "DRACONIS",  nom: "Maison Draconis",   devise: "Le sang commande",       bonus: "sang +15%",       couleur: "#8A0E1E", trait: "force" },
	NOCTUARI:  { id: "NOCTUARI",  nom: "Maison Noctuari",   devise: "L'ombre nous couvre",     bonus: "furtivité +15%",  couleur: "#2B1C3F", trait: "ombre" },
	VELANTHE:  { id: "VELANTHE",  nom: "Maison Velanthe",   devise: "La beauté est une arme",  bonus: "influence +15%",  couleur: "#7A4A0E", trait: "charme" },
	MORTHYS:   { id: "MORTHYS",   nom: "Maison Morthys",    devise: "La mort nous obéit",      bonus: "esprit +15%",     couleur: "#1E3B2E", trait: "esprit" },
	SANGREAL:  { id: "SANGREAL",  nom: "Maison Sangréal",   devise: "Le trône par le sang",    bonus: "toutes stats +5%",trait: "royal", couleur: "#5A0E1C" },
};

const POUVOIRS = [
	{ id: "GRIFFE",     nom: "Griffe Écarlate",   tier: 1, cout: 0,  degats: [14, 22], desc: "Une lacération rapide et précise." },
	{ id: "ETREINTE",   nom: "Étreinte Glaciale", tier: 1, cout: 10, degats: [10, 16], effet: "gel", desc: "Ralentit l'ennemi d'un tour." },
	{ id: "HYPNOSE",    nom: "Regard Hypnotique", tier: 2, cout: 18, degats: [0, 0],   effet: "confusion", desc: "L'ennemi rate son prochain assaut (50%)." },
	{ id: "MORSURE",    nom: "Morsure Ancestrale",tier: 2, cout: 22, degats: [20, 32], effet: "vol_de_sang", desc: "Draine des PV et restaure du sang." },
	{ id: "BRUME",      nom: "Forme de Brume",    tier: 2, cout: 16, degats: [0, 0],   effet: "esquive_totale", desc: "Esquive garantie ce tour, +sang." },
	{ id: "TEMPETE",    nom: "Tempête de Corbeaux",tier: 3, cout: 30, degats: [26, 40], effet: "saignement", desc: "Dégâts + saignement sur 3 tours." },
	{ id: "DOMINATION", nom: "Domination Royale", tier: 3, cout: 35, degats: [30, 46], effet: "etourdissement", desc: "Coup dévastateur, étourdit l'ennemi." },
	{ id: "EVEIL",      nom: "Éveil du Sang Ancien", tier: 4, cout: 50, degats: [45, 65], effet: "critique_garanti", desc: "Le pouvoir ultime des Anciens." },
];

const PNJ_MORTELS = [
	{ id: "CHANCELIER", nom: "Chancelier Aldric Vane", poste: "Chancelier de la Cité", influence_max: 100, trait: "prudent" },
	{ id: "CAPITAINE",  nom: "Capitaine Ysolde Marr",  poste: "Garde de Nuit",         influence_max: 100, trait: "loyal" },
	{ id: "MARCHANDE",  nom: "Marchande Odalys Fen",   poste: "Guilde des Marchands",  influence_max: 100, trait: "cupide" },
	{ id: "PRETRE",     nom: "Prêtre Cassian Thorn",   poste: "Clergé du Lumen",       influence_max: 100, trait: "fanatique" },
	{ id: "JUGE",       nom: "Juge Elowen Dray",       poste: "Cour de Justice",       influence_max: 100, trait: "impartial" },
	{ id: "ESPIONNE",   nom: "Espionne Mira Kessel",   poste: "Réseau d'ombre",        influence_max: 100, trait: "insaisissable" },
];

const INDICES_POOL = [
	"a été vu quittant les jardins suspendus après minuit",
	"porte une bague ornée du sceau d'une maison rivale",
	"a menti sur l'heure de son dernier repas de sang",
	"correspond en secret avec un émissaire étranger",
	"a payé une dette avec de l'argent d'origine inconnue",
	"évite soigneusement le regard du Chancelier depuis trois nuits",
	"possède une clé du passage souterrain de la crypte est",
	"a été aperçu en compagnie d'un chasseur de vampires",
	"a modifié les registres de la garde de nuit",
	"porte une odeur de soufre, signe d'un rituel interdit",
	"a un alibi qui ne correspond pas au témoignage du sommelier",
	"a été surpris en train de brûler une lettre scellée",
];

const SUCCES = [
	{ id: "PREMIER_SANG",   nom: "Premier Sang",          desc: "Chasser pour la première fois.", cond: (d) => d.stats.chasses >= 1 },
	{ id: "DIPLOMATE_NUIT", nom: "Diplomate de la Nuit",  desc: "Influencer 5 PNJ différents.",    cond: (d) => Object.keys(d.influences).length >= 5 },
	{ id: "SANG_PUR",       nom: "Sang Pur",               desc: "Atteindre 100 points de sang.",   cond: (d) => d.sang >= 100 },
	{ id: "GARDIEN_HUMANITE",nom: "Gardien de l'Humanité", desc: "Garder l'humanité à 100.",         cond: (d) => d.humanite >= 100 },
	{ id: "AME_DAMNEE",     nom: "Âme Damnée",             desc: "Descendre l'humanité à 0.",        cond: (d) => d.humanite <= 0 },
	{ id: "DETECTIVE",      nom: "Détective des Ombres",   desc: "Résoudre une intrigue.",           cond: (d) => d.stats.intriguesResolues >= 1 },
	{ id: "MAITRE_ENQUETE", nom: "Maître Enquêteur",       desc: "Résoudre 5 intrigues.",            cond: (d) => d.stats.intriguesResolues >= 5 },
	{ id: "DUELLISTE",      nom: "Duelliste de Sang",      desc: "Gagner un duel.",                  cond: (d) => d.stats.duelsGagnes >= 1 },
	{ id: "CHAMPION_COUR",  nom: "Champion de la Cour",    desc: "Gagner 10 duels.",                 cond: (d) => d.stats.duelsGagnes >= 10 },
	{ id: "ANCIEN",         nom: "Ancien du Sang",         desc: "Atteindre le niveau 10.",          cond: (d) => d.niveau >= 10 },
	{ id: "IMMORTEL",       nom: "Immortel",                desc: "Atteindre le niveau 25.",          cond: (d) => d.niveau >= 25 },
	{ id: "MAITRE_POUVOIRS",nom: "Maître des Pouvoirs",    desc: "Débloquer tous les pouvoirs.",      cond: (d) => d.pouvoirs.length >= POUVOIRS.length },
	{ id: "SEIGNEUR_CLAN",  nom: "Seigneur de Clan",       desc: "Rejoindre un clan.",                cond: (d) => !!d.clan },
	{ id: "SURVIVANT_AUBE", nom: "Survivant de l'Aube",    desc: "Survivre à l'aube 3 fois.",         cond: (d) => d.stats.aubesSurvecues >= 3 },
	{ id: "TRAQUE_NOCTURNE",nom: "Traque Nocturne",        desc: "Chasser 20 fois.",                  cond: (d) => d.stats.chasses >= 20 },
	{ id: "RICHESSE_SANG",  nom: "Richesse de Sang",       desc: "Posséder 500 points de sang cumulés.", cond: (d) => d.stats.sangTotalGagne >= 500 },
	{ id: "MANIPULATEUR",   nom: "Grand Manipulateur",      desc: "Influence totale >= 300.",         cond: (d) => Object.values(d.influences).reduce((a, b) => a + b, 0) >= 300 },
	{ id: "COLLECTIONNEUR", nom: "Collectionneur de Reliques", desc: "Posséder 5 reliques.",         cond: (d) => (d.inventaire || []).length >= 5 },
	{ id: "SANS_PITIE",     nom: "Sans Pitié",              desc: "Perdre 50 humanité en une nuit.",  cond: (d) => d.stats.perteHumaniteMax >= 50 },
	{ id: "GARDE_ROBE_ROYALE", nom: "Garde-Robe Royale",   desc: "Atteindre le rang Sangréal Royal.", cond: (d) => d.niveau >= 20 && d.clan === "SANGREAL" },
	{ id: "OEIL_DE_LYNX",   nom: "Œil de Lynx",             desc: "Trouver 15 indices.",              cond: (d) => d.stats.indicesTrouves >= 15 },
	{ id: "REVENANT",       nom: "Revenant",                desc: "Perdre un duel puis en gagner un.",cond: (d) => d.stats.duelsGagnes >= 1 && d.stats.duelsPerdus >= 1 },
];

const GRADES = [
	{ min: 0,  nom: "Fledgling",       titre: "Nouveau-Né" },
	{ min: 3,  nom: "Néophyte",        titre: "Néophyte du Sang" },
	{ min: 6,  nom: "Courtisan",       titre: "Courtisan de la Nuit" },
	{ min: 10, nom: "Seigneur Mineur", titre: "Seigneur Mineur" },
	{ min: 15, nom: "Voïvode",         titre: "Voïvode" },
	{ min: 20, nom: "Prince de Cour",  titre: "Prince de la Cour" },
	{ min: 30, nom: "Ancien",          titre: "Ancien Immémorial" },
];

const RIVAUX = [
	{ nom: "Lord Kaine Ravenscroft", pvBase: 140, sangBase: 60, pouvoirs: ["GRIFFE", "ETREINTE", "MORSURE"] },
	{ nom: "Dame Isadora Vex",       pvBase: 150, sangBase: 70, pouvoirs: ["GRIFFE", "HYPNOSE", "TEMPETE"] },
	{ nom: "Baron Ulric Thorne",     pvBase: 165, sangBase: 80, pouvoirs: ["ETREINTE", "MORSURE", "DOMINATION"] },
	{ nom: "Comtesse Séraphine Noir",pvBase: 175, sangBase: 85, pouvoirs: ["BRUME", "TEMPETE", "DOMINATION"] },
	{ nom: "Duc Alaric Sombreval",   pvBase: 200, sangBase: 100,pouvoirs: ["MORSURE", "DOMINATION", "EVEIL"] },
];

const COOLDOWNS = {
	CHASSER: 45 * 60 * 1000,
	INFLUENCE: 60 * 60 * 1000,
	ENQUETER: 20 * 60 * 1000,
	DUEL: 30 * 60 * 1000,
	DAILY: 24 * 60 * 60 * 1000,
	AUBE: 8 * 60 * 60 * 1000,
};

/* ═══════════════════════════════════════════════════════════════════
 *  INITIALISATION / PERSISTANCE
 * ═══════════════════════════════════════════════════════════════════ */

function initVampire() {
	return {
		clan: null,
		niveau: 1,
		xp: 0,
		sang: 20,
		humanite: 80,
		pouvoirs: ["GRIFFE"],
		inventaire: [],
		influences: {}, // pnjId -> valeur 0-100
		intrigueActuelle: null, // { suspects:[], coupable, indicesDecouverts:[], commencedAt }
		duelEnCours: null,
		cooldowns: {},
		succes: [],
		historique: [],
		stats: {
			chasses: 0, duelsGagnes: 0, duelsPerdus: 0, intriguesResolues: 0,
			aubesSurvecues: 0, indicesTrouves: 0, sangTotalGagne: 0, perteHumaniteMax: 0,
		},
		dailyStreak: 0,
		lastDaily: 0,
		derniereActivite: Date.now(),
	};
}

function migrateVampire(d) {
	const base = initVampire();
	for (const k of Object.keys(base)) {
		if (d[k] === undefined) d[k] = base[k];
	}
	for (const k of Object.keys(base.stats)) {
		if (d.stats[k] === undefined) d.stats[k] = base.stats[k];
	}
	return d;
}

async function getVampire(usersData, uid) {
	const data = await usersData.get(uid);
	if (!data.courDesSangs) data.courDesSangs = initVampire();
	else data.courDesSangs = migrateVampire(data.courDesSangs);
	return data.courDesSangs;
}

async function saveVampire(usersData, uid, vamp) {
	await usersData.set(uid, vamp, "courDesSangs");
}

function pushHistorique(vamp, texte) {
	vamp.historique.unshift({ t: Date.now(), texte });
	if (vamp.historique.length > 30) vamp.historique.pop();
}

function xpRequis(niveau) { return Math.floor(80 * Math.pow(niveau, 1.55)); }

function gagnerXp(vamp, montant) {
	vamp.xp += montant;
	let leveled = false;
	while (vamp.xp >= xpRequis(vamp.niveau)) {
		vamp.xp -= xpRequis(vamp.niveau);
		vamp.niveau++;
		leveled = true;
	}
	return leveled;
}

function gradeActuel(niveau) {
	let g = GRADES[0];
	for (const gr of GRADES) if (niveau >= gr.min) g = gr;
	return g;
}

function checkSucces(vamp) {
	const nouveaux = [];
	for (const s of SUCCES) {
		if (!vamp.succes.includes(s.id) && s.cond(vamp)) {
			vamp.succes.push(s.id);
			nouveaux.push(s);
		}
	}
	return nouveaux;
}

function checkCooldown(vamp, key) {
	const last = vamp.cooldowns[key] || 0;
	const dur = COOLDOWNS[key] || 0;
	const reste = last + dur - Date.now();
	return reste > 0 ? reste : 0;
}

function setCooldown(vamp, key) { vamp.cooldowns[key] = Date.now(); }

function formatDuree(ms) {
	if (ms <= 0) return "disponible";
	const s = Math.ceil(ms / 1000);
	const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

/* ═══════════════════════════════════════════════════════════════════
 *  RENDU CANVAS — DASHBOARD DE COUR
 * ═══════════════════════════════════════════════════════════════════ */

async function renderDashboard(vamp, userName, uid) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 1250;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawBackground(ctx, W, H);

	// Titre
	T(ctx, "COUR DES SANGS", W / 2, 78, 46, PALETTE.or, { align: "center", weight: "900", letterSpacing: 6 });
	T(ctx, "REGISTRE DE COUR NOCTURNE", W / 2, 118, 16, PALETTE.orClair, { align: "center", weight: "600", letterSpacing: 4 });
	GL(ctx, 80, 145, W - 80, 145, PALETTE.or, 2);
	drawFan(ctx, W / 2, 145, 70, 9, PALETTE.orFonce, 0.35);

	// Médaillon avatar
	const img = await fetchAvatar(uid).catch(() => null);
	drawAvatarMedallion(ctx, img, 150, 240, 68);

	const clanData = vamp.clan ? CLANS[vamp.clan] : null;
	const grade = gradeActuel(vamp.niveau);
	T(ctx, userName.toUpperCase(), 250, 205, 26, PALETTE.ivoire, { align: "left", weight: "800" });
	T(ctx, grade.titre.toUpperCase(), 250, 235, 16, PALETTE.orClair, { align: "left", weight: "600" });
	T(ctx, clanData ? clanData.nom.toUpperCase() : "SANS MAISON", 250, 260, 15, clanData ? PALETTE.or : "#777", { align: "left", weight: "600" });

	// Cadre principal en biseau
	drawBevelFrame(ctx, 60, 330, W - 120, 230);
	T(ctx, "ETAT VITAL", 100, 365, 20, PALETTE.or, { align: "left", weight: "800", letterSpacing: 3 });
	drawGauge(ctx, 100, 400, W - 200, 26, vamp.sang / 100, "#4a0a12", "#c41e3a", "SANG", `${Math.round(vamp.sang)}/100`);
	drawGauge(ctx, 100, 460, W - 200, 26, vamp.humanite / 100, "#1a2a3a", "#7ec8e3", "HUMANITE", `${Math.round(vamp.humanite)}/100`);
	drawGauge(ctx, 100, 520, W - 200, 26, vamp.xp / xpRequis(vamp.niveau), "#5a4008", "#d4af37", `NIVEAU ${vamp.niveau}`, `${vamp.xp}/${xpRequis(vamp.niveau)} XP`);

	// Pouvoirs débloqués (grille en éventail)
	drawBevelFrame(ctx, 60, 585, W - 120, 210);
	T(ctx, "POUVOIRS DU SANG", 100, 620, 20, PALETTE.or, { align: "left", weight: "800", letterSpacing: 3 });
	let px = 100, py = 660;
	for (let i = 0; i < POUVOIRS.length; i++) {
		const pw = POUVOIRS[i];
		const owned = vamp.pouvoirs.includes(pw.id);
		const col = i % 4;
		const row = Math.floor(i / 4);
		const bx = 100 + col * 205, by = 660 + row * 90;
		rr(ctx, bx, by, 190, 75, 8);
		ctx.fillStyle = owned ? "rgba(212,175,55,0.14)" : "rgba(255,255,255,0.03)";
		ctx.fill();
		ctx.strokeStyle = owned ? PALETTE.or : "#4a3020";
		ctx.lineWidth = 1.4;
		ctx.stroke();
		T(ctx, pw.nom.toUpperCase(), bx + 10, by + 22, 13, owned ? PALETTE.orClair : "#665", { align: "left", weight: "700" });
		T(ctx, owned ? "MAITRISE" : `NIVEAU REQUIS`, bx + 10, by + 44, 11, owned ? "#8fd18f" : "#886", { align: "left", weight: "600" });
		T(ctx, `COUT ${pw.cout} SANG`, bx + 10, by + 62, 10, "#c9b98a", { align: "left", weight: "500" });
	}

	// Statistiques
	drawBevelFrame(ctx, 60, 810, W - 120, 200);
	T(ctx, "CHRONIQUES", 100, 845, 20, PALETTE.or, { align: "left", weight: "800", letterSpacing: 3 });
	const statsLignes = [
		["CHASSES", vamp.stats.chasses], ["DUELS GAGNES", vamp.stats.duelsGagnes],
		["DUELS PERDUS", vamp.stats.duelsPerdus], ["INTRIGUES RESOLUES", vamp.stats.intriguesResolues],
		["AUBES SURVECUES", vamp.stats.aubesSurvecues], ["SUCCES", `${vamp.succes.length}/${SUCCES.length}`],
	];
	for (let i = 0; i < statsLignes.length; i++) {
		const col = i % 2, row = Math.floor(i / 2);
		const bx = 100 + col * 380, by = 880 + row * 40;
		T(ctx, statsLignes[i][0], bx, by, 14, PALETTE.orClair, { align: "left", weight: "600" });
		T(ctx, String(statsLignes[i][1]), bx + 330, by, 15, PALETTE.ivoire, { align: "right", weight: "700" });
	}

	// Pied de page héraldique
	drawFan(ctx, W / 2, H - 40, 90, 11, PALETTE.orFonce, 0.4, Math.PI * 0.9);
	GL(ctx, 80, H - 90, W - 80, H - 90, PALETTE.or, 2);
	T(ctx, `MAISON ${clanData ? clanData.nom.toUpperCase() : "ERRANTE"}`, W / 2, H - 60, 15, PALETTE.or, { align: "center", weight: "700", letterSpacing: 3 });

	const outPath = path.join(TMP_DIR, `dashboard_${uid}_${Date.now()}.png`);
	await fs.ensureDir(TMP_DIR);
	const buf = canvas.toBuffer("image/png");
	await fs.writeFile(outPath, buf);
	return outPath;
}

/* ═══════════════════════════════════════════════════════════════════
 *  RENDU CANVAS — SCÈNE DE DUEL
 * ═══════════════════════════════════════════════════════════════════ */

async function renderDuel(duel, joueurNom, uidJoueur) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1100, H = 700;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawBackground(ctx, W, H);

	T(ctx, "DUEL DE SANG", W / 2, 60, 34, PALETTE.or, { align: "center", weight: "900", letterSpacing: 6 });
	GL(ctx, 100, 90, W - 100, 90, PALETTE.or, 2);
	drawFan(ctx, W / 2, 90, 55, 7, PALETTE.orFonce, 0.3);

	const img = await fetchAvatar(uidJoueur).catch(() => null);
	drawAvatarMedallion(ctx, img, 150, 190, 62);
	T(ctx, joueurNom.toUpperCase(), 150, 275, 16, PALETTE.ivoire, { align: "center", weight: "800" });

	drawAvatarMedallion(ctx, null, W - 150, 190, 62);
	T(ctx, duel.rival.nom.toUpperCase(), W - 150, 275, 15, PALETTE.ivoire, { align: "center", weight: "800" });

	// VS emblème central
	ctx.save();
	T(ctx, "VS", W / 2, 190, 40, PALETTE.sang, { align: "center", weight: "900" });
	ctx.restore();

	drawGauge(ctx, 60, 330, 400, 24, duel.joueur.pv / duel.joueur.pvMax, "#4a0a12", "#c41e3a", "VOTRE VITALITE", `${Math.max(0, Math.round(duel.joueur.pv))}/${duel.joueur.pvMax}`);
	drawGauge(ctx, 60, 380, 400, 24, duel.joueur.sang / 100, "#3a1a08", "#d4af37", "VOTRE SANG", `${Math.round(duel.joueur.sang)}/100`);
	drawGauge(ctx, W - 460, 330, 400, 24, duel.rival.pv / duel.rival.pvMax, "#4a0a12", "#c41e3a", "VITALITE RIVALE", `${Math.max(0, Math.round(duel.rival.pv))}/${duel.rival.pvMax}`);
	drawGauge(ctx, W - 460, 380, 400, 24, duel.rival.sang / 100, "#3a1a08", "#d4af37", "SANG RIVAL", `${Math.round(duel.rival.sang)}/100`);

	// Journal du combat
	drawBevelFrame(ctx, 60, 440, W - 120, 200);
	T(ctx, "JOURNAL DU DUEL", 100, 470, 18, PALETTE.or, { align: "left", weight: "800", letterSpacing: 3 });
	const lignes = duel.journal.slice(-6);
	for (let i = 0; i < lignes.length; i++) {
		T(ctx, `TOUR ${duel.tour - lignes.length + i + 1} — ${lignes[i].toUpperCase()}`, 100, 505 + i * 24, 13, PALETTE.ivoire, { align: "left", weight: "500" });
	}

	T(ctx, `TOUR ${duel.tour}`, W / 2, H - 30, 16, PALETTE.orClair, { align: "center", weight: "700", letterSpacing: 3 });

	const outPath = path.join(TMP_DIR, `duel_${uidJoueur}_${Date.now()}.png`);
	await fs.writeFile(outPath, canvas.toBuffer("image/png"));
	return outPath;
}

/* ═══════════════════════════════════════════════════════════════════
 *  RENDU CANVAS — CARTE DE LA COUR (clans)
 * ═══════════════════════════════════════════════════════════════════ */

async function renderCarteCour(vamp) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 900;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawBackground(ctx, W, H);
	T(ctx, "CARTE DE LA COUR", W / 2, 70, 38, PALETTE.or, { align: "center", weight: "900", letterSpacing: 5 });
	GL(ctx, 90, 100, W - 90, 100, PALETTE.or, 2);

	const clanIds = Object.keys(CLANS);
	const cx = W / 2, cy = 480, R = 300;
	for (let i = 0; i < clanIds.length; i++) {
		const angle = (Math.PI * 2 * i) / clanIds.length - Math.PI / 2;
		const bx = cx + Math.cos(angle) * R;
		const by = cy + Math.sin(angle) * R;
		const clan = CLANS[clanIds[i]];
		drawFan(ctx, bx, by, 60, 8, clan.couleur, 0.5);
		rr(ctx, bx - 100, by - 46, 200, 92, 10);
		ctx.fillStyle = "rgba(10,4,6,0.75)";
		ctx.fill();
		ctx.strokeStyle = PALETTE.or; ctx.lineWidth = 1.6; ctx.stroke();
		T(ctx, clan.nom.toUpperCase(), bx, by - 18, 15, PALETTE.orClair, { align: "center", weight: "800" });
		T(ctx, clan.devise.toUpperCase(), bx, by + 4, 11, "#c9b98a", { align: "center", weight: "500" });
		T(ctx, clan.bonus.toUpperCase(), bx, by + 24, 12, PALETTE.or, { align: "center", weight: "700" });
		if (vamp.clan === clanIds[i]) {
			ctx.strokeStyle = "#ffe98a"; ctx.lineWidth = 3;
			rr(ctx, bx - 105, by - 51, 210, 102, 12); ctx.stroke();
		}
		GL(ctx, cx, cy, bx, by, "rgba(212,175,55,0.25)", 1);
	}
	drawArabesque(ctx, cx, cy, 90, PALETTE.or, 0.5);
	T(ctx, "TRONE DE LA NUIT", cx, cy, 16, PALETTE.orClair, { align: "center", weight: "800" });

	const outPath = path.join(TMP_DIR, `carte_${Date.now()}.png`);
	await fs.writeFile(outPath, canvas.toBuffer("image/png"));
	return outPath;
}

/* ═══════════════════════════════════════════════════════════════════
 *  RENDU CANVAS — CLASSEMENT
 * ═══════════════════════════════════════════════════════════════════ */

async function renderClassement(rows) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 140 + rows.length * 70;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawBackground(ctx, W, H);
	T(ctx, "CLASSEMENT DE LA COUR", W / 2, 65, 32, PALETTE.or, { align: "center", weight: "900", letterSpacing: 4 });
	GL(ctx, 80, 95, W - 80, 95, PALETTE.or, 2);
	let y = 140;
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		rr(ctx, 80, y, W - 160, 56, 8);
		ctx.fillStyle = i === 0 ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.03)";
		ctx.fill();
		ctx.strokeStyle = PALETTE.orFonce; ctx.lineWidth = 1; ctx.stroke();
		T(ctx, `#${i + 1}`, 105, y + 28, 22, PALETTE.or, { align: "left", weight: "900" });
		T(ctx, r.nom.toUpperCase(), 165, y + 20, 18, PALETTE.ivoire, { align: "left", weight: "700" });
		T(ctx, (r.grade || "").toUpperCase(), 165, y + 40, 12, PALETTE.orClair, { align: "left", weight: "500" });
		T(ctx, `NIVEAU ${r.niveau}`, W - 105, y + 28, 16, PALETTE.or, { align: "right", weight: "700" });
		y += 70;
	}
	const outPath = path.join(TMP_DIR, `classement_${Date.now()}.png`);
	await fs.writeFile(outPath, canvas.toBuffer("image/png"));
	return outPath;
}

/* ═══════════════════════════════════════════════════════════════════
 *  MOTEUR DE DUEL TOUR PAR TOUR (inspiré naruto-storm.js)
 * ═══════════════════════════════════════════════════════════════════ */

function creerDuel(vamp, rivalTemplate) {
	return {
		joueur: { pv: 100 + vamp.niveau * 5, pvMax: 100 + vamp.niveau * 5, sang: vamp.sang, statuts: [] },
		rival: {
			nom: rivalTemplate.nom,
			pv: rivalTemplate.pvBase, pvMax: rivalTemplate.pvBase,
			sang: rivalTemplate.sangBase, pouvoirs: rivalTemplate.pouvoirs, statuts: [],
		},
		tour: 1,
		journal: ["Le duel commence sous la lune rousse."],
		termine: false,
		vainqueur: null,
	};
}

function calculerDegats(base) {
	const [min, max] = base;
	return Math.floor(min + Math.random() * (max - min + 1));
}

function appliquerStatuts(entite, journal, qui) {
	let peutAgir = true;
	entite.statuts = entite.statuts.filter((s) => {
		if (s.type === "saignement") {
			entite.pv -= s.valeur;
			journal.push(`${qui} saigne (-${s.valeur} PV)`);
		}
		if (s.type === "gel" || s.type === "etourdissement") {
			if (s.duree > 0) { peutAgir = false; journal.push(`${qui} est immobilisé`); }
		}
		s.duree--;
		return s.duree > 0;
	});
	return peutAgir;
}

function executerPouvoir(pouvoirId, source, cible, journal, nomSource, nomCible) {
	const p = POUVOIRS.find((x) => x.id === pouvoirId) || POUVOIRS[0];
	if (source.sang < p.cout) {
		journal.push(`${nomSource} n'a pas assez de sang pour ${p.nom}, attaque de base.`);
		const deg = calculerDegats([8, 14]);
		cible.pv -= deg;
		journal.push(`${nomSource} griffe ${nomCible} (-${deg} PV)`);
		return;
	}
	source.sang -= p.cout;
	let esquive = cible.statuts.some((s) => s.type === "esquive_totale");
	if (esquive && p.degats[1] > 0) {
		journal.push(`${nomCible} se dissout en brume, esquive totale !`);
		return;
	}
	let critique = Math.random() < 0.15 || p.effet === "critique_garanti";
	let deg = calculerDegats(p.degats);
	if (critique) deg = Math.floor(deg * 1.6);
	if (deg > 0) {
		cible.pv -= deg;
		journal.push(`${nomSource} utilise ${p.nom}${critique ? " (CRITIQUE)" : ""} sur ${nomCible} (-${deg} PV)`);
	} else {
		journal.push(`${nomSource} invoque ${p.nom} sur ${nomCible}`);
	}
	switch (p.effet) {
		case "gel": cible.statuts.push({ type: "gel", duree: 1 }); break;
		case "confusion": cible.statuts.push({ type: "confusion", duree: 1 }); break;
		case "vol_de_sang": source.sang = Math.min(100, source.sang + Math.floor(deg * 0.4)); journal.push(`${nomSource} draine ${Math.floor(deg * 0.4)} sang`); break;
		case "esquive_totale": source.statuts.push({ type: "esquive_totale", duree: 1 }); source.sang = Math.min(100, source.sang + 8); break;
		case "saignement": cible.statuts.push({ type: "saignement", valeur: Math.floor(deg * 0.25), duree: 3 }); break;
		case "etourdissement": cible.statuts.push({ type: "etourdissement", duree: 1 }); break;
	}
}

function iaChoisirPouvoir(rival) {
	const dispo = rival.pouvoirs.filter((id) => {
		const p = POUVOIRS.find((x) => x.id === id);
		return p && p.cout <= rival.sang;
	});
	if (!dispo.length) return "GRIFFE";
	return dispo[Math.floor(Math.random() * dispo.length)];
}

function tourDuel(duel, actionJoueur) {
	if (duel.termine) return duel;
	const j = duel.joueur, r = duel.rival;
	const peutAgirJ = appliquerStatuts(j, duel.journal, "Vous");
	const peutAgirR = appliquerStatuts(r, duel.journal, r.nom);
	if (j.pv <= 0 || r.pv <= 0) { finDuel(duel); return duel; }

	if (peutAgirJ) {
		executerPouvoir(actionJoueur, j, r, duel.journal, "Vous", r.nom);
	}
	if (r.pv <= 0) { finDuel(duel); return duel; }
	if (peutAgirR) {
		const choix = iaChoisirPouvoir(r);
		executerPouvoir(choix, r, j, duel.journal, r.nom, "Vous");
	}
	j.sang = Math.min(100, j.sang + 4);
	r.sang = Math.min(100, r.sang + 4);
	duel.tour++;
	if (j.pv <= 0 || r.pv <= 0) finDuel(duel);
	return duel;
}

function finDuel(duel) {
	duel.termine = true;
	if (duel.joueur.pv <= 0 && duel.rival.pv <= 0) { duel.vainqueur = "nul"; duel.journal.push("Les deux combattants s'effondrent."); }
	else if (duel.rival.pv <= 0) { duel.vainqueur = "joueur"; duel.journal.push(`${duel.rival.nom} succombe. Vous triomphez !`); }
	else { duel.vainqueur = "rival"; duel.journal.push("Vous succombez au duel."); }
}

/* ═══════════════════════════════════════════════════════════════════
 *  MODULE DE DÉDUCTION SOCIALE — INTRIGUES DE COUR
 * ═══════════════════════════════════════════════════════════════════ */

function genererIntrigue() {
	const suspects = [...PNJ_MORTELS].sort(() => Math.random() - 0.5).slice(0, 4);
	const coupable = suspects[Math.floor(Math.random() * suspects.length)];
	const indicesShuffled = [...INDICES_POOL].sort(() => Math.random() - 0.5);
	const indicesParSuspect = {};
	suspects.forEach((s, i) => {
		indicesParSuspect[s.id] = [];
	});
	// Le coupable reçoit 2-3 indices incriminants, les autres 1 indice neutre/faux
	let pool = [...indicesShuffled];
	indicesParSuspect[coupable.id].push(pool.pop(), pool.pop());
	for (const s of suspects) {
		if (s.id === coupable.id) continue;
		indicesParSuspect[s.id].push(pool.pop());
	}
	return {
		suspects: suspects.map((s) => s.id),
		coupable: coupable.id,
		indicesParSuspect,
		indicesDecouverts: {},
		commencedAt: Date.now(),
		tentatives: 0,
	};
}

function enqueterSurSuspect(intrigue, suspectId) {
	if (!intrigue.indicesDecouverts[suspectId]) intrigue.indicesDecouverts[suspectId] = [];
	const dispo = intrigue.indicesParSuspect[suspectId].filter((ind) => !intrigue.indicesDecouverts[suspectId].includes(ind));
	if (!dispo.length) return null;
	const trouve = dispo[Math.floor(Math.random() * dispo.length)];
	intrigue.indicesDecouverts[suspectId].push(trouve);
	return trouve;
}

/* ═══════════════════════════════════════════════════════════════════
 *  FORMATAGE TEXTE
 * ═══════════════════════════════════════════════════════════════════ */

function entete(titre) {
	return `${fonts.bold("🩸 ═══════════ " + titre.toUpperCase() + " ═══════════ 🩸")}\n`;
}

function sep() { return "━━━━━━━━━━━━━━━━━━━━━━━━━\n"; }

/* ═══════════════════════════════════════════════════════════════════
 *  SOUS-COMMANDES
 * ═══════════════════════════════════════════════════════════════════ */

async function cmdHelp(message) {
	const txt =
		entete("Cour des Sangs — Guide") +
		`Bienvenue dans les intrigues nocturnes 🌙🦇\n\n` +
		`${fonts.bold("📜 Commandes principales :")}\n` +
		`├─ ${fonts.monospace("cds status")} — Votre registre vampirique\n` +
		`├─ ${fonts.monospace("cds clan <nom>")} — Rejoindre une maison\n` +
		`├─ ${fonts.monospace("cds carte")} — Carte politique des clans\n` +
		`├─ ${fonts.monospace("cds chasser")} — Chasser pour du sang 🩸\n` +
		`├─ ${fonts.monospace("cds influence <pnj>")} — Influencer un mortel\n` +
		`├─ ${fonts.monospace("cds enqueter")} — Débuter/poursuivre une intrigue 🔍\n` +
		`├─ ${fonts.monospace("cds accuser")} — Accuser le traître (via réponse)\n` +
		`├─ ${fonts.monospace("cds duel")} — Provoquer un duel de sang ⚔️\n` +
		`├─ ${fonts.monospace("cds pouvoir")} — Voir/débloquer vos pouvoirs\n` +
		`├─ ${fonts.monospace("cds daily")} — Récompense nocturne quotidienne\n` +
		`├─ ${fonts.monospace("cds succes")} — Vos succès\n` +
		`├─ ${fonts.monospace("cds historique")} — Votre chronique récente\n` +
		`└─ ${fonts.monospace("cds classement")} — Classement de la Cour\n\n` +
		`${fonts.italic("« L'aube approche toujours plus vite pour ceux qui l'oublient. »")}`;
	return message.reply(txt);
}

async function cmdStatus(message, vamp, userName, uid) {
	const grade = gradeActuel(vamp.niveau);
	const outPath = canvasAvailable ? await renderDashboard(vamp, userName, uid).catch(() => null) : null;
	const texteFallback =
		entete("Registre de Cour") +
		`${fonts.bold(userName)} — ${grade.titre}\n` +
		`${sep()}` +
		`🩸 Sang : ${Math.round(vamp.sang)}/100\n` +
		`🕊️ Humanité : ${Math.round(vamp.humanite)}/100\n` +
		`⭐ Niveau ${vamp.niveau} (${vamp.xp}/${xpRequis(vamp.niveau)} XP)\n` +
		`🏛️ Maison : ${vamp.clan ? CLANS[vamp.clan].nom : "Aucune"}\n` +
		`🏆 Succès : ${vamp.succes.length}/${SUCCES.length}`;
	if (outPath) {
		return message.reply({ body: fonts.bold(`🩸 Registre de ${userName}`), attachment: fs.createReadStream(outPath) });
	}
	return message.reply(texteFallback);
}

async function cmdClan(message, args, vamp, save) {
	const nomClan = (args[1] || "").toUpperCase();
	if (!nomClan || !CLANS[nomClan]) {
		let txt = entete("Maisons de la Cour") + `Choisissez une maison avec ${fonts.monospace("cds clan <id>")} :\n\n`;
		for (const c of Object.values(CLANS)) {
			txt += `├─ ${fonts.bold(c.id)} — ${c.nom}\n│   "${c.devise}" — ${c.bonus}\n`;
		}
		return message.reply(txt);
	}
	if (vamp.clan) return message.reply(`❌ Vous appartenez déjà à ${fonts.bold(CLANS[vamp.clan].nom)}. La trahison de sa maison est impossible.`);
	vamp.clan = nomClan;
	pushHistorique(vamp, `A rejoint la maison ${CLANS[nomClan].nom}.`);
	const nouveaux = checkSucces(vamp);
	await save();
	let txt = `🩸 Vous prêtez serment à ${fonts.bold(CLANS[nomClan].nom)} !\n"${CLANS[nomClan].devise}"\nBonus : ${CLANS[nomClan].bonus}`;
	if (nouveaux.length) txt += `\n\n🏆 Succès débloqué(s) : ${nouveaux.map((s) => s.nom).join(", ")}`;
	return message.reply(txt);
}

async function cmdCarte(message, vamp) {
	const outPath = canvasAvailable ? await renderCarteCour(vamp).catch(() => null) : null;
	if (outPath) return message.reply({ body: fonts.bold("🗺️ Carte politique de la Cour des Sangs"), attachment: fs.createReadStream(outPath) });
	let txt = entete("Carte de la Cour");
	for (const c of Object.values(CLANS)) txt += `├─ ${c.nom} : ${c.devise}\n`;
	return message.reply(txt);
}

async function cmdChasser(message, vamp, save) {
	const cd = checkCooldown(vamp, "CHASSER");
	if (cd > 0) return message.reply(`⏳ Vos crocs doivent encore se reposer. Réessayez dans ${formatDuree(cd)}.`);
	const scenarios = [
		{ txt: "Vous surprenez un ivrogne isolé dans une ruelle.", sang: [10, 18], hum: -3 },
		{ txt: "Un garde de nuit imprudent croise votre chemin.", sang: [14, 22], hum: -6 },
		{ txt: "Vous vous nourrissez discrètement, sans violence.", sang: [6, 12], hum: -1 },
		{ txt: "Une victime résiste, le combat tourne au carnage.", sang: [20, 30], hum: -12 },
		{ txt: "Vous choisissez de vous abstenir, épargnant un innocent.", sang: [0, 4], hum: 5 },
	];
	const s = scenarios[Math.floor(Math.random() * scenarios.length)];
	const gain = Math.floor(s.sang[0] + Math.random() * (s.sang[1] - s.sang[0] + 1));
	vamp.sang = Math.min(100, vamp.sang + gain);
	vamp.humanite = Math.max(0, Math.min(100, vamp.humanite + s.hum));
	vamp.stats.chasses++;
	vamp.stats.sangTotalGagne += gain;
	if (s.hum < 0) vamp.stats.perteHumaniteMax = Math.max(vamp.stats.perteHumaniteMax, -s.hum);
	gagnerXp(vamp, 8);
	setCooldown(vamp, "CHASSER");
	pushHistorique(vamp, s.txt);
	const nouveaux = checkSucces(vamp);
	await save();
	let txt = `🌙 ${s.txt}\n🩸 Sang +${gain} (${Math.round(vamp.sang)}/100)\n🕊️ Humanité ${s.hum >= 0 ? "+" : ""}${s.hum} (${Math.round(vamp.humanite)}/100)\n✨ +8 XP`;
	if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
	return message.reply(txt);
}

async function cmdInfluence(message, args, vamp, save) {
	const cd = checkCooldown(vamp, "INFLUENCE");
	if (cd > 0) return message.reply(`⏳ La cour surveille. Réessayez dans ${formatDuree(cd)}.`);
	const cible = args.slice(1).join(" ").toUpperCase();
	const pnj = PNJ_MORTELS.find((p) => p.id === cible || p.nom.toUpperCase().includes(cible));
	if (!pnj) {
		let txt = entete("Personnages de la Cour Mortelle") + `Ciblez avec ${fonts.monospace("cds influence <id>")} :\n\n`;
		for (const p of PNJ_MORTELS) txt += `├─ ${fonts.bold(p.id)} — ${p.nom} (${p.poste})\n`;
		return message.reply(txt);
	}
	const actuel = vamp.influences[pnj.id] || 0;
	const chance = 0.55 + (vamp.clan === "VELANTHE" ? 0.15 : 0);
	const succes = Math.random() < chance;
	const gain = succes ? 8 + Math.floor(Math.random() * 12) : -(4 + Math.floor(Math.random() * 6));
	vamp.influences[pnj.id] = Math.max(0, Math.min(100, actuel + gain));
	setCooldown(vamp, "INFLUENCE");
	gagnerXp(vamp, succes ? 12 : 4);
	pushHistorique(vamp, `A tenté d'influencer ${pnj.nom} (${succes ? "succès" : "échec"}).`);
	const nouveaux = checkSucces(vamp);
	await save();
	let txt = succes
		? `🕯️ Vous manipulez habilement ${fonts.bold(pnj.nom)}. Influence ${gain >= 0 ? "+" : ""}${gain} (${vamp.influences[pnj.id]}/100).`
		: `⚠️ ${fonts.bold(pnj.nom)} se méfie de vos manières. Influence ${gain} (${vamp.influences[pnj.id]}/100).`;
	if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
	return message.reply(txt);
}

async function cmdEnqueter(message, event, vamp, save, usersData, uid) {
	const cd = checkCooldown(vamp, "ENQUETER");
	if (cd > 0) return message.reply(`⏳ Les ombres ne révèlent rien de plus pour l'instant. Réessayez dans ${formatDuree(cd)}.`);
	if (!vamp.intrigueActuelle) {
		vamp.intrigueActuelle = genererIntrigue();
		pushHistorique(vamp, "A ouvert une nouvelle enquête sur un complot de cour.");
	}
	const intrigue = vamp.intrigueActuelle;
	const suspectId = intrigue.suspects[Math.floor(Math.random() * intrigue.suspects.length)];
	const suspect = PNJ_MORTELS.find((p) => p.id === suspectId);
	const indice = enqueterSurSuspect(intrigue, suspectId);
	setCooldown(vamp, "ENQUETER");
	if (indice) { vamp.stats.indicesTrouves++; }
	await save();

	let txt = entete("Enquête de Cour") +
		`Vous enquêtez discrètement dans les couloirs du palais...\n\n`;
	if (indice) {
		txt += `🔍 Concernant ${fonts.bold(suspect.nom)} (${suspect.poste}) :\n"${suspect.nom} ${indice}."\n\n`;
	} else {
		txt += `🔍 Aucun nouvel indice sur ${fonts.bold(suspect.nom)} pour l'instant.\n\n`;
	}
	txt += `${fonts.bold("Suspects de cette intrigue :")}\n`;
	for (const sId of intrigue.suspects) {
		const s = PNJ_MORTELS.find((p) => p.id === sId);
		const nbIndices = (intrigue.indicesDecouverts[sId] || []).length;
		txt += `├─ ${fonts.bold(s.id)} — ${s.nom} (${nbIndices} indice(s) découvert(s))\n`;
	}
	txt += `\nRépondez à ce message avec ${fonts.monospace("accuser <ID>")} pour désigner le traître, ou utilisez ${fonts.monospace("cds accuser <ID>")}.`;

	const sent = await message.reply(txt);
	if (global.GoatBot && global.GoatBot.onReply && sent && sent.messageID) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "courdessangs",
			messageID: sent.messageID,
			author: uid,
			threadID: message.threadID,
			type: "accusation",
		});
	}
	return;
}

async function cmdAccuser(message, args, vamp, save) {
	const intrigue = vamp.intrigueActuelle;
	if (!intrigue) return message.reply("❌ Aucune intrigue en cours. Lancez d'abord une enquête avec `cds enqueter`.");
	const cibleId = (args[1] || "").toUpperCase();
	const suspect = PNJ_MORTELS.find((p) => p.id === cibleId && intrigue.suspects.includes(p.id));
	if (!suspect) {
		return message.reply(`❌ Suspect invalide. Suspects actuels : ${intrigue.suspects.join(", ")}`);
	}
	intrigue.tentatives++;
	if (suspect.id === intrigue.coupable) {
		vamp.stats.intriguesResolues++;
		gagnerXp(vamp, 60);
		vamp.sang = Math.min(100, vamp.sang + 15);
		pushHistorique(vamp, `A démasqué ${suspect.nom} comme traître !`);
		vamp.intrigueActuelle = null;
		const nouveaux = checkSucces(vamp);
		await save();
		let txt = `⚖️ Justice est rendue ! ${fonts.bold(suspect.nom)} était bien le traître.\n✨ +60 XP, +15 Sang.`;
		if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
		return message.reply(txt);
	} else {
		vamp.humanite = Math.max(0, vamp.humanite - 5);
		pushHistorique(vamp, `A accusé à tort ${suspect.nom}.`);
		await save();
		return message.reply(`❌ ${fonts.bold(suspect.nom)} est innocent ! Votre erreur ébranle votre crédibilité (-5 Humanité). Poursuivez l'enquête.`);
	}
}

async function cmdPouvoir(message, args, vamp, save) {
	const sub = (args[1] || "").toLowerCase();
	if (sub === "debloquer" || sub === "unlock") {
		const id = (args[2] || "").toUpperCase();
		const p = POUVOIRS.find((x) => x.id === id);
		if (!p) return message.reply(`❌ Pouvoir inconnu. Utilisez ${fonts.monospace("cds pouvoir")} pour voir la liste.`);
		if (vamp.pouvoirs.includes(p.id)) return message.reply("❌ Vous maîtrisez déjà ce pouvoir.");
		const niveauRequis = p.tier * 4;
		if (vamp.niveau < niveauRequis) return message.reply(`❌ Niveau ${niveauRequis} requis (vous êtes niveau ${vamp.niveau}).`);
		vamp.pouvoirs.push(p.id);
		pushHistorique(vamp, `A débloqué le pouvoir ${p.nom}.`);
		const nouveaux = checkSucces(vamp);
		await save();
		let txt = `✨ Vous maîtrisez désormais ${fonts.bold(p.nom)} !\n${p.desc}`;
		if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
		return message.reply(txt);
	}
	let txt = entete("Grimoire des Pouvoirs");
	for (const p of POUVOIRS) {
		const owned = vamp.pouvoirs.includes(p.id);
		txt += `${owned ? "✅" : "🔒"} ${fonts.bold(p.nom)} (Tier ${p.tier}, coût ${p.cout} sang, niveau requis ${p.tier * 4})\n   ${p.desc}\n`;
	}
	txt += `\nUtilisez ${fonts.monospace("cds pouvoir debloquer <ID>")} pour apprendre un nouveau pouvoir.`;
	return message.reply(txt);
}

async function cmdDuel(message, event, vamp, save, uid) {
	const cd = checkCooldown(vamp, "DUEL");
	if (cd > 0) return message.reply(`⏳ Votre honneur peut attendre. Réessayez dans ${formatDuree(cd)}.`);
	if (vamp.duelEnCours) return message.reply("❌ Un duel est déjà en cours. Répondez au message de combat.");
	const rivalTpl = RIVAUX[Math.min(RIVAUX.length - 1, Math.floor(vamp.niveau / 5))];
	const duel = creerDuel(vamp, rivalTpl);
	vamp.duelEnCours = duel;
	setCooldown(vamp, "DUEL");
	await save();

	const outPath = canvasAvailable ? await renderDuel(duel, "Vous", uid).catch(() => null) : null;
	const listePouvoirs = vamp.pouvoirs.map((id) => POUVOIRS.find((p) => p.id === id)).filter(Boolean);
	let txt = entete("Duel de Sang") +
		`Vous affrontez ${fonts.bold(duel.rival.nom)} !\n\n` +
		`${fonts.bold("Répondez avec le nom d'un pouvoir :")}\n`;
	for (const p of listePouvoirs) txt += `├─ ${fonts.bold(p.id)} (${p.cout} sang) — ${p.desc}\n`;

	const sent = outPath
		? await message.reply({ body: txt, attachment: fs.createReadStream(outPath) })
		: await message.reply(txt);
	if (global.GoatBot && global.GoatBot.onReply && sent && sent.messageID) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "courdessangs",
			messageID: sent.messageID,
			author: uid,
			threadID: message.threadID,
			type: "duel",
		});
	}
	return;
}

async function cmdDaily(message, vamp, save) {
	const cd = checkCooldown(vamp, "DAILY");
	if (cd > 0) return message.reply(`⏳ Le crépuscule n'est pas encore revenu. Réessayez dans ${formatDuree(cd)}.`);
	const now = Date.now();
	const gap = now - (vamp.lastDaily || 0);
	vamp.dailyStreak = gap < COOLDOWNS.DAILY * 2 ? (vamp.dailyStreak || 0) + 1 : 1;
	vamp.lastDaily = now;
	setCooldown(vamp, "DAILY");
	const sangGain = 15 + vamp.dailyStreak * 2;
	const xpGain = 25 + vamp.dailyStreak * 3;
	vamp.sang = Math.min(100, vamp.sang + sangGain);
	vamp.stats.sangTotalGagne += sangGain;
	gagnerXp(vamp, xpGain);
	pushHistorique(vamp, `A réclamé sa récompense nocturne (série ${vamp.dailyStreak}).`);
	const nouveaux = checkSucces(vamp);
	await save();
	let txt = `🌘 Récompense nocturne réclamée ! Série : ${vamp.dailyStreak} nuit(s).\n🩸 +${sangGain} sang, ✨ +${xpGain} XP.`;
	if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
	return message.reply(txt);
}

async function cmdSucces(message, vamp) {
	let txt = entete("Succès de la Cour") + `${vamp.succes.length}/${SUCCES.length} débloqués\n\n`;
	for (const s of SUCCES) {
		const owned = vamp.succes.includes(s.id);
		txt += `${owned ? "🏆" : "🔒"} ${fonts.bold(s.nom)} — ${s.desc}\n`;
	}
	return message.reply(txt);
}

async function cmdHistorique(message, vamp) {
	if (!vamp.historique.length) return message.reply("📜 Votre chronique est encore vierge.");
	let txt = entete("Chronique Récente");
	for (const h of vamp.historique.slice(0, 15)) {
		const date = new Date(h.t);
		txt += `├─ [${date.toLocaleDateString("fr-FR")}] ${h.texte}\n`;
	}
	return message.reply(txt);
}

async function cmdClassement(message, usersData) {
	const all = await usersData.getAll();
	const rows = all
		.filter((u) => u.courDesSangs && u.courDesSangs.niveau)
		.map((u) => ({
			nom: u.name || "Vampire Anonyme",
			niveau: u.courDesSangs.niveau,
			grade: gradeActuel(u.courDesSangs.niveau).titre,
		}))
		.sort((a, b) => b.niveau - a.niveau)
		.slice(0, 10);
	if (!rows.length) return message.reply("📊 Aucun vampire classé pour l'instant.");
	const outPath = canvasAvailable ? await renderClassement(rows).catch(() => null) : null;
	if (outPath) return message.reply({ body: fonts.bold("🏆 Classement de la Cour des Sangs"), attachment: fs.createReadStream(outPath) });
	let txt = entete("Classement");
	rows.forEach((r, i) => { txt += `${i + 1}. ${r.nom} — Niveau ${r.niveau} (${r.grade})\n`; });
	return message.reply(txt);
}

async function cmdAube(message, vamp, save) {
	// Mini-mécanique "aube = danger" : le joueur doit se mettre à l'abri à temps
	const cd = checkCooldown(vamp, "AUBE");
	if (cd > 0) return message.reply(`☀️ L'aube n'est pas encore une menace. Réessayez dans ${formatDuree(cd)}.`);
	setCooldown(vamp, "AUBE");
	const chanceAbri = 0.5 + Math.min(0.3, vamp.niveau * 0.02);
	const survit = Math.random() < chanceAbri;
	if (survit) {
		vamp.stats.aubesSurvecues++;
		gagnerXp(vamp, 20);
		pushHistorique(vamp, "A survécu à l'aube en trouvant refuge à temps.");
		const nouveaux = checkSucces(vamp);
		await save();
		let txt = "🌅 Les premières lueurs percent l'horizon... Vous trouvez refuge dans une crypte oubliée à temps ! ✨ +20 XP";
		if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
		return message.reply(txt);
	} else {
		vamp.sang = Math.max(0, vamp.sang - 30);
		pushHistorique(vamp, "A été surpris par l'aube, brûlé partiellement.");
		await save();
		return message.reply("☀️ L'aube vous surprend ! Vous perdez 30 points de sang en fuyant vers l'ombre la plus proche.");
	}
}

/* ═══════════════════════════════════════════════════════════════════
 *  ONREPLY — Traitement des réponses (accusation / duel)
 * ═══════════════════════════════════════════════════════════════════ */

async function handleReplyAccusation(message, event, usersData, Reply) {
	const uid = event.senderID;
	if (Reply.author !== uid) return;
	const vamp = await getVampire(usersData, uid);
	const body = (event.body || "").trim();
	const match = body.match(/accuser\s+(\S+)/i) || body.match(/^(\S+)$/);
	const suspectId = match ? match[1].toUpperCase() : "";
	const save = () => saveVampire(usersData, uid, vamp);
	if (global.GoatBot && global.GoatBot.onReply) global.GoatBot.onReply.delete(Reply.messageID);
	return cmdAccuser(message, ["accuser", suspectId], vamp, save);
}

async function handleReplyDuel(message, event, usersData, Reply, uid) {
	if (Reply.author !== uid) return;
	const vamp = await getVampire(usersData, uid);
	const duel = vamp.duelEnCours;
	if (!duel) { if (global.GoatBot?.onReply) global.GoatBot.onReply.delete(Reply.messageID); return; }
	const body = (event.body || "").trim().toUpperCase();
	const pouvoir = POUVOIRS.find((p) => p.id === body && vamp.pouvoirs.includes(p.id));
	const actionId = pouvoir ? pouvoir.id : "GRIFFE";

	tourDuel(duel, actionId);
	const save = () => saveVampire(usersData, uid, vamp);

	if (duel.termine) {
		if (global.GoatBot && global.GoatBot.onReply) global.GoatBot.onReply.delete(Reply.messageID);
		let recompenseTxt = "";
		if (duel.vainqueur === "joueur") {
			vamp.stats.duelsGagnes++;
			gagnerXp(vamp, 45);
			vamp.sang = Math.min(100, vamp.sang + 10);
			recompenseTxt = "✨ +45 XP, +10 Sang.";
		} else if (duel.vainqueur === "rival") {
			vamp.stats.duelsPerdus++;
			vamp.humanite = Math.max(0, vamp.humanite - 5);
			recompenseTxt = "💔 -5 Humanité.";
		}
		vamp.duelEnCours = null;
		pushHistorique(vamp, `Duel contre ${duel.rival.nom} : ${duel.vainqueur === "joueur" ? "victoire" : duel.vainqueur === "rival" ? "défaite" : "nul"}.`);
		const nouveaux = checkSucces(vamp);
		await save();
		const outPath = canvasAvailable ? await renderDuel(duel, "Vous", uid).catch(() => null) : null;
		let txt = `${duel.journal[duel.journal.length - 1]}\n\n${recompenseTxt}`;
		if (nouveaux.length) txt += `\n\n🏆 Succès : ${nouveaux.map((x) => x.nom).join(", ")}`;
		return outPath ? message.reply({ body: txt, attachment: fs.createReadStream(outPath) }) : message.reply(txt);
	}

	await save();
	const outPath = canvasAvailable ? await renderDuel(duel, "Vous", uid).catch(() => null) : null;
	const listePouvoirs = vamp.pouvoirs.map((id) => POUVOIRS.find((p) => p.id === id)).filter(Boolean);
	let txt = `${duel.journal.slice(-2).join("\n")}\n\n${fonts.bold("Répondez avec un pouvoir :")}\n`;
	for (const p of listePouvoirs) txt += `├─ ${fonts.bold(p.id)} (${p.cout} sang)\n`;
	const sent = outPath ? await message.reply({ body: txt, attachment: fs.createReadStream(outPath) }) : await message.reply(txt);
	if (global.GoatBot && global.GoatBot.onReply && sent && sent.messageID) {
		global.GoatBot.onReply.set(sent.messageID, {
			commandName: "courdessangs", messageID: sent.messageID, author: uid, threadID: message.threadID, type: "duel",
		});
	}
}

/* ═══════════════════════════════════════════════════════════════════
 *  EXPORT GOAT-BOT V2
 * ═══════════════════════════════════════════════════════════════════ */

module.exports = {
	config: {
		name: "courdessangs",
		aliases: ["vampire", "cds", "coursang", "sangs"],
		version: "1.0",
		author: "Christus",
		countDown: 3,
		role: 0,
		category: "rpg",
		description: { fr: "🩸 Intrigue vampirique nocturne — clans, complots, duels de sang et pouvoirs ancestraux." },
		guide: {
			fr:
				`${fonts.bold("🩸 COUR DES SANGS 🩸")}\n\n` +
				`${fonts.monospace("cds status")} — Registre vampirique\n` +
				`${fonts.monospace("cds clan <ID>")} — Rejoindre une maison\n` +
				`${fonts.monospace("cds carte")} — Carte de la Cour\n` +
				`${fonts.monospace("cds chasser")} — Chasser pour du sang\n` +
				`${fonts.monospace("cds influence <ID>")} — Influencer un PNJ\n` +
				`${fonts.monospace("cds enqueter")} — Enquêter sur un complot\n` +
				`${fonts.monospace("cds accuser <ID>")} — Accuser un suspect\n` +
				`${fonts.monospace("cds duel")} — Duel de sang\n` +
				`${fonts.monospace("cds pouvoir")} — Grimoire des pouvoirs\n` +
				`${fonts.monospace("cds daily")} — Récompense nocturne\n` +
				`${fonts.monospace("cds aube")} — Affronter l'aube\n` +
				`${fonts.monospace("cds succes")} — Succès\n` +
				`${fonts.monospace("cds historique")} — Chronique\n` +
				`${fonts.monospace("cds classement")} — Classement`,
		},
	},

	onStart: async function ({ message, event, args, api, usersData, threadsData, commandName }) {
		try {
			const uid = event.senderID;
			const userName = (await usersData.getName(uid).catch(() => null)) || "Vampire Anonyme";
			const vamp = await getVampire(usersData, uid);
			const save = () => saveVampire(usersData, uid, vamp);
			const sub = (args[0] || "status").toLowerCase();

			switch (sub) {
				case "help": case "aide": case "guide":
					return cmdHelp(message);
				case "status": case "profil": case "registre":
					return cmdStatus(message, vamp, userName, uid);
				case "clan": case "maison":
					return cmdClan(message, args, vamp, save);
				case "carte": case "cour":
					return cmdCarte(message, vamp);
				case "chasser": case "chasse":
					return cmdChasser(message, vamp, save);
				case "influence": case "influencer":
					return cmdInfluence(message, args, vamp, save);
				case "enqueter": case "enquete": case "enquêter":
					return cmdEnqueter(message, event, vamp, save, usersData, uid);
				case "accuser":
					return cmdAccuser(message, args, vamp, save);
				case "duel": case "combattre": case "combat":
					return cmdDuel(message, event, vamp, save, uid);
				case "pouvoir": case "pouvoirs": case "grimoire":
					return cmdPouvoir(message, args, vamp, save);
				case "daily": case "quotidien":
					return cmdDaily(message, vamp, save);
				case "aube":
					return cmdAube(message, vamp, save);
				case "succes": case "succès": case "achievements":
					return cmdSucces(message, vamp);
				case "historique": case "chronique":
					return cmdHistorique(message, vamp);
				case "classement": case "leaderboard": case "top":
					return cmdClassement(message, usersData);
				default:
					return message.reply(`❓ Sous-commande inconnue. Tapez ${fonts.monospace("cds help")} pour la liste complète.`);
			}
		} catch (err) {
			console.error("[COUR DES SANGS] Erreur onStart:", err);
			return message.reply("⚠️ Une ombre a perturbé le rituel. Réessayez plus tard.");
		}
	},

	onReply: async function ({ message, event, Reply, usersData, api, commandName }) {
		try {
			const uid = event.senderID;
			if (Reply.type === "accusation") {
				return handleReplyAccusation(message, event, usersData, Reply);
			}
			if (Reply.type === "duel") {
				return handleReplyDuel(message, event, usersData, Reply, uid);
			}
		} catch (err) {
			console.error("[COUR DES SANGS] Erreur onReply:", err);
			return message.reply("⚠️ Le rituel a échoué dans l'ombre.");
		}
	},
};
