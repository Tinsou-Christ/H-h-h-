// ============================================================================
//  ⚗️  GRAND ŒUVRE — Alchimie de laboratoire
//  Auteur : Christus
//  Commande Goat-Bot V2
// ============================================================================
//  Résumé :
//   - 4 éléments primordiaux (Feu, Eau, Air, Terre) + 3 essences philosophiques
//     (Sel, Soufre, Mercure) à combiner pour transmuter des substances.
//   - Un module de déduction ("Table des Arcanes") où le joueur propose des
//     combinaisons et reçoit des indices "chaud / froid" jusqu'à trouver la
//     vraie recette d'un élixir caché (via onReply).
//   - Distillation d'élixirs, fabrication de la Pierre Philosophale par étapes,
//     risques d'accidents et d'explosions de laboratoire.
//   - Vente d'élixirs sur le marché des apothicaires.
//   - Duel de mages alchimistes au tour par tour (moteur inspiré naruto-storm.js)
//     avec onReply pour choisir les actions.
//   - Rendu Canvas façon "planche scientifique" : fond ivoire, cercles
//     alchimiques vectoriels, courbes de réaction, légendes numérotées,
//     palette monochrome cuivre. AUCUN emoji dans le canvas.
// ============================================================================

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const fonts = require("../../func/font.js");
const numbers = require("../../func/number.js");

let canvasAvailable = true;
let createCanvas, registerFont, loadImage;
try {
	const canvasLib = require("canvas");
	createCanvas = canvasLib.createCanvas;
	registerFont = canvasLib.registerFont;
	loadImage = canvasLib.loadImage;
} catch (e) {
	canvasAvailable = false;
}

// ----------------------------------------------------------------------------
//  0. CONSTANTES GLOBALES & PALETTE "PLANCHE SCIENTIFIQUE"
// ----------------------------------------------------------------------------

const PALETTE = {
	ivoire1: "#f4ecd8",
	ivoire2: "#eadfc4",
	ivoire3: "#e2d3ac",
	cuivre1: "#8a5a2b",
	cuivre2: "#a9702f",
	cuivre3: "#6e451f",
	cuivreClair: "#c98a3f",
	encre: "#3a2a17",
	trait: "#54371a",
	rouge: "#8f2b1c",
	vert: "#3c5a34",
	bleu: "#2c4a5a",
	or: "#b8860b",
	blanc: "#fffdf5"
};

let fontsLoaded = false;
function ensureFonts() {
	if (fontsLoaded || !canvasAvailable || !registerFont) return;
	fontsLoaded = true;
	try {
		const fd = path.join(__dirname, "assets", "font");
		if (!fs.existsSync(fd)) return;
		const files = fs.readdirSync(fd);
		for (const f of files) {
			if (/\.(ttf|otf)$/i.test(f)) {
				try { registerFont(path.join(fd, f), { family: "ALC" }); } catch (e) {}
			}
		}
	} catch (e) {}
}

const FONT_FAMILY = "ALC, Georgia, 'Times New Roman', serif";

function rr(ctx, x, y, w, h, r) {
	if (typeof r === "number") r = [r, r, r, r];
	const [tl, tr, br, bl] = r;
	ctx.beginPath();
	ctx.moveTo(x + tl, y);
	ctx.lineTo(x + w - tr, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
	ctx.lineTo(x + w, y + h - br);
	ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
	ctx.lineTo(x + bl, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
	ctx.lineTo(x, y + tl);
	ctx.quadraticCurveTo(x, y, x + tl, y);
	ctx.closePath();
}

function T(ctx, s, x, y, sz, color, opts = {}) {
	const { align = "left", weight = "normal", alpha = 1, spacing = 0 } = opts;
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = color;
	ctx.font = `${weight} ${sz}px ${FONT_FAMILY}`;
	ctx.textBaseline = "middle";
	if (!spacing) {
		ctx.textAlign = align;
		ctx.fillText(String(s), x, y);
	} else {
		const str = String(s);
		let widths = str.split("").map(c => ctx.measureText(c).width + spacing);
		let total = widths.reduce((a, b) => a + b, 0) - spacing;
		let cx = x;
		if (align === "center") cx = x - total / 2;
		if (align === "right") cx = x - total;
		ctx.textAlign = "left";
		for (const c of str) {
			ctx.fillText(c, cx, y);
			cx += ctx.measureText(c).width + spacing;
		}
	}
	ctx.restore();
}

function circle(ctx, x, y, r, color, lineWidth = 2) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function polygon(ctx, cx, cy, r, sides, rotation, color, lineWidth = 2) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	for (let i = 0; i <= sides; i++) {
		const a = rotation + (i / sides) * Math.PI * 2;
		const px = cx + Math.cos(a) * r;
		const py = cy + Math.sin(a) * r;
		if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
	}
	ctx.stroke();
	ctx.restore();
}

function drawSheetBackground(ctx, W, H) {
	const g = ctx.createLinearGradient(0, 0, W, H);
	g.addColorStop(0, PALETTE.ivoire1);
	g.addColorStop(0.5, PALETTE.ivoire2);
	g.addColorStop(1, PALETTE.ivoire3);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// grain / texture léger : petits points aléatoires
	ctx.save();
	ctx.globalAlpha = 0.05;
	for (let i = 0; i < 900; i++) {
		const x = Math.random() * W, y = Math.random() * H;
		ctx.fillStyle = PALETTE.encre;
		ctx.fillRect(x, y, 1, 1);
	}
	ctx.restore();
	// bordure double façon planche
	ctx.save();
	ctx.strokeStyle = PALETTE.trait;
	ctx.lineWidth = 4;
	ctx.strokeRect(14, 14, W - 28, H - 28);
	ctx.lineWidth = 1.2;
	ctx.strokeRect(24, 24, W - 48, H - 48);
	ctx.restore();
	// petites croix de repère aux coins
	const marks = [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]];
	ctx.save();
	ctx.strokeStyle = PALETTE.cuivre3;
	ctx.lineWidth = 1;
	for (const [mx, my] of marks) {
		ctx.beginPath();
		ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my);
		ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my + 10);
		ctx.stroke();
	}
	ctx.restore();
}

function drawHeader(ctx, W, title, subtitle, planNumber) {
	T(ctx, title, W / 2, 62, 34, PALETTE.encre, { align: "center", weight: "bold", spacing: 2 });
	T(ctx, subtitle, W / 2, 96, 16, PALETTE.cuivre3, { align: "center", weight: "normal" });
	ctx.save();
	ctx.strokeStyle = PALETTE.trait;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(60, 112);
	ctx.lineTo(W - 60, 112);
	ctx.stroke();
	ctx.restore();
	T(ctx, `PLANCHE N° ${planNumber}`, W - 44, 44, 13, PALETTE.cuivre3, { align: "right" });
	T(ctx, `ECHELLE 1:1 — LABORATOIRE DU GRAND OEUVRE`, 44, 44, 13, PALETTE.cuivre3, { align: "left" });
}

function drawLegendBox(ctx, x, y, w, items) {
	const lineH = 22;
	const h = 30 + items.length * lineH;
	rr(ctx, x, y, w, h, 6);
	ctx.fillStyle = "rgba(255,253,245,0.55)";
	ctx.fill();
	ctx.strokeStyle = PALETTE.trait;
	ctx.lineWidth = 1;
	rr(ctx, x, y, w, h, 6);
	ctx.stroke();
	T(ctx, "LEGENDE", x + 14, y + 20, 13, PALETTE.encre, { weight: "bold" });
	items.forEach((it, i) => {
		const iy = y + 40 + i * lineH;
		T(ctx, String(i + 1), x + 14, iy, 12, PALETTE.cuivre1, { weight: "bold" });
		ctx.save();
		ctx.strokeStyle = PALETTE.cuivre2;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(x + 14, iy, 9, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
		T(ctx, it, x + 32, iy, 12, PALETTE.encre, { weight: "normal" });
	});
	return h;
}

function drawGauge(ctx, x, y, w, h, ratio, label, colorFull) {
	rr(ctx, x, y, w, h, 4);
	ctx.strokeStyle = PALETTE.trait;
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.save();
	ctx.beginPath();
	rr(ctx, x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, ratio))), h - 4, 3);
	ctx.fillStyle = colorFull;
	ctx.fill();
	ctx.restore();
	for (let i = 1; i < 10; i++) {
		const gx = x + (w / 10) * i;
		ctx.strokeStyle = "rgba(58,42,23,0.35)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(gx, y); ctx.lineTo(gx, y + h);
		ctx.stroke();
	}
	T(ctx, label, x, y - 8, 11, PALETTE.cuivre3, { weight: "bold" });
}

async function saveCanvasToFile(canvas, filename) {
	const dir = path.join(__dirname, "cache");
	await fs.ensureDir(dir);
	const p = path.join(dir, filename);
	await new Promise((resolve, reject) => {
		const out = fs.createWriteStream(p);
		const stream = canvas.createPNGStream();
		stream.pipe(out);
		out.on("finish", resolve);
		out.on("error", reject);
	});
	return p;
}

// ----------------------------------------------------------------------------
//  1. DONNÉES DE JEU
// ----------------------------------------------------------------------------

const ELEMENTS = [
	{ id: "feu", nom: "Feu", symbole: "Δ", couleur: PALETTE.rouge, desc: "Chaud et sec, principe de transformation violente." },
	{ id: "eau", nom: "Eau", symbole: "∇", couleur: PALETTE.bleu, desc: "Froid et humide, principe de dissolution." },
	{ id: "air", nom: "Air", symbole: "△(barré)", couleur: PALETTE.cuivre2, desc: "Chaud et humide, principe de diffusion." },
	{ id: "terre", nom: "Terre", symbole: "▽(barré)", couleur: PALETTE.vert, desc: "Froid et sec, principe de fixation." }
];

const ESSENCES = [
	{ id: "sel", nom: "Sel", desc: "Corps, matière fixe, incorruptible." },
	{ id: "soufre", nom: "Soufre", desc: "Âme, principe actif, combustible." },
	{ id: "mercure", nom: "Mercure", desc: "Esprit, principe volatil, liant." }
];

// Table des recettes de transmutation : combinaison de 2 éléments + 1 essence => résultat
// Chaque recette possède une "distance" calculable pour donner des indices chaud/froid.
const RECETTES = [
	{ id: "or_potable", nom: "Or Potable", elts: ["feu", "terre"], essence: "sel", rarete: "légendaire", valeur: 900, effet: "Régénère entièrement la vigueur du laboratoire." },
	{ id: "eau_de_vie_phil", nom: "Eau-de-Vie Philosophale", elts: ["eau", "air"], essence: "mercure", rarete: "épique", valeur: 420, effet: "Accélère toutes les distillations en cours." },
	{ id: "elixir_vie", nom: "Élixir de Longue Vie", elts: ["eau", "terre"], essence: "sel", rarete: "épique", valeur: 460, effet: "Ajoute 3 tours de PV en duel." },
	{ id: "poudre_projection", nom: "Poudre de Projection", elts: ["feu", "air"], essence: "soufre", rarete: "rare", valeur: 260, effet: "Double les gains de la prochaine transmutation." },
	{ id: "huile_de_talc", nom: "Huile de Talc", elts: ["terre", "air"], essence: "mercure", rarete: "rare", valeur: 220, effet: "Réduit les risques d'accident de 50%." },
	{ id: "vitriol", nom: "Vitriol Vert", elts: ["feu", "eau"], essence: "soufre", rarete: "rare", valeur: 240, effet: "Inflige des dégâts corrosifs en duel." },
	{ id: "sel_ammoniac", nom: "Sel Ammoniac", elts: ["terre", "feu"], essence: "mercure", rarete: "commune", valeur: 90, effet: "Ingrédient de base pour recettes supérieures." },
	{ id: "esprit_de_vin", nom: "Esprit-de-Vin", elts: ["eau", "air"], essence: "soufre", rarete: "commune", valeur: 80, effet: "Se vend bien au marché." },
	{ id: "chaux_vive", nom: "Chaux Vive", elts: ["terre", "terre"], essence: "sel", rarete: "commune", valeur: 60, effet: "Utile pour la calcination." },
	{ id: "cinabre", nom: "Cinabre Rouge", elts: ["feu", "feu"], essence: "soufre", rarete: "rare", valeur: 200, effet: "Composant de la Pierre Philosophale." },
	{ id: "argent_vif", nom: "Argent Vif", elts: ["eau", "eau"], essence: "mercure", rarete: "rare", valeur: 210, effet: "Composant de la Pierre Philosophale." },
	{ id: "nitre", nom: "Nitre Blanc", elts: ["air", "air"], essence: "sel", rarete: "rare", valeur: 205, effet: "Composant de la Pierre Philosophale." },
	{ id: "antimoine", nom: "Antimoine Étoilé", elts: ["feu", "terre"], essence: "soufre", rarete: "épique", valeur: 380, effet: "Purifie une essence corrompue." },
	{ id: "eau_regale", nom: "Eau Régale", elts: ["feu", "eau"], essence: "mercure", rarete: "épique", valeur: 400, effet: "Dissout n'importe quel métal en duel (dégâts perçants)." },
	{ id: "teinture_universelle", nom: "Teinture Universelle", elts: ["air", "terre"], essence: "soufre", rarete: "légendaire", valeur: 950, effet: "Transforme n'importe quel métal vil en argent." }
];

// Le "code secret" journalier: une recette cachée que le joueur doit deviner par déduction.
function pickDailySecret(seedStr) {
	let h = 0;
	for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
	return RECETTES[h % RECETTES.length];
}

// Table des ingrédients bruts récoltables (pour varier le flux de jeu / ressources)
const INGREDIENTS_BRUTS = [
	{ id: "charbon", nom: "Charbon Ardent", elt: "feu" },
	{ id: "roseeMatin", nom: "Rosée du Matin", elt: "eau" },
	{ id: "plumeCorbeau", nom: "Plume de Corbeau", elt: "air" },
	{ id: "argileRouge", nom: "Argile Rouge", elt: "terre" },
	{ id: "cristalSel", nom: "Cristal de Sel", elt: "sel_ess" },
	{ id: "pierreSoufre", nom: "Pierre de Soufre", elt: "soufre_ess" },
	{ id: "gouteMercure", nom: "Goutte de Mercure", elt: "mercure_ess" }
];

// Étapes de fabrication de la Pierre Philosophale (Magnum Opus), en 4 phases classiques
const OEUVRE_ETAPES = [
	{ id: "nigredo", nom: "Nigredo (Oeuvre au Noir)", desc: "Putréfaction et décomposition de la matière première.", requis: { cinabre: 2, argent_vif: 1 }, tempsMin: 30 },
	{ id: "albedo", nom: "Albedo (Oeuvre au Blanc)", desc: "Purification et lavage jusqu'à obtenir la blancheur.", requis: { nitre: 2, huile_de_talc: 1 }, tempsMin: 45 },
	{ id: "citrinitas", nom: "Citrinitas (Oeuvre au Jaune)", desc: "Illumination progressive, teinte dorée.", requis: { antimoine: 1, poudre_projection: 2 }, tempsMin: 60 },
	{ id: "rubedo", nom: "Rubedo (Oeuvre au Rouge)", desc: "Achèvement, fixation de la Pierre Philosophale.", requis: { or_potable: 1, teinture_universelle: 1 }, tempsMin: 90 }
];

// Événements aléatoires de laboratoire
const EVENEMENTS_LABO = [
	{ id: "fuite_gaz", nom: "Fuite de Gaz Vert", proba: 0.12, effet: "vigueur", delta: -15, texte: "Une fuite de gaz vert vous prend à la gorge !" },
	{ id: "flamme_bleue", nom: "Flamme Bleue Inattendue", proba: 0.08, effet: "or", delta: 60, texte: "Une flamme bleue révèle un dépôt d'or oublié !" },
	{ id: "corbeau_alchimique", nom: "Corbeau Alchimique", proba: 0.06, effet: "indice", delta: 1, texte: "Un corbeau noir dépose un indice sur votre table." },
	{ id: "explosion_mineure", nom: "Explosion Mineure", proba: 0.10, effet: "vigueur", delta: -25, texte: "BOUM ! Une fiole a explosé sur l'établi." },
	{ id: "inspiration", nom: "Inspiration Soudaine", proba: 0.09, effet: "xp", delta: 40, texte: "Une inspiration soudaine éclaire votre esprit." },
	{ id: "vol_apprenti", nom: "Vol d'un Apprenti", proba: 0.05, effet: "or", delta: -40, texte: "Un apprenti malhonnête a fauché quelques pièces." },
	{ id: "eclipse", nom: "Éclipse Favorable", proba: 0.04, effet: "chance", delta: 1, texte: "Une éclipse favorise vos prochaines transmutations." }
];

// Table des succès (au moins 20)
const SUCCES = [
	{ id: "premier_pas", nom: "Premiers Pas", desc: "Réaliser votre première transmutation.", cond: u => u.stats.transmutations >= 1 },
	{ id: "apprenti", nom: "Apprenti Alchimiste", desc: "Atteindre le niveau 5.", cond: u => u.niveau >= 5 },
	{ id: "adepte", nom: "Adepte du Grand Oeuvre", desc: "Atteindre le niveau 15.", cond: u => u.niveau >= 15 },
	{ id: "maitre", nom: "Maître Alchimiste", desc: "Atteindre le niveau 30.", cond: u => u.niveau >= 30 },
	{ id: "archimage", nom: "Archimage Hermétique", desc: "Atteindre le niveau 50.", cond: u => u.niveau >= 50 },
	{ id: "dix_transmutations", nom: "Manipulateur de Matière", desc: "10 transmutations réussies.", cond: u => u.stats.transmutations >= 10 },
	{ id: "cent_transmutations", nom: "Souverain des Réactions", desc: "100 transmutations réussies.", cond: u => u.stats.transmutations >= 100 },
	{ id: "premiere_recette", nom: "Eurêka !", desc: "Découvrir votre première recette secrète.", cond: u => u.stats.recettesDecouvertes >= 1 },
	{ id: "cinq_recettes", nom: "Collectionneur d'Arcanes", desc: "Découvrir 5 recettes secrètes.", cond: u => u.stats.recettesDecouvertes >= 5 },
	{ id: "toutes_recettes", nom: "Encyclopédiste Hermétique", desc: "Découvrir toutes les recettes.", cond: u => u.stats.recettesDecouvertes >= RECETTES.length },
	{ id: "premiere_explosion", nom: "Ça Sent le Roussi", desc: "Provoquer votre première explosion.", cond: u => u.stats.explosions >= 1 },
	{ id: "dix_explosions", nom: "Danger Public", desc: "Provoquer 10 explosions.", cond: u => u.stats.explosions >= 10 },
	{ id: "riche", nom: "Bourse Bien Garnie", desc: "Posséder 1000 pièces d'or.", cond: u => u.or >= 1000 },
	{ id: "tres_riche", nom: "Mécène des Sciences", desc: "Posséder 10000 pièces d'or.", cond: u => u.or >= 10000 },
	{ id: "nigredo_fait", nom: "Oeuvre au Noir", desc: "Achever l'étape Nigredo.", cond: u => u.pierre.etapes.includes("nigredo") },
	{ id: "albedo_fait", nom: "Oeuvre au Blanc", desc: "Achever l'étape Albedo.", cond: u => u.pierre.etapes.includes("albedo") },
	{ id: "citrinitas_fait", nom: "Oeuvre au Jaune", desc: "Achever l'étape Citrinitas.", cond: u => u.pierre.etapes.includes("citrinitas") },
	{ id: "pierre_complete", nom: "LA PIERRE PHILOSOPHALE", desc: "Achever le Grand Oeuvre complet.", cond: u => u.pierre.complete },
	{ id: "premier_duel", nom: "Premier Duel", desc: "Disputer votre premier duel de mages.", cond: u => u.stats.duels >= 1 },
	{ id: "dix_victoires", nom: "Rival Redouté", desc: "Remporter 10 duels.", cond: u => u.stats.duelsGagnes >= 10 },
	{ id: "cinquante_victoires", nom: "Champion Hermétique", desc: "Remporter 50 duels.", cond: u => u.stats.duelsGagnes >= 50 },
	{ id: "vente_elixir", nom: "Premier Client", desc: "Vendre votre premier élixir.", cond: u => u.stats.ventes >= 1 },
	{ id: "vendeur_prolifique", nom: "Apothicaire de Renom", desc: "Vendre 50 élixirs.", cond: u => u.stats.ventes >= 50 },
	{ id: "sans_accident", nom: "Main Sûre", desc: "Réaliser 20 transmutations sans accident depuis le début.", cond: u => u.stats.transmutations >= 20 && u.stats.explosions === 0 },
	{ id: "code_casse", nom: "Décrypteur d'Arcanes", desc: "Résoudre une table des arcanes en moins de 4 essais.", cond: u => u.stats.meilleurEssaiDeduction > 0 && u.stats.meilleurEssaiDeduction <= 4 }
];

// Adversaires du duel de mages alchimistes (IA)
const ADVERSAIRES = [
	{ id: "novice_rouge", nom: "Novice au Manteau Rouge", niveau: 3, pv: 90, energie: 40, techniques: ["jet_flamme", "projection_sel"], recompenseOr: 45, recompenseXp: 30 },
	{ id: "soeur_eau", nom: "Sœur des Eaux Grises", niveau: 6, pv: 120, energie: 55, techniques: ["voile_brume", "onde_mercure", "projection_sel"], recompenseOr: 70, recompenseXp: 55 },
	{ id: "frere_terre", nom: "Frère de la Terre Cuite", niveau: 10, pv: 160, energie: 65, techniques: ["mur_argile", "seisme_mineur", "jet_flamme"], recompenseOr: 110, recompenseXp: 90 },
	{ id: "maitre_soufre", nom: "Maître du Soufre Noir", niveau: 16, pv: 220, energie: 80, techniques: ["explosion_soufre", "onde_mercure", "seisme_mineur"], recompenseOr: 180, recompenseXp: 150 },
	{ id: "dame_vitriol", nom: "Dame du Vitriol", niveau: 22, pv: 280, energie: 95, techniques: ["pluie_acide", "explosion_soufre", "voile_brume"], recompenseOr: 260, recompenseXp: 220 },
	{ id: "archi_hermes", nom: "Archi-Hermès le Trismégiste", niveau: 35, pv: 420, energie: 130, techniques: ["foudre_philosophale", "pluie_acide", "seisme_mineur", "onde_mercure"], recompenseOr: 500, recompenseXp: 420 }
];

// Techniques de duel : dégâts, coût, effets spéciaux
const TECHNIQUES = {
	jet_flamme: { nom: "Jet de Flamme", cout: 10, degats: [14, 22], type: "feu", desc: "Une gerbe de feu contrôlée." },
	projection_sel: { nom: "Projection de Sel", cout: 8, degats: [8, 14], type: "terre", effetStatut: { nom: "aveugle", tours: 1, precisionMalus: 0.25 }, desc: "Aveugle brièvement l'adversaire." },
	voile_brume: { nom: "Voile de Brume", cout: 12, degats: [0, 0], soin: [10, 18], desc: "Restaure des points de vie via la vapeur d'eau." },
	onde_mercure: { nom: "Onde de Mercure", cout: 14, degats: [16, 24], type: "eau", effetStatut: { nom: "ralenti", tours: 2, esquiveMalus: 0.2 }, desc: "Ralentit les réflexes adverses." },
	mur_argile: { nom: "Mur d'Argile", cout: 10, degats: [0, 0], bouclier: [20, 30], desc: "Érige un mur de terre cuite protecteur." },
	seisme_mineur: { nom: "Séisme Mineur", cout: 18, degats: [22, 32], type: "terre", desc: "Fait trembler le sol du laboratoire." },
	explosion_soufre: { nom: "Explosion de Soufre", cout: 22, degats: [28, 40], type: "feu", effetStatut: { nom: "brulure", tours: 3, degatsParTour: 6 }, desc: "Une explosion soufrée qui embrase l'adversaire." },
	pluie_acide: { nom: "Pluie Acide", cout: 20, degats: [24, 34], type: "eau", effetStatut: { nom: "corrosion", tours: 2, degatsParTour: 8 }, desc: "Corrode l'armure adverse." },
	foudre_philosophale: { nom: "Foudre Philosophale", cout: 30, degats: [40, 58], type: "air", desc: "Technique ultime, rarement maîtrisée." },
	transmutation_offensive: { nom: "Transmutation Offensive", cout: 16, degats: [18, 28], type: "special", desc: "Convertit une part d'or en dégâts bruts." },
	pierre_defense: { nom: "Bouclier de la Pierre", cout: 15, degats: [0, 0], bouclier: [25, 35], desc: "Invoque un fragment protecteur de la Pierre." }
};

const GRADES = [
	{ niveauMin: 0, nom: "Souffleur de Charbon" },
	{ niveauMin: 5, nom: "Apprenti Alchimiste" },
	{ niveauMin: 10, nom: "Compagnon Hermétique" },
	{ niveauMin: 18, nom: "Adepte du Grand Oeuvre" },
	{ niveauMin: 28, nom: "Maître Alchimiste" },
	{ niveauMin: 40, nom: "Archimage Hermétique" },
	{ niveauMin: 60, nom: "Trismégiste Vivant" }
];

function gradeDe(niveau) {
	let g = GRADES[0];
	for (const gr of GRADES) if (niveau >= gr.niveauMin) g = gr;
	return g.nom;
}

function xpRequisPour(niveau) {
	return Math.round(60 * Math.pow(niveau, 1.55) + 40);
}

// ----------------------------------------------------------------------------
//  2. PERSISTANCE / INITIALISATION
// ----------------------------------------------------------------------------

function initAlchimie(userData) {
	if (!userData.alchimie) userData.alchimie = {};
	const a = userData.alchimie;
	if (typeof a.or !== "number") a.or = 100;
	if (typeof a.niveau !== "number") a.niveau = 1;
	if (typeof a.xp !== "number") a.xp = 0;
	if (typeof a.vigueur !== "number") a.vigueur = 100;
	if (typeof a.vigueurMax !== "number") a.vigueurMax = 100;
	if (!Array.isArray(a.inventaireElements)) a.inventaireElements = [];
	if (!a.inventaireEssences) a.inventaireEssences = { sel: 0, soufre: 0, mercure: 0 };
	if (!a.inventaireElixirs) a.inventaireElixirs = {};
	if (!a.recettesConnues) a.recettesConnues = [];
	if (!a.pierre) a.pierre = { etapes: [], complete: false, enCours: null, debutEtape: 0 };
	if (!a.stats) a.stats = { transmutations: 0, explosions: 0, recettesDecouvertes: 0, duels: 0, duelsGagnes: 0, ventes: 0, meilleurEssaiDeduction: 0 };
	if (!Array.isArray(a.succesDebloques)) a.succesDebloques = [];
	if (!a.cooldowns) a.cooldowns = { transmuter: 0, daily: 0, evenement: 0, distiller: 0, deviner: 0 };
	if (!a.deduction) a.deduction = null; // { secretId, essais: [], nbEssaisMax, dateDebut }
	if (!a.duelEnCours) a.duelEnCours = null;
	if (!a.historique) a.historique = [];
	if (typeof a.chance !== "number") a.chance = 0;
	// migration douce des essences si ancien format
	if (typeof a.inventaireEssences.sel !== "number") a.inventaireEssences.sel = 0;
	if (typeof a.inventaireEssences.soufre !== "number") a.inventaireEssences.soufre = 0;
	if (typeof a.inventaireEssences.mercure !== "number") a.inventaireEssences.mercure = 0;
	return a;
}

function ajouterElement(a, id, qte = 1) {
	let e = a.inventaireElements.find(x => x.id === id);
	if (!e) { e = { id, qte: 0 }; a.inventaireElements.push(e); }
	e.qte += qte;
}

function retirerElement(a, id, qte = 1) {
	const e = a.inventaireElements.find(x => x.id === id);
	if (!e || e.qte < qte) return false;
	e.qte -= qte;
	return true;
}

function compterElement(a, id) {
	const e = a.inventaireElements.find(x => x.id === id);
	return e ? e.qte : 0;
}

function ajouterElixir(a, id, qte = 1) {
	if (!a.inventaireElixirs[id]) a.inventaireElixirs[id] = 0;
	a.inventaireElixirs[id] += qte;
}

function gainerXp(a, montant) {
	a.xp += montant;
	let leveled = false;
	while (a.xp >= xpRequisPour(a.niveau)) {
		a.xp -= xpRequisPour(a.niveau);
		a.niveau += 1;
		a.vigueurMax += 4;
		leveled = true;
	}
	return leveled;
}

function verifierSucces(a) {
	const nouveaux = [];
	for (const s of SUCCES) {
		if (!a.succesDebloques.includes(s.id)) {
			try {
				if (s.cond(a)) {
					a.succesDebloques.push(s.id);
					nouveaux.push(s);
				}
			} catch (e) {}
		}
	}
	return nouveaux;
}

function distanceRecette(candidat, secret) {
	// candidat = { elts: [a,b], essence } ; distance basée sur éléments communs + essence
	let score = 0;
	const secElts = [...secret.elts];
	const candElts = [...candidat.elts];
	// comparer multi-ensemble
	let matched = 0;
	for (const e of candElts) {
		const idx = secElts.indexOf(e);
		if (idx !== -1) { secElts.splice(idx, 1); matched++; }
	}
	score += (2 - matched) * 2; // 0..4
	score += candidat.essence === secret.essence ? 0 : 2;
	return score; // 0 = trouvé, plus haut = plus loin
}

function indiceTexte(distance) {
	if (distance === 0) return "🔥 BRÛLANT — Vous avez trouvé la recette exacte !";
	if (distance <= 1) return "🔥 Très chaud — vous y êtes presque.";
	if (distance <= 2) return "🌤️ Chaud — bonne direction.";
	if (distance <= 3) return "🌥️ Tiède — encore du chemin.";
	if (distance <= 4) return "❄️ Froid — revoyez votre combinaison.";
	return "🧊 Glacial — vous êtes loin du compte.";
}

// ----------------------------------------------------------------------------
//  3. RENDUS CANVAS
// ----------------------------------------------------------------------------

async function renderLaboratoire(a, nomJoueur) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 1300;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawSheetBackground(ctx, W, H);
	drawHeader(ctx, W, "LABORATOIRE ALCHIMIQUE", `REGISTRE DE ${nomJoueur.toUpperCase()}`, "A-001");

	// Cercle alchimique central (grand sceau)
	const cx = W / 2, cy = 330, R = 190;
	circle(ctx, cx, cy, R, PALETTE.cuivre1, 2.4);
	circle(ctx, cx, cy, R - 14, PALETTE.cuivre3, 1);
	polygon(ctx, cx, cy, R - 30, 4, Math.PI / 4, PALETTE.trait, 1.6);
	polygon(ctx, cx, cy, R - 55, 3, -Math.PI / 2, PALETTE.cuivre2, 1.4);
	circle(ctx, cx, cy, 34, PALETTE.encre, 1.8);

	// 4 éléments disposés en croix autour du cercle
	const positions = [
		{ dx: 0, dy: -R - 40, elt: ELEMENTS[0] },
		{ dx: R + 40, dy: 0, elt: ELEMENTS[1] },
		{ dx: 0, dy: R + 40, elt: ELEMENTS[2] },
		{ dx: -R - 40, dy: 0, elt: ELEMENTS[3] }
	];
	positions.forEach((p, i) => {
		const px = cx + p.dx, py = cy + p.dy;
		circle(ctx, px, py, 38, PALETTE.trait, 1.6);
		T(ctx, p.elt.nom.toUpperCase(), px, py - 4, 13, PALETTE.encre, { align: "center", weight: "bold" });
		const qte = compterElement(a, p.elt.id);
		T(ctx, `x${qte}`, px, py + 16, 12, PALETTE.cuivre2, { align: "center" });
	});

	// Courbes de réaction reliant le sceau aux 3 essences (bas de planche)
	const baseY = 620;
	T(ctx, "ESSENCES PHILOSOPHIQUES", W / 2, baseY - 30, 16, PALETTE.encre, { align: "center", weight: "bold" });
	const essX = [W / 2 - 260, W / 2, W / 2 + 260];
	ESSENCES.forEach((es, i) => {
		const ex = essX[i], ey = baseY + 40;
		ctx.save();
		ctx.strokeStyle = PALETTE.cuivre2;
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(cx, cy + R);
		ctx.bezierCurveTo(cx, cy + R + 80, ex, ey - 90, ex, ey - 46);
		ctx.stroke();
		ctx.restore();
		rr(ctx, ex - 70, ey - 46, 140, 92, 8);
		ctx.strokeStyle = PALETTE.trait;
		ctx.lineWidth = 1.4;
		ctx.stroke();
		T(ctx, es.nom.toUpperCase(), ex, ey - 14, 14, PALETTE.encre, { align: "center", weight: "bold" });
		const qte = a.inventaireEssences[es.id] || 0;
		T(ctx, `STOCK: ${qte}`, ex, ey + 8, 12, PALETTE.cuivre2, { align: "center" });
		T(ctx, `${i + 1}`, ex - 60, ey - 36, 11, PALETTE.cuivre1, { weight: "bold" });
	});

	// Bloc statistiques bas de page
	const sy = 800;
	rr(ctx, 60, sy, W - 120, 300, 10);
	ctx.strokeStyle = PALETTE.trait; ctx.lineWidth = 1.4; ctx.stroke();
	T(ctx, "REGISTRE DES MESURES", W / 2, sy + 30, 18, PALETTE.encre, { align: "center", weight: "bold" });

	drawGauge(ctx, 100, sy + 70, W - 200, 22, a.vigueur / a.vigueurMax, `VIGUEUR DU LABORATOIRE  ${a.vigueur}/${a.vigueurMax}`, PALETTE.vert);
	drawGauge(ctx, 100, sy + 130, W - 200, 22, (a.xp) / xpRequisPour(a.niveau), `EXPERIENCE  NIVEAU ${a.niveau}  (${a.xp}/${xpRequisPour(a.niveau)})`, PALETTE.or);

	T(ctx, `OR: ${a.or}`, 100, sy + 190, 15, PALETTE.encre, { weight: "bold" });
	T(ctx, `GRADE: ${gradeDe(a.niveau).toUpperCase()}`, 100, sy + 216, 15, PALETTE.encre, { weight: "bold" });
	T(ctx, `TRANSMUTATIONS: ${a.stats.transmutations}`, 100, sy + 242, 14, PALETTE.cuivre3);
	T(ctx, `RECETTES DECOUVERTES: ${a.stats.recettesDecouvertes}/${RECETTES.length}`, 500, sy + 216, 14, PALETTE.cuivre3);
	T(ctx, `EXPLOSIONS: ${a.stats.explosions}`, 500, sy + 242, 14, PALETTE.cuivre3);
	T(ctx, `DUELS GAGNES: ${a.stats.duelsGagnes}/${a.stats.duels}`, 100, sy + 268, 14, PALETTE.cuivre3);
	T(ctx, `PIERRE PHILOSOPHALE: ${a.pierre.complete ? "ACHEVEE" : a.pierre.etapes.length + "/4 ETAPES"}`, 500, sy + 268, 14, PALETTE.cuivre3);

	drawLegendBox(ctx, 60, 1130, W - 120, [
		"Cercle alchimique central : sceau de manipulation des quatre éléments.",
		"Points cardinaux : réserves d'éléments primordiaux disponibles.",
		"Courbes en pointillé : circulation de l'énergie vers les essences.",
		"Jauges inférieures : vigueur du laboratoire et progression d'expérience."
	]);

	return await saveCanvasToFile(canvas, `labo_${Date.now()}.png`);
}

async function renderDeduction(a, essaisAffiches) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 900;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawSheetBackground(ctx, W, H);
	drawHeader(ctx, W, "TABLE DES ARCANES", "DEDUCTION DE LA RECETTE SECRETE", "A-002");

	T(ctx, "COMBINAISONS TESTEES", 60, 150, 16, PALETTE.encre, { weight: "bold" });
	const startY = 190;
	const rowH = 46;
	essaisAffiches.forEach((es, i) => {
		const y = startY + i * rowH;
		rr(ctx, 60, y, W - 120, rowH - 8, 6);
		ctx.strokeStyle = PALETTE.trait; ctx.lineWidth = 1; ctx.stroke();
		T(ctx, `${i + 1}`, 80, y + (rowH - 8) / 2, 13, PALETTE.cuivre1, { weight: "bold" });
		T(ctx, es.texte.toUpperCase(), 110, y + (rowH - 8) / 2, 14, PALETTE.encre);
		const dcolor = es.distance === 0 ? PALETTE.vert : (es.distance <= 2 ? PALETTE.cuivre2 : PALETTE.bleu);
		T(ctx, es.distance === 0 ? "TROUVE" : `ECART ${es.distance}`, W - 100, y + (rowH - 8) / 2, 13, dcolor, { align: "right", weight: "bold" });
	});

	// diagramme radar/courbe de convergence des écarts
	const gy = startY + Math.max(essaisAffiches.length, 1) * rowH + 40;
	T(ctx, "COURBE DE CONVERGENCE", 60, gy, 16, PALETTE.encre, { weight: "bold" });
	const gx0 = 90, gyBase = gy + 220, gw = W - 180, gh = 190;
	ctx.save();
	ctx.strokeStyle = PALETTE.trait; ctx.lineWidth = 1.2;
	ctx.beginPath(); ctx.moveTo(gx0, gyBase); ctx.lineTo(gx0 + gw, gyBase); ctx.stroke();
	ctx.beginPath(); ctx.moveTo(gx0, gyBase); ctx.lineTo(gx0, gyBase - gh); ctx.stroke();
	ctx.restore();
	if (essaisAffiches.length > 0) {
		ctx.save();
		ctx.strokeStyle = PALETTE.cuivre1;
		ctx.lineWidth = 2;
		ctx.beginPath();
		essaisAffiches.forEach((es, i) => {
			const px = gx0 + (gw / Math.max(essaisAffiches.length - 1, 1)) * i;
			const py = gyBase - (gh * (1 - es.distance / 6));
			if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
			ctx.fillStyle = PALETTE.cuivre2;
			ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
		});
		ctx.stroke();
		ctx.restore();
	}

	drawLegendBox(ctx, 60, H - 130, W - 120, [
		"Écart 0 : recette exacte découverte (BRULANT).",
		"Écart croissant : combinaison de plus en plus éloignée (vers GLACIAL).",
		"Courbe : évolution de la précision des essais dans le temps."
	]);

	return await saveCanvasToFile(canvas, `deduction_${Date.now()}.png`);
}

async function renderDuel(duel) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1100, H = 750;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawSheetBackground(ctx, W, H);
	drawHeader(ctx, W, "DUEL DE MAGES ALCHIMISTES", `TOUR ${duel.tour} — ARENE HERMETIQUE`, "A-003");

	// Deux blasons face à face
	const drawFighter = (x, nom, pv, pvMax, energie, energieMax, statuts, sideRight) => {
		rr(ctx, x, 150, 420, 240, 10);
		ctx.strokeStyle = PALETTE.trait; ctx.lineWidth = 1.6; ctx.stroke();
		T(ctx, nom.toUpperCase(), x + 210, 178, 16, PALETTE.encre, { align: "center", weight: "bold" });
		polygon(ctx, x + 210, 250, 46, 6, Math.PI / 6, PALETTE.cuivre2, 1.6);
		circle(ctx, x + 210, 250, 20, PALETTE.trait, 1.2);
		drawGauge(ctx, x + 20, 320, 380, 20, pv / pvMax, `VIE ${Math.max(0, Math.round(pv))}/${pvMax}`, PALETTE.rouge);
		drawGauge(ctx, x + 20, 360, 380, 16, energie / energieMax, `ENERGIE ${Math.max(0, Math.round(energie))}/${energieMax}`, PALETTE.bleu);
		let sy = 388;
		for (const st of statuts) {
			T(ctx, `- ${st.nom.toUpperCase()} (${st.tours})`, x + 20, sy, 11, PALETTE.cuivre3);
			sy += 14;
		}
	};
	drawFighter(50, duel.joueur.nom, duel.joueur.pv, duel.joueur.pvMax, duel.joueur.energie, duel.joueur.energieMax, duel.joueur.statuts);
	drawFighter(630, duel.adversaire.nom, duel.adversaire.pv, duel.adversaire.pvMax, duel.adversaire.energie, duel.adversaire.energieMax, duel.adversaire.statuts);

	// symbole VS central
	T(ctx, "VERSUS", W / 2, 260, 26, PALETTE.cuivre1, { align: "center", weight: "bold", spacing: 4 });
	circle(ctx, W / 2, 260, 60, PALETTE.trait, 1.4);

	// journal des dernières actions
	T(ctx, "JOURNAL DE COMBAT", 60, 430, 16, PALETTE.encre, { weight: "bold" });
	const journal = duel.journal.slice(-6);
	journal.forEach((l, i) => {
		T(ctx, `${i + 1}. ${l}`, 60, 460 + i * 24, 12, PALETTE.cuivre3);
	});

	drawLegendBox(ctx, 60, H - 100, W - 120, [
		"Jauge rouge : points de vie restants du duelliste.",
		"Jauge bleue : énergie disponible pour lancer des techniques."
	]);

	return await saveCanvasToFile(canvas, `duel_${Date.now()}.png`);
}

async function renderPierre(a) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 900;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	drawSheetBackground(ctx, W, H);
	drawHeader(ctx, W, "MAGNUM OPUS", "LES QUATRE ETAPES DE LA PIERRE PHILOSOPHALE", "A-004");

	const boxW = (W - 160) / 2, boxH = 280;
	OEUVRE_ETAPES.forEach((et, i) => {
		const col = i % 2, row = Math.floor(i / 2);
		const x = 60 + col * (boxW + 40);
		const y = 150 + row * (boxH + 40);
		const fait = a.pierre.etapes.includes(et.id);
		rr(ctx, x, y, boxW, boxH, 10);
		ctx.strokeStyle = fait ? PALETTE.vert : PALETTE.trait;
		ctx.lineWidth = fait ? 2.4 : 1.4;
		ctx.stroke();
		if (fait) {
			ctx.save();
			ctx.globalAlpha = 0.08;
			ctx.fillStyle = PALETTE.vert;
			rr(ctx, x, y, boxW, boxH, 10);
			ctx.fill();
			ctx.restore();
		}
		T(ctx, `${i + 1}. ${et.nom.toUpperCase()}`, x + 20, y + 34, 15, PALETTE.encre, { weight: "bold" });
		T(ctx, fait ? "ETAPE ACHEVEE" : (a.pierre.enCours === et.id ? "EN COURS" : "EN ATTENTE"), x + 20, y + 58, 12, fait ? PALETTE.vert : PALETTE.cuivre2, { weight: "bold" });
		const words = et.desc.split(" ");
		let line = "", ly = y + 90, maxW = boxW - 40;
		ctx.font = "12px " + FONT_FAMILY;
		for (const w of words) {
			const test = line ? line + " " + w : w;
			if (ctx.measureText(test).width > maxW) {
				T(ctx, test.replace(" " + w, ""), x + 20, ly, 12, PALETTE.cuivre3);
				line = w; ly += 16;
			} else line = test;
		}
		if (line) T(ctx, line, x + 20, ly, 12, PALETTE.cuivre3);
		let ry = ly + 30;
		T(ctx, "INGREDIENTS REQUIS:", x + 20, ry, 11, PALETTE.encre, { weight: "bold" });
		ry += 18;
		for (const key of Object.keys(et.requis)) {
			T(ctx, `- ${key.toUpperCase()} x${et.requis[key]}`, x + 20, ry, 11, PALETTE.cuivre3);
			ry += 15;
		}
		polygon(ctx, x + boxW - 40, y + 40, 22, fait ? 8 : 4, Math.PI / 8, fait ? PALETTE.vert : PALETTE.cuivre2, 1.4);
	});

	drawLegendBox(ctx, 60, H - 110, W - 120, [
		"Encadré vert : étape du Grand Oeuvre déjà achevée.",
		"Polygone à 8 côtés : symbole de complétude d'une phase.",
		"Polygone à 4 côtés : symbole d'une phase encore à réaliser."
	]);

	return await saveCanvasToFile(canvas, `pierre_${Date.now()}.png`);
}

// ----------------------------------------------------------------------------
//  4. MOTEUR DE DUEL (inspiré naruto-storm.js)
// ----------------------------------------------------------------------------

function creerDuel(joueurData, joueurNom, adversaireDef) {
	return {
		tour: 1,
		enAttenteAction: true,
		joueur: {
			nom: joueurNom,
			pv: 100 + joueurData.niveau * 4,
			pvMax: 100 + joueurData.niveau * 4,
			energie: 60 + Math.floor(joueurData.niveau * 1.5),
			energieMax: 60 + Math.floor(joueurData.niveau * 1.5),
			statuts: [],
			techniques: ["jet_flamme", "projection_sel", "voile_brume", "onde_mercure", "mur_argile", "seisme_mineur", "transmutation_offensive", "pierre_defense"]
		},
		adversaire: {
			nom: adversaireDef.nom,
			pv: adversaireDef.pv,
			pvMax: adversaireDef.pv,
			energie: adversaireDef.energie,
			energieMax: adversaireDef.energie,
			statuts: [],
			techniques: adversaireDef.techniques
		},
		def: adversaireDef,
		journal: [`Le duel commence entre ${joueurNom} et ${adversaireDef.nom} !`],
		termine: false,
		vainqueur: null
	};
}

function appliquerStatutsDebutTour(cible, journalPush) {
	let degatsTotal = 0;
	cible.statuts.forEach(st => {
		if (st.degatsParTour) {
			degatsTotal += st.degatsParTour;
			journalPush(`${cible.nom} subit ${st.degatsParTour} dégâts de ${st.nom}.`);
		}
	});
	cible.pv -= degatsTotal;
	cible.statuts.forEach(st => st.tours -= 1);
	cible.statuts = cible.statuts.filter(st => st.tours > 0);
	return degatsTotal;
}

function tirageDegats(range) {
	return Math.round(range[0] + Math.random() * (range[1] - range[0]));
}

function executerTechnique(attaquant, defenseur, techId, journalPush) {
	const tech = TECHNIQUES[techId];
	if (!tech) return;
	if (attaquant.energie < tech.cout) {
		journalPush(`${attaquant.nom} n'a pas assez d'énergie pour ${tech.nom} !`);
		return;
	}
	attaquant.energie -= tech.cout;
	// esquive
	let esquiveChance = 0.08;
	defenseur.statuts.forEach(s => { if (s.esquiveMalus) esquiveChance -= s.esquiveMalus; });
	if (Math.random() < Math.max(0, esquiveChance)) {
		journalPush(`${defenseur.nom} esquive ${tech.nom} !`);
		return;
	}
	let critique = Math.random() < 0.12;
	let degats = tirageDegats(tech.degats || [0, 0]);
	if (critique) degats = Math.round(degats * 1.6);
	if (tech.bouclier) {
		const b = tirageDegats(tech.bouclier);
		attaquant.statuts.push({ nom: "bouclier", tours: 2, bouclier: b });
		journalPush(`${attaquant.nom} érige un bouclier de ${b} points avec ${tech.nom}.`);
	}
	if (tech.soin) {
		const s = tirageDegats(tech.soin);
		attaquant.pv = Math.min(attaquant.pvMax, attaquant.pv + s);
		journalPush(`${attaquant.nom} se soigne de ${s} points avec ${tech.nom}.`);
	}
	if (degats > 0) {
		// absorption par bouclier
		let bouclierActif = defenseur.statuts.find(s => s.nom === "bouclier" && s.bouclier > 0);
		if (bouclierActif) {
			const absorbe = Math.min(bouclierActif.bouclier, degats);
			bouclierActif.bouclier -= absorbe;
			degats -= absorbe;
			journalPush(`Le bouclier de ${defenseur.nom} absorbe ${absorbe} dégâts.`);
			if (bouclierActif.bouclier <= 0) defenseur.statuts = defenseur.statuts.filter(s => s !== bouclierActif);
		}
		defenseur.pv -= degats;
		journalPush(`${attaquant.nom} utilise ${tech.nom} et inflige ${degats} dégâts${critique ? " (COUP CRITIQUE)" : ""} à ${defenseur.nom}.`);
	}
	if (tech.effetStatut) {
		defenseur.statuts.push({ ...tech.effetStatut });
		journalPush(`${defenseur.nom} est affecté par ${tech.effetStatut.nom} (${tech.effetStatut.tours} tours).`);
	}
}

function iaChoisirTechnique(adversaire) {
	const dispo = adversaire.techniques.filter(t => TECHNIQUES[t] && adversaire.energie >= TECHNIQUES[t].cout);
	if (dispo.length === 0) return null;
	// priorité : soigner si bas, sinon dégâts max possible
	if (adversaire.pv < adversaire.pvMax * 0.3) {
		const soin = dispo.find(t => TECHNIQUES[t].soin);
		if (soin) return soin;
	}
	dispo.sort((a, b) => (TECHNIQUES[b].degats ? TECHNIQUES[b].degats[1] : 0) - (TECHNIQUES[a].degats ? TECHNIQUES[a].degats[1] : 0));
	return dispo[0];
}

// ----------------------------------------------------------------------------
//  5. CONFIGURATION GOAT-BOT V2
// ----------------------------------------------------------------------------

module.exports = {
	config: {
		name: "alchimie",
		aliases: ["grandoeuvre", "goetc", "alchemy"],
		version: "1.0",
		author: "Christus",
		countDown: 5,
		role: 0,
		shortDescription: {
			fr: "Laboratoire d'alchimie : transmutation, déduction et duels."
		},
		longDescription: {
			fr: "Gérez votre laboratoire alchimique : combinez les 4 éléments et 3 essences pour transmuter des substances, découvrez des recettes secrètes par déduction, fabriquez la Pierre Philosophale étape par étape, affrontez d'autres mages alchimistes en duel tour par tour, et vendez vos élixirs au marché."
		},
		category: "jeux",
		guide: {
			fr: "{pn} labo — Afficher votre laboratoire (dashboard).\n"
				+ "{pn} recolte — Récolter des éléments bruts (cooldown).\n"
				+ "{pn} transmuter <elt1> <elt2> <essence> — Tenter une transmutation.\n"
				+ "{pn} recettes — Voir la liste des recettes déjà découvertes.\n"
				+ "{pn} deviner — Lancer la Table des Arcanes (déduction, onReply).\n"
				+ "{pn} pierre — Voir l'avancée du Grand Oeuvre.\n"
				+ "{pn} pierre <etape> — Lancer une étape de fabrication (nigredo/albedo/citrinitas/rubedo).\n"
				+ "{pn} vendre <elixir> <quantite> — Vendre des élixirs au marché.\n"
				+ "{pn} duel — Affronter un mage alchimiste (onReply pour les actions).\n"
				+ "{pn} inventaire — Voir votre inventaire complet.\n"
				+ "{pn} succes — Voir vos succès débloqués.\n"
				+ "{pn} classement — Classement des alchimistes.\n"
				+ "{pn} daily — Récupérer votre prime alchimique quotidienne."
		}
	},

	onStart: async function ({ message, event, args, api, usersData, threadsData, commandName }) {
		const uid = event.senderID;
		const userData = await usersData.get(uid);
		const nomJoueur = (userData && userData.name) ? userData.name : "Alchimiste Inconnu";
		const a = initAlchimie(userData);

		function save() { return usersData.set(uid, userData, "alchimie"); }

		const sub = (args[0] || "labo").toLowerCase();

		try {
			switch (sub) {

				case "aide":
				case "help": {
					const txt = "⚗️ " + fonts.bold("GRAND ŒUVRE — GUIDE") + "\n"
						+ "━━━━━━━━━━━━━━━━━━━━\n"
						+ "├─ 🧪 " + fonts.bold("labo") + " : votre laboratoire (dashboard)\n"
						+ "├─ 🌿 " + fonts.bold("recolte") + " : récolter des éléments bruts\n"
						+ "├─ 🔮 " + fonts.bold("transmuter <e1> <e2> <essence>") + "\n"
						+ "├─ 📖 " + fonts.bold("recettes") + " : recettes découvertes\n"
						+ "├─ 🧩 " + fonts.bold("deviner") + " : Table des Arcanes (déduction)\n"
						+ "├─ 🗿 " + fonts.bold("pierre [étape]") + " : Grand Oeuvre\n"
						+ "├─ 💰 " + fonts.bold("vendre <élixir> <qte>") + "\n"
						+ "├─ ⚔️ " + fonts.bold("duel") + " : duel de mages\n"
						+ "├─ 🎒 " + fonts.bold("inventaire") + "\n"
						+ "├─ 🏆 " + fonts.bold("succes") + "\n"
						+ "├─ 📊 " + fonts.bold("classement") + "\n"
						+ "└─ 🎁 " + fonts.bold("daily") + "\n"
						+ "━━━━━━━━━━━━━━━━━━━━";
					return message.reply(txt);
				}

				case "labo":
				case "dashboard": {
					const img = await renderLaboratoire(a, nomJoueur);
					let texte = "⚗️ " + fonts.bold(`LABORATOIRE DE ${nomJoueur.toUpperCase()}`) + "\n"
						+ "━━━━━━━━━━━━━━━━━━━━\n"
						+ `├─ 🥇 Grade : ${fonts.bold(gradeDe(a.niveau))}\n`
						+ `├─ 📈 Niveau ${a.niveau} — XP ${a.xp}/${xpRequisPour(a.niveau)}\n`
						+ `├─ 💰 Or : ${numbers.bold(String(a.or))}\n`
						+ `├─ ⚡ Vigueur : ${a.vigueur}/${a.vigueurMax}\n`
						+ `├─ 🔬 Transmutations : ${a.stats.transmutations}\n`
						+ `├─ 📜 Recettes découvertes : ${a.stats.recettesDecouvertes}/${RECETTES.length}\n`
						+ `└─ 🗿 Pierre Philosophale : ${a.pierre.complete ? "ACHEVÉE ✨" : a.pierre.etapes.length + "/4 étapes"}\n`
						+ "━━━━━━━━━━━━━━━━━━━━\n"
						+ "Utilisez " + fonts.italic("aide") + " pour la liste des sous-commandes.";
					await save();
					if (img) return message.reply({ body: texte, attachment: fs.createReadStream(img) });
					return message.reply(texte);
				}

				case "recolte":
				case "récolte": {
					const now = Date.now();
					const COOLDOWN = 25 * 60 * 1000;
					if (a.cooldowns.recolte && now - a.cooldowns.recolte < COOLDOWN) {
						const reste = Math.ceil((COOLDOWN - (now - a.cooldowns.recolte)) / 60000);
						return message.reply(`⏳ Vos réserves ne se renouvellent pas encore. Revenez dans ${reste} minute(s).`);
					}
					a.cooldowns.recolte = now;
					const gains = [];
					for (let i = 0; i < 3; i++) {
						const ing = INGREDIENTS_BRUTS[Math.floor(Math.random() * INGREDIENTS_BRUTS.length)];
						if (ing.elt.endsWith("_ess")) {
							const essId = ing.elt.replace("_ess", "");
							a.inventaireEssences[essId] += 1;
							gains.push(`${ing.nom} → +1 essence de ${essId}`);
						} else {
							ajouterElement(a, ing.elt, 1);
							gains.push(`${ing.nom} → +1 ${ing.elt}`);
						}
					}
					// événement aléatoire
					let eventTxt = "";
					if (Math.random() < 0.25) {
						const ev = EVENEMENTS_LABO[Math.floor(Math.random() * EVENEMENTS_LABO.length)];
						if (ev.effet === "vigueur") a.vigueur = Math.max(0, Math.min(a.vigueurMax, a.vigueur + ev.delta));
						if (ev.effet === "or") a.or = Math.max(0, a.or + ev.delta);
						if (ev.effet === "xp") gainerXp(a, ev.delta);
						if (ev.effet === "chance") a.chance += ev.delta;
						eventTxt = `\n\n🎲 Événement : ${ev.texte}`;
					}
					const succesNouveaux = verifierSucces(a);
					await save();
					let txt = "🌿 " + fonts.bold("RÉCOLTE D'INGRÉDIENTS") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ gains.map(g => "├─ " + g).join("\n") + eventTxt;
					if (succesNouveaux.length) txt += "\n\n🏆 Succès débloqué(s) : " + succesNouveaux.map(s => s.nom).join(", ");
					return message.reply(txt);
				}

				case "transmuter": {
					if (args.length < 4) {
						return message.reply("⚠️ Syntaxe : {pn} transmuter <élément1> <élément2> <essence>\nÉléments : feu, eau, air, terre — Essences : sel, soufre, mercure".replace("{pn}", commandName));
					}
					const e1 = args[1].toLowerCase(), e2 = args[2].toLowerCase(), es = args[3].toLowerCase();
					const validElt = ELEMENTS.map(e => e.id);
					if (!validElt.includes(e1) || !validElt.includes(e2) || !ESSENCES.map(x => x.id).includes(es)) {
						return message.reply("⚠️ Combinaison invalide. Éléments valides : feu, eau, air, terre. Essences valides : sel, soufre, mercure.");
					}
					if (compterElement(a, e1) < 1 || (e1 === e2 ? compterElement(a, e1) < 2 : compterElement(a, e2) < 1)) {
						return message.reply("⚠️ Vous n'avez pas assez de ces éléments en stock. Faites `recolte` pour en obtenir.");
					}
					if (a.inventaireEssences[es] < 1) {
						return message.reply(`⚠️ Vous n'avez pas d'essence de ${es} en stock.`);
					}
					if (a.vigueur < 10) {
						return message.reply("⚠️ Votre laboratoire manque de vigueur pour manipuler ces substances. Attendez ou récoltez.");
					}
					// consommation
					retirerElement(a, e1, 1);
					retirerElement(a, e2, 1);
					a.inventaireEssences[es] -= 1;
					a.vigueur -= 8;
					a.stats.transmutations += 1;

					// chance d'accident
					let chanceAccident = 0.15 - (a.chance > 0 ? 0.05 : 0);
					if (Math.random() < chanceAccident) {
						a.stats.explosions += 1;
						a.vigueur = Math.max(0, a.vigueur - 20);
						await save();
						return message.reply("💥 " + fonts.bold("EXPLOSION !") + "\n━━━━━━━━━━━━━━━━━━━━\nLa mixture a mal tourné et un nuage âcre envahit le laboratoire. Les éléments sont perdus, la vigueur du laboratoire chute lourdement.\n💡 Astuce : l'Huile de Talc réduit ce risque de moitié.");
					}

					// recherche de la recette correspondante (ordre indifférent)
					const recette = RECETTES.find(r => {
						const combo = [...r.elts].sort().join(",");
						const test = [e1, e2].sort().join(",");
						return combo === test && r.essence === es;
					});

					if (recette) {
						const premiereFois = !a.recettesConnues.includes(recette.id);
						if (premiereFois) {
							a.recettesConnues.push(recette.id);
							a.stats.recettesDecouvertes += 1;
						}
						ajouterElixir(a, recette.id, 1);
						const xpGagne = premiereFois ? 80 : 25;
						const leveled = gainerXp(a, xpGagne);
						a.or += Math.round(recette.valeur * 0.1);
						if (a.chance > 0) a.chance -= 1;
						const succesNouveaux = verifierSucces(a);
						await save();
						let txt = "✨ " + fonts.bold("TRANSMUTATION RÉUSSIE !") + "\n━━━━━━━━━━━━━━━━━━━━\n"
							+ `├─ 🧪 Résultat : ${fonts.bold(recette.nom)} (${recette.rarete})\n`
							+ `├─ 📖 Effet : ${recette.effet}\n`
							+ `├─ 💰 Valeur estimée : ${recette.valeur} or\n`
							+ `├─ ⭐ XP gagné : +${xpGagne}${leveled ? " (NIVEAU SUPÉRIEUR !)" : ""}\n`
							+ (premiereFois ? "└─ 🆕 Nouvelle recette ajoutée à votre grimoire !\n" : "└─ 📚 Recette déjà connue, élixir ajouté au stock.\n");
						if (succesNouveaux.length) txt += "\n🏆 Succès débloqué(s) : " + succesNouveaux.map(s => s.nom).join(", ");
						return message.reply(txt);
					} else {
						// échec : substance instable sans recette connue, petite compensation
						gainerXp(a, 5);
						await save();
						return message.reply("🌫️ " + fonts.bold("SUBSTANCE INSTABLE") + "\n━━━━━━━━━━━━━━━━━━━━\nCette combinaison ne correspond à aucune recette connue. Les éléments se dissipent en fumée, mais vous gagnez un peu d'expérience de l'expérimentation.\n💡 Essayez `deviner` pour découvrir des recettes par déduction méthodique.");
					}
				}

				case "recettes": {
					if (a.recettesConnues.length === 0) {
						return message.reply("📖 Vous ne connaissez encore aucune recette. Expérimentez avec `transmuter` ou lancez `deviner` !");
					}
					let txt = "📖 " + fonts.bold("GRIMOIRE DES RECETTES CONNUES") + "\n━━━━━━━━━━━━━━━━━━━━\n";
					a.recettesConnues.forEach(rid => {
						const r = RECETTES.find(x => x.id === rid);
						if (!r) return;
						txt += `├─ ${fonts.bold(r.nom)} (${r.rarete}) — ${r.elts.join(" + ")} + ${r.essence}\n│   ${r.effet}\n`;
					});
					txt += "━━━━━━━━━━━━━━━━━━━━";
					return message.reply(txt);
				}

				case "deviner": {
					if (a.deduction) {
						return message.reply("🧩 Une Table des Arcanes est déjà en cours. Répondez au message précédent, ou attendez qu'elle expire (10 essais max).");
					}
					const secret = pickDailySecret(uid + "-" + Math.floor(Date.now() / (1000 * 60 * 60 * 6)));
					a.deduction = { secretId: secret.id, essais: [], nbEssaisMax: 10, dateDebut: Date.now() };
					await save();
					const txt = "🧩 " + fonts.bold("TABLE DES ARCANES") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ "Une recette secrète attend d'être découverte. Répondez sous ce message avec une combinaison au format :\n"
						+ fonts.italic("élément1 élément2 essence") + "\n"
						+ "Exemple : feu terre sel\n\n"
						+ "Éléments : feu, eau, air, terre — Essences : sel, soufre, mercure\n"
						+ `Vous avez ${a.deduction.nbEssaisMax} essais. Bonne chance, apprenti !`;
					const img = await renderDeduction(a, []);
					const sent = img
						? await message.reply({ body: txt, attachment: fs.createReadStream(img) })
						: await message.reply(txt);
					global.GoatBot.onReply.set(sent.messageID, {
						commandName,
						messageID: sent.messageID,
						author: uid,
						type: "deduction"
					});
					return;
				}

				case "pierre": {
					const etapeArg = (args[1] || "").toLowerCase();
					if (!etapeArg) {
						const img = await renderPierre(a);
						let txt = "🗿 " + fonts.bold("MAGNUM OPUS — LA PIERRE PHILOSOPHALE") + "\n━━━━━━━━━━━━━━━━━━━━\n";
						OEUVRE_ETAPES.forEach((et, i) => {
							const fait = a.pierre.etapes.includes(et.id);
							txt += `${i === OEUVRE_ETAPES.length - 1 ? "└─" : "├─"} ${fait ? "✅" : "🔲"} ${fonts.bold(et.nom)} — ${et.desc}\n`;
						});
						txt += "━━━━━━━━━━━━━━━━━━━━\nUtilisez `pierre <nigredo|albedo|citrinitas|rubedo>` pour lancer une étape.";
						if (a.pierre.complete) txt += "\n\n✨ LE GRAND ŒUVRE EST ACCOMPLI. Vous détenez la Pierre Philosophale !";
						if (img) return message.reply({ body: txt, attachment: fs.createReadStream(img) });
						return message.reply(txt);
					}
					const etape = OEUVRE_ETAPES.find(e => e.id === etapeArg);
					if (!etape) return message.reply("⚠️ Étape inconnue. Choix : nigredo, albedo, citrinitas, rubedo.");
					if (a.pierre.etapes.includes(etape.id)) return message.reply("✅ Cette étape est déjà accomplie.");
					const idxEtape = OEUVRE_ETAPES.findIndex(e => e.id === etape.id);
					if (idxEtape > 0 && !a.pierre.etapes.includes(OEUVRE_ETAPES[idxEtape - 1].id)) {
						return message.reply(`⚠️ Vous devez d'abord accomplir l'étape ${OEUVRE_ETAPES[idxEtape - 1].nom}.`);
					}
					// vérifier les ingrédients (élixirs requis)
					for (const key of Object.keys(etape.requis)) {
						const qte = a.inventaireElixirs[key] || 0;
						if (qte < etape.requis[key]) {
							return message.reply(`⚠️ Il vous manque des ingrédients pour ${etape.nom} : ${key} (${qte}/${etape.requis[key]}). Transmutez-en davantage.`);
						}
					}
					for (const key of Object.keys(etape.requis)) {
						a.inventaireElixirs[key] -= etape.requis[key];
					}
					a.pierre.etapes.push(etape.id);
					gainerXp(a, 150);
					if (a.pierre.etapes.length === OEUVRE_ETAPES.length) {
						a.pierre.complete = true;
						a.or += 2000;
					}
					const succesNouveaux = verifierSucces(a);
					await save();
					let txt = "🗿 " + fonts.bold(`ÉTAPE ACCOMPLIE : ${etape.nom.toUpperCase()}`) + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `${etape.desc}\n+150 XP gagnés.`;
					if (a.pierre.complete) txt += "\n\n✨✨✨ LE GRAND ŒUVRE EST ACCOMPLI ! La Pierre Philosophale est née de vos mains. +2000 or !";
					if (succesNouveaux.length) txt += "\n\n🏆 Succès débloqué(s) : " + succesNouveaux.map(s => s.nom).join(", ");
					return message.reply(txt);
				}

				case "vendre": {
					if (args.length < 2) return message.reply("⚠️ Syntaxe : {pn} vendre <id_élixir> <quantité>".replace("{pn}", commandName));
					const elixirId = args[1].toLowerCase();
					const qte = Math.max(1, parseInt(args[2]) || 1);
					const recette = RECETTES.find(r => r.id === elixirId);
					if (!recette) return message.reply("⚠️ Élixir inconnu. Utilisez `recettes` pour voir vos IDs.");
					const stock = a.inventaireElixirs[elixirId] || 0;
					if (stock < qte) return message.reply(`⚠️ Vous n'avez que ${stock} exemplaire(s) de ${recette.nom}.`);
					const prixUnitaire = Math.round(recette.valeur * (0.7 + Math.random() * 0.3));
					const total = prixUnitaire * qte;
					a.inventaireElixirs[elixirId] -= qte;
					a.or += total;
					a.stats.ventes += qte;
					const succesNouveaux = verifierSucces(a);
					await save();
					let txt = "💰 " + fonts.bold("VENTE AU MARCHÉ DES APOTHICAIRES") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `├─ Élixir : ${recette.nom} x${qte}\n`
						+ `├─ Prix unitaire : ${prixUnitaire} or\n`
						+ `└─ Total encaissé : ${numbers.bold(String(total))} or`;
					if (succesNouveaux.length) txt += "\n\n🏆 Succès débloqué(s) : " + succesNouveaux.map(s => s.nom).join(", ");
					return message.reply(txt);
				}

				case "duel": {
					if (a.duelEnCours) return message.reply("⚔️ Un duel est déjà en cours. Répondez au message de combat précédent.");
					const eligibles = ADVERSAIRES.filter(ad => Math.abs(ad.niveau - a.niveau) <= 12);
					const adv = (eligibles.length ? eligibles : ADVERSAIRES)[Math.floor(Math.random() * (eligibles.length ? eligibles.length : ADVERSAIRES.length))];
					const duel = creerDuel(a, nomJoueur, adv);
					a.duelEnCours = duel;
					a.stats.duels += 1;
					await save();
					const img = await renderDuel(duel);
					const txt = "⚔️ " + fonts.bold("DUEL DE MAGES ALCHIMISTES") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `Un défi vous oppose à ${fonts.bold(adv.nom)} (niveau ${adv.niveau}) !\n\n`
						+ "Techniques disponibles :\n"
						+ duel.joueur.techniques.map((t, i) => `${i + 1}. ${TECHNIQUES[t].nom} (coût ${TECHNIQUES[t].cout})`).join("\n")
						+ "\n\nRépondez avec le numéro de la technique à utiliser.";
					const sent = img
						? await message.reply({ body: txt, attachment: fs.createReadStream(img) })
						: await message.reply(txt);
					global.GoatBot.onReply.set(sent.messageID, {
						commandName,
						messageID: sent.messageID,
						author: uid,
						type: "duel"
					});
					return;
				}

				case "inventaire":
				case "inv": {
					let txt = "🎒 " + fonts.bold(`INVENTAIRE DE ${nomJoueur.toUpperCase()}`) + "\n━━━━━━━━━━━━━━━━━━━━\n";
					txt += "📦 Éléments :\n";
					ELEMENTS.forEach(e => {
						txt += `├─ ${e.nom} : ${compterElement(a, e.id)}\n`;
					});
					txt += "🧴 Essences :\n";
					ESSENCES.forEach(e => {
						txt += `├─ ${e.nom} : ${a.inventaireEssences[e.id]}\n`;
					});
					txt += "🧪 Élixirs :\n";
					const elixirKeys = Object.keys(a.inventaireElixirs).filter(k => a.inventaireElixirs[k] > 0);
					if (elixirKeys.length === 0) txt += "└─ (aucun)\n";
					else elixirKeys.forEach((k, i) => {
						const r = RECETTES.find(x => x.id === k);
						txt += `${i === elixirKeys.length - 1 ? "└─" : "├─"} ${r ? r.nom : k} x${a.inventaireElixirs[k]}\n`;
					});
					txt += "━━━━━━━━━━━━━━━━━━━━";
					return message.reply(txt);
				}

				case "succes":
				case "succès": {
					let txt = "🏆 " + fonts.bold("SUCCÈS ALCHIMIQUES") + "\n━━━━━━━━━━━━━━━━━━━━\n";
					SUCCES.forEach((s, i) => {
						const ok = a.succesDebloques.includes(s.id);
						txt += `${i === SUCCES.length - 1 ? "└─" : "├─"} ${ok ? "✅" : "🔒"} ${fonts.bold(s.nom)} — ${s.desc}\n`;
					});
					txt += `━━━━━━━━━━━━━━━━━━━━\nTotal : ${a.succesDebloques.length}/${SUCCES.length}`;
					return message.reply(txt);
				}

				case "classement":
				case "top": {
					const all = await usersData.getAll();
					const joueurs = all.filter(u => u.alchimie && u.alchimie.niveau).sort((x, y) => {
						if (y.alchimie.niveau !== x.alchimie.niveau) return y.alchimie.niveau - x.alchimie.niveau;
						return y.alchimie.xp - x.alchimie.xp;
					}).slice(0, 10);
					let txt = "📊 " + fonts.bold("CLASSEMENT DES ALCHIMISTES") + "\n━━━━━━━━━━━━━━━━━━━━\n";
					joueurs.forEach((u, i) => {
						txt += `${i + 1}. ${fonts.bold(u.name || "???")} — Niveau ${u.alchimie.niveau} (${gradeDe(u.alchimie.niveau)})\n`;
					});
					if (joueurs.length === 0) txt += "Aucun alchimiste classé pour le moment.";
					txt += "━━━━━━━━━━━━━━━━━━━━";
					return message.reply(txt);
				}

				case "daily": {
					const now = Date.now();
					const COOLDOWN = 20 * 60 * 60 * 1000;
					if (a.cooldowns.daily && now - a.cooldowns.daily < COOLDOWN) {
						const reste = Math.ceil((COOLDOWN - (now - a.cooldowns.daily)) / (60 * 60 * 1000));
						return message.reply(`⏳ Votre prime alchimique quotidienne sera disponible dans ${reste}h.`);
					}
					a.cooldowns.daily = now;
					const orGagne = 50 + a.niveau * 5;
					a.or += orGagne;
					const essaisRandom = ESSENCES[Math.floor(Math.random() * ESSENCES.length)];
					a.inventaireEssences[essaisRandom.id] += 2;
					gainerXp(a, 30);
					await save();
					return message.reply("🎁 " + fonts.bold("PRIME ALCHIMIQUE QUOTIDIENNE") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `├─ 💰 Or gagné : +${orGagne}\n`
						+ `├─ 🧴 Essence de ${essaisRandom.nom} x2\n`
						+ `└─ ⭐ XP : +30`);
				}

				default:
					return message.reply(`⚠️ Sous-commande inconnue "${sub}". Tapez "${commandName} aide" pour la liste complète.`);
			}
		} catch (err) {
			console.error("[alchimie] erreur:", err);
			return message.reply("❌ Une erreur alchimique imprévue est survenue. Le laboratoire a été stabilisé automatiquement.");
		}
	},

	onReply: async function ({ message, event, Reply, api, usersData, commandName }) {
		const uid = event.senderID;
		if (Reply.author !== uid) return;
		const userData = await usersData.get(uid);
		const a = initAlchimie(userData);
		function save() { return usersData.set(uid, userData, "alchimie"); }
		const bodyRaw = (event.body || "").trim();

		try {
			if (Reply.type === "deduction") {
				if (!a.deduction) return message.reply("⚠️ Cette Table des Arcanes n'est plus active.");
				const parts = bodyRaw.toLowerCase().split(/\s+/);
				if (parts.length < 3) return message.reply("⚠️ Format attendu : élément1 élément2 essence (ex: feu terre sel)");
				const [e1, e2, es] = parts;
				const validElt = ELEMENTS.map(e => e.id);
				if (!validElt.includes(e1) || !validElt.includes(e2) || !ESSENCES.map(x => x.id).includes(es)) {
					return message.reply("⚠️ Combinaison invalide. Éléments : feu, eau, air, terre — Essences : sel, soufre, mercure.");
				}
				const secret = RECETTES.find(r => r.id === a.deduction.secretId);
				const distance = distanceRecette({ elts: [e1, e2], essence: es }, secret);
				a.deduction.essais.push({ texte: `${e1} + ${e2} + ${es}`, distance });
				const nbEssais = a.deduction.essais.length;

				if (distance === 0) {
					const premiereFois = !a.recettesConnues.includes(secret.id);
					if (premiereFois) { a.recettesConnues.push(secret.id); a.stats.recettesDecouvertes += 1; }
					ajouterElixir(a, secret.id, 1);
					gainerXp(a, 200);
					a.or += Math.round(secret.valeur * 0.15);
					if (a.stats.meilleurEssaiDeduction === 0 || nbEssais < a.stats.meilleurEssaiDeduction) a.stats.meilleurEssaiDeduction = nbEssais;
					const nouveauxSucces = verifierSucces(a);
					const img = await renderDeduction(a, a.deduction.essais);
					a.deduction = null;
					await save();
					let txt = "🎉 " + fonts.bold("RECETTE DÉCOUVERTE !") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `├─ 🧪 ${fonts.bold(secret.nom)} (${secret.rarete})\n`
						+ `├─ 📖 Effet : ${secret.effet}\n`
						+ `├─ 🔢 Trouvée en ${nbEssais} essai(s)\n`
						+ `└─ ⭐ +200 XP, +${Math.round(secret.valeur * 0.15)} or`;
					if (nouveauxSucces.length) txt += "\n\n🏆 Succès : " + nouveauxSucces.map(s => s.nom).join(", ");
					if (img) return message.reply({ body: txt, attachment: fs.createReadStream(img) });
					return message.reply(txt);
				}

				if (nbEssais >= a.deduction.nbEssaisMax) {
					const img = await renderDeduction(a, a.deduction.essais);
					a.deduction = null;
					await save();
					const txt = "⌛ " + fonts.bold("TABLE DES ARCANES ÉPUISÉE") + "\n━━━━━━━━━━━━━━━━━━━━\n"
						+ `Vous n'avez pas trouvé la recette en ${a.deduction ? a.deduction.nbEssaisMax : 10} essais.\n`
						+ `La recette secrète était : ${fonts.bold(secret.nom)} (${secret.elts.join(" + ")} + ${secret.essence}).\n`
						+ "Relancez `deviner` pour une nouvelle table !";
					if (img) return message.reply({ body: txt, attachment: fs.createReadStream(img) });
					return message.reply(txt);
				}

				await save();
				const img = await renderDeduction(a, a.deduction.essais);
				const txt = `🧩 Essai ${nbEssais}/${a.deduction.nbEssaisMax} — ${e1} + ${e2} + ${es}\n${indiceTexte(distance)}\n\nRépondez encore pour affiner votre déduction.`;
				const sent = img
					? await message.reply({ body: txt, attachment: fs.createReadStream(img) })
					: await message.reply(txt);
				global.GoatBot.onReply.set(sent.messageID, { commandName, messageID: sent.messageID, author: uid, type: "deduction" });
				return;
			}

			if (Reply.type === "duel") {
				const duel = a.duelEnCours;
				if (!duel) return message.reply("⚠️ Ce duel n'est plus actif.");
				const num = parseInt(bodyRaw);
				const techId = duel.joueur.techniques[num - 1];
				if (!techId) return message.reply("⚠️ Choisissez un numéro de technique valide.");

				const journal = [];
				const push = t => journal.push(t);

				// début de tour : statuts
				appliquerStatutsDebutTour(duel.joueur, push);
				if (duel.joueur.pv <= 0) { duel.termine = true; duel.vainqueur = "adversaire"; }

				if (!duel.termine) {
					executerTechnique(duel.joueur, duel.adversaire, techId, push);
					// régénération légère d'énergie
					duel.joueur.energie = Math.min(duel.joueur.energieMax, duel.joueur.energie + 6);

					if (duel.adversaire.pv <= 0) {
						duel.termine = true; duel.vainqueur = "joueur";
					} else {
						appliquerStatutsDebutTour(duel.adversaire, push);
						if (duel.adversaire.pv <= 0) { duel.termine = true; duel.vainqueur = "joueur"; }
						else {
							const choixIA = iaChoisirTechnique(duel.adversaire);
							if (choixIA) executerTechnique(duel.adversaire, duel.joueur, choixIA, push);
							duel.adversaire.energie = Math.min(duel.adversaire.energieMax, duel.adversaire.energie + 5);
							if (duel.joueur.pv <= 0) { duel.termine = true; duel.vainqueur = "adversaire"; }
						}
					}
				}

				duel.journal.push(...journal);
				duel.tour += 1;

				if (duel.termine) {
					a.stats.duels += 0; // déjà compté au lancement
					let txtFin;
					if (duel.vainqueur === "joueur") {
						a.stats.duelsGagnes += 1;
						a.or += duel.def.recompenseOr;
						const leveled = gainerXp(a, duel.def.recompenseXp);
						txtFin = "🏆 " + fonts.bold("VICTOIRE !") + "\n━━━━━━━━━━━━━━━━━━━━\n"
							+ `Vous avez vaincu ${duel.def.nom} !\n`
							+ `├─ 💰 Récompense : +${duel.def.recompenseOr} or\n`
							+ `└─ ⭐ XP : +${duel.def.recompenseXp}${leveled ? " (NIVEAU SUPÉRIEUR !)" : ""}`;
					} else {
						txtFin = "💀 " + fonts.bold("DÉFAITE") + "\n━━━━━━━━━━━━━━━━━━━━\n"
							+ `${duel.def.nom} l'a emporté cette fois. Retournez vous entraîner au laboratoire !`;
					}
					const nouveauxSucces = verifierSucces(a);
					a.duelEnCours = null;
					await save();
					const img = await renderDuel(duel);
					let txt = txtFin;
					if (nouveauxSucces.length) txt += "\n\n🏆 Succès : " + nouveauxSucces.map(s => s.nom).join(", ");
					if (img) return message.reply({ body: txt, attachment: fs.createReadStream(img) });
					return message.reply(txt);
				}

				await save();
				const img = await renderDuel(duel);
				const txt = `⚔️ Tour ${duel.tour}\n` + duel.journal.slice(-4).map(l => "• " + l).join("\n")
					+ "\n\nTechniques disponibles :\n"
					+ duel.joueur.techniques.map((t, i) => `${i + 1}. ${TECHNIQUES[t].nom} (coût ${TECHNIQUES[t].cout}, énergie: ${duel.joueur.energie})`).join("\n");
				const sent = img
					? await message.reply({ body: txt, attachment: fs.createReadStream(img) })
					: await message.reply(txt);
				global.GoatBot.onReply.set(sent.messageID, { commandName, messageID: sent.messageID, author: uid, type: "duel" });
				return;
			}
		} catch (err) {
			console.error("[alchimie:onReply] erreur:", err);
			return message.reply("❌ Une erreur est survenue pendant la réaction alchimique. Réessayez plus tard.");
		}
	}
};
