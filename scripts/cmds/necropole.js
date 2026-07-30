/**
 * ⚰️ NÉCROPOLE — Dungeon crawler procédural étage par étage
 * ------------------------------------------------------------
 * Auteur      : Christus
 * Version     : 1.0
 * Catégorie   : Jeu / RPG
 *
 * Descente dans une nécropole engloutie, générée procéduralement salle
 * après salle : pièges mécaniques, énigmes de dalles/leviers/inscriptions
 * (résolues via onReply), malédictions rongeant le corps, reliques
 * anciennes, marchands spectraux et boss morts-vivants affrontés dans un
 * moteur de combat tour par tour (inspiré de naruto-storm.js).
 *
 * Ressource centrale : les TORCHES. Chaque action dans le noir consomme
 * de la lumière ; à sec, l'explorateur s'expose aux ténèbres et à leurs
 * malédictions.
 *
 * Direction artistique CANVAS : "Parchemin encre gravé" — plan de donjon
 * en fil de fer façon gravure ancienne, hachures façon taille-douce,
 * texture de papier vieilli, cartouches héraldiques, encre sépia
 * monochrome. AUCUN emoji ni glyphe stylisé dans le rendu canvas : que du
 * texte latin capital, des traits, des hachures et des sceaux dessinés à
 * la main. Les emojis et polices unicode ne vivent que dans le texte du
 * chat.
 * ------------------------------------------------------------
 */

const fonts = require('../../func/font.js');
const numbers = require('../../func/number.js');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;
try {
	const cv = require('canvas');
	loadImage = cv.loadImage;
	createCanvas = cv.createCanvas;
	registerFont = cv.registerFont;
	canvasAvailable = true;
} catch (e) {
	console.error('[NÉCROPOLE] canvas indisponible, bascule en mode texte :', e.message);
}

let fontsLoaded = false;
function ensureFonts() {
	if (fontsLoaded || !canvasAvailable || !registerFont) return;
	fontsLoaded = true;
	try {
		const fd = path.join(__dirname, 'assets', 'font');
		if (!fs.existsSync(fd)) return;
		const fontFiles = [
			['BeVietnamPro-Bold.ttf', 'NECRO', 'bold'],
			['BeVietnamPro-Regular.ttf', 'NECRO', 'normal'],
			['BeVietnamPro-SemiBold.ttf', 'NECRO', '600'],
			['NotoSans-Bold.ttf', 'NECRO', 'bold'],
			['NotoSans-Regular.ttf', 'NECRO', 'normal'],
			['Kanit-SemiBoldItalic.ttf', 'NECROI', 'italic']
		];
		for (const [f, fam, w] of fontFiles) {
			try {
				const fp = path.join(fd, f);
				if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
			} catch (_) {}
		}
	} catch (_) {}
}

/* ===================================================================
 *  OUTILS CANVAS BAS-NIVEAU — style "parchemin encre gravé"
 * =================================================================== */

// Palette sépia monochrome, tons d'encre sur papier vieilli.
const INK = {
	paper: '#e9dcbd',
	paper2: '#ded0aa',
	paperDark: '#cdbb90',
	ink: '#2c1c0f',
	ink2: '#4b3319',
	inkFaint: '#6f5330',
	inkPale: '#8a6d43',
	blood: '#5a1f14',
	gold: '#8a6a22',
	frame: '#382312'
};

function rr(ctx, x, y, w, h, r) {
	if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
	ctx.beginPath();
	ctx.moveTo(x + r.tl, y);
	ctx.lineTo(x + w - r.tr, y);
	ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
	ctx.lineTo(x + w, y + h - r.br);
	ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
	ctx.lineTo(x + r.bl, y + h);
	ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
	ctx.lineTo(x, y + r.tl);
	ctx.arcTo(x, y, x + r.tl, y, r.tl);
	ctx.closePath();
}

function T(ctx, s, x, y, sz, color, { align = 'left', weight = 'bold', alpha = 1, letterSpacing = 0, italic = false } = {}) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.textBaseline = 'alphabetic';
	const fam = italic ? 'NECROI' : 'NECRO';
	ctx.font = `${italic ? 'italic ' : ''}${weight} ${sz}px "${fam}", sans-serif`;
	s = String(s == null ? '' : s);
	if (!letterSpacing) {
		ctx.fillText(s, x, y);
	} else {
		let cx = x;
		const widths = s.split('').map(c => ctx.measureText(c).width + letterSpacing);
		const total = widths.reduce((a, b) => a + b, 0) - letterSpacing;
		if (align === 'center') cx = x - total / 2;
		if (align === 'right') cx = x - total;
		ctx.textAlign = 'left';
		for (const c of s) {
			ctx.fillText(c, cx, y);
			cx += ctx.measureText(c).width + letterSpacing;
		}
	}
	ctx.restore();
}

function GL(ctx, x1, y1, x2, y2, color, w = 1.2, alpha = 1) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.lineWidth = w;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.restore();
}

// Bruit pseudo-aléatoire déterministe pour la texture de papier.
function seededRand(seed) {
	let s = seed % 2147483647;
	if (s <= 0) s += 2147483646;
	return function () {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

function drawPaperTexture(ctx, W, H, seed = 42) {
	const rnd = seededRand(seed);
	const grad = ctx.createLinearGradient(0, 0, W, H);
	grad.addColorStop(0, INK.paper2);
	grad.addColorStop(0.5, INK.paper);
	grad.addColorStop(1, INK.paper2);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, W, H);
	// taches et auréoles d'humidité
	for (let i = 0; i < 26; i++) {
		const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 90;
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, 'rgba(120,95,50,0.10)');
		g.addColorStop(1, 'rgba(120,95,50,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	// fibres / rayures fines
	ctx.strokeStyle = 'rgba(60,40,15,0.05)';
	ctx.lineWidth = 1;
	for (let i = 0; i < 220; i++) {
		const x = rnd() * W, y = rnd() * H, len = 6 + rnd() * 22, ang = rnd() * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
		ctx.stroke();
	}
	// bords assombris (vignettage papier brûlé)
	const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
	vg.addColorStop(0, 'rgba(0,0,0,0)');
	vg.addColorStop(1, 'rgba(35,20,8,0.55)');
	ctx.fillStyle = vg;
	ctx.fillRect(0, 0, W, H);
}

// Hachures façon taille-douce (gravure), pour ombrer une zone.
function hatch(ctx, x, y, w, h, spacing = 6, angle = Math.PI / 4, color = INK.ink, alpha = 0.5, widthFactor = 0.9) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.strokeStyle = color;
	ctx.globalAlpha = alpha;
	ctx.lineWidth = widthFactor;
	const diag = Math.sqrt(w * w + h * h) + spacing * 2;
	const cx = x + w / 2, cy = y + h / 2;
	for (let d = -diag; d < diag; d += spacing) {
		ctx.beginPath();
		ctx.moveTo(cx + d * Math.cos(angle + Math.PI / 2) - diag * Math.cos(angle), cy + d * Math.sin(angle + Math.PI / 2) - diag * Math.sin(angle));
		ctx.lineTo(cx + d * Math.cos(angle + Math.PI / 2) + diag * Math.cos(angle), cy + d * Math.sin(angle + Math.PI / 2) + diag * Math.sin(angle));
		ctx.stroke();
	}
	ctx.restore();
}

function crossHatch(ctx, x, y, w, h, spacing, color, alpha) {
	hatch(ctx, x, y, w, h, spacing, Math.PI / 4, color, alpha);
	hatch(ctx, x, y, w, h, spacing, -Math.PI / 4, color, alpha * 0.7);
}

// Cartouche héraldique avec double filet
function drawCartouche(ctx, x, y, w, h, title) {
	ctx.save();
	rr(ctx, x, y, w, h, 6);
	ctx.fillStyle = 'rgba(233,220,189,0.35)';
	ctx.fill();
	ctx.lineWidth = 2.4;
	ctx.strokeStyle = INK.frame;
	rr(ctx, x, y, w, h, 6);
	ctx.stroke();
	ctx.lineWidth = 1;
	ctx.strokeStyle = INK.inkFaint;
	rr(ctx, x + 4, y + 4, w - 8, h - 8, 4);
	ctx.stroke();
	if (title) {
		T(ctx, title.toUpperCase(), x + w / 2, y + 20, 15, INK.ink, { align: 'center', letterSpacing: 2 });
		GL(ctx, x + 14, y + 28, x + w - 14, y + 28, INK.inkFaint, 1);
	}
	ctx.restore();
}

// Cadre général de la planche avec coins gravés
function drawEngravedFrame(ctx, W, H) {
	ctx.save();
	ctx.lineWidth = 6;
	ctx.strokeStyle = INK.frame;
	ctx.strokeRect(10, 10, W - 20, H - 20);
	ctx.lineWidth = 1.4;
	ctx.strokeStyle = INK.inkFaint;
	ctx.strokeRect(18, 18, W - 36, H - 36);
	const cs = 26;
	ctx.strokeStyle = INK.ink;
	ctx.lineWidth = 2;
	[[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]].forEach(([cx, cy, sx, sy]) => {
		ctx.beginPath();
		ctx.moveTo(cx, cy + cs * sy);
		ctx.lineTo(cx, cy);
		ctx.lineTo(cx + cs * sx, cy);
		ctx.stroke();
	});
	ctx.restore();
}

// Jauge horizontale gravée (vie, lumière, énergie...)
function drawGauge(ctx, x, y, w, h, ratio, label, valueText) {
	ratio = Math.max(0, Math.min(1, ratio));
	ctx.save();
	rr(ctx, x, y, w, h, 3);
	ctx.fillStyle = 'rgba(44,28,15,0.10)';
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.strokeStyle = INK.frame;
	rr(ctx, x, y, w, h, 3);
	ctx.stroke();
	crossHatch(ctx, x + 1, y + 1, (w - 2) * ratio, h - 2, 4, INK.ink, 0.55);
	// graduations
	ctx.strokeStyle = INK.inkFaint;
	ctx.lineWidth = 0.8;
	for (let i = 1; i < 10; i++) {
		const gx = x + (w / 10) * i;
		ctx.beginPath();
		ctx.moveTo(gx, y);
		ctx.lineTo(gx, y + h);
		ctx.stroke();
	}
	if (label) T(ctx, label.toUpperCase(), x, y - 6, 12, INK.ink2, { letterSpacing: 1 });
	if (valueText) T(ctx, valueText, x + w, y - 6, 12, INK.ink2, { align: 'right' });
	ctx.restore();
}

// Sceau circulaire gravé (rune de statut / bouclier / boss)
function drawSeal(ctx, cx, cy, r, points, label) {
	ctx.save();
	ctx.strokeStyle = INK.ink;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	for (let i = 0; i < points; i++) {
		const a = (Math.PI * 2 * i) / points - Math.PI / 2;
		const px = cx + Math.cos(a) * (r - 6);
		const py = cy + Math.sin(a) * (r - 6);
		if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.stroke();
	if (label) T(ctx, label.toUpperCase(), cx, cy + 5, 13, INK.ink, { align: 'center', letterSpacing: 1 });
	ctx.restore();
}

// Petite icône vectorielle sans emoji : croix ossuaire
function iconBone(ctx, x, y, s, color = INK.ink) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = s * 0.16;
	ctx.beginPath();
	ctx.moveTo(x - s, y - s);
	ctx.lineTo(x + s, y + s);
	ctx.moveTo(x + s, y - s);
	ctx.lineTo(x - s, y + s);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(x - s, y - s, s * 0.3, 0, Math.PI * 2);
	ctx.arc(x + s, y - s, s * 0.3, 0, Math.PI * 2);
	ctx.arc(x - s, y + s, s * 0.3, 0, Math.PI * 2);
	ctx.arc(x + s, y + s, s * 0.3, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

function iconFlame(ctx, x, y, s, color = INK.ink) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = s * 0.14;
	ctx.beginPath();
	ctx.moveTo(x, y + s);
	ctx.quadraticCurveTo(x - s * 0.9, y + s * 0.1, x - s * 0.15, y - s);
	ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.2, x + s * 0.1, y);
	ctx.quadraticCurveTo(x + s * 0.65, y - s * 0.15, x, y + s);
	ctx.stroke();
	ctx.restore();
}

module.exports.__INK = INK;

/* ===================================================================
 *  DONNÉES DE JEU
 * =================================================================== */

const GAME_NAME = 'necropole';
const PREFIX_DEFAULT = '!';

// --- Étages thématiques (chaque palier de 5 change d'ambiance) -------
const FLOOR_THEMES = [
	{ min: 1, max: 4, nom: 'Les Caves Oubliées', desc: 'Un dédale humide où suintent les pierres millénaires.' },
	{ min: 5, max: 9, nom: 'La Nef des Cendres', desc: 'Des colonnes calcinées soutiennent une voûte de suie.' },
	{ min: 10, max: 14, nom: 'Le Cloître des Damnés', desc: 'Des cloches muettes pendent au-dessus de tombes ouvertes.' },
	{ min: 15, max: 19, nom: 'La Crypte Royale', desc: 'Sarcophages dorés et fresques rongées par le temps.' },
	{ min: 20, max: 24, nom: 'Le Puits sans Fond', desc: 'La pierre elle-même semble respirer dans l\'obscurité.' },
	{ min: 25, max: 29, nom: 'Le Sanctuaire Interdit', desc: 'Autels renversés, glyphes interdits gravés au sol.' },
	{ min: 30, max: 999, nom: 'Le Trône de l\'Ombre-Reine', desc: 'Le cœur battant de la Nécropole, là où plus rien ne vit.' }
];

function floorTheme(n) {
	return FLOOR_THEMES.find(f => n >= f.min && n <= f.max) || FLOOR_THEMES[FLOOR_THEMES.length - 1];
}

// --- Reliques (objets rares, effets passifs) --------------------------
const RELICS = [
	{ id: 'anneau_cendre', nom: 'Anneau de Cendre', rarete: 'Rare', effet: 'atk', valeur: 4, desc: 'Chauffe la peau, aiguise la rage.' },
	{ id: 'oeil_de_lich', nom: 'Œil de Lich', rarete: 'Épique', effet: 'crit', valeur: 8, desc: 'Un regard mort qui perce les défenses.' },
	{ id: 'linceul_leger', nom: 'Linceul Léger', rarete: 'Commune', effet: 'esquive', valeur: 5, desc: 'Un tissu qui glisse comme du brouillard.' },
	{ id: 'coeur_de_pierre', nom: 'Cœur de Pierre', rarete: 'Rare', effet: 'pvmax', valeur: 25, desc: 'Bat lentement, comme la terre elle-même.' },
	{ id: 'lanterne_ame', nom: 'Lanterne d\'Âme', rarete: 'Épique', effet: 'torche', valeur: 3, desc: 'Ne s\'éteint jamais complètement.' },
	{ id: 'chaine_rompue', nom: 'Chaîne Rompue', rarete: 'Commune', effet: 'def', valeur: 3, desc: 'Ancien lien d\'esclave, devenu armure.' },
	{ id: 'couronne_fondue', nom: 'Couronne Fondue', rarete: 'Légendaire', effet: 'atk', valeur: 10, desc: 'Ce qui reste d\'un roi qui a trop voulu régner.' },
	{ id: 'medaillon_silence', nom: 'Médaillon du Silence', rarete: 'Rare', effet: 'resistmal', valeur: 20, desc: 'Étouffe les murmures des malédictions.' },
	{ id: 'gantelet_fossoyeur', nom: 'Gantelet du Fossoyeur', rarete: 'Épique', effet: 'atk', valeur: 7, desc: 'A creusé mille tombes, en creusera mille autres.' },
	{ id: 'larme_ambre', nom: 'Larme d\'Ambre', rarete: 'Commune', effet: 'pvmax', valeur: 12, desc: 'Une larme figée depuis des siècles.' },
	{ id: 'clef_des_scelles', nom: 'Clef des Scellés', rarete: 'Légendaire', effet: 'butin', valeur: 30, desc: 'Ouvre les portes que nul ne devrait ouvrir.' },
	{ id: 'voile_des_pleureuses', nom: 'Voile des Pleureuses', rarete: 'Rare', effet: 'def', valeur: 6, desc: 'Tissé avec les larmes de celles qui attendent.' },
	{ id: 'dent_de_goule', nom: 'Dent de Goule', rarete: 'Commune', effet: 'atk', valeur: 3, desc: 'Encore tranchante malgré la pourriture.' },
	{ id: 'sablier_fele', nom: 'Sablier Fêlé', rarete: 'Épique', effet: 'esquive', valeur: 9, desc: 'Le temps y coule de travers.' },
	{ id: 'orbe_necrotique', nom: 'Orbe Nécrotique', rarete: 'Légendaire', effet: 'crit', valeur: 15, desc: 'Un fragment de la volonté de l\'Ombre-Reine.' }
];

// --- Objets d'inventaire consommables ---------------------------------
const ITEMS = [
	{ id: 'torche', nom: 'Torche', desc: 'Redonne de la lumière.', usage: 'torche', valeur: 4, prix: 15 },
	{ id: 'onguent', nom: 'Onguent de Résine', desc: 'Soigne des blessures légères.', usage: 'soin', valeur: 20, prix: 20 },
	{ id: 'elixir_majeur', nom: 'Élixir Majeur', desc: 'Restaure une grande partie des PV.', usage: 'soin', valeur: 55, prix: 55 },
	{ id: 'antidote_ombre', nom: 'Antidote d\'Ombre', desc: 'Purge une malédiction active.', usage: 'purge', valeur: 1, prix: 40 },
	{ id: 'poudre_aveuglante', nom: 'Poudre Aveuglante', desc: 'En combat, réduit fortement la précision adverse.', usage: 'combat_aveugle', valeur: 1, prix: 30 },
	{ id: 'pierre_fuite', nom: 'Pierre de Fuite', desc: 'Permet de fuir un combat sans dégât garanti.', usage: 'fuite', valeur: 1, prix: 35 },
	{ id: 'cle_rouillee', nom: 'Clé Rouillée', desc: 'Ouvre certains passages scellés.', usage: 'cle', valeur: 1, prix: 25 },
	{ id: 'fiole_courage', nom: 'Fiole de Courage', desc: 'En combat, augmente les dégâts du prochain coup.', usage: 'combat_buff', valeur: 1, prix: 28 }
];

// --- Malédictions ------------------------------------------------------
const CURSES = [
	{ id: 'main_tremblante', nom: 'Main Tremblante', desc: 'Vos coups perdent en précision.', effet: 'atk', malus: -4 },
	{ id: 'souffle_court', nom: 'Souffle Court', desc: 'Votre énergie se régénère plus lentement.', effet: 'energie', malus: -3 },
	{ id: 'peau_de_cendre', nom: 'Peau de Cendre', desc: 'Votre défense s\'effrite.', effet: 'def', malus: -4 },
	{ id: 'murmures_constants', nom: 'Murmures Constants', desc: 'Vos torches se consument plus vite.', effet: 'torche', malus: -1 },
	{ id: 'poids_des_ombres', nom: 'Poids des Ombres', desc: 'Vos PV maximum diminuent temporairement.', effet: 'pvmax', malus: -15 },
	{ id: 'oeil_errant', nom: 'Œil Errant', desc: 'Votre esquive chute drastiquement.', effet: 'esquive', malus: -8 },
	{ id: 'sang_noirci', nom: 'Sang Noirci', desc: 'Vous perdez un peu de vie à chaque salle.', effet: 'saignement', malus: 3 }
];

// --- Table de pièges -----------------------------------------------------
const TRAPS = [
	{ id: 'dalle_lame', nom: 'Dalle à Lames', desc: 'Une dalle libère une volée de lames rasantes.', degats: [8, 16], evite: 'esquive' },
	{ id: 'flechettes', nom: 'Fléchettes Empoisonnées', desc: 'Des orifices crachent des fléchettes.', degats: [6, 12], evite: 'esquive' },
	{ id: 'plafond_bas', nom: 'Plafond qui Descend', desc: 'Le plafond se referme lentement.', degats: [10, 20], evite: 'force' },
	{ id: 'gaz_toxique', nom: 'Vapeurs Toxiques', desc: 'Un gaz verdâtre s\'échappe des fissures.', degats: [5, 14], evite: 'endurance' },
	{ id: 'fosse', nom: 'Fosse Dissimulée', desc: 'Le sol se dérobe sous vos pieds.', degats: [9, 18], evite: 'agilite' },
	{ id: 'feu_grec', nom: 'Jet de Feu Grégeois', desc: 'Un mécanisme antique crache des flammes.', degats: [12, 22], evite: 'esquive' },
	{ id: 'runes_explosives', nom: 'Runes Explosives', desc: 'Des runes gravées explosent au contact.', degats: [11, 19], evite: 'force' }
];

// --- Énigmes (dalles, leviers, inscriptions) ---------------------------
// Chaque énigme fournit un texte, une liste d'indices, et un validateur.
const PUZZLES = [
	{
		id: 'dalles_poids',
		type: 'dalles',
		titre: 'Les Dalles de Poids Inégal',
		texte: 'Sept dalles portent des chiffres romains : I, III, V, VII, IX, XI, XIII. Une inscription dit : "Foule celle dont la valeur est la somme des deux plus petites augmentée de un." Quel chiffre romain devez-vous fouler ?',
		reponses: ['v', 'V'],
		indice: 'Les deux plus petites valeurs sont I et III. I + III + 1 = 5.'
	},
	{
		id: 'leviers_ordre',
		type: 'leviers',
		titre: 'Les Trois Leviers',
		texte: 'Trois leviers portent les mots FEU, EAU et TERRE. Une fresque montre l\'eau éteignant le feu, puis la terre absorbant l\'eau. Dans quel ordre actionner les leviers pour rejouer la scène (répondez en un mot séparé par des tirets, ex: FEU-EAU-TERRE) ?',
		reponses: ['feu-eau-terre'],
		indice: 'La fresque se lit de gauche à droite : le feu d\'abord.'
	},
	{
		id: 'inscription_age',
		type: 'inscription',
		titre: 'L\'Inscription du Gardien',
		texte: 'Une inscription dit : "J\'avais vingt ans quand le roi fut couronné il y a 300 ans ; je suis mort centenaire. Combien d\'années suis-je resté vivant après le couronnement ?" Répondez avec un nombre.',
		reponses: ['80'],
		indice: '100 - 20 = 80.'
	},
	{
		id: 'code_squelettes',
		type: 'code',
		titre: 'Le Code des Ossements',
		texte: 'Cinq squelettes portent des nombres : 2, 4, 8, 16, ?. Quel nombre manque à la suite ?',
		reponses: ['32'],
		indice: 'Chaque nombre double le précédent.'
	},
	{
		id: 'miroir_ombre',
		type: 'inscription',
		titre: 'Le Miroir des Ombres',
		texte: 'Le miroir répète : "Je suis toujours devant toi mais tu ne peux jamais m\'atteindre. La nuit je grandis, le jour je rétrécis. Que suis-je ?"',
		reponses: ['ombre', 'une ombre', 'l\'ombre', 'lombre'],
		indice: 'Elle vous suit partout au soleil.'
	},
	{
		id: 'sablier_double',
		type: 'code',
		titre: 'Les Sabliers Jumeaux',
		texte: 'Vous avez un sablier de 7 minutes et un de 4 minutes. Il faut mesurer exactement 9 minutes. Combien de fois au minimum devez-vous retourner un sablier en tout pour y parvenir (comptez les retournements) ?',
		reponses: ['3'],
		indice: 'Lancez les deux ensembles, puis retournez le 4 min quand il finit, etc. La solution optimale utilise 3 retournements.'
	},
	{
		id: 'porte_binaire',
		type: 'code',
		titre: 'La Porte Binaire',
		texte: 'Une porte affiche : 1 0 1 1. Convertie en décimal, quelle est cette valeur ?',
		reponses: ['11'],
		indice: '8 + 0 + 2 + 1 = 11.'
	},
	{
		id: 'echiquier_maudit',
		type: 'dalles',
		titre: 'L\'Échiquier Maudit',
		texte: 'Un échiquier 8x8 possède 64 cases. Si on retire les deux coins opposés, combien de cases restent-elles ?',
		reponses: ['62'],
		indice: '64 - 2 = 62.'
	},
	{
		id: 'trois_portes',
		type: 'inscription',
		titre: 'Les Trois Portes du Passeur',
		texte: 'Trois portes : la première dit "la vérité est derrière la seconde", la seconde dit "je mens", la troisième dit "la première ment". Une seule porte dit toujours vrai. Laquelle (1, 2 ou 3) ?',
		reponses: ['3'],
		indice: 'Si la 2 dit "je mens" et est vraie, contradiction ; il faut tester logiquement chaque cas, la porte 3 reste cohérente.'
	},
	{
		id: 'balance_ossements',
		type: 'dalles',
		titre: 'La Balance aux Ossements',
		texte: 'Neuf crânes identiques en apparence, un seul plus lourd que les autres. Vous avez une balance à deux plateaux. Quel est le nombre minimum de pesées pour le trouver à coup sûr ?',
		reponses: ['2'],
		indice: 'Divisez en groupes de 3, 3, 3.'
	},
	{
		id: 'chandelles',
		type: 'code',
		titre: 'Les Deux Chandelles',
		texte: 'Deux chandelles brûlent chacune en exactement une heure mais de façon irrégulière. Combien de minutes pouvez-vous mesurer en les allumant judicieusement aux deux bouts (au minimum, un intervalle simple) ?',
		reponses: ['30'],
		indice: 'Allumer une chandelle aux deux bouts la consume en 30 minutes.'
	},
	{
		id: 'runes_miroir',
		type: 'inscription',
		titre: 'Les Runes en Miroir',
		texte: 'Le mot "ENIGME" gravé à l\'envers sur le mur donne quel mot lu normalement (juste retourné lettre par lettre) ?',
		reponses: ['emginé', 'emgine', 'egminé', 'egmine'],
		indice: 'Inversez simplement l\'ordre des lettres : E-N-I-G-M-E devient E-M-G-I-N-E.'
	},
	{
		id: 'poids_ame',
		type: 'code',
		titre: 'Le Poids de l\'Âme',
		texte: 'Une légende dit que l\'âme pèse 21 grammes. Si un cercueil vide pèse 8 kilos et qu\'on y ajoute une âme, combien de grammes pèse le tout en grammes (8000 + 21) ?',
		reponses: ['8021'],
		indice: '8000 + 21 = 8021.'
	},
	{
		id: 'lanternes_couleur',
		type: 'leviers',
		titre: 'Les Lanternes de Couleur',
		texte: 'Rouge, Bleue, Verte : la rouge doit s\'allumer avant la bleue, la verte doit s\'allumer en dernier. Donnez l\'ordre d\'allumage (ex: ROUGE-BLEUE-VERTE).',
		reponses: ['rouge-bleue-verte'],
		indice: 'Rouge puis Bleue puis Verte est le seul ordre valide.'
	},
	{
		id: 'nombre_manquant',
		type: 'code',
		titre: 'La Suite du Fossoyeur',
		texte: 'Complétez la suite : 1, 1, 2, 3, 5, 8, 13, ?',
		reponses: ['21'],
		indice: 'Suite de Fibonacci : additionnez les deux précédents.'
	}
];

// --- Événements aléatoires en salle -------------------------------------
const RANDOM_EVENTS = [
	{ id: 'marchand', nom: 'Marchand Spectral', poids: 10 },
	{ id: 'autel', nom: 'Autel Sacrificiel', poids: 8 },
	{ id: 'fontaine', nom: 'Fontaine Sombre', poids: 8 },
	{ id: 'tombeau_vide', nom: 'Tombeau Vide', poids: 6 },
	{ id: 'brouillard', nom: 'Brouillard Mémoriel', poids: 6 }
];

// --- Ennemis courants (rencontres normales) ------------------------------
const MOBS = [
	{ id: 'squelette', nom: 'Squelette Rouillé', pv: 40, atk: 8, def: 2, xp: 12, or: 8 },
	{ id: 'goule', nom: 'Goule Affamée', pv: 55, atk: 10, def: 3, xp: 16, or: 12 },
	{ id: 'zombie', nom: 'Zombie Boueux', pv: 65, atk: 7, def: 5, xp: 18, or: 10 },
	{ id: 'spectre', nom: 'Spectre Gémissant', pv: 35, atk: 12, def: 1, xp: 20, or: 14 },
	{ id: 'chevalier_os', nom: 'Chevalier d\'Ossements', pv: 80, atk: 13, def: 7, xp: 28, or: 22 },
	{ id: 'araignee_tombe', nom: 'Araignée des Tombes', pv: 50, atk: 11, def: 4, xp: 19, or: 15 },
	{ id: 'banshee', nom: 'Banshee Hurlante', pv: 45, atk: 14, def: 2, xp: 24, or: 18 },
	{ id: 'golem_os', nom: 'Golem d\'Ossements', pv: 100, atk: 9, def: 10, xp: 32, or: 26 }
];

// --- Boss (tous les 5 étages) ---------------------------------------------
const BOSSES = [
	{
		id: 'boss_charnier',
		nom: 'Le Seigneur du Charnier', palier: 5, pv: 220, atk: 16, def: 8, xp: 90, or: 80,
		techniques: [
			{ nom: 'Griffe Nécrosée', mult: 1.0, cout: 0 },
			{ nom: 'Vague de Vers', mult: 1.4, cout: 15 },
			{ nom: 'Étreinte du Charnier', mult: 2.0, cout: 30 }
		]
	},
	{
		id: 'boss_cloches',
		nom: 'Le Sonneur Sans Visage', palier: 10, pv: 300, atk: 19, def: 11, xp: 140, or: 120,
		techniques: [
			{ nom: 'Coup de Battant', mult: 1.1, cout: 0 },
			{ nom: 'Glas Assourdissant', mult: 1.5, cout: 18 },
			{ nom: 'Requiem Brisé', mult: 2.2, cout: 35 }
		]
	},
	{
		id: 'boss_reine_pale',
		nom: 'La Reine Pâle', palier: 15, pv: 380, atk: 22, def: 13, xp: 200, or: 170,
		techniques: [
			{ nom: 'Lame Blafarde', mult: 1.2, cout: 0 },
			{ nom: 'Couronne d\'Épines Grises', mult: 1.6, cout: 20 },
			{ nom: 'Édit du Silence Éternel', mult: 2.4, cout: 38 }
		]
	},
	{
		id: 'boss_gardien_puits',
		nom: 'Le Gardien du Puits', palier: 20, pv: 460, atk: 25, def: 16, xp: 260, or: 220,
		techniques: [
			{ nom: 'Chute de Pierre', mult: 1.2, cout: 0 },
			{ nom: 'Effondrement', mult: 1.7, cout: 22 },
			{ nom: 'Appel de l\'Abîme', mult: 2.6, cout: 40 }
		]
	},
	{
		id: 'boss_grand_pretre',
		nom: 'Le Grand Prêtre Excommunié', palier: 25, pv: 540, atk: 28, def: 18, xp: 330, or: 280,
		techniques: [
			{ nom: 'Anathème', mult: 1.3, cout: 0 },
			{ nom: 'Rituel Interdit', mult: 1.8, cout: 24 },
			{ nom: 'Excommunication Finale', mult: 2.8, cout: 42 }
		]
	},
	{
		id: 'boss_ombre_reine',
		nom: 'L\'Ombre-Reine', palier: 30, pv: 700, atk: 32, def: 20, xp: 500, or: 500,
		techniques: [
			{ nom: 'Griffe d\'Ombre', mult: 1.4, cout: 0 },
			{ nom: 'Voile de Nuit Éternelle', mult: 2.0, cout: 26 },
			{ nom: 'Jugement des Ténèbres', mult: 3.2, cout: 48 }
		]
	}
];

function bossForFloor(n) {
	return BOSSES.find(b => b.palier === n) || null;
}

// --- Succès (≥20) ---------------------------------------------------------
const ACHIEVEMENTS = [
	{ id: 'premier_pas', nom: 'Premier Pas', desc: 'Entrer pour la première fois dans la Nécropole.', check: s => s.stats.entreesTotales >= 1 },
	{ id: 'etage5', nom: 'Cinquième Marche', desc: 'Atteindre l\'étage 5.', check: s => s.record.etageMax >= 5 },
	{ id: 'etage10', nom: 'Dixième Marche', desc: 'Atteindre l\'étage 10.', check: s => s.record.etageMax >= 10 },
	{ id: 'etage20', nom: 'Vingtième Marche', desc: 'Atteindre l\'étage 20.', check: s => s.record.etageMax >= 20 },
	{ id: 'etage30', nom: 'Le Trône', desc: 'Atteindre l\'étage 30.', check: s => s.record.etageMax >= 30 },
	{ id: 'premier_boss', nom: 'Chasseur de Titans', desc: 'Vaincre un premier boss.', check: s => s.stats.bossVaincus >= 1 },
	{ id: 'cinq_boss', nom: 'Bourreau de Légendes', desc: 'Vaincre 5 boss.', check: s => s.stats.bossVaincus >= 5 },
	{ id: 'relique1', nom: 'Collectionneur', desc: 'Trouver une première relique.', check: s => s.inventaire.reliques.length >= 1 },
	{ id: 'relique5', nom: 'Antiquaire', desc: 'Posséder 5 reliques.', check: s => s.inventaire.reliques.length >= 5 },
	{ id: 'relique_legendaire', nom: 'Toucher la Légende', desc: 'Obtenir une relique légendaire.', check: s => s.inventaire.reliques.some(r => (RELICS.find(x => x.id === r) || {}).rarete === 'Légendaire') },
	{ id: 'enigme1', nom: 'Esprit Vif', desc: 'Résoudre une première énigme.', check: s => s.stats.enigmesResolues >= 1 },
	{ id: 'enigme10', nom: 'Déchiffreur', desc: 'Résoudre 10 énigmes.', check: s => s.stats.enigmesResolues >= 10 },
	{ id: 'enigme_sans_indice', nom: 'Sans Filet', desc: 'Résoudre une énigme sans indice.', check: s => s.stats.enigmesSansIndice >= 1 },
	{ id: 'piege_evite', nom: 'Pas Léger', desc: 'Éviter un premier piège.', check: s => s.stats.piegesEvites >= 1 },
	{ id: 'piege10_evite', nom: 'Danseur d\'Ombre', desc: 'Éviter 10 pièges.', check: s => s.stats.piegesEvites >= 10 },
	{ id: 'malediction1', nom: 'Marqué', desc: 'Subir une première malédiction.', check: s => s.stats.malédictionsSubies >= 1 },
	{ id: 'purge1', nom: 'Purifié', desc: 'Purger une malédiction.', check: s => s.stats.malédictionsPurgees >= 1 },
	{ id: 'or1000', nom: 'Petit Trésor', desc: 'Amasser 1000 pièces d\'or au total.', check: s => s.stats.orTotal >= 1000 },
	{ id: 'or10000', nom: 'Fortune de Nécropole', desc: 'Amasser 10000 pièces d\'or au total.', check: s => s.stats.orTotal >= 10000 },
	{ id: 'niveau10', nom: 'Aguerri', desc: 'Atteindre le niveau 10.', check: s => s.niveau >= 10 },
	{ id: 'niveau25', nom: 'Vétéran de l\'Ombre', desc: 'Atteindre le niveau 25.', check: s => s.niveau >= 25 },
	{ id: 'mort1', nom: 'Première Chute', desc: 'Mourir une première fois dans la Nécropole.', check: s => s.stats.morts >= 1 },
	{ id: 'survie_sans_torche', nom: 'Enfant des Ténèbres', desc: 'Survivre à une salle sans torche allumée.', check: s => s.stats.sallesSansTorche >= 1 },
	{ id: 'daily7', nom: 'Pèlerin Assidu', desc: 'Réclamer 7 primes quotidiennes.', check: s => s.stats.dailyStreakMax >= 7 },
	{ id: 'daily30', nom: 'Pèlerin Éternel', desc: 'Réclamer 30 primes quotidiennes.', check: s => s.stats.dailyStreakMax >= 30 },
	{ id: 'fuite1', nom: 'Fuite Habile', desc: 'Fuir un combat avec succès.', check: s => s.stats.fuitesReussies >= 1 },
	{ id: 'critique10', nom: 'Œil du Bourreau', desc: 'Infliger 10 coups critiques.', check: s => s.stats.critiques >= 10 },
	{ id: 'combat50', nom: 'Habitué des Lames', desc: 'Remporter 50 combats.', check: s => s.stats.combatsGagnes >= 50 }
];

module.exports.__PART2_MARK = true;

/* ===================================================================
 *  INITIALISATION / PERSISTANCE
 * =================================================================== */

function xpForLevel(lvl) { return Math.round(60 * Math.pow(lvl, 1.55)); }

function defaultState() {
	return {
		niveau: 1,
		xp: 0,
		or: 0,
		pvMax: 100,
		pv: 100,
		energieMax: 50,
		energie: 50,
		torches: 5,
		torchesMax: 10,
		enDonjon: false,
		etage: 0,
		salleIndex: 0,
		sallesParEtage: 6,
		combat: null,
		puzzleEnCours: null,
		malediction: null,
		inventaire: { objets: {}, reliques: [] },
		record: { etageMax: 0, orMax: 0 },
		daily: { dernier: 0, streak: 0 },
		historique: [],
		succes: [],
		stats: {
			entreesTotales: 0, bossVaincus: 0, enigmesResolues: 0, enigmesSansIndice: 0,
			piegesEvites: 0, malédictionsSubies: 0, malédictionsPurgees: 0, orTotal: 0,
			morts: 0, sallesSansTorche: 0, dailyStreakMax: 0, fuitesReussies: 0,
			critiques: 0, combatsGagnes: 0
		}
	};
}

function migrate(s) {
	const d = defaultState();
	for (const k in d) {
		if (s[k] === undefined) s[k] = d[k];
	}
	for (const k in d.stats) if (s.stats[k] === undefined) s.stats[k] = d.stats[k];
	for (const k in d.inventaire) if (s.inventaire[k] === undefined) s.inventaire[k] = d.inventaire[k];
	for (const k in d.record) if (s.record[k] === undefined) s.record[k] = d.record[k];
	for (const k in d.daily) if (s.daily[k] === undefined) s.daily[k] = d.daily[k];
	if (!Array.isArray(s.historique)) s.historique = [];
	if (!Array.isArray(s.succes)) s.succes = [];
	return s;
}

async function initState(usersData, uid) {
	const data = await usersData.get(uid);
	let s = (data && data[GAME_NAME]) ? data[GAME_NAME] : defaultState();
	s = migrate(s);
	return s;
}

async function save(usersData, uid, state) {
	await usersData.set(uid, { [GAME_NAME]: state }, undefined, { flag: 'merge' });
}

function pushHistory(state, texte) {
	state.historique.unshift({ t: Date.now(), texte });
	if (state.historique.length > 30) state.historique.length = 30;
}

function checkAchievements(state) {
	const nouveaux = [];
	for (const a of ACHIEVEMENTS) {
		if (!state.succes.includes(a.id)) {
			try {
				if (a.check(state)) {
					state.succes.push(a.id);
					nouveaux.push(a);
				}
			} catch (_) {}
		}
	}
	return nouveaux;
}

function gainXp(state, amount) {
	state.xp += amount;
	const levelUps = [];
	let need = xpForLevel(state.niveau);
	while (state.xp >= need) {
		state.xp -= need;
		state.niveau++;
		state.pvMax += 8;
		state.energieMax += 3;
		state.pv = state.pvMax;
		state.energie = state.energieMax;
		levelUps.push(state.niveau);
		need = xpForLevel(state.niveau);
	}
	return levelUps;
}

function gainOr(state, amount) {
	state.or += amount;
	state.stats.orTotal += Math.max(0, amount);
	if (state.or > state.record.orMax) state.record.orMax = state.or;
}

function relicBonus(state, effet) {
	let total = 0;
	for (const rid of state.inventaire.reliques) {
		const r = RELICS.find(x => x.id === rid);
		if (r && r.effet === effet) total += r.valeur;
	}
	return total;
}

function computeCombatStats(state) {
	const curseAtk = state.malediction && state.malediction.effet === 'atk' ? state.malediction.malus : 0;
	const curseDef = state.malediction && state.malediction.effet === 'def' ? state.malediction.malus : 0;
	const cursePvMax = state.malediction && state.malediction.effet === 'pvmax' ? state.malediction.malus : 0;
	const curseEsq = state.malediction && state.malediction.effet === 'esquive' ? state.malediction.malus : 0;
	return {
		atk: 10 + Math.floor(state.niveau * 1.6) + relicBonus(state, 'atk') + curseAtk,
		def: 4 + Math.floor(state.niveau * 0.8) + relicBonus(state, 'def') + curseDef,
		crit: 5 + relicBonus(state, 'crit'),
		esquive: 5 + relicBonus(state, 'esquive') + curseEsq,
		pvMax: state.pvMax + relicBonus(state, 'pvmax') + cursePvMax
	};
}

/* ===================================================================
 *  GÉNÉRATION DE SALLES ET DÉROULÉ DU DONJON
 * =================================================================== */

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function weightedPick(list) {
	const total = list.reduce((a, b) => a + b.poids, 0);
	let r = Math.random() * total;
	for (const it of list) { r -= it.poids; if (r <= 0) return it; }
	return list[0];
}

function enterDungeon(state) {
	state.enDonjon = true;
	state.etage = 1;
	state.salleIndex = 0;
	state.stats.entreesTotales++;
	pushHistory(state, `Entrée dans la Nécropole — Étage 1 (${floorTheme(1).nom}).`);
}

function nextRoomType(state) {
	// Toutes les 6 salles = boss potentiel si étage multiple de 5.
	const isLastRoom = state.salleIndex >= state.sallesParEtage - 1;
	const boss = bossForFloor(state.etage);
	if (isLastRoom && boss) return 'boss';
	const roll = Math.random();
	if (roll < 0.22) return 'piege';
	if (roll < 0.46) return 'enigme';
	if (roll < 0.68) return 'combat';
	if (roll < 0.84) return 'evenement';
	return 'butin';
}

function generateRoom(state) {
	const type = nextRoomType(state);
	if (type === 'piege') return { type, data: pick(TRAPS) };
	if (type === 'enigme') return { type, data: pick(PUZZLES) };
	if (type === 'combat') return { type, data: pick(MOBS) };
	if (type === 'evenement') return { type, data: weightedPick(RANDOM_EVENTS) };
	if (type === 'boss') return { type, data: bossForFloor(state.etage) };
	return { type: 'butin', data: null };
}

function consumeTorch(state) {
	if (state.torches > 0) { state.torches--; return true; }
	return false;
}

function applyCurse(state) {
	const c = pick(CURSES);
	state.malediction = c;
	state.stats.malédictionsSubies++;
	return c;
}

function purgeCurse(state) {
	if (!state.malediction) return false;
	state.malediction = null;
	state.stats.malédictionsPurgees++;
	return true;
}

function grantLoot(state) {
	const roll = Math.random();
	if (roll < 0.35 && state.inventaire.reliques.length < RELICS.length) {
		let r;
		do { r = pick(RELICS); } while (state.inventaire.reliques.includes(r.id));
		state.inventaire.reliques.push(r.id);
		return { type: 'relique', item: r };
	}
	if (roll < 0.75) {
		const or = randInt(10, 20) * state.etage;
		gainOr(state, or);
		return { type: 'or', montant: or };
	}
	const it = pick(ITEMS);
	state.inventaire.objets[it.id] = (state.inventaire.objets[it.id] || 0) + 1;
	return { type: 'objet', item: it };
}

/* ===================================================================
 *  MOTEUR DE COMBAT (tour par tour, inspiré de naruto-storm.js)
 * =================================================================== */

function startCombat(state, enemyDef, isBoss) {
	const cs = computeCombatStats(state);
	const enemy = {
		nom: enemyDef.nom,
		pv: enemyDef.pv, pvMax: enemyDef.pv,
		atk: enemyDef.atk, def: enemyDef.def,
		xp: enemyDef.xp, or: enemyDef.or,
		isBoss: !!isBoss,
		techniques: enemyDef.techniques || null,
		energie: 0
	};
	state.combat = {
		enemy,
		joueurPv: state.pv,
		joueurPvMax: cs.pvMax,
		joueurEnergie: state.energie,
		joueurEnergieMax: state.energieMax,
		tour: 1,
		log: [`Un ${enemyDef.nom} surgit de l'obscurité !`],
		buffDegats: 0,
		aveugleEnnemi: 0,
		termine: false,
		issue: null
	};
	return state.combat;
}

function combatAction(state, action) {
	const c = state.combat;
	if (!c || c.termine) return c;
	const cs = computeCombatStats(state);
	const log = [];
	let joueurAgitEnPremier = true;

	if (action === 'attaque') {
		let degats = Math.max(2, cs.atk - c.enemy.def + randInt(-3, 4) + c.buffDegats);
		const crit = Math.random() * 100 < cs.crit;
		if (crit) { degats = Math.round(degats * 1.8); state.stats.critiques++; }
		c.enemy.pv -= degats;
		log.push(`Vous frappez pour ${degats} dégâts${crit ? ' (COUP CRITIQUE)' : ''}.`);
		c.buffDegats = 0;
	} else if (action === 'sort') {
		if (state.energie >= 15) {
			state.energie -= 15;
			let degats = Math.max(3, Math.round((cs.atk * 1.6) - c.enemy.def * 0.6) + randInt(-2, 5));
			const crit = Math.random() * 100 < cs.crit + 5;
			if (crit) { degats = Math.round(degats * 1.8); state.stats.critiques++; }
			c.enemy.pv -= degats;
			log.push(`Vous invoquez une flamme rituelle : ${degats} dégâts${crit ? ' (COUP CRITIQUE)' : ''}.`);
		} else {
			log.push('Énergie insuffisante — le sort échoue.');
		}
	} else if (action === 'defense') {
		joueurAgitEnPremier = false;
		c.defenseActive = true;
		state.energie = Math.min(state.energieMax, state.energie + 8);
		log.push('Vous vous mettez en garde et reprenez un peu d\'énergie.');
	} else if (action === 'objet_soin') {
		if ((state.inventaire.objets['onguent'] || 0) > 0) {
			state.inventaire.objets['onguent']--;
			state.pv = Math.min(cs.pvMax, state.pv + 20);
			c.joueurPvMax = cs.pvMax;
			c.joueurPv = state.pv;
			log.push('Vous appliquez un onguent de résine : +20 PV.');
		} else {
			log.push('Vous n\'avez plus d\'onguent.');
		}
	} else if (action === 'fuite') {
		const reussite = Math.random() < 0.55;
		if (reussite) {
			c.termine = true;
			c.issue = 'fuite';
			state.stats.fuitesReussies++;
			log.push('Vous parvenez à fuir dans les ténèbres.');
			c.log.push(...log);
			return c;
		} else {
			log.push('Impossible de fuir cette fois !');
		}
	}

	if (c.enemy.pv <= 0) {
		c.termine = true;
		c.issue = 'victoire';
		c.log.push(...log, `${c.enemy.nom} s'effondre en poussière.`);
		return c;
	}

	// Riposte ennemie
	let techUsed = null;
	if (c.enemy.techniques) {
		c.enemy.energie += 12;
		const dispo = c.enemy.techniques.filter(t => t.cout <= c.enemy.energie);
		techUsed = dispo.length ? dispo[dispo.length - 1] : c.enemy.techniques[0];
		if (techUsed.cout > 0) c.enemy.energie -= techUsed.cout;
	}
	const evadePlayer = Math.random() * 100 < cs.esquive && action !== 'defense';
	if (evadePlayer) {
		log.push(`${c.enemy.nom} attaque mais vous esquivez !`);
	} else {
		const base = techUsed ? Math.round(c.enemy.atk * techUsed.mult) : c.enemy.atk;
		let degatsRecus = Math.max(1, base - cs.def + randInt(-2, 3));
		if (c.defenseActive) { degatsRecus = Math.round(degatsRecus * 0.4); c.defenseActive = false; }
		state.pv -= degatsRecus;
		c.joueurPv = state.pv;
		log.push(`${c.enemy.nom} riposte${techUsed ? ` avec ${techUsed.nom}` : ''} : ${degatsRecus} dégâts subis.`);
	}

	if (state.pv <= 0) {
		state.pv = 0;
		c.termine = true;
		c.issue = 'defaite';
		state.stats.morts++;
	}

	c.log.push(...log);
	if (c.log.length > 8) c.log = c.log.slice(-8);
	c.tour++;
	return c;
}

function resolveCombatRewards(state) {
	const c = state.combat;
	if (!c || c.issue !== 'victoire') return null;
	const lvlUps = gainXp(state, c.enemy.xp);
	gainOr(state, c.enemy.or);
	if (c.enemy.isBoss) state.stats.bossVaincus++;
	else state.stats.combatsGagnes++;
	const loot = Math.random() < (c.enemy.isBoss ? 0.9 : 0.25) ? grantLoot(state) : null;
	return { xp: c.enemy.xp, or: c.enemy.or, lvlUps, loot };
}

module.exports.__PART3_MARK = true;
