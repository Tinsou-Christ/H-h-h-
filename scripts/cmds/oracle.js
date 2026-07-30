/**
 * 🔮 ORACLE DES RUNES — Goat-Bot V2
 * Tirages de runes, prophéties/énigmes, casse-code runique (mastermind), rituels,
 * karma, arbre de dons divinatoires, duels d'énigmes contre PNJ, succès, classement, daily.
 * Direction artistique canvas : VITRAIL GOTHIQUE GÉOMÉTRIQUE (cercles concentriques, sceaux,
 * plomb, symétrie radiale) — AUCUN emoji dans le canvas.
 *
 * @author Christus
 */

const fonts = require('../../func/font.js');
let numbers = null;
try { numbers = require('../../func/number.js'); } catch (_) { numbers = null; }

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
	console.error("[oracle.js] Canvas indisponible, fallback texte activé:", e.message);
}

// ═══════════════════════════════════════════════════════════════════════
// § 0. UTILITAIRES GÉNÉRIQUES
// ═══════════════════════════════════════════════════════════════════════

function fmt(n) {
	n = Math.floor(n) || 0;
	try {
		if (numbers && typeof numbers.format === "function") return numbers.format(n);
	} catch (_) {}
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function pickN(arr, n) {
	const copy = [...arr];
	const out = [];
	for (let i = 0; i < n && copy.length; i++) {
		out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
	}
	return out;
}
function shuffle(arr) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = randInt(0, i);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pad(str, len) {
	str = String(str);
	while (str.length < len) str += " ";
	return str;
}
function bar(pct, size = 14, filled = "█", empty = "░") {
	pct = clamp(pct, 0, 1);
	const n = Math.round(pct * size);
	return filled.repeat(n) + empty.repeat(size - n);
}
function msToClock(ms) {
	if (ms <= 0) return "00:00:00";
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function dayKey(ts = Date.now()) {
	const d = new Date(ts);
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const LINE = "━━━━━━━━━━━━━━━━━━━━━━━━━━";
const LINE_S = "─────────────────────";

// ═══════════════════════════════════════════════════════════════════════
// § 1. DONNÉES DE JEU — RUNES ELDER FUTHARK (24)
// ═══════════════════════════════════════════════════════════════════════

const RUNES = [
	{ id: "fehu", sym: "ᚠ", nom: "Fehu", sens: "Bétail, richesse", droit: "Abondance et prospérité matérielle t'attendent.", inverse: "Perte financière, avarice à surveiller.", elt: "feu", karma: 2 },
	{ id: "uruz", sym: "ᚢ", nom: "Uruz", sens: "Aurochs, force brute", droit: "Force vitale et santé renouvelée.", inverse: "Faiblesse, occasion manquée par lenteur.", elt: "terre", karma: 1 },
	{ id: "thurisaz", sym: "ᚦ", nom: "Thurisaz", sens: "Géant, épine", droit: "Protection puissante contre le danger.", inverse: "Conflit imminent, imprudence dangereuse.", elt: "feu", karma: -1 },
	{ id: "ansuz", sym: "ᚨ", nom: "Ansuz", sens: "Dieu, souffle, message", droit: "Une révélation ou un message important arrive.", inverse: "Malentendu, tromperie dans les mots.", elt: "air", karma: 2 },
	{ id: "raidho", sym: "ᚱ", nom: "Raidho", sens: "Voyage, chevauchée", droit: "Un voyage bénéfique ou un changement de cap.", inverse: "Retard, chemin bloqué, désordre.", elt: "air", karma: 1 },
	{ id: "kenaz", sym: "ᚲ", nom: "Kenaz", sens: "Torche, connaissance", droit: "Illumination, créativité, savoir retrouvé.", inverse: "Ignorance, instabilité, flamme éteinte.", elt: "feu", karma: 2 },
	{ id: "gebo", sym: "ᚷ", nom: "Gebo", sens: "Don, échange", droit: "Un don équilibré, partenariat fructueux.", inverse: "Gebo n'a pas d'inverse : équilibre parfait toujours.", elt: "air", karma: 3 },
	{ id: "wunjo", sym: "ᚹ", nom: "Wunjo", sens: "Joie, harmonie", droit: "Joie profonde, réussite sociale.", inverse: "Tristesse, discorde, retard de bonheur.", elt: "air", karma: 2 },
	{ id: "hagalaz", sym: "ᚺ", nom: "Hagalaz", sens: "Grêle, destruction", droit: "Hagalaz n'a pas d'inverse : force destructrice inévitable, transformation forcée.", inverse: "Force destructrice inévitable.", elt: "eau", karma: -2 },
	{ id: "nauthiz", sym: "ᚾ", nom: "Nauthiz", sens: "Besoin, contrainte", droit: "Épreuve formatrice, résilience nécessaire.", inverse: "Privation, épuisement, erreur répétée.", elt: "feu", karma: -1 },
	{ id: "isa", sym: "ᛁ", nom: "Isa", sens: "Glace, immobilité", droit: "Isa n'a pas d'inverse : pause obligatoire, patience.", inverse: "Pause obligatoire, patience.", elt: "eau", karma: 0 },
	{ id: "jera", sym: "ᛃ", nom: "Jera", sens: "Récolte, cycle", droit: "Jera n'a pas d'inverse : récompense méritée après effort.", inverse: "Récompense méritée après effort.", elt: "terre", karma: 2 },
	{ id: "eihwaz", sym: "ᛇ", nom: "Eihwaz", sens: "If, endurance", droit: "Eihwaz n'a pas d'inverse : endurance, changement stable.", inverse: "Endurance, changement stable.", elt: "terre", karma: 1 },
	{ id: "perthro", sym: "ᛈ", nom: "Perthro", sens: "Sort, mystère caché", droit: "Chance cachée, secret bientôt révélé.", inverse: "Secret nuisible, addiction, stagnation.", elt: "eau", karma: 0 },
	{ id: "algiz", sym: "ᛉ", nom: "Algiz", sens: "Élan, protection", droit: "Bouclier spirituel actif, guide protecteur.", inverse: "Vulnérabilité, protection rompue.", elt: "air", karma: 1 },
	{ id: "sowilo", sym: "ᛊ", nom: "Sowilo", sens: "Soleil, victoire", droit: "Sowilo n'a pas d'inverse : victoire, énergie solaire, succès.", inverse: "Victoire, énergie solaire, succès.", elt: "feu", karma: 3 },
	{ id: "tiwaz", sym: "ᛏ", nom: "Tiwaz", sens: "Tyr, justice, honneur", droit: "Justice rendue, victoire honorable au combat.", inverse: "Injustice, perte d'honneur, conflit perdu.", elt: "feu", karma: 1 },
	{ id: "berkano", sym: "ᛒ", nom: "Berkano", sens: "Bouleau, renaissance", droit: "Nouveau départ, fertilité, croissance.", inverse: "Stagnation familiale, stérilité de projet.", elt: "terre", karma: 2 },
	{ id: "ehwaz", sym: "ᛖ", nom: "Ehwaz", sens: "Cheval, progrès", droit: "Progrès en duo, confiance mutuelle.", inverse: "Trahison d'un allié, progrès rompu.", elt: "terre", karma: 1 },
	{ id: "mannaz", sym: "ᛗ", nom: "Mannaz", sens: "Homme, humanité", droit: "Soutien social, sagesse collective.", inverse: "Isolement, égoïsme, manque d'aide.", elt: "air", karma: 0 },
	{ id: "laguz", sym: "ᛚ", nom: "Laguz", sens: "Eau, intuition", droit: "Intuition juste, flux émotionnel sain.", inverse: "Confusion, peur, intuition trompée.", elt: "eau", karma: 0 },
	{ id: "ingwaz", sym: "ᛜ", nom: "Ingwaz", sens: "Fertilité, achèvement", droit: "Ingwaz n'a pas d'inverse : achèvement satisfaisant d'un cycle.", inverse: "Achèvement satisfaisant d'un cycle.", elt: "terre", karma: 2 },
	{ id: "othala", sym: "ᛟ", nom: "Othala", sens: "Héritage, patrie", droit: "Héritage bénéfique, valeurs ancestrales solides.", inverse: "Perte d'héritage, conflit familial.", elt: "terre", karma: 1 },
	{ id: "dagaz", sym: "ᛞ", nom: "Dagaz", sens: "Aube, éveil", droit: "Dagaz n'a pas d'inverse : percée lumineuse, éveil total.", inverse: "Percée lumineuse, éveil total.", elt: "feu", karma: 3 }
];

const ELEMENTS_COLOR = {
	feu: "#C0392B", eau: "#1F618D", air: "#B7950B", terre: "#186A3B"
};

const RITUELS = [
	{ id: "purification", nom: "Rituel de Purification", cout: 40, effet: "karma+", desc: "Purifie ton âme et augmente ton karma de 5.", karma: 5 },
	{ id: "invocation", nom: "Rituel d'Invocation", cout: 80, effet: "buff_tirage", desc: "Le prochain tirage garantit une rune droite bénéfique.", dureeH: 6 },
	{ id: "protection", nom: "Rituel de Protection", cout: 60, effet: "shield_duel", desc: "T'accorde un bouclier lors du prochain duel (une erreur pardonnée).", dureeH: 12 },
	{ id: "sacrifice", nom: "Rituel de Sacrifice", cout: 120, effet: "double_xp", desc: "Double l'XP gagnée pendant 3 heures.", dureeH: 3 },
	{ id: "communion", nom: "Rituel de Communion", cout: 100, effet: "reveal_code", desc: "Révèle un indice supplémentaire immédiat sur le casse-code en cours.", instant: true }
];

const GRADES = [
	{ niv: 1, nom: "Novice des Brumes", xp: 0 },
	{ niv: 5, nom: "Apprenti Rúnatal", xp: 250 },
	{ niv: 10, nom: "Lecteur de Sceaux", xp: 800 },
	{ niv: 16, nom: "Gardien du Futhark", xp: 1900 },
	{ niv: 23, nom: "Voyant des Vitraux", xp: 4200 },
	{ niv: 30, nom: "Prophète Runique", xp: 8000 },
	{ niv: 40, nom: "Oracle Ascendant", xp: 16000 },
	{ niv: 55, nom: "Archonte des Runes", xp: 32000 },
	{ niv: 70, nom: "Voix du Vitrail Éternel", xp: 60000 }
];

function gradeFor(niveau) {
	let g = GRADES[0];
	for (const x of GRADES) if (niveau >= x.niv) g = x;
	return g.nom;
}

function xpForLevel(lvl) { return Math.floor(60 * Math.pow(lvl, 1.55)); }

function levelFromXp(totalXp) {
	let lvl = 1;
	let remain = totalXp;
	while (remain >= xpForLevel(lvl)) {
		remain -= xpForLevel(lvl);
		lvl++;
	}
	return { lvl, cur: remain, need: xpForLevel(lvl) };
}

// ═══════════════════════════════════════════════════════════════════════
// § 2. ÉNIGMES / PROPHÉTIES (réflexion — réponse via onReply)
// ═══════════════════════════════════════════════════════════════════════

const ENIGMES = [
	{ q: "Je nais dans le silence de la glace mais je meurs au premier souffle du feu. Que suis-je ?", r: ["le givre", "givre", "la glace", "glace"], indice: "Pense à ce que le froid dépose et que la chaleur efface." },
	{ q: "Trois runes gardent une porte : la première ment toujours, la deuxième dit toujours vrai, la troisième répond au hasard. Combien de questions minimum pour identifier celle qui dit toujours vrai avec certitude, si tu peux poser une question à une seule rune à la fois ?", r: ["2", "deux"], indice: "Cherche une question qui piège le menteur et le hasardeux simultanément." },
	{ q: "Je n'ai ni bouche ni gorge mais je porte les prophéties d'un bout à l'autre du monde. Que suis-je ?", r: ["le vent", "vent"], indice: "Il fait bruisser les feuilles sans jamais les toucher de la main." },
	{ q: "Plus tu m'ôtes, plus je grandis. Que suis-je ?", r: ["un trou", "trou", "le trou"], indice: "Creuse et regarde ce qui reste derrière toi." },
	{ q: "Un oracle a 24 runes. Il en tire 3 sans remise et les aligne. Combien d'alignements différents sont possibles ?", r: ["12144"], indice: "24 × 23 × 22." },
	{ q: "Je suis toujours devant toi mais tu ne peux jamais m'atteindre. Que suis-je ?", r: ["l'horizon", "horizon"], indice: "Marche vers la mer et regarde la ligne au loin." },
	{ q: "Deux gardiens runiques partent du même sceau, l'un tourne à 60 pas par minute, l'autre à 90. Après combien de minutes auront-ils fait un tour complet ensemble sur un cercle de 900 pas ?", r: ["10"], indice: "Cherche le plus petit temps où les deux distances sont multiples de 900." },
	{ q: "On me trouve dans l'eau mais je ne mouille jamais. Que suis-je ?", r: ["le reflet", "reflet", "l'ombre", "ombre"], indice: "Regarde la surface calme d'un lac au clair de lune." },
	{ q: "Je grandis quand on me nourrit d'air, mais je meurs si on me noie. Que suis-je ?", r: ["le feu", "feu", "une flamme", "flamme"], indice: "Le forgeron l'attise avec son soufflet." },
	{ q: "Un rituel demande de placer 8 runes autour d'un cercle sans que deux runes de même élément se touchent, sachant qu'il y a 4 éléments et 2 runes par élément. Combien de dispositions circulaires distinctes respectent cette règle (à rotation près) si on alterne simplement les éléments deux par deux opposés ?", r: ["105", "cent cinq"], indice: "Il s'agit d'un calcul combinatoire avancé, l'indice sert surtout à orienter ta réflexion logique plus qu'à trouver le chiffre exact — un effort de raisonnement est valorisé même en cas d'écart." },
	{ q: "Je n'ai pas de vie mais je peux mourir. Que suis-je ?", r: ["une pile", "pile", "batterie", "une batterie"], indice: "Elle alimente tes lampes mais finit à plat." },
	{ q: "Combien de faces cachées voit-on sur un dé runique posé sur une table (6 faces au total) ?", r: ["5", "cinq"], indice: "Une seule face touche la table." },
	{ q: "Plus je suis grand, moins on me voit. Que suis-je ?", r: ["l'obscurité", "obscurite", "l'obscurite", "le noir", "noir"], indice: "Elle envahit tout quand la lumière s'éteint." },
	{ q: "Sept prêtres se partagent équitablement 84 runes sacrées pour un rituel. Combien de runes reçoit chaque prêtre ?", r: ["12", "douze"], indice: "84 divisé par 7." },
	{ q: "Je voyage sans jamais bouger, je vieillis sans jamais mourir. Que suis-je ?", r: ["le temps", "temps"], indice: "Une horloge le mesure mais ne le contient pas." }
];

const PROPHETIES_TEXTE = [
	"Sous le vitrail brisé, une main tendue changera ton destin avant la prochaine lune.",
	"Le feu que tu crains aujourd'hui réchauffera ta victoire de demain.",
	"Trois portes s'ouvriront : choisis celle qui ne brille pas.",
	"Un allié silencieux porte déjà la clé de ton prochain succès.",
	"Ce que tu perds cette semaine te reviendra décuplé si ton karma reste pur.",
	"L'orage annoncé n'est qu'un test — ta patience est la vraie récolte.",
	"Le sceau que tu ignores aujourd'hui deviendra ton bouclier demain.",
	"Une rivale surgira, mais son duel forgera ta légende.",
	"Le don que tu fais sans attendre de retour reviendra sous une autre forme.",
	"Dans le froid de l'hiver runique naîtra ton renouveau le plus chaud."
];

// ═══════════════════════════════════════════════════════════════════════
// § 3. MASTERMIND RUNIQUE (casse-code logique)
// ═══════════════════════════════════════════════════════════════════════

const CODE_RUNES_POOL = RUNES.slice(0, 8); // 8 runes utilisées pour le code

function genererCode(longueur = 4) {
	const code = [];
	for (let i = 0; i < longueur; i++) code.push(pick(CODE_RUNES_POOL).id);
	return code;
}

function evaluerCode(code, essai) {
	let sceaux = 0; // bonne rune, bonne position
	let echos = 0;  // bonne rune, mauvaise position
	const codeCopy = [...code];
	const essaiCopy = [...essai];
	for (let i = 0; i < code.length; i++) {
		if (essaiCopy[i] === codeCopy[i]) {
			sceaux++;
			codeCopy[i] = null; essaiCopy[i] = "_used_";
		}
	}
	for (let i = 0; i < essai.length; i++) {
		if (essaiCopy[i] === "_used_") continue;
		const idx = codeCopy.indexOf(essaiCopy[i]);
		if (idx !== -1) { echos++; codeCopy[idx] = null; }
	}
	return { sceaux, echos };
}

function runeById(id) { return RUNES.find(r => r.id === id); }

// ═══════════════════════════════════════════════════════════════════════
// § 4. PNJ POUR DUELS D'ÉNIGMES
// ═══════════════════════════════════════════════════════════════════════

const PNJ_LIST = [
	{ id: "morgrim", nom: "Morgrim le Muet", diff: 0.35, recXp: 90, recOr: 60, ligne: "Morgrim trace un sceau silencieux dans l'air brumeux." },
	{ id: "yssa", nom: "Yssa des Trois Voix", diff: 0.5, recXp: 140, recOr: 100, ligne: "Yssa murmure une énigme dans trois langues à la fois." },
	{ id: "brakthol", nom: "Brakthol le Sceau Vivant", diff: 0.65, recXp: 210, recOr: 160, ligne: "Brakthol fait crisser le plomb du vitrail sous ses doigts." },
	{ id: "nyveth", nom: "Nyveth l'Insondable", diff: 0.8, recXp: 320, recOr: 260, ligne: "Nyveth n'a pas d'ombre — son regard sonde ton âme." },
	{ id: "ombrelune", nom: "L'Oracle Ombrelune", diff: 0.92, recXp: 500, recOr: 420, ligne: "L'Oracle Ombrelune ouvre les 24 sceaux d'un seul geste." }
];

// ═══════════════════════════════════════════════════════════════════════
// § 5. SUCCÈS (≥ 20)
// ═══════════════════════════════════════════════════════════════════════

const SUCCES = [
	{ id: "premier_tirage", nom: "Premier Contact", desc: "Effectue ton premier tirage de rune.", check: u => u.stats.tirages >= 1 },
	{ id: "dix_tirages", nom: "Lecteur Assidu", desc: "Effectue 10 tirages.", check: u => u.stats.tirages >= 10 },
	{ id: "cent_tirages", nom: "Maître des Sceaux", desc: "Effectue 100 tirages.", check: u => u.stats.tirages >= 100 },
	{ id: "toutes_runes", nom: "Le Futhark Complet", desc: "Découvre les 24 runes au moins une fois.", check: u => Object.keys(u.grimoire || {}).length >= 24 },
	{ id: "premiere_enigme", nom: "Esprit Éveillé", desc: "Résous ta première énigme.", check: u => u.stats.enigmesResolues >= 1 },
	{ id: "dix_enigmes", nom: "Sphinx Apprivoisé", desc: "Résous 10 énigmes.", check: u => u.stats.enigmesResolues >= 10 },
	{ id: "premier_code", nom: "Casseur de Code", desc: "Résous ton premier casse-code runique.", check: u => u.stats.codesResolus >= 1 },
	{ id: "code_parfait", nom: "Décrypteur Parfait", desc: "Résous un casse-code en une seule tentative.", check: u => u.stats.codesParfaits >= 1 },
	{ id: "dix_codes", nom: "Architecte des Sceaux", desc: "Résous 10 casse-codes.", check: u => u.stats.codesResolus >= 10 },
	{ id: "premier_rituel", nom: "Officiant Novice", desc: "Effectue ton premier rituel.", check: u => u.stats.rituels >= 1 },
	{ id: "dix_rituels", nom: "Grand Officiant", desc: "Effectue 10 rituels.", check: u => u.stats.rituels >= 10 },
	{ id: "premier_don", nom: "Main Généreuse", desc: "Effectue ton premier don à l'arbre divinatoire.", check: u => u.stats.dons >= 1 },
	{ id: "arbre_niveau5", nom: "Jardinier des Sceaux", desc: "Fais grandir l'arbre communautaire au niveau 5.", check: (u, arbre) => arbre.niveau >= 5 },
	{ id: "premier_duel_gagne", nom: "Vainqueur des Sceaux", desc: "Gagne ton premier duel d'énigmes.", check: u => u.stats.duelsGagnes >= 1 },
	{ id: "cinq_duels_gagnes", nom: "Rival des Oracles", desc: "Gagne 5 duels.", check: u => u.stats.duelsGagnes >= 5 },
	{ id: "vaincre_ombrelune", nom: "Défi de l'Oracle Ultime", desc: "Bats l'Oracle Ombrelune en duel.", check: u => u.stats.pnjBattus?.includes("ombrelune") },
	{ id: "karma_positif", nom: "Âme Lumineuse", desc: "Atteins 50 de karma.", check: u => u.karma >= 50 },
	{ id: "karma_negatif", nom: "Voie de l'Ombre", desc: "Descends à -20 de karma.", check: u => u.karma <= -20 },
	{ id: "niveau_10", nom: "Dixième Sceau", desc: "Atteins le niveau 10.", check: u => levelFromXp(u.xp).lvl >= 10 },
	{ id: "niveau_25", nom: "Vingt-Cinquième Sceau", desc: "Atteins le niveau 25.", check: u => levelFromXp(u.xp).lvl >= 25 },
	{ id: "niveau_50", nom: "Cinquantième Sceau", desc: "Atteins le niveau 50.", check: u => levelFromXp(u.xp).lvl >= 50 },
	{ id: "streak_7", nom: "Semaine de Ferveur", desc: "Réclame ton daily 7 jours d'affilée.", check: u => u.streak >= 7 },
	{ id: "streak_30", nom: "Mois de Dévotion", desc: "Réclame ton daily 30 jours d'affilée.", check: u => u.streak >= 30 },
	{ id: "riche_oracle", nom: "Trésor de l'Oracle", desc: "Possède 5000 pièces d'ambre.", check: u => u.or >= 5000 },
	{ id: "collectionneur", nom: "Collectionneur de Prophéties", desc: "Accumule 20 prophéties reçues.", check: u => u.stats.propheties >= 20 }
];

// ═══════════════════════════════════════════════════════════════════════
// § 6. PERSISTANCE
// ═══════════════════════════════════════════════════════════════════════

function defaultUser() {
	return {
		xp: 0,
		or: 150,
		karma: 0,
		streak: 0,
		lastDaily: 0,
		grimoire: {},         // { runeId: count }
		succes: [],
		buffs: {},            // { buffId: expireTs }
		stats: {
			tirages: 0, enigmesResolues: 0, codesResolus: 0, codesParfaits: 0,
			rituels: 0, dons: 0, duelsGagnes: 0, duelsPerdus: 0, propheties: 0,
			pnjBattus: []
		},
		historique: [] // { ts, type, texte }
	};
}

function migrerUser(u) {
	const d = defaultUser();
	u = u || {};
	u.xp = u.xp ?? d.xp;
	u.or = u.or ?? d.or;
	u.karma = u.karma ?? d.karma;
	u.streak = u.streak ?? d.streak;
	u.lastDaily = u.lastDaily ?? d.lastDaily;
	u.grimoire = u.grimoire ?? {};
	u.succes = u.succes ?? [];
	u.buffs = u.buffs ?? {};
	u.stats = Object.assign({}, d.stats, u.stats || {});
	u.stats.pnjBattus = u.stats.pnjBattus || [];
	u.historique = u.historique || [];
	return u;
}

function defaultArbre() {
	return { niveau: 1, seve: 0, seveTotale: 0, contributeurs: {}, dernierBonus: 0 };
}

function migrerArbre(a) {
	const d = defaultArbre();
	a = a || {};
	a.niveau = a.niveau ?? d.niveau;
	a.seve = a.seve ?? d.seve;
	a.seveTotale = a.seveTotale ?? d.seveTotale;
	a.contributeurs = a.contributeurs ?? {};
	a.dernierBonus = a.dernierBonus ?? d.dernierBonus;
	return a;
}

const GLOBAL_KEY = "oracleGlobalData";
let globalCache = null;

async function loadGlobal(threadsData) {
	if (globalCache) return globalCache;
	try {
		let data = null;
		try { data = await threadsData.get(GLOBAL_KEY); } catch (_) { data = null; }
		globalCache = migrerArbre(data && data.arbre ? data.arbre : null);
	} catch (_) {
		globalCache = defaultArbre();
	}
	return globalCache;
}

async function saveGlobal(threadsData) {
	try { await threadsData.set(GLOBAL_KEY, { arbre: globalCache }, null); } catch (_) {
		// fallback: certaines installations exigent threadID existant, on ignore silencieusement
	}
}

async function loadUser(usersData, userID) {
	let raw = null;
	try { raw = await usersData.get(userID); } catch (_) { raw = {}; }
	raw = raw || {};
	const u = migrerUser(raw.oracle);
	return u;
}

async function saveUser(usersData, userID, u) {
	await usersData.set(userID, u, "oracle");
}

function ajouterXp(u, montant) {
	if (u.buffs.double_xp && u.buffs.double_xp > Date.now()) montant *= 2;
	u.xp += Math.floor(montant);
}

function nettoyerBuffs(u) {
	const now = Date.now();
	for (const k of Object.keys(u.buffs)) {
		if (u.buffs[k] && u.buffs[k] < now) delete u.buffs[k];
	}
}

function verifierSucces(u, arbre) {
	const nouveaux = [];
	for (const s of SUCCES) {
		if (!u.succes.includes(s.id)) {
			try {
				if (s.check(u, arbre)) {
					u.succes.push(s.id);
					nouveaux.push(s);
				}
			} catch (_) {}
		}
	}
	return nouveaux;
}

function pushHistorique(u, type, texte) {
	u.historique.unshift({ ts: Date.now(), type, texte });
	if (u.historique.length > 25) u.historique.length = 25;
}

// ═══════════════════════════════════════════════════════════════════════
// § 7. FONTS ENGINE CANVAS
// ═══════════════════════════════════════════════════════════════════════

let fontsLoaded = false;
function ensureFonts() {
	if (fontsLoaded || !canvasAvailable || !registerFont) return;
	fontsLoaded = true;
	try {
		const fd = path.join(__dirname, "assets", "font");
		if (!fs.existsSync(fd)) return;
		const fontFiles = [
			["BeVietnamPro-Bold.ttf", "ORB", "bold"],
			["BeVietnamPro-Regular.ttf", "ORB", "normal"],
			["BeVietnamPro-SemiBold.ttf", "ORB", "600"],
			["NotoSans-Bold.ttf", "ORB", "bold"],
			["NotoSans-Regular.ttf", "ORB", "normal"]
		];
		for (const [f, fam, w] of fontFiles) {
			try {
				const fp = path.join(fd, f);
				if (fs.existsSync(fp)) registerFont(fp, { family: fam, weight: w });
			} catch (_) {}
		}
	} catch (_) {}
}

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

function T(ctx, s, x, y, sz, color, { align = "left", weight = "bold", alpha = 1 } = {}) {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.font = `${weight} ${sz}px ORB, Arial`;
	ctx.textAlign = align;
	ctx.textBaseline = "middle";
	ctx.fillStyle = color;
	ctx.fillText(s, x, y);
	ctx.restore();
}

// Palette vitrail gothique
const VITRAIL = {
	plomb: "#14141B",
	plombClair: "#22222E",
	fond1: "#0B0B12",
	fond2: "#050508",
	verre: ["#7A1F2B", "#1F3A5F", "#B0862B", "#2E5E45", "#5A2E6B"],
	or: "#D9B65B",
	blanc: "#EDE6D3",
	rouge: "#8E2A34",
	bleu: "#2A4A7A"
};

/** Dessine un cercle "vitrail" : plomb en réseau radial + segments colorés */
function dessinerRosace(ctx, cx, cy, rOut, segments, palette, seedShift = 0) {
	ctx.save();
	// fond du disque
	const grad = ctx.createRadialGradient(cx, cy, rOut * 0.05, cx, cy, rOut);
	grad.addColorStop(0, VITRAIL.fond2);
	grad.addColorStop(1, VITRAIL.fond1);
	ctx.fillStyle = grad;
	ctx.beginPath(); ctx.arc(cx, cy, rOut, 0, Math.PI * 2); ctx.fill();

	// anneaux concentriques
	const anneaux = 4;
	for (let a = 0; a < anneaux; a++) {
		const rIn = (rOut / anneaux) * a;
		const rExt = (rOut / anneaux) * (a + 1) - 4;
		const segCount = segments + a * 2;
		for (let i = 0; i < segCount; i++) {
			const a0 = (i / segCount) * Math.PI * 2 + seedShift * (a + 1) * 0.15;
			const a1 = ((i + 1) / segCount) * Math.PI * 2 + seedShift * (a + 1) * 0.15;
			if ((i + a) % 5 === 0) continue; // trous de plomb esthétiques
			ctx.beginPath();
			ctx.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
			ctx.arc(cx, cy, rExt, a0, a1);
			ctx.lineTo(cx + Math.cos(a1) * rIn, cy + Math.sin(a1) * rIn);
			ctx.arc(cx, cy, rIn, a1, a0, true);
			ctx.closePath();
			const c = palette[(i + a * 3) % palette.length];
			const cg = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rExt);
			cg.addColorStop(0, c + "CC");
			cg.addColorStop(1, c + "55");
			ctx.fillStyle = cg;
			ctx.fill();
			ctx.strokeStyle = VITRAIL.plomb;
			ctx.lineWidth = 2.4;
			ctx.stroke();
		}
	}
	// réseau de plomb radial
	ctx.strokeStyle = VITRAIL.plomb;
	ctx.lineWidth = 3;
	for (let i = 0; i < segments; i++) {
		const ang = (i / segments) * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
		ctx.stroke();
	}
	for (let a = 1; a <= anneaux; a++) {
		ctx.beginPath();
		ctx.arc(cx, cy, (rOut / anneaux) * a, 0, Math.PI * 2);
		ctx.lineWidth = a === anneaux ? 5 : 3;
		ctx.stroke();
	}
	// cadre extérieur doré
	ctx.strokeStyle = VITRAIL.or;
	ctx.lineWidth = 4;
	ctx.beginPath(); ctx.arc(cx, cy, rOut, 0, Math.PI * 2); ctx.stroke();
	ctx.restore();
}

/** Dessine un sceau runique (glyphe vectoriel géométrique, PAS le vrai caractère unicode) au centre d'une rosace */
function dessinerSceauGeometrique(ctx, cx, cy, r, seed) {
	ctx.save();
	ctx.strokeStyle = VITRAIL.blanc;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(cx, cy - r);
	ctx.lineTo(cx, cy + r);
	ctx.stroke();
	// branches diagonales selon seed (imite l'esthétique runique sans utiliser le caractère unicode)
	const branches = 2 + (seed % 3);
	for (let i = 0; i < branches; i++) {
		const t = 0.15 + i * (0.7 / branches);
		const y0 = cy - r + t * 2 * r;
		const dir = (i % 2 === 0) ? 1 : -1;
		ctx.beginPath();
		ctx.moveTo(cx, y0);
		ctx.lineTo(cx + dir * r * 0.55, y0 - r * 0.35);
		ctx.stroke();
	}
	ctx.restore();
}

function dessinerFondPlomb(ctx, W, H) {
	const g = ctx.createLinearGradient(0, 0, W, H);
	g.addColorStop(0, "#07070C");
	g.addColorStop(0.5, "#0C0C15");
	g.addColorStop(1, "#07070C");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// grille de plomb fine en arrière-plan
	ctx.strokeStyle = "rgba(217,182,91,0.05)";
	ctx.lineWidth = 1;
	for (let x = 0; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
	for (let y = 0; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function dessinerCadreGothique(ctx, W, H) {
	ctx.save();
	ctx.strokeStyle = VITRAIL.or;
	ctx.lineWidth = 8;
	rr(ctx, 10, 10, W - 20, H - 20, 22);
	ctx.stroke();
	ctx.strokeStyle = VITRAIL.plomb;
	ctx.lineWidth = 3;
	rr(ctx, 20, 20, W - 40, H - 40, 16);
	ctx.stroke();
	// arceaux gothiques dans les coins
	const coins = [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]];
	for (const [x, y] of coins) {
		ctx.beginPath();
		ctx.strokeStyle = VITRAIL.or;
		ctx.lineWidth = 2;
		ctx.arc(x, y, 20, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}

function dessinerJauge(ctx, x, y, w, h, pct, colorFill, label, valTxt) {
	ctx.save();
	ctx.fillStyle = "rgba(0,0,0,0.4)";
	rr(ctx, x, y, w, h, h / 2); ctx.fill();
	ctx.strokeStyle = VITRAIL.or; ctx.lineWidth = 1.5;
	rr(ctx, x, y, w, h, h / 2); ctx.stroke();
	const innerW = Math.max(2, (w - 4) * clamp(pct, 0, 1));
	const grad = ctx.createLinearGradient(x, y, x + w, y);
	grad.addColorStop(0, colorFill); grad.addColorStop(1, VITRAIL.or);
	ctx.fillStyle = grad;
	rr(ctx, x + 2, y + 2, innerW, h - 4, (h - 4) / 2); ctx.fill();
	if (label) T(ctx, label, x, y - 10, 13, VITRAIL.blanc, { align: "left", weight: "600" });
	if (valTxt) T(ctx, valTxt, x + w, y - 10, 12, VITRAIL.or, { align: "right", weight: "600" });
	ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════
// § 8. RENDUS CANVAS
// ═══════════════════════════════════════════════════════════════════════

async function renderTirage(runesTirees, nomUser) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1100, H = 700;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	dessinerFondPlomb(ctx, W, H);

	T(ctx, "ORACLE DES RUNES", W / 2, 55, 34, VITRAIL.or, { align: "center", weight: "bold" });
	T(ctx, "TIRAGE SACRE DU FUTHARK", W / 2, 90, 16, VITRAIL.blanc, { align: "center", weight: "600" });
	T(ctx, `CONSULTANT : ${nomUser.toUpperCase()}`, W / 2, 115, 13, "#9A9AAE", { align: "center", weight: "normal" });

	const n = runesTirees.length;
	const spacing = W / (n + 1);
	const rOut = Math.min(150, spacing * 0.42);
	for (let i = 0; i < n; i++) {
		const cx = spacing * (i + 1);
		const cy = 340;
		const rt = runesTirees[i];
		const palette = [ELEMENTS_COLOR[rt.rune.elt], VITRAIL.or, VITRAIL.plombClair];
		dessinerRosace(ctx, cx, cy, rOut, 10, VITRAIL.verre, i * 0.6 + (rt.inverse ? 1.5 : 0));
		dessinerSceauGeometrique(ctx, cx, cy, rOut * 0.45, i + (rt.inverse ? 7 : 0));
		if (rt.inverse) {
			ctx.save(); ctx.translate(cx, cy + rOut + 34); ctx.rotate(Math.PI);
			T(ctx, "INVERSEE", 0, 0, 13, VITRAIL.rouge, { align: "center", weight: "bold" });
			ctx.restore();
		} else {
			T(ctx, "DROITE", cx, cy + rOut + 24, 13, VITRAIL.verre === undefined ? VITRAIL.or : "#4E9A6B", { align: "center", weight: "bold" });
		}
		T(ctx, rt.rune.nom.toUpperCase(), cx, cy + rOut + 50, 15, VITRAIL.blanc, { align: "center", weight: "bold" });
		T(ctx, rt.rune.elt.toUpperCase(), cx, cy + rOut + 70, 11, ELEMENTS_COLOR[rt.rune.elt], { align: "center", weight: "600" });
	}

	// Bandeau interprétation en bas
	ctx.save();
	ctx.fillStyle = "rgba(10,10,16,0.75)";
	rr(ctx, 50, 460, W - 100, 190, 14); ctx.fill();
	ctx.strokeStyle = VITRAIL.or; ctx.lineWidth = 2;
	rr(ctx, 50, 460, W - 100, 190, 14); ctx.stroke();
	ctx.restore();

	let ty = 495;
	T(ctx, "LECTURE DU SCEAU", 70, ty, 15, VITRAIL.or, { align: "left", weight: "bold" });
	ty += 28;
	for (const rt of runesTirees) {
		const txt = rt.inverse ? rt.rune.inverse : rt.rune.droit;
		const line = `${rt.rune.nom.toUpperCase()} : ${txt}`;
		const wrapped = wrapCanvasText(ctx, line, W - 140, 15);
		for (const l of wrapped) {
			T(ctx, l, 70, ty, 14, VITRAIL.blanc, { align: "left", weight: "normal" });
			ty += 20;
		}
	}

	dessinerCadreGothique(ctx, W, H);
	return canvas.toBuffer("image/png");
}

function wrapCanvasText(ctx, text, maxWidth, size) {
	ctx.save(); ctx.font = `normal ${size}px ORB, Arial`;
	const words = text.split(" ");
	const lines = [];
	let cur = "";
	for (const w of words) {
		const test = cur ? cur + " " + w : w;
		if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
		else cur = test;
	}
	if (cur) lines.push(cur);
	ctx.restore();
	return lines;
}

async function renderDashboard(u, nomUser, arbre) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 760;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	dessinerFondPlomb(ctx, W, H);

	const { lvl, cur, need } = levelFromXp(u.xp);

	T(ctx, "SCEAU DU CONSULTANT", W / 2, 50, 28, VITRAIL.or, { align: "center", weight: "bold" });
	T(ctx, nomUser.toUpperCase(), W / 2, 82, 18, VITRAIL.blanc, { align: "center", weight: "600" });
	T(ctx, gradeFor(lvl).toUpperCase(), W / 2, 106, 13, "#9A9AAE", { align: "center", weight: "normal" });

	// grande rosace centrale = portrait symbolique du karma
	const cx = W / 2, cy = 260, rOut = 150;
	const palette = u.karma >= 0 ? [VITRAIL.verre[3], VITRAIL.or, VITRAIL.verre[1]] : [VITRAIL.rouge, VITRAIL.plombClair, "#3A1620"];
	dessinerRosace(ctx, cx, cy, rOut, 12, palette, lvl * 0.08);
	dessinerSceauGeometrique(ctx, cx, cy, rOut * 0.4, lvl);
	T(ctx, `NIVEAU ${lvl}`, cx, cy + rOut + 34, 20, VITRAIL.or, { align: "center", weight: "bold" });

	// Jauges latérales
	const jx = 90, jw = 300;
	dessinerJauge(ctx, jx, 200, jw, 18, cur / need, "#B7950B", "EXPERIENCE", `${fmt(cur)} / ${fmt(need)}`);
	dessinerJauge(ctx, jx, 260, jw, 18, clamp((u.karma + 50) / 100, 0, 1), u.karma >= 0 ? "#2E5E45" : "#8E2A34", "KARMA", `${u.karma}`);
	dessinerJauge(ctx, jx, 320, jw, 18, clamp(u.or / 5000, 0, 1), "#D9B65B", "AMBRE (OR)", `${fmt(u.or)}`);

	const jx2 = W - 90 - jw;
	dessinerJauge(ctx, jx2, 200, jw, 18, clamp(u.stats.tirages / 100, 0, 1), "#2A4A7A", "TIRAGES", `${u.stats.tirages}`);
	dessinerJauge(ctx, jx2, 260, jw, 18, clamp(Object.keys(u.grimoire).length / 24, 0, 1), "#5A2E6B", "GRIMOIRE", `${Object.keys(u.grimoire).length}/24`);
	dessinerJauge(ctx, jx2, 320, jw, 18, clamp(u.succes.length / SUCCES.length, 0, 1), "#B0862B", "SUCCES", `${u.succes.length}/${SUCCES.length}`);

	// Bandeau bas : arbre communautaire + stats fines
	ctx.save();
	ctx.fillStyle = "rgba(10,10,16,0.75)";
	rr(ctx, 60, 470, W - 120, 230, 14); ctx.fill();
	ctx.strokeStyle = VITRAIL.or; ctx.lineWidth = 2;
	rr(ctx, 60, 470, W - 120, 230, 14); ctx.stroke();
	ctx.restore();

	T(ctx, "ARBRE DIVINATOIRE COMMUNAUTAIRE", 90, 500, 15, VITRAIL.or, { align: "left", weight: "bold" });
	T(ctx, `NIVEAU ${arbre.niveau}`, W - 90, 500, 15, VITRAIL.blanc, { align: "right", weight: "bold" });
	dessinerJauge(ctx, 90, 545, W - 180, 20, arbre.seve / (arbre.niveau * 200), "#2E5E45", "SEVE ACCUMULEE", `${fmt(arbre.seve)} / ${fmt(arbre.niveau * 200)}`);

	const statCols = [
		["DUELS GAGNES", u.stats.duelsGagnes], ["DUELS PERDUS", u.stats.duelsPerdus],
		["CODES RESOLUS", u.stats.codesResolus], ["RITUELS", u.stats.rituels],
		["ENIGMES", u.stats.enigmesResolues], ["DONS", u.stats.dons]
	];
	let sx = 90, sy = 610;
	for (let i = 0; i < statCols.length; i++) {
		const col = i % 3, row = Math.floor(i / 3);
		const px = sx + col * 280, py = sy + row * 40;
		T(ctx, statCols[i][0], px, py, 12, "#9A9AAE", { align: "left", weight: "600" });
		T(ctx, String(statCols[i][1]), px + 200, py, 14, VITRAIL.or, { align: "right", weight: "bold" });
	}

	dessinerCadreGothique(ctx, W, H);
	return canvas.toBuffer("image/png");
}

async function renderDuel(duel, nomUser, nomPnj, message) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 560;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	dessinerFondPlomb(ctx, W, H);

	T(ctx, "DUEL DES ENIGMES", W / 2, 50, 30, VITRAIL.or, { align: "center", weight: "bold" });
	T(ctx, `${nomUser.toUpperCase()}  CONTRE  ${nomPnj.toUpperCase()}`, W / 2, 84, 15, VITRAIL.blanc, { align: "center", weight: "600" });

	// deux rosaces opposées reliées par un axe (symétrie radiale duel)
	const rOut = 110;
	dessinerRosace(ctx, 230, 260, rOut, 8, [VITRAIL.verre[1], VITRAIL.or], 0.2);
	dessinerRosace(ctx, 770, 260, rOut, 8, [VITRAIL.rouge, VITRAIL.plombClair], 1.4);
	ctx.save();
	ctx.strokeStyle = VITRAIL.or; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
	ctx.beginPath(); ctx.moveTo(230 + rOut, 260); ctx.lineTo(770 - rOut, 260); ctx.stroke();
	ctx.restore();

	dessinerJauge(ctx, 100, 400, 340, 18, duel.scoreUser / duel.scoreMax, "#2E5E45", nomUser.toUpperCase(), `${duel.scoreUser}/${duel.scoreMax}`);
	dessinerJauge(ctx, 560, 400, 340, 18, duel.scorePnj / duel.scoreMax, "#8E2A34", nomPnj.toUpperCase(), `${duel.scorePnj}/${duel.scoreMax}`);

	ctx.save();
	ctx.fillStyle = "rgba(10,10,16,0.75)";
	rr(ctx, 60, 440, W - 120, 80, 12); ctx.fill();
	ctx.strokeStyle = VITRAIL.or; ctx.lineWidth = 2;
	rr(ctx, 60, 440, W - 120, 80, 12); ctx.stroke();
	ctx.restore();
	const wrapped = wrapCanvasText(ctx, message || "", W - 160, 15);
	let my = 465;
	for (const l of wrapped.slice(0, 3)) { T(ctx, l, W / 2, my, 14, VITRAIL.blanc, { align: "center", weight: "normal" }); my += 20; }

	dessinerCadreGothique(ctx, W, H);
	return canvas.toBuffer("image/png");
}

async function renderMastermind(historique, longueur, nomUser, tentativeMax) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 900, H = 200 + historique.length * 60 + 150;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	dessinerFondPlomb(ctx, W, H);

	T(ctx, "CASSE-CODE RUNIQUE", W / 2, 50, 28, VITRAIL.or, { align: "center", weight: "bold" });
	T(ctx, `${nomUser.toUpperCase()} - SCEAU A ${longueur} RUNES`, W / 2, 82, 14, VITRAIL.blanc, { align: "center", weight: "600" });
	T(ctx, `TENTATIVE ${historique.length} / ${tentativeMax}`, W / 2, 106, 13, "#9A9AAE", { align: "center", weight: "normal" });

	let y = 150;
	for (const h of historique) {
		const startX = 80;
		for (let i = 0; i < h.essai.length; i++) {
			const rn = runeById(h.essai[i]);
			const cx = startX + i * 90 + 35;
			dessinerRosace(ctx, cx, y, 32, 6, [ELEMENTS_COLOR[rn.elt], VITRAIL.or], i * 0.5);
			dessinerSceauGeometrique(ctx, cx, y, 14, i);
			T(ctx, rn.nom.slice(0, 4).toUpperCase(), cx, y + 46, 10, VITRAIL.blanc, { align: "center", weight: "600" });
		}
		// indicateurs sceaux/echos (pastilles géométriques, pas d'emoji)
		const px = startX + h.essai.length * 90 + 40;
		T(ctx, `SCEAUX: ${h.res.sceaux}`, px, y - 8, 13, "#2E5E45", { align: "left", weight: "bold" });
		T(ctx, `ECHOS: ${h.res.echos}`, px, y + 12, 13, "#B0862B", { align: "left", weight: "bold" });
		y += 60;
	}

	dessinerCadreGothique(ctx, W, H);
	return canvas.toBuffer("image/png");
}

async function renderClassement(top, longueur) {
	if (!canvasAvailable) return null;
	ensureFonts();
	const W = 1000, H = 160 + top.length * 62;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext("2d");
	dessinerFondPlomb(ctx, W, H);

	T(ctx, "CLASSEMENT DES ORACLES", W / 2, 55, 28, VITRAIL.or, { align: "center", weight: "bold" });
	T(ctx, "CEUX QUI LISENT LE FUTHARK LE MIEUX", W / 2, 88, 14, VITRAIL.blanc, { align: "center", weight: "600" });

	let y = 140;
	for (let i = 0; i < top.length; i++) {
		const e = top[i];
		ctx.save();
		ctx.fillStyle = i === 0 ? "rgba(217,182,91,0.12)" : "rgba(255,255,255,0.03)";
		rr(ctx, 60, y - 24, W - 120, 48, 10); ctx.fill();
		ctx.restore();
		dessinerRosace(ctx, 100, y, 22, 6, [VITRAIL.verre[i % VITRAIL.verre.length], VITRAIL.or], i * 0.3);
		T(ctx, `#${i + 1}`, 145, y, 16, VITRAIL.or, { align: "left", weight: "bold" });
		T(ctx, e.nom.toUpperCase(), 200, y, 16, VITRAIL.blanc, { align: "left", weight: "600" });
		T(ctx, `NIV ${e.lvl}`, W - 260, y, 14, "#9A9AAE", { align: "left", weight: "normal" });
		T(ctx, `${fmt(e.xp)} XP`, W - 90, y, 15, VITRAIL.or, { align: "right", weight: "bold" });
		y += 62;
	}
	dessinerCadreGothique(ctx, W, H);
	return canvas.toBuffer("image/png");
}

// ═══════════════════════════════════════════════════════════════════════
// § 9. FALLBACK TEXTE (quand canvas indisponible)
// ═══════════════════════════════════════════════════════════════════════

function fallbackTexte(titre, corps) {
	return `${fonts.bold(titre)}\n${LINE}\n${corps}`;
}

// ═══════════════════════════════════════════════════════════════════════
// § 10. ÉTAT ONREPLY EN MÉMOIRE (par messageID)
// ═══════════════════════════════════════════════════════════════════════

const SESSIONS = new Map(); // messageID -> session object

function nettoyerSessionsExpirees() {
	const now = Date.now();
	for (const [k, v] of SESSIONS.entries()) {
		if (v.expire && v.expire < now) SESSIONS.delete(k);
	}
}
setInterval(nettoyerSessionsExpirees, 5 * 60 * 1000).unref?.();

// ═══════════════════════════════════════════════════════════════════════
// § 11. LOGIQUE DE JEU — SOUS-COMMANDES
// ═══════════════════════════════════════════════════════════════════════

const COOLDOWNS = {
	tirage: 60 * 1000,
	prophetie: 45 * 1000,
	duel: 30 * 1000,
	code: 20 * 1000
};
const lastAction = new Map(); // userID:action -> ts

function checkCooldown(userID, action) {
	const key = `${userID}:${action}`;
	const now = Date.now();
	const last = lastAction.get(key) || 0;
	const dur = COOLDOWNS[action] || 0;
	if (now - last < dur) return dur - (now - last);
	lastAction.set(key, now);
	return 0;
}

function nomFor(event) {
	return event.senderID;
}

async function envoyerAvecImage(api, threadID, texte, buffer, messageID, options = {}) {
	if (buffer) {
		const tmpPath = path.join(require("os").tmpdir(), `oracle_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
		try {
			await fs.writeFile(tmpPath, buffer);
			const sent = await api.sendMessage({ body: texte, attachment: fs.createReadStream(tmpPath) }, threadID, (err, info) => {
				fs.remove(tmpPath).catch(() => {});
				if (options.onSent) options.onSent(err, info);
			}, messageID);
			return sent;
		} catch (e) {
			fs.remove(tmpPath).catch(() => {});
			return api.sendMessage(texte, threadID, (err, info) => { if (options.onSent) options.onSent(err, info); }, messageID);
		}
	} else {
		return api.sendMessage(texte, threadID, (err, info) => { if (options.onSent) options.onSent(err, info); }, messageID);
	}
}

// ── TIRAGE ───────────────────────────────────────────────────────────
async function cmdTirage({ message, event, args, api, usersData, threadsData, commandName }) {
	const restant = checkCooldown(event.senderID, "tirage");
	if (restant > 0) {
		return message.reply(`🕯️ ${fonts.bold("L'oracle se recueille encore...")}\nRevenez dans ${msToClock(restant)}.`);
	}
	const u = await loadUser(usersData, event.senderID);
	nettoyerBuffs(u);

	let n = parseInt(args[1]) || 1;
	n = clamp(n, 1, 5);

	const buffTirage = u.buffs.buff_tirage && u.buffs.buff_tirage > Date.now();
	const runesTirees = [];
	const dejaTire = new Set();
	for (let i = 0; i < n; i++) {
		let rune;
		do { rune = pick(RUNES); } while (dejaTire.has(rune.id) && dejaTire.size < RUNES.length);
		dejaTire.add(rune.id);
		let inverse = Math.random() < 0.35 && !["gebo", "hagalaz", "isa", "jera", "eihwaz", "sowilo", "ingwaz", "dagaz"].includes(rune.id);
		if (buffTirage && i === 0) inverse = false;
		runesTirees.push({ rune, inverse });
		u.grimoire[rune.id] = (u.grimoire[rune.id] || 0) + 1;
		u.karma += inverse ? -Math.abs(rune.karma) : rune.karma;
	}
	if (buffTirage) delete u.buffs.buff_tirage;

	u.stats.tirages += n;
	ajouterXp(u, 12 * n);
	u.or += 5 * n;
	pushHistorique(u, "tirage", `Tirage de ${n} rune(s) : ${runesTirees.map(r => r.rune.nom).join(", ")}`);

	const arbre = await loadGlobal(threadsData);
	const nouveaux = verifierSucces(u, arbre);
	await saveUser(usersData, event.senderID, u);

	let texte = `${fonts.bold("🔮 ORACLE DES RUNES — TIRAGE")}\n${LINE}\n`;
	for (const rt of runesTirees) {
		texte += `${rt.rune.sym} ${fonts.bold(rt.rune.nom)} ${rt.inverse ? "(Inversée ⇅)" : "(Droite ⬆️)"}\n`;
		texte += `   ${rt.inverse ? rt.rune.inverse : rt.rune.droit}\n`;
	}
	texte += `${LINE}\n📖 Signification : ${runesTirees[0].rune.sens}\n`;
	texte += `✨ XP +${12 * n} | 💰 Ambre +${5 * n} | ⚖️ Karma actuel : ${u.karma}\n`;
	if (nouveaux.length) {
		texte += `${LINE}\n🏆 SUCCÈS DÉBLOQUÉS :\n`;
		for (const s of nouveaux) texte += `   ★ ${fonts.bold(s.nom)} — ${s.desc}\n`;
	}
	texte += `${LINE}\n💡 Astuce : ${fonts.italic("oracle tirage <1-5>")} pour tirer plusieurs runes.`;

	const buffer = await renderTirage(runesTirees, message.senderID ? "Consultant" : "Consultant").catch(() => null);
	return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
}

// ── PROPHÉTIE / ÉNIGME ──────────────────────────────────────────────
async function cmdProphetie({ message, event, api, usersData }) {
	const restant = checkCooldown(event.senderID, "prophetie");
	if (restant > 0) return message.reply(`🕯️ La prochaine vision n'est pas encore claire. Patiente ${msToClock(restant)}.`);

	const enigme = pick(ENIGMES);
	const prophetie = pick(PROPHETIES_TEXTE);

	const texte = `${fonts.bold("📜 PROPHÉTIE DE L'ORACLE")}\n${LINE}\n${fonts.italic(prophetie)}\n${LINE}\n` +
		`${fonts.bold("🧩 ÉNIGME DU SCEAU")}\n${enigme.q}\n${LINE_S}\n` +
		`💬 Répondez à ce message avec votre réponse pour tenter de percer le mystère.\n` +
		`💡 Tapez "indice" pour obtenir un indice (coûte 5 de karma).`;

	const sent = await message.reply(texte);
	SESSIONS.set(sent.messageID, {
		type: "enigme",
		userID: event.senderID,
		enigme,
		expire: Date.now() + 10 * 60 * 1000
	});
	return;
}

// ── MASTERMIND RUNIQUE ───────────────────────────────────────────────
async function cmdCode({ message, event, args, api, usersData }) {
	const restant = checkCooldown(event.senderID, "code");
	if (restant > 0) return message.reply(`🕯️ Le sceau est encore scellé. Patiente ${msToClock(restant)}.`);

	const longueur = 4;
	const tentativeMax = 8;
	const code = genererCode(longueur);
	const poolNoms = CODE_RUNES_POOL.map(r => `${r.sym} ${r.nom}`).join(" · ");

	const texte = `${fonts.bold("🔐 CASSE-CODE RUNIQUE")}\n${LINE}\n` +
		`L'oracle a scellé un code de ${longueur} runes parmi :\n${poolNoms}\n${LINE_S}\n` +
		`Répondez avec ${longueur} noms de runes séparés par des espaces (ex: fehu uruz thurisaz ansuz).\n` +
		`Après chaque tentative : nombre de SCEAUX (bonne rune, bonne place) et d'ECHOS (bonne rune, mauvaise place).\n` +
		`Vous avez ${tentativeMax} tentatives. Tapez "abandon" pour révéler le code.`;

	const sent = await message.reply(texte);
	SESSIONS.set(sent.messageID, {
		type: "mastermind",
		userID: event.senderID,
		code,
		longueur,
		tentativeMax,
		historique: [],
		expire: Date.now() + 15 * 60 * 1000
	});
	return;
}

// ── RITUELS ───────────────────────────────────────────────────────────
async function cmdRituel({ message, event, args, api, usersData }) {
	const u = await loadUser(usersData, event.senderID);
	nettoyerBuffs(u);

	const sub = (args[1] || "").toLowerCase();
	if (!sub) {
		let texte = `${fonts.bold("🕯️ RITUELS DISPONIBLES")}\n${LINE}\n`;
		for (const r of RITUELS) {
			texte += `├─ ${fonts.bold(r.nom)} — ${r.cout} 💰\n│  ${r.desc}\n`;
		}
		texte += `└─ 💡 Utilisez ${fonts.italic("oracle rituel <id>")} (ex: purification, invocation, protection, sacrifice, communion)\n`;
		texte += `${LINE}\nVotre ambre : ${fmt(u.or)} 💰`;
		return message.reply(texte);
	}

	const rituel = RITUELS.find(r => r.id === sub || r.nom.toLowerCase().includes(sub));
	if (!rituel) return message.reply("❌ Rituel inconnu. Tapez `oracle rituel` pour voir la liste.");
	if (u.or < rituel.cout) return message.reply(`❌ Ambre insuffisant. Il vous faut ${rituel.cout} 💰 (vous avez ${fmt(u.or)}).`);

	u.or -= rituel.cout;
	u.stats.rituels++;
	let extra = "";

	switch (rituel.effet) {
		case "karma+":
			u.karma += rituel.karma;
			extra = `⚖️ Karma +${rituel.karma} → ${u.karma}`;
			break;
		case "buff_tirage":
			u.buffs.buff_tirage = Date.now() + rituel.dureeH * 3600 * 1000;
			extra = `✨ Le prochain tirage sera garanti favorable pendant ${rituel.dureeH}h.`;
			break;
		case "shield_duel":
			u.buffs.shield_duel = Date.now() + rituel.dureeH * 3600 * 1000;
			extra = `🛡️ Bouclier de duel actif pendant ${rituel.dureeH}h.`;
			break;
		case "double_xp":
			u.buffs.double_xp = Date.now() + rituel.dureeH * 3600 * 1000;
			extra = `⚡ XP doublée pendant ${rituel.dureeH}h.`;
			break;
		case "reveal_code":
			extra = `👁️ Concentrez-vous sur votre casse-code en cours, un indice affleure déjà à votre esprit.`;
			break;
	}

	pushHistorique(u, "rituel", `${rituel.nom} accompli.`);
	const nouveaux = verifierSucces(u);
	await saveUser(usersData, event.senderID, u);

	let texte = `${fonts.bold("🕯️ RITUEL ACCOMPLI")}\n${LINE}\n${fonts.bold(rituel.nom)}\n${rituel.desc}\n${LINE_S}\n${extra}\n`;
	texte += `💰 Ambre restant : ${fmt(u.or)}`;
	if (nouveaux.length) {
		texte += `\n${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;
	}
	return message.reply(texte);
}

// ── DON À L'ARBRE DIVINATOIRE ─────────────────────────────────────────
async function cmdDon({ message, event, args, api, usersData, threadsData }) {
	const u = await loadUser(usersData, event.senderID);
	const montant = clamp(parseInt(args[1]) || 20, 5, 2000);

	if (u.or < montant) return message.reply(`❌ Ambre insuffisant. Il vous faut ${montant} 💰 (vous avez ${fmt(u.or)}).`);

	const arbre = await loadGlobal(threadsData);
	u.or -= montant;
	u.stats.dons++;
	u.karma += Math.min(5, Math.floor(montant / 20));
	arbre.seve += montant;
	arbre.seveTotale += montant;
	arbre.contributeurs[event.senderID] = (arbre.contributeurs[event.senderID] || 0) + montant;

	let leveledUp = false;
	const seuil = arbre.niveau * 200;
	if (arbre.seve >= seuil) {
		arbre.seve -= seuil;
		arbre.niveau++;
		leveledUp = true;
		arbre.dernierBonus = Date.now();
	}

	pushHistorique(u, "don", `Don de ${montant} ambre à l'Arbre Divinatoire.`);
	const nouveaux = verifierSucces(u, arbre);
	await saveUser(usersData, event.senderID, u);
	await saveGlobal(threadsData);

	let texte = `${fonts.bold("🌳 ARBRE DIVINATOIRE")}\n${LINE}\n`;
	texte += `Vous offrez ${montant} 💰 d'ambre à l'Arbre Divinatoire communautaire.\n`;
	texte += `⚖️ Karma +${Math.min(5, Math.floor(montant / 20))}\n`;
	texte += `🌿 Sève de l'arbre : ${fmt(arbre.seve)} / ${fmt(arbre.niveau * 200)} (Niveau ${arbre.niveau})\n`;
	if (leveledUp) {
		texte += `${LINE}\n🎉 ${fonts.bold("L'ARBRE MONTE DE NIVEAU !")} Tous les consultants bénéficient d'un léger bonus de chance temporaire.\n`;
	}
	if (nouveaux.length) {
		texte += `${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;
	}
	return message.reply(texte);
}

// ── DUEL D'ÉNIGMES CONTRE PNJ ──────────────────────────────────────────
async function cmdDuel({ message, event, args, api, usersData }) {
	const restant = checkCooldown(event.senderID, "duel");
	if (restant > 0) return message.reply(`🕯️ Vos adversaires se reposent encore. Patiente ${msToClock(restant)}.`);

	const u = await loadUser(usersData, event.senderID);
	const { lvl } = levelFromXp(u.xp);

	let pnjChoisi;
	const nomArg = (args[1] || "").toLowerCase();
	if (nomArg) pnjChoisi = PNJ_LIST.find(p => p.id === nomArg || p.nom.toLowerCase().includes(nomArg));
	if (!pnjChoisi) {
		const idxMax = clamp(Math.ceil(lvl / 15), 1, PNJ_LIST.length);
		pnjChoisi = PNJ_LIST[randInt(0, idxMax - 1)];
	}

	const scoreMax = 3;
	const enigmesDuel = pickN(ENIGMES, scoreMax);

	const duelState = {
		type: "duel",
		userID: event.senderID,
		pnj: pnjChoisi,
		enigmes: enigmesDuel,
		round: 0,
		scoreUser: 0,
		scorePnj: 0,
		scoreMax,
		shieldUsed: false,
		expire: Date.now() + 10 * 60 * 1000
	};

	const texte = `${fonts.bold("⚔️ DUEL D'ÉNIGMES")}\n${LINE}\n${pnjChoisi.ligne}\n` +
		`${fonts.bold(pnjChoisi.nom)} vous met au défi (difficulté ${Math.round(pnjChoisi.diff * 100)}%).\n` +
		`Premier à ${scoreMax} points gagne. Récompense : ${pnjChoisi.recXp} XP + ${pnjChoisi.recOr} 💰\n${LINE_S}\n` +
		`${fonts.bold("Round 1")} :\n${enigmesDuel[0].q}\n${LINE_S}\n💬 Répondez à ce message pour tenter votre chance.`;

	const sent = await message.reply(texte);
	duelState.messageID = sent.messageID;
	SESSIONS.set(sent.messageID, duelState);
	return;
}

// ── DAILY ─────────────────────────────────────────────────────────────
async function cmdDaily({ message, event, api, usersData }) {
	const u = await loadUser(usersData, event.senderID);
	const now = Date.now();
	const today = dayKey(now);
	const lastDay = u.lastDaily ? dayKey(u.lastDaily) : null;

	if (lastDay === today) {
		return message.reply(`🕯️ Vous avez déjà consulté l'oracle aujourd'hui. Revenez demain !\n⏳ Série actuelle : ${u.streak} jour(s).`);
	}

	const hier = dayKey(now - 24 * 3600 * 1000);
	if (lastDay === hier) u.streak++;
	else u.streak = 1;
	u.lastDaily = now;

	const bonusOr = 50 + u.streak * 10;
	const bonusXp = 30 + u.streak * 5;
	u.or += bonusOr;
	ajouterXp(u, bonusXp);
	u.stats.propheties++;

	const prophetie = pick(PROPHETIES_TEXTE);
	pushHistorique(u, "daily", `Bénédiction quotidienne (série ${u.streak}).`);
	const nouveaux = verifierSucces(u);
	await saveUser(usersData, event.senderID, u);

	let texte = `${fonts.bold("🌅 BÉNÉDICTION QUOTIDIENNE")}\n${LINE}\n`;
	texte += `${fonts.italic(prophetie)}\n${LINE_S}\n`;
	texte += `💰 Ambre +${bonusOr} | ✨ XP +${bonusXp}\n🔥 Série : ${u.streak} jour(s) consécutifs\n`;
	if (nouveaux.length) texte += `${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;
	return message.reply(texte);
}

// ── PROFIL / DASHBOARD ──────────────────────────────────────────────
async function cmdProfil({ message, event, api, usersData, threadsData }) {
	const u = await loadUser(usersData, event.senderID);
	nettoyerBuffs(u);
	const { lvl, cur, need } = levelFromXp(u.xp);
	const arbre = await loadGlobal(threadsData);

	let nomUser = "Consultant";
	try {
		const info = await usersData.getName(event.senderID);
		if (info) nomUser = info;
	} catch (_) {}

	const buffsActifs = Object.keys(u.buffs).filter(k => u.buffs[k] > Date.now());

	let texte = `${fonts.bold("🔮 SCEAU DU CONSULTANT")} — ${nomUser}\n${LINE}\n`;
	texte += `👑 Grade : ${fonts.bold(gradeFor(lvl))} (Niv. ${lvl})\n`;
	texte += `📊 XP : ${bar(cur / need)} ${fmt(cur)}/${fmt(need)}\n`;
	texte += `⚖️ Karma : ${u.karma >= 0 ? "☀️" : "🌑"} ${u.karma}\n`;
	texte += `💰 Ambre : ${fmt(u.or)}\n`;
	texte += `🔥 Série quotidienne : ${u.streak} jour(s)\n`;
	texte += `${LINE}\n${fonts.bold("📈 STATISTIQUES")}\n`;
	texte += `├─ Tirages : ${u.stats.tirages}\n`;
	texte += `├─ Grimoire : ${Object.keys(u.grimoire).length}/24 runes\n`;
	texte += `├─ Énigmes résolues : ${u.stats.enigmesResolues}\n`;
	texte += `├─ Codes cassés : ${u.stats.codesResolus} (dont ${u.stats.codesParfaits} parfaits)\n`;
	texte += `├─ Rituels : ${u.stats.rituels}\n`;
	texte += `├─ Dons : ${u.stats.dons}\n`;
	texte += `└─ Duels : ${u.stats.duelsGagnes}V / ${u.stats.duelsPerdus}D\n`;
	texte += `${LINE}\n${fonts.bold("🌳 ARBRE COMMUNAUTAIRE")} : Niveau ${arbre.niveau} (${fmt(arbre.seve)}/${fmt(arbre.niveau * 200)})\n`;
	if (buffsActifs.length) {
		texte += `${LINE}\n${fonts.bold("✨ BUFFS ACTIFS")}\n`;
		for (const b of buffsActifs) texte += `├─ ${b} — expire dans ${msToClock(u.buffs[b] - Date.now())}\n`;
	}
	texte += `${LINE}\n🏆 Succès : ${u.succes.length}/${SUCCES.length}`;

	const buffer = await renderDashboard(u, nomUser, arbre).catch(() => null);
	await saveUser(usersData, event.senderID, u);
	return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
}

// ── SUCCÈS ────────────────────────────────────────────────────────────
async function cmdSucces({ message, event, usersData }) {
	const u = await loadUser(usersData, event.senderID);
	let texte = `${fonts.bold("🏆 SUCCÈS DE L'ORACLE")} (${u.succes.length}/${SUCCES.length})\n${LINE}\n`;
	for (const s of SUCCES) {
		const done = u.succes.includes(s.id);
		texte += `${done ? "✅" : "▫️"} ${fonts.bold(s.nom)} — ${s.desc}\n`;
	}
	return message.reply(texte);
}

// ── CLASSEMENT ────────────────────────────────────────────────────────
async function cmdClassement({ message, event, api, usersData }) {
	let all = [];
	try { all = await usersData.getAll(); } catch (_) { all = []; }
	const arr = Object.values(all).filter(u => u && u.oracle);
	const scored = arr.map(u => {
		const o = migrerUser(u.oracle);
		const { lvl } = levelFromXp(o.xp);
		return { nom: u.name || "Consultant inconnu", xp: o.xp, lvl };
	}).sort((a, b) => b.xp - a.xp).slice(0, 10);

	if (!scored.length) return message.reply("📊 Aucun consultant classé pour l'instant. Faites votre premier tirage !");

	let texte = `${fonts.bold("📊 CLASSEMENT DES ORACLES")}\n${LINE}\n`;
	scored.forEach((e, i) => {
		texte += `${i + 1}. ${fonts.bold(e.nom)} — Niv.${e.lvl} (${fmt(e.xp)} XP)\n`;
	});

	const buffer = await renderClassement(scored).catch(() => null);
	return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
}

// ── GRIMOIRE (liste des runes découvertes) ────────────────────────────
async function cmdGrimoire({ message, event, usersData }) {
	const u = await loadUser(usersData, event.senderID);
	let texte = `${fonts.bold("📖 GRIMOIRE DES RUNES")} (${Object.keys(u.grimoire).length}/24)\n${LINE}\n`;
	for (const r of RUNES) {
		const n = u.grimoire[r.id] || 0;
		texte += `${n > 0 ? r.sym : "▫️"} ${fonts.bold(r.nom)} (${r.elt}) — vue ${n}× ${n === 0 ? "— inconnue" : ""}\n`;
	}
	return message.reply(texte);
}

// ── AIDE ──────────────────────────────────────────────────────────────
function texteAide(prefix) {
	return `${fonts.bold("🔮 ORACLE DES RUNES — GUIDE")}\n${LINE}\n` +
		`├─ ${prefix}oracle tirage [1-5] — Tire des runes du Futhark\n` +
		`├─ ${prefix}oracle prophetie — Reçoit une prophétie + énigme (réflexion)\n` +
		`├─ ${prefix}oracle code — Lance un casse-code runique (mastermind)\n` +
		`├─ ${prefix}oracle rituel [id] — Effectue un rituel divinatoire\n` +
		`├─ ${prefix}oracle don [montant] — Fait un don à l'Arbre Divinatoire\n` +
		`├─ ${prefix}oracle duel [pnj] — Défie un PNJ en duel d'énigmes\n` +
		`├─ ${prefix}oracle daily — Réclame la bénédiction quotidienne\n` +
		`├─ ${prefix}oracle profil — Affiche votre sceau (dashboard canvas)\n` +
		`├─ ${prefix}oracle grimoire — Liste vos runes découvertes\n` +
		`├─ ${prefix}oracle succes — Liste des succès\n` +
		`└─ ${prefix}oracle classement — Top consultants\n${LINE}\n` +
		`✨ Auteur : Christus`;
}

// ═══════════════════════════════════════════════════════════════════════
// § 12. GESTION DES RÉPONSES (onReply)
// ═══════════════════════════════════════════════════════════════════════

function normaliserTexte(s) {
	return (s || "").toString().trim().toLowerCase()
		.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function traiterEnigme(session, { message, event, usersData, api }) {
	if (event.senderID !== session.userID) return;
	const rep = normaliserTexte(event.body);
	const u = await loadUser(usersData, event.senderID);

	if (rep === "indice") {
		if (u.karma < 5) {
			await message.reply("❌ Karma insuffisant pour recevoir un indice (5 requis).");
			return;
		}
		u.karma -= 5;
		await saveUser(usersData, event.senderID, u);
		await message.reply(`💡 Indice : ${session.enigme.indice}\n⚖️ Karma -5 → ${u.karma}`);
		return;
	}

	const bonnesReponses = session.enigme.r.map(normaliserTexte);
	if (bonnesReponses.includes(rep)) {
		u.stats.enigmesResolues++;
		u.stats.propheties++;
		ajouterXp(u, 45);
		u.or += 30;
		u.karma += 3;
		pushHistorique(u, "enigme", "Énigme résolue avec succès.");
		const nouveaux = verifierSucces(u);
		await saveUser(usersData, event.senderID, u);
		SESSIONS.delete(event.messageReply.messageID);

		let texte = `${fonts.bold("✅ RÉPONSE JUSTE !")}\n${LINE}\n` +
			`L'oracle acquiesce : "${session.enigme.r[0]}" était la vérité cachée.\n` +
			`✨ XP +45 | 💰 Ambre +30 | ⚖️ Karma +3\n`;
		if (nouveaux.length) texte += `${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;
		return message.reply(texte);
	} else {
		return message.reply(`❌ Ce n'est pas la réponse que cherche l'oracle. Réessayez, ou tapez "indice".`);
	}
}

async function traiterMastermind(session, { message, event, usersData, api }) {
	if (event.senderID !== session.userID) return;
	const rep = normaliserTexte(event.body);

	if (rep === "abandon") {
		const codeTxt = session.code.map(id => runeById(id).nom).join(", ");
		SESSIONS.delete(event.messageReply.messageID);
		return message.reply(`🏳️ Abandon. Le code sacré était : ${codeTxt}.`);
	}

	const mots = rep.split(/\s+/).filter(Boolean);
	if (mots.length !== session.longueur) {
		return message.reply(`❌ Il faut exactement ${session.longueur} noms de runes séparés par des espaces.`);
	}
	const ids = mots.map(m => {
		const found = CODE_RUNES_POOL.find(r => r.id === m || r.nom.toLowerCase() === m);
		return found ? found.id : null;
	});
	if (ids.includes(null)) {
		return message.reply(`❌ Rune inconnue dans votre essai. Runes valides : ${CODE_RUNES_POOL.map(r => r.nom).join(", ")}.`);
	}

	const res = evaluerCode(session.code, ids);
	session.historique.push({ essai: ids, res });

	const u = await loadUser(usersData, event.senderID);

	if (res.sceaux === session.longueur) {
		u.stats.codesResolus++;
		if (session.historique.length === 1) u.stats.codesParfaits++;
		const gain = Math.max(20, 150 - session.historique.length * 12);
		ajouterXp(u, gain);
		u.or += gain;
		u.karma += 2;
		pushHistorique(u, "code", `Code runique cassé en ${session.historique.length} tentative(s).`);
		const nouveaux = verifierSucces(u);
		await saveUser(usersData, event.senderID, u);
		SESSIONS.delete(event.messageReply.messageID);

		let texte = `${fonts.bold("🔓 CODE PERCÉ !")}\n${LINE}\n` +
			`Sceau brisé en ${session.historique.length} tentative(s).\n✨ XP +${gain} | 💰 Ambre +${gain} | ⚖️ Karma +2\n`;
		if (nouveaux.length) texte += `${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;
		const buffer = await renderMastermind(session.historique, session.longueur, "Consultant", session.tentativeMax).catch(() => null);
		return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
	}

	if (session.historique.length >= session.tentativeMax) {
		const codeTxt = session.code.map(id => runeById(id).nom).join(", ");
		SESSIONS.delete(event.messageReply.messageID);
		const texte = `${fonts.bold("💀 ÉCHEC DU RITUEL")}\n${LINE}\nVous avez épuisé vos ${session.tentativeMax} tentatives.\nLe code sacré était : ${codeTxt}.`;
		const buffer = await renderMastermind(session.historique, session.longueur, "Consultant", session.tentativeMax).catch(() => null);
		return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
	}

	// Continue : renvoyer un message + garder la session sur le nouveau messageID
	const texte = `${fonts.bold(`SCEAUX: ${res.sceaux} | ECHOS: ${res.echos}`)}\n` +
		`Tentative ${session.historique.length}/${session.tentativeMax}. Répondez avec votre prochain essai.`;
	const buffer = await renderMastermind(session.historique, session.longueur, "Consultant", session.tentativeMax).catch(() => null);
	const sent = await envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
	SESSIONS.delete(event.messageReply.messageID);
	if (sent && sent.messageID) SESSIONS.set(sent.messageID, session);
	return;
}

async function traiterDuel(session, { message, event, usersData, api }) {
	if (event.senderID !== session.userID) return;
	const u = await loadUser(usersData, event.senderID);
	const enigmeActuelle = session.enigmes[session.round];
	const rep = normaliserTexte(event.body);
	const bonnesReponses = enigmeActuelle.r.map(normaliserTexte);
	const userACorrect = bonnesReponses.includes(rep);

	// Le PNJ répond avec une probabilité liée à sa difficulté
	const pnjACorrect = Math.random() < session.pnj.diff;

	let logRound = "";
	if (userACorrect && !pnjACorrect) {
		session.scoreUser++;
		logRound = `✅ Vous trouvez la réponse avant ${session.pnj.nom} !`;
	} else if (!userACorrect && pnjACorrect) {
		if (u.buffs.shield_duel && u.buffs.shield_duel > Date.now() && !session.shieldUsed) {
			session.shieldUsed = true;
			delete u.buffs.shield_duel;
			logRound = `🛡️ Votre bouclier absorbe l'échec ! Round neutralisé.`;
		} else {
			session.scorePnj++;
			logRound = `❌ ${session.pnj.nom} devine avant vous...`;
		}
	} else if (userACorrect && pnjACorrect) {
		session.scoreUser++;
		logRound = `⚡ Égalité de vitesse, mais votre réponse est validée en premier !`;
	} else {
		logRound = `🤝 Aucun des deux n'a trouvé. Round nul.`;
	}

	session.round++;

	if (session.scoreUser >= session.scoreMax || session.scorePnj >= session.scoreMax || session.round >= session.enigmes.length) {
		const victoire = session.scoreUser > session.scorePnj;
		SESSIONS.delete(event.messageReply.messageID);
		if (victoire) {
			u.stats.duelsGagnes++;
			if (!u.stats.pnjBattus.includes(session.pnj.id)) u.stats.pnjBattus.push(session.pnj.id);
			ajouterXp(u, session.pnj.recXp);
			u.or += session.pnj.recOr;
			u.karma += 2;
		} else {
			u.stats.duelsPerdus++;
			u.karma -= 1;
			ajouterXp(u, Math.floor(session.pnj.recXp * 0.3));
		}
		pushHistorique(u, "duel", `Duel contre ${session.pnj.nom} : ${victoire ? "Victoire" : "Défaite"} (${session.scoreUser}-${session.scorePnj}).`);
		const nouveaux = verifierSucces(u);
		await saveUser(usersData, event.senderID, u);

		let texte = `${fonts.bold(logRound)}\n${LINE}\n${fonts.bold(victoire ? "🏆 VICTOIRE !" : "💀 DÉFAITE")}\n` +
			`Score final : Vous ${session.scoreUser} - ${session.scorePnj} ${session.pnj.nom}\n`;
		if (victoire) texte += `✨ XP +${session.pnj.recXp} | 💰 Ambre +${session.pnj.recOr} | ⚖️ Karma +2\n`;
		else texte += `✨ XP +${Math.floor(session.pnj.recXp * 0.3)} (consolation) | ⚖️ Karma -1\n`;
		if (nouveaux.length) texte += `${LINE}\n🏆 Succès débloqués : ${nouveaux.map(s => s.nom).join(", ")}`;

		const buffer = await renderDuel(session, "Vous", session.pnj.nom, logRound).catch(() => null);
		return envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
	}

	await saveUser(usersData, event.senderID, u);
	const prochaine = session.enigmes[session.round];
	const texte = `${fonts.bold(logRound)}\n${LINE}\nScore : Vous ${session.scoreUser} - ${session.scorePnj} ${session.pnj.nom}\n${LINE_S}\n` +
		`${fonts.bold(`Round ${session.round + 1}`)} :\n${prochaine.q}\n${LINE_S}\n💬 Répondez pour continuer.`;
	const buffer = await renderDuel(session, "Vous", session.pnj.nom, logRound).catch(() => null);
	const sent = await envoyerAvecImage(api, event.threadID, texte, buffer, event.messageID);
	SESSIONS.delete(event.messageReply.messageID);
	if (sent && sent.messageID) SESSIONS.set(sent.messageID, session);
	return;
}

// ═══════════════════════════════════════════════════════════════════════
// § 13. EXPORT GOAT-BOT V2
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
	config: {
		name: "oracle",
		aliases: ["runes", "oracledesrunes", "futhark"],
		version: "1.0",
		author: "Christus",
		countDown: 5,
		role: 0,
		shortDescription: {
			fr: "Oracle des Runes : tirages, énigmes, casse-code et duels divinatoires"
		},
		longDescription: {
			fr: "Un jeu complet d'oracle runique : tirages du Futhark, prophéties et énigmes de réflexion, casse-code logique (mastermind runique), rituels, karma, arbre de dons communautaire, duels d'énigmes contre des PNJ, succès, classement et bénédiction quotidienne. Rendu en canvas façon vitrail gothique."
		},
		category: "jeu",
		guide: {
			fr: "{pn} tirage [1-5] | {pn} prophetie | {pn} code | {pn} rituel [id] | {pn} don [montant] | {pn} duel [pnj] | {pn} daily | {pn} profil | {pn} grimoire | {pn} succes | {pn} classement | {pn} aide"
		}
	},

	onStart: async function ({ message, event, args, api, usersData, threadsData, commandName }) {
		try {
			const sub = (args[0] || "").toLowerCase();
			const prefix = global.GoatBot?.config?.prefix || "/";

			switch (sub) {
				case "tirage":
				case "tirer":
					return await cmdTirage({ message, event, args, api, usersData, threadsData, commandName });
				case "prophetie":
				case "prophétie":
				case "enigme":
				case "énigme":
					return await cmdProphetie({ message, event, api, usersData });
				case "code":
				case "mastermind":
				case "castecode":
				case "cassecode":
					return await cmdCode({ message, event, args, api, usersData });
				case "rituel":
				case "rituels":
					return await cmdRituel({ message, event, args, api, usersData });
				case "don":
				case "donner":
					return await cmdDon({ message, event, args, api, usersData, threadsData });
				case "duel":
				case "défi":
				case "defi":
					return await cmdDuel({ message, event, args, api, usersData });
				case "daily":
				case "quotidien":
					return await cmdDaily({ message, event, api, usersData });
				case "profil":
				case "sceau":
				case "dashboard":
					return await cmdProfil({ message, event, api, usersData, threadsData });
				case "grimoire":
					return await cmdGrimoire({ message, event, usersData });
				case "succes":
				case "succès":
				case "achievements":
					return await cmdSucces({ message, event, usersData });
				case "classement":
				case "top":
				case "leaderboard":
					return await cmdClassement({ message, event, api, usersData });
				case "aide":
				case "help":
				case "":
					return message.reply(texteAide(prefix));
				default:
					return message.reply(`❓ Sous-commande inconnue "${args[0]}".\n${texteAide(prefix)}`);
			}
		} catch (err) {
			console.error("[oracle.js] Erreur onStart:", err);
			return message.reply("⚠️ Une brume magique a perturbé l'oracle. Réessayez plus tard.");
		}
	},

	onReply: async function ({ message, event, api, usersData, threadsData, Reply }) {
		try {
			const replyID = event.messageReply?.messageID;
			if (!replyID) return;
			const session = SESSIONS.get(replyID);
			if (!session) return;
			if (session.expire && session.expire < Date.now()) {
				SESSIONS.delete(replyID);
				return message.reply("⌛ Cette session divinatoire a expiré.");
			}

			switch (session.type) {
				case "enigme":
					return await traiterEnigme(session, { message, event, usersData, api });
				case "mastermind":
					return await traiterMastermind(session, { message, event, usersData, api });
				case "duel":
					return await traiterDuel(session, { message, event, usersData, api });
				default:
					return;
			}
		} catch (err) {
			console.error("[oracle.js] Erreur onReply:", err);
			return message.reply("⚠️ L'oracle a perdu le fil de sa vision. Recommencez.");
		}
	}
};
