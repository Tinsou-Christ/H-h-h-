/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  🌊 CITÉ ABYSSALE — abyssal.js
 * ───────────────────────────────────────────────────────────────────────────
 *  Commande Goat-Bot V2 — exploration sous-marine par paliers de profondeur.
 *  Auteur : Christus
 *
 *  Concept :
 *   - Le joueur pilote un sous-marin depuis la surface jusqu'aux abysses
 *     à la recherche de la légendaire Cité Abyssale engloutie.
 *   - Chaque palier de profondeur augmente la pression et consomme
 *     l'oxygène embarqué. Il faut gérer ces ressources sous peine
 *     d'implosion ou d'asphyxie.
 *   - Un sonar (rendu en canvas façon "carte marine") révèle des échos :
 *     épaves à fouiller, créatures abyssales hostiles, failles hydrothermales.
 *   - Les créatures abyssales se combattent au tour par tour (moteur inspiré
 *     de naruto-storm.js : PV, énergie/oxygène de combat, techniques, esquive,
 *     critique, statuts).
 *   - Des tablettes de pierre englouties contiennent des énigmes logiques
 *     (séquences, chiffrement, déduction) résolues via onReply.
 *   - Une ferme d'aquaculture abyssale génère des ressources passives.
 *   - Le sous-marin peut être amélioré (coque, moteur, réserve d'oxygène,
 *     portée sonar, soute).
 *
 *  Direction artistique canvas : "carte marine / sonar" — bathymétrie en
 *  courbes de niveau, écho radar tournant, trames de points façon papier
 *  d'écho-sondeur, palette bleu-vert monochrome. AUCUN emoji dans le canvas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

"use strict";

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const fonts = require("../../func/font.js");

let loadImage, createCanvas, registerFont;
let CANVAS_OK = false;
try {
  const cv = require("canvas");
  loadImage = cv.loadImage;
  createCanvas = cv.createCanvas;
  registerFont = cv.registerFont;
  CANVAS_OK = true;
} catch (e) {
  console.error("[abyssal.js] canvas indisponible, fallback texte :", e.message);
}

let FONTS_LOADED = false;
function ensureFonts() {
  if (FONTS_LOADED || !CANVAS_OK || !registerFont) return;
  FONTS_LOADED = true;
  try {
    const fd = path.join(__dirname, "assets", "font");
    if (!fs.existsSync(fd)) return;
    const list = [
      ["BeVietnamPro-Bold.ttf", "SONAR", "bold"],
      ["BeVietnamPro-Regular.ttf", "SONAR", "normal"],
      ["BeVietnamPro-SemiBold.ttf", "SONAR", "600"],
      ["NotoSans-Bold.ttf", "SONAR2", "bold"],
      ["NotoSans-Regular.ttf", "SONAR2", "normal"],
    ];
    for (const [file, fam, weight] of list) {
      const fp = path.join(fd, file);
      if (fs.existsSync(fp)) {
        try { registerFont(fp, { family: fam, weight }); } catch (_) {}
      }
    }
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════════════════
 *  I. TABLES DE DONNÉES — PALIERS DE PROFONDEUR
 * ═══════════════════════════════════════════════════════════════════════ */

const DEPTH_ZONES = [
  { id: "epipelagique", nom: "Zone Épipélagique", min: 0, max: 200, pression: 1, o2drain: 1, danger: 1,
    couleur: "#2E7D6B", description: "Eaux baignées de lumière, proche de la surface." },
  { id: "mesopelagique", nom: "Zone Mésopélagique", min: 200, max: 1000, pression: 2, o2drain: 2, danger: 2,
    couleur: "#1F6E8C", description: "Le crépuscule océanique, lumière déclinante." },
  { id: "bathypelagique", nom: "Zone Bathypélagique", min: 1000, max: 4000, pression: 4, o2drain: 3, danger: 4,
    couleur: "#154B72", description: "Nuit perpétuelle, pression écrasante." },
  { id: "abyssopelagique", nom: "Zone Abyssopélagique", min: 4000, max: 6000, pression: 7, o2drain: 4, danger: 6,
    couleur: "#0F3357", description: "Plaines abyssales, silence minéral." },
  { id: "hadal", nom: "Zone Hadale", min: 6000, max: 11000, pression: 11, o2drain: 6, danger: 9,
    couleur: "#0A2440", description: "Fosses hadales, aux confins du possible." },
  { id: "cite", nom: "Seuil de la Cité Abyssale", min: 11000, max: 14000, pression: 15, o2drain: 8, danger: 12,
    couleur: "#081A33", description: "Les ruines englouties de la cité perdue." },
];

function getZoneForDepth(depth) {
  for (let i = DEPTH_ZONES.length - 1; i >= 0; i--) {
    if (depth >= DEPTH_ZONES[i].min) return DEPTH_ZONES[i];
  }
  return DEPTH_ZONES[0];
}

/* ═══════════════════════════════════════════════════════════════════════
 *  II. CRÉATURES ABYSSALES (combat tour par tour)
 * ═══════════════════════════════════════════════════════════════════════ */

const TECHNIQUES = {
  morsure: { nom: "Morsure Profonde", cout: 0, degats: [8, 16], precision: 0.90, crit: 0.10 },
  griffe: { nom: "Lacération Abyssale", cout: 0, degats: [10, 18], precision: 0.85, crit: 0.15 },
  jet_encre: { nom: "Jet d'Encre Noire", cout: 10, degats: [4, 10], precision: 0.95, crit: 0.05, statut: { type: "aveugle", tours: 2, effet: -0.25 } },
  decharge: { nom: "Décharge Bioélectrique", cout: 15, degats: [14, 22], precision: 0.80, crit: 0.20, statut: { type: "paralysie", tours: 1, effet: 0.5 } },
  implosion: { nom: "Onde d'Implosion", cout: 25, degats: [20, 34], precision: 0.70, crit: 0.25 },
  regeneration: { nom: "Régénération Cellulaire", cout: 20, soin: [15, 25] },
  venin: { nom: "Piqûre Venimeuse", cout: 12, degats: [6, 12], precision: 0.90, crit: 0.08, statut: { type: "poison", tours: 3, effet: 6 } },
  sonar_choc: { nom: "Choc Sonique", cout: 18, degats: [12, 20], precision: 0.75, crit: 0.15, statut: { type: "etourdi", tours: 1, effet: 1 } },
  broyage: { nom: "Broyage de Mâchoires", cout: 22, degats: [18, 30], precision: 0.72, crit: 0.22 },
  camouflage: { nom: "Camouflage Bioluminescent", cout: 16, esquiveBonus: 0.35, tours: 2 },
};

const CREATURES = [
  { id: "meduse_spectrale", nom: "Méduse Spectrale", zone: "epipelagique", pv: 60, energie: 40, atk: 8, def: 3,
    techniques: ["morsure", "jet_encre"], loot: [{ item: "tentacule_luminescente", chance: 0.6 }, { item: "perle_trouble", chance: 0.2 }],
    xp: 25, argent: [40, 90] },
  { id: "requin_lanterne", nom: "Requin-Lanterne", zone: "epipelagique", pv: 85, energie: 45, atk: 11, def: 5,
    techniques: ["morsure", "griffe", "sonar_choc"], loot: [{ item: "dent_luminescente", chance: 0.5 }, { item: "peau_phosphorescente", chance: 0.25 }],
    xp: 40, argent: [60, 120] },
  { id: "calmar_geant", nom: "Calmar Géant des Brumes", zone: "mesopelagique", pv: 140, energie: 60, atk: 14, def: 7,
    techniques: ["griffe", "jet_encre", "broyage"], loot: [{ item: "encre_noire", chance: 0.55 }, { item: "bec_corne", chance: 0.3 }],
    xp: 70, argent: [90, 180] },
  { id: "anguille_electrique", nom: "Anguille Électrique des Failles", zone: "mesopelagique", pv: 110, energie: 70, atk: 16, def: 4,
    techniques: ["decharge", "morsure"], loot: [{ item: "organe_electrique", chance: 0.45 }, { item: "ecaille_conductrice", chance: 0.3 }],
    xp: 80, argent: [100, 190] },
  { id: "poisson_vipere", nom: "Poisson-Vipère Ancestral", zone: "bathypelagique", pv: 160, energie: 65, atk: 19, def: 8,
    techniques: ["morsure", "venin", "broyage"], loot: [{ item: "croc_vipere", chance: 0.4 }, { item: "venin_concentre", chance: 0.35 }],
    xp: 130, argent: [150, 260] },
  { id: "kraken_juvenile", nom: "Kraken Juvénile", zone: "bathypelagique", pv: 230, energie: 90, atk: 22, def: 12,
    techniques: ["griffe", "broyage", "implosion", "camouflage"], loot: [{ item: "ventouse_krakenne", chance: 0.4 }, { item: "cristal_abyssal", chance: 0.15 }],
    xp: 210, argent: [220, 400] },
  { id: "isopode_geant", nom: "Isopode Géant Cuirassé", zone: "abyssopelagique", pv: 260, energie: 50, atk: 18, def: 20,
    techniques: ["broyage", "morsure"], loot: [{ item: "carapace_cuirassee", chance: 0.5 }, { item: "chitine_abyssale", chance: 0.3 }],
    xp: 190, argent: [180, 300] },
  { id: "ver_tube", nom: "Ver Tubicole des Fumeurs Noirs", zone: "abyssopelagique", pv: 190, energie: 55, atk: 15, def: 14,
    techniques: ["venin", "regeneration"], loot: [{ item: "tube_chitineux", chance: 0.45 }, { item: "soufre_cristallise", chance: 0.35 }],
    xp: 170, argent: [160, 290] },
  { id: "leviathan_larvaire", nom: "Léviathan Larvaire", zone: "hadal", pv: 340, energie: 110, atk: 27, def: 16,
    techniques: ["implosion", "decharge", "broyage", "sonar_choc"], loot: [{ item: "ecaille_leviathan", chance: 0.35 }, { item: "coeur_abyssal", chance: 0.1 }],
    xp: 320, argent: [300, 520] },
  { id: "araignee_mer", nom: "Araignée de Mer Colossale", zone: "hadal", pv: 300, energie: 80, atk: 24, def: 18,
    techniques: ["griffe", "venin", "camouflage"], loot: [{ item: "patte_articulee", chance: 0.4 }, { item: "venin_noir", chance: 0.25 }],
    xp: 280, argent: [260, 470] },
  { id: "gardien_hadal", nom: "Gardien Hadal", zone: "hadal", pv: 380, energie: 120, atk: 29, def: 22,
    techniques: ["implosion", "broyage", "sonar_choc", "regeneration"], loot: [{ item: "fragment_gardien", chance: 0.3 }, { item: "sceau_hadal", chance: 0.12 }],
    xp: 400, argent: [350, 600] },
  { id: "sentinelle_cite", nom: "Sentinelle de la Cité Engloutie", zone: "cite", pv: 480, energie: 140, atk: 33, def: 24,
    techniques: ["implosion", "decharge", "broyage", "camouflage"], loot: [{ item: "alliage_cite", chance: 0.3 }, { item: "rune_engloutie", chance: 0.18 }],
    xp: 520, argent: [420, 700] },
  { id: "archiviste_abysse", nom: "Archiviste des Abysses", zone: "cite", pv: 440, energie: 160, atk: 30, def: 20,
    techniques: ["sonar_choc", "regeneration", "venin", "implosion"], loot: [{ item: "tablette_fragmentee", chance: 0.4 }, { item: "encre_ancestrale", chance: 0.2 }],
    xp: 560, argent: [450, 750] },
  { id: "titan_des_failles", nom: "Titan des Failles Hydrothermales", zone: "cite", pv: 620, energie: 180, atk: 38, def: 28,
    techniques: ["implosion", "broyage", "decharge", "regeneration"], loot: [{ item: "coeur_hydrothermal", chance: 0.25 }, { item: "cristal_titan", chance: 0.15 }],
    xp: 700, argent: [600, 950] },
  { id: "reine_abyssale", nom: "Reine Abyssale, Gardienne du Trône Englouti", zone: "cite", pv: 900, energie: 220, atk: 44, def: 32,
    techniques: ["implosion", "decharge", "broyage", "venin", "camouflage"], loot: [{ item: "couronne_abyssale", chance: 0.2 }, { item: "perle_reine", chance: 0.5 }],
    xp: 1200, argent: [900, 1500], boss: true },
];

function creaturesForZone(zoneId) {
  return CREATURES.filter(c => c.zone === zoneId);
}

/* ═══════════════════════════════════════════════════════════════════════
 *  III. ÉPAVES, LOOT ET AQUACULTURE
 * ═══════════════════════════════════════════════════════════════════════ */

const WRECK_TYPES = [
  { id: "chalutier", nom: "Chalutier Rouillé", zoneMin: "epipelagique", loot: [
      { item: "ferraille", qte: [2, 5], chance: 0.9 }, { item: "filet_dechire", qte: [1, 2], chance: 0.5 },
      { item: "boite_conserve_ancienne", qte: [1, 3], chance: 0.4 } ] },
  { id: "galion", nom: "Galion Englouti", zoneMin: "mesopelagique", loot: [
      { item: "piece_or_ancienne", qte: [1, 6], chance: 0.6 }, { item: "canon_corrode", qte: [1, 1], chance: 0.2 },
      { item: "coffre_scelle", qte: [1, 1], chance: 0.15 } ] },
  { id: "sous_marin_militaire", nom: "Sous-Marin Militaire Abandonné", zoneMin: "bathypelagique", loot: [
      { item: "alliage_titane", qte: [1, 4], chance: 0.55 }, { item: "puce_electronique", qte: [1, 3], chance: 0.35 },
      { item: "torpille_desamorcee", qte: [1, 1], chance: 0.1 } ] },
  { id: "cargo_industriel", nom: "Cargo Industriel Fantôme", zoneMin: "bathypelagique", loot: [
      { item: "conteneur_scelle", qte: [1, 2], chance: 0.4 }, { item: "minerai_brut", qte: [3, 8], chance: 0.7 } ] },
  { id: "station_recherche", nom: "Station de Recherche Coulée", zoneMin: "abyssopelagique", loot: [
      { item: "journal_bord", qte: [1, 1], chance: 0.3 }, { item: "echantillon_biologique", qte: [1, 3], chance: 0.5 },
      { item: "module_sonar", qte: [1, 1], chance: 0.15 } ] },
  { id: "temple_englouti", nom: "Temple Pré-Cité Englouti", zoneMin: "hadal", loot: [
      { item: "tablette_pierre", qte: [1, 1], chance: 0.5 }, { item: "statuette_rituelle", qte: [1, 2], chance: 0.25 },
      { item: "fragment_or_hadal", qte: [1, 3], chance: 0.3 } ] },
  { id: "ruine_cite", nom: "Ruine Périphérique de la Cité Abyssale", zoneMin: "cite", loot: [
      { item: "alliage_cite", qte: [1, 3], chance: 0.4 }, { item: "rune_engloutie", qte: [1, 2], chance: 0.25 },
      { item: "reliquaire_royal", qte: [1, 1], chance: 0.08 } ] },
];

const ITEM_LABELS = {
  ferraille: "Ferraille récupérée", filet_dechire: "Filet déchiré", boite_conserve_ancienne: "Boîte de conserve ancienne",
  piece_or_ancienne: "Pièce d'or ancienne", canon_corrode: "Canon corrodé", coffre_scelle: "Coffre scellé",
  alliage_titane: "Alliage de titane", puce_electronique: "Puce électronique", torpille_desamorcee: "Torpille désamorcée",
  conteneur_scelle: "Conteneur scellé", minerai_brut: "Minerai brut", journal_bord: "Journal de bord",
  echantillon_biologique: "Échantillon biologique", module_sonar: "Module sonar", tablette_pierre: "Tablette de pierre",
  statuette_rituelle: "Statuette rituelle", fragment_or_hadal: "Fragment d'or hadal", alliage_cite: "Alliage de la Cité",
  rune_engloutie: "Rune engloutie", reliquaire_royal: "Reliquaire royal", tentacule_luminescente: "Tentacule luminescente",
  perle_trouble: "Perle trouble", dent_luminescente: "Dent luminescente", peau_phosphorescente: "Peau phosphorescente",
  encre_noire: "Encre noire", bec_corne: "Bec corné", organe_electrique: "Organe électrique",
  ecaille_conductrice: "Écaille conductrice", croc_vipere: "Croc de vipère", venin_concentre: "Venin concentré",
  ventouse_krakenne: "Ventouse krakenne", cristal_abyssal: "Cristal abyssal", carapace_cuirassee: "Carapace cuirassée",
  chitine_abyssale: "Chitine abyssale", tube_chitineux: "Tube chitineux", soufre_cristallise: "Soufre cristallisé",
  ecaille_leviathan: "Écaille de léviathan", coeur_abyssal: "Cœur abyssal", patte_articulee: "Patte articulée",
  venin_noir: "Venin noir", fragment_gardien: "Fragment de gardien", sceau_hadal: "Sceau hadal",
  tablette_fragmentee: "Tablette fragmentée", encre_ancestrale: "Encre ancestrale", coeur_hydrothermal: "Cœur hydrothermal",
  cristal_titan: "Cristal du titan", couronne_abyssale: "Couronne abyssale", perle_reine: "Perle de la reine",
  larve_luminescente: "Larve luminescente (aquaculture)", algue_phosphorescente: "Algue phosphorescente (aquaculture)",
  huitre_perliere: "Huître perlière (aquaculture)", crevette_geante: "Crevette géante (aquaculture)",
};

/* ═══════════════════════════════════════════════════════════════════════
 *  IV. SOUS-MARIN — AMÉLIORATIONS
 * ═══════════════════════════════════════════════════════════════════════ */

const SUB_UPGRADES = {
  coque: [
    { niveau: 0, nom: "Coque Standard", resistancePression: 1000, cout: 0 },
    { niveau: 1, nom: "Coque Renforcée Acier", resistancePression: 3000, cout: 800 },
    { niveau: 2, nom: "Coque Titane Composite", resistancePression: 6500, cout: 2200 },
    { niveau: 3, nom: "Coque Alliage Abyssal", resistancePression: 11000, cout: 5200 },
    { niveau: 4, nom: "Coque Céramique Hadale", resistancePression: 14500, cout: 11000 },
  ],
  moteur: [
    { niveau: 0, nom: "Moteur Diesel-Électrique", vitesse: 1, cout: 0 },
    { niveau: 1, nom: "Moteur à Propulsion Hybride", vitesse: 2, cout: 700 },
    { niveau: 2, nom: "Moteur Nucléaire Compact", vitesse: 3, cout: 2000 },
    { niveau: 3, nom: "Moteur à Réaction Biomécanique", vitesse: 4, cout: 4800 },
  ],
  reservoir: [
    { niveau: 0, nom: "Réservoir O2 Basique", capacite: 100, cout: 0 },
    { niveau: 1, nom: "Réservoir O2 Étendu", capacite: 160, cout: 600 },
    { niveau: 2, nom: "Réservoir O2 Cryogénique", capacite: 240, cout: 1600 },
    { niveau: 3, nom: "Réservoir O2 à Recyclage", capacite: 340, cout: 3600 },
    { niveau: 4, nom: "Réservoir O2 Bio-Symbiotique", capacite: 460, cout: 8000 },
  ],
  sonar: [
    { niveau: 0, nom: "Sonar Passif", portee: 3, cout: 0 },
    { niveau: 1, nom: "Sonar Actif Longue Portée", portee: 5, cout: 900 },
    { niveau: 2, nom: "Sonar Multifaisceaux", portee: 7, cout: 2400 },
    { niveau: 3, nom: "Sonar Quantique Expérimental", portee: 10, cout: 5500 },
  ],
  soute: [
    { niveau: 0, nom: "Soute Réduite", capacite: 20, cout: 0 },
    { niveau: 1, nom: "Soute Standard", capacite: 40, cout: 500 },
    { niveau: 2, nom: "Soute Élargie", capacite: 70, cout: 1400 },
    { niveau: 3, nom: "Soute Modulaire", capacite: 120, cout: 3200 },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════
 *  V. TABLETTES ENGLOUTIES — ÉNIGMES LOGIQUES (onReply)
 * ═══════════════════════════════════════════════════════════════════════ */

const TABLET_RIDDLES = [
  { id: "seq1", texte: "Une tablette gravée montre une suite : 2, 6, 12, 20, 30, ? — Quel est le nombre manquant ?",
    reponse: "42", indice: "Différences successives : 4, 6, 8, 10... (n(n+1))" },
  { id: "seq2", texte: "Gravure : 1, 1, 2, 3, 5, 8, 13, ? — Complétez la séquence sacrée des abysses.",
    reponse: "21", indice: "Suite de Fibonacci." },
  { id: "chiffre1", texte: "Un code runique décalé : chaque lettre du mot MER a été décalée de +3 dans l'alphabet, donnant PHU. Déchiffrez OLW en appliquant le décalage inverse (-3).",
    reponse: "LIT", indice: "Chiffre de César, décalage de 3 vers l'arrière." },
  { id: "logique1", texte: "Trois gardiens de pierre : le premier ment toujours, le second dit toujours vrai, le troisième alterne. Le premier affirme 'Je ne suis pas le menteur'. Qui ment toujours ? Répondez par 1, 2 ou 3.",
    reponse: "1", indice: "Si le premier disait vrai, il ne serait pas le menteur — contradiction immédiate." },
  { id: "poids1", texte: "Une balance abyssale : 3 perles rouges pèsent autant que 5 perles bleues. 2 perles bleues pèsent autant que 4 perles vertes. Combien de perles vertes équivalent à 3 perles rouges ?",
    reponse: "10", indice: "3 rouges = 5 bleues = 10 vertes (1 bleue = 2 vertes)." },
  { id: "seq3", texte: "Gravure spirale : 3, 9, 27, 81, ? — Quel nombre complète la spirale ?",
    reponse: "243", indice: "Chaque terme est multiplié par 3." },
  { id: "logique2", texte: "Une porte hadale s'ouvre si la somme des chiffres du code est un multiple de 9. Le code partiel est 4_28 où _ est un chiffre. Quel chiffre manque (le plus petit possible) ?",
    reponse: "5", indice: "4+2+8=14, il faut ajouter 5 pour atteindre 18 (bien un multiple de 9), plus petit possible." },
  { id: "chiffre2", texte: "Message codé en binaire retrouvé sur une plaque : 01000001 01000010 01011001 01010011 01010011 01000101 — Convertissez en texte (lettres ASCII majuscules).",
    reponse: "ABYSSE", indice: "Chaque octet est un code ASCII. 01000001=A, 01000010=B, etc." },
  { id: "seq4", texte: "Suite de la Cité : 5, 11, 23, 47, ? — Trouvez le nombre suivant.",
    reponse: "95", indice: "Chaque terme = terme précédent * 2 + 1." },
  { id: "logique3", texte: "Quatre statues sont alignées. La rouge est immédiatement à gauche de la bleue. La verte est à l'extrémité droite. La jaune n'est pas à côté de la rouge. Dans quel ordre (gauche à droite, initiales) sont-elles ?",
    reponse: "JRBV", indice: "Testez les permutations en respectant chaque contrainte une à une." },
];

function pickRiddle() {
  return TABLET_RIDDLES[Math.floor(Math.random() * TABLET_RIDDLES.length)];
}

/* ═══════════════════════════════════════════════════════════════════════
 *  VI. AQUACULTURE ABYSSALE
 * ═══════════════════════════════════════════════════════════════════════ */

const AQUACULTURE_SLOTS = [
  { id: "larves", nom: "Bassin de Larves Luminescentes", item: "larve_luminescente", tempsMs: 20 * 60 * 1000, rendement: [3, 6], coutDeblocage: 0 },
  { id: "algues", nom: "Champ d'Algues Phosphorescentes", item: "algue_phosphorescente", tempsMs: 35 * 60 * 1000, rendement: [4, 9], coutDeblocage: 400 },
  { id: "huitres", nom: "Ferme d'Huîtres Perlières", item: "huitre_perliere", tempsMs: 60 * 60 * 1000, rendement: [1, 4], coutDeblocage: 1200 },
  { id: "crevettes", nom: "Élevage de Crevettes Géantes", item: "crevette_geante", tempsMs: 90 * 60 * 1000, rendement: [2, 5], coutDeblocage: 2600 },
];

/* ═══════════════════════════════════════════════════════════════════════
 *  VII. SUCCÈS (≥ 20)
 * ═══════════════════════════════════════════════════════════════════════ */

const ACHIEVEMENTS = [
  { id: "premiere_plongee", nom: "Première Immersion", desc: "Effectuer votre première plongée.", check: s => s.stats.plongees >= 1 },
  { id: "cent_metres", nom: "Cent Mètres", desc: "Atteindre 100 mètres de profondeur.", check: s => s.profondeurMax >= 100 },
  { id: "mille_metres", nom: "Le Crépuscule Bleu", desc: "Atteindre 1000 mètres.", check: s => s.profondeurMax >= 1000 },
  { id: "quatre_mille", nom: "Nuit Perpétuelle", desc: "Atteindre 4000 mètres.", check: s => s.profondeurMax >= 4000 },
  { id: "six_mille", nom: "Plaines Abyssales", desc: "Atteindre 6000 mètres.", check: s => s.profondeurMax >= 6000 },
  { id: "onze_mille", nom: "Fosse Hadale", desc: "Atteindre 11000 mètres.", check: s => s.profondeurMax >= 11000 },
  { id: "cite_perdue", nom: "La Cité Retrouvée", desc: "Atteindre le seuil de la Cité Abyssale.", check: s => s.profondeurMax >= 11000 },
  { id: "premiere_epave", nom: "Pilleur d'Épaves", desc: "Fouiller une première épave.", check: s => s.stats.epavesFouillees >= 1 },
  { id: "dix_epaves", nom: "Archéologue des Fonds", desc: "Fouiller 10 épaves.", check: s => s.stats.epavesFouillees >= 10 },
  { id: "cinquante_epaves", nom: "Maître Épaviste", desc: "Fouiller 50 épaves.", check: s => s.stats.epavesFouillees >= 50 },
  { id: "premiere_victoire", nom: "Premier Sang Abyssal", desc: "Remporter un premier combat.", check: s => s.stats.victoires >= 1 },
  { id: "dix_victoires", nom: "Chasseur des Profondeurs", desc: "Remporter 10 combats.", check: s => s.stats.victoires >= 10 },
  { id: "cinquante_victoires", nom: "Fléau Abyssal", desc: "Remporter 50 combats.", check: s => s.stats.victoires >= 50 },
  { id: "tueur_kraken", nom: "Tueur de Kraken", desc: "Vaincre un Kraken Juvénile.", check: s => s.stats.creaturesVaincues.includes("kraken_juvenile") },
  { id: "tueur_reine", nom: "Régicide des Abysses", desc: "Vaincre la Reine Abyssale.", check: s => s.stats.creaturesVaincues.includes("reine_abyssale") },
  { id: "premiere_tablette", nom: "Déchiffreur Novice", desc: "Résoudre une première énigme de tablette.", check: s => s.stats.tablettesResolues >= 1 },
  { id: "dix_tablettes", nom: "Sage des Abysses", desc: "Résoudre 10 énigmes de tablette.", check: s => s.stats.tablettesResolues >= 10 },
  { id: "sous_marin_niveau_max", nom: "Ingénieur Abyssal", desc: "Améliorer toutes les pièces du sous-marin au niveau maximum.", check: s => isSubMaxed(s) },
  { id: "aquaculteur", nom: "Aquaculteur Débutant", desc: "Récolter votre première ferme aquacole.", check: s => s.stats.recoltes >= 1 },
  { id: "aquaculteur_confirme", nom: "Aquaculteur Confirmé", desc: "Effectuer 25 récoltes aquacoles.", check: s => s.stats.recoltes >= 25 },
  { id: "millionnaire_abysse", nom: "Trésor des Profondeurs", desc: "Cumuler 10000 pièces gagnées dans le jeu.", check: s => s.stats.argentGagne >= 10000 },
  { id: "niveau_dix", nom: "Plongeur Aguerri", desc: "Atteindre le niveau 10.", check: s => s.niveau >= 10 },
  { id: "niveau_vingt_cinq", nom: "Capitaine des Abysses", desc: "Atteindre le niveau 25.", check: s => s.niveau >= 25 },
  { id: "niveau_cinquante", nom: "Légende Abyssale", desc: "Atteindre le niveau 50.", check: s => s.niveau >= 50 },
  { id: "survivant_implosion", nom: "Frôlé l'Implosion", desc: "Survivre avec moins de 5% d'oxygène restant.", check: s => s.stats.oxygeneCritiqueSurvecu >= 1 },
];

/* ═══════════════════════════════════════════════════════════════════════
 *  VIII. INITIALISATION / PERSISTANCE
 * ═══════════════════════════════════════════════════════════════════════ */

function initAbyss(user) {
  if (!user.data) user.data = {};
  if (!user.data.abyssal) user.data.abyssal = {};
  const s = user.data.abyssal;

  if (s.profondeur === undefined) s.profondeur = 0;
  if (s.profondeurMax === undefined) s.profondeurMax = 0;
  if (s.oxygene === undefined) s.oxygene = 100;
  if (s.niveau === undefined) s.niveau = 1;
  if (s.xp === undefined) s.xp = 0;
  if (s.pvActuel === undefined) s.pvActuel = 100;
  if (s.pvMax === undefined) s.pvMax = 100;
  if (!s.inventaire) s.inventaire = {};
  if (!s.sousMarin) s.sousMarin = { coque: 0, moteur: 0, reservoir: 0, sonar: 0, soute: 0 };
  if (!s.aquaculture) s.aquaculture = {};
  if (!s.succes) s.succes = [];
  if (!s.stats) s.stats = {};
  const statDefaults = {
    plongees: 0, epavesFouillees: 0, victoires: 0, defaites: 0, creaturesVaincues: [],
    tablettesResolues: 0, recoltes: 0, argentGagne: 0, oxygeneCritiqueSurvecu: 0, tour: 0,
  };
  for (const k of Object.keys(statDefaults)) if (s.stats[k] === undefined) s.stats[k] = statDefaults[k];
  if (!s.stats.creaturesVaincues) s.stats.creaturesVaincues = [];
  if (!s.historique) s.historique = [];
  if (s.dernierPlongeon === undefined) s.dernierPlongeon = 0;
  if (s.dernierDaily === undefined) s.dernierDaily = 0;
  if (!s.combat) s.combat = null;
  if (!s.tabletteEnCours) s.tabletteEnCours = null;
  if (s.grade === undefined) s.grade = "Recrue de Surface";
  return s;
}

function isSubMaxed(s) {
  for (const key of Object.keys(SUB_UPGRADES)) {
    const maxNiveau = SUB_UPGRADES[key].length - 1;
    if ((s.sousMarin[key] || 0) < maxNiveau) return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  IX. UTILITAIRES DE JEU
 * ═══════════════════════════════════════════════════════════════════════ */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function xpForLevel(level) { return Math.floor(80 * Math.pow(level, 1.55)); }

function addXp(s, amount) {
  s.xp += amount;
  let leveled = false;
  while (s.xp >= xpForLevel(s.niveau)) {
    s.xp -= xpForLevel(s.niveau);
    s.niveau++;
    s.pvMax += 12;
    s.pvActuel = s.pvMax;
    leveled = true;
  }
  return leveled;
}

const GRADES = [
  { min: 1, nom: "Recrue de Surface" }, { min: 5, nom: "Plongeur Certifié" },
  { min: 10, nom: "Pilote de Sous-Marin" }, { min: 18, nom: "Explorateur Bathyal" },
  { min: 28, nom: "Chasseur Abyssal" }, { min: 40, nom: "Capitaine Hadal" },
  { min: 55, nom: "Archonte des Profondeurs" }, { min: 75, nom: "Légende de la Cité Engloutie" },
];
function getGrade(niveau) {
  let g = GRADES[0];
  for (const gr of GRADES) if (niveau >= gr.min) g = gr;
  return g.nom;
}

function addItem(inv, id, qte) { inv[id] = (inv[id] || 0) + qte; }

function inventaireTotalCount(inv) {
  return Object.values(inv).reduce((a, b) => a + b, 0);
}

function soutCapacite(s) {
  return SUB_UPGRADES.soute[s.sousMarin.soute || 0].capacite;
}

function o2Capacite(s) {
  return SUB_UPGRADES.reservoir[s.sousMarin.reservoir || 0].capacite;
}

function resistancePression(s) {
  return SUB_UPGRADES.coque[s.sousMarin.coque || 0].resistancePression;
}

function porteeSonar(s) {
  return SUB_UPGRADES.sonar[s.sousMarin.sonar || 0].portee;
}

function formatBar(current, max, size = 20, fill = "#", empty = "-") {
  const ratio = clamp(current / max, 0, 1);
  const filled = Math.round(ratio * size);
  return fill.repeat(filled) + empty.repeat(size - filled);
}

function checkAchievements(s) {
  const nouveaux = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.succes.includes(a.id) && a.check(s)) {
      s.succes.push(a.id);
      nouveaux.push(a);
    }
  }
  return nouveaux;
}


/* ═══════════════════════════════════════════════════════════════════════
 *  X. MOTEUR DE COMBAT TOUR PAR TOUR (inspiré naruto-storm.js)
 * ═══════════════════════════════════════════════════════════════════════ */

function buildCombatState(s, creatureDef) {
  return {
    creatureId: creatureDef.id,
    joueur: { pv: s.pvActuel, pvMax: s.pvMax, energie: 100, energieMax: 100, statuts: [] },
    ennemi: { pv: creatureDef.pv, pvMax: creatureDef.pv, energie: creatureDef.energie, energieMax: creatureDef.energie, statuts: [] },
    log: [`Un(e) ${creatureDef.nom} surgit de l'obscurité liquide !`],
    tour: 1,
    fini: false,
    victoire: null,
  };
}

function statutActif(entite, type) { return entite.statuts.find(st => st.type === type); }

function appliquerStatutsDebutTour(entite, log, nom) {
  for (const st of [...entite.statuts]) {
    if (st.type === "poison") {
      entite.pv = Math.max(0, entite.pv - st.effet);
      log.push(`${nom} subit ${st.effet} dégâts de poison abyssal.`);
    }
    st.tours--;
  }
  entite.statuts = entite.statuts.filter(st => st.tours > 0);
}

function calculerDegats(base, def, statutsAttaquant, statutsDefenseur) {
  let [min, max] = base;
  let deg = randInt(min, max);
  deg = Math.max(1, deg - Math.floor(def * 0.4));
  if (statutActif(statutsDefenseur, "paralysie")) deg = Math.round(deg * 1.2);
  return deg;
}

function tourJoueur(combat, creatureDef, actionKey) {
  const j = combat.joueur, e = combat.ennemi, log = combat.log;
  if (statutActif(j.statuts, "etourdi")) {
    log.push("Vous êtes étourdi par le choc sonique et ne pouvez agir ce tour-ci !");
    return;
  }
  if (actionKey === "fuite") {
    log.push("Vous tentez de fuir vers la surface...");
    if (Math.random() < 0.55) { combat.fini = true; combat.victoire = "fuite"; log.push("Fuite réussie ! Vous regagnez les eaux plus sûres."); }
    else log.push("Impossible de fuir, la créature bloque le passage !");
    return;
  }
  if (actionKey === "attaque_basique") {
    let esquive = 0.08;
    if (statutActif(e.statuts, "camouflage")) esquive += 0.30;
    if (Math.random() < esquive) { log.push("Votre attaque manque sa cible dans l'obscurité !"); return; }
    let deg = calculerDegats([9, 17], 3, j.statuts, e.statuts);
    const crit = Math.random() < 0.12;
    if (crit) { deg = Math.round(deg * 1.6); log.push("COUP CRITIQUE ! "); }
    e.pv = Math.max(0, e.pv - deg);
    log.push(`Vous frappez avec votre harpon submersible pour ${deg} dégâts.`);
    return;
  }
  const tech = TECHNIQUES[actionKey];
  if (!tech) { log.push("Action inconnue, vous hésitez un instant."); return; }
  if (j.energie < tech.cout) { log.push("Énergie insuffisante pour cette technique !"); return; }
  j.energie -= tech.cout;
  if (tech.soin) {
    const soin = randInt(tech.soin[0], tech.soin[1]);
    j.pv = Math.min(j.pvMax, j.pv + soin);
    log.push(`Vous utilisez ${tech.nom} et récupérez ${soin} PV.`);
    return;
  }
  let esquive = 0.08 + (1 - tech.precision);
  if (statutActif(e.statuts, "camouflage")) esquive += 0.30;
  if (Math.random() < esquive) { log.push(`${tech.nom} manque sa cible !`); return; }
  let deg = calculerDegats(tech.degats, 3, j.statuts, e.statuts);
  const crit = Math.random() < tech.crit;
  if (crit) { deg = Math.round(deg * 1.7); log.push("COUP CRITIQUE ! "); }
  e.pv = Math.max(0, e.pv - deg);
  log.push(`Vous déclenchez ${tech.nom} pour ${deg} dégâts.`);
  if (tech.statut) e.statuts.push({ ...tech.statut });
}

function tourEnnemi(combat, creatureDef) {
  const j = combat.joueur, e = combat.ennemi, log = combat.log;
  if (e.pv <= 0 || combat.fini) return;
  if (statutActif(e.statuts, "etourdi")) { log.push(`${creatureDef.nom} est étourdi(e) et ne peut agir !`); return; }
  const options = creatureDef.techniques.filter(t => TECHNIQUES[t].cout <= e.energie);
  const choix = options.length ? pick(options) : null;
  if (!choix) {
    let deg = calculerDegats([creatureDef.atk - 3, creatureDef.atk + 3], 2, e.statuts, j.statuts);
    j.pv = Math.max(0, j.pv - deg);
    log.push(`${creatureDef.nom} attaque instinctivement pour ${deg} dégâts.`);
    return;
  }
  const tech = TECHNIQUES[choix];
  e.energie -= tech.cout;
  if (tech.soin) {
    const soin = randInt(tech.soin[0], tech.soin[1]);
    e.pv = Math.min(e.pvMax, e.pv + soin);
    log.push(`${creatureDef.nom} se régénère de ${soin} PV.`);
    return;
  }
  if (tech.esquiveBonus) {
    e.statuts.push({ type: "camouflage", tours: tech.tours, effet: tech.esquiveBonus });
    log.push(`${creatureDef.nom} se fond dans l'obscurité (camouflage).`);
    return;
  }
  let esquive = 0.08 + (1 - tech.precision);
  if (statutActif(j.statuts, "camouflage")) esquive += 0.3;
  if (Math.random() < esquive) { log.push(`${tech.nom} de ${creatureDef.nom} manque sa cible !`); return; }
  let deg = calculerDegats(tech.degats, 2, e.statuts, j.statuts);
  const crit = Math.random() < tech.crit;
  if (crit) { deg = Math.round(deg * 1.6); log.push("COUP CRITIQUE ENNEMI ! "); }
  j.pv = Math.max(0, j.pv - deg);
  log.push(`${creatureDef.nom} utilise ${tech.nom} pour ${deg} dégâts.`);
  if (tech.statut) j.statuts.push({ ...tech.statut });
}

function jouerTour(combat, creatureDef, actionKey) {
  if (combat.fini) return combat;
  appliquerStatutsDebutTour(combat.joueur, combat.log, "Vous");
  appliquerStatutsDebutTour(combat.ennemi, combat.log, creatureDef.nom);
  if (combat.joueur.pv > 0 && !combat.fini) tourJoueur(combat, creatureDef, actionKey);
  if (combat.ennemi.pv <= 0) { combat.fini = true; combat.victoire = "joueur"; combat.log.push(`${creatureDef.nom} est vaincu(e) !`); }
  if (!combat.fini && combat.joueur.pv > 0) tourEnnemi(combat, creatureDef);
  if (combat.joueur.pv <= 0) { combat.fini = true; combat.victoire = "ennemi"; combat.log.push("Vous perdez connaissance, submergé(e)..."); }
  if (combat.ennemi.pv <= 0 && !combat.victoire) { combat.fini = true; combat.victoire = "joueur"; }
  combat.joueur.energie = Math.min(combat.joueur.energieMax, combat.joueur.energie + 8);
  combat.tour++;
  if (combat.log.length > 14) combat.log = combat.log.slice(-14);
  return combat;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  XI. RENDU CANVAS — DIRECTION ARTISTIQUE "CARTE MARINE / SONAR"
 * ═══════════════════════════════════════════════════════════════════════ */

function drawSonarBackground(ctx, W, H, baseColor) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#020C14");
  g.addColorStop(0.5, "#03141F");
  g.addColorStop(1, "#010810");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Trames de points façon papier d'écho-sondeur
  ctx.save();
  ctx.fillStyle = baseColor;
  ctx.globalAlpha = 0.10;
  for (let y = 10; y < H; y += 14) {
    for (let x = (y % 28 === 0) ? 10 : 17; x < W; x += 14) {
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  ctx.restore();

  // Courbes de niveau bathymétriques concentriques
  ctx.save();
  ctx.strokeStyle = baseColor;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  const cx = W * 0.72, cy = H * 0.38;
  for (let r = 40; r < 900; r += 46) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.62, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Cadre de carte marine
  ctx.save();
  ctx.strokeStyle = baseColor;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.restore();
}

function drawSonarSweep(ctx, cx, cy, radius, angle, color) {
  ctx.save();
  const grad = ctx.createConicGradient ? ctx.createConicGradient(angle - Math.PI / 2, cx, cy) : null;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const sweepGrad = ctx.createLinearGradient(0, 0, radius, 0);
  sweepGrad.addColorStop(0, color.replace(")", ",0.55)").replace("rgb", "rgba"));
  sweepGrad.addColorStop(1, color.replace(")", ",0)").replace("rgb", "rgba"));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -0.35, 0.35);
  ctx.closePath();
  ctx.fillStyle = sweepGrad;
  ctx.fill();
  ctx.restore();

  // cercles concentriques du radar
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let r = radius / 4; r <= radius; r += radius / 4) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
  ctx.restore();
}

function txt(ctx, s, x, y, size, color, opts = {}) {
  ctx.save();
  ctx.globalAlpha = opts.alpha !== undefined ? opts.alpha : 1;
  ctx.font = `${opts.weight || "bold"} ${size}px SONAR, SONAR2, sans-serif`;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.blur || 12; }
  ctx.fillText(s, x, y);
  ctx.restore();
}

function barre(ctx, x, y, w, h, ratio, colorFill, colorBg) {
  ctx.save();
  ctx.fillStyle = colorBg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colorFill;
  ctx.fillRect(x, y, Math.max(0, w * clamp(ratio, 0, 1)), h);
  ctx.strokeStyle = "#9FE8D8";
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

async function renderDashboard(s, userName) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 1000, H = 620;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const zone = getZoneForDepth(s.profondeur);
  const baseColor = "#4FD9C4";

  drawSonarBackground(ctx, W, H, baseColor);
  drawSonarSweep(ctx, W * 0.72, H * 0.38, 230, (Date.now() / 900) % (Math.PI * 2), "rgb(79,217,196)");

  txt(ctx, "CITE ABYSSALE - CONSOLE DE BORD", 40, 52, 30, "#B9FBEF", { glow: "#2ED9C0", blur: 18 });
  txt(ctx, `PLONGEUR : ${userName.toUpperCase()}`, 40, 90, 18, "#8FE9DA");
  txt(ctx, `GRADE : ${getGrade(s.niveau).toUpperCase()}`, 40, 116, 16, "#6FCBBE");

  // Bloc profondeur / pression
  ctx.save(); ctx.strokeStyle = "#3AA394"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 150, 420, 190); ctx.restore();
  txt(ctx, "PARAMETRES DE PLONGEE", 56, 174, 16, "#B9FBEF");
  txt(ctx, `ZONE : ${zone.nom.toUpperCase()}`, 56, 202, 14, "#9FE8D8");
  txt(ctx, `PROFONDEUR : ${s.profondeur} M / MAX ${s.profondeurMax} M`, 56, 224, 14, "#9FE8D8");
  txt(ctx, `PRESSION ESTIMEE : ${zone.pression} ATM`, 56, 246, 14, "#9FE8D8");
  txt(ctx, `RESISTANCE COQUE : ${resistancePression(s)} M MAX`, 56, 268, 14, "#9FE8D8");

  txt(ctx, "OXYGENE EMBARQUE", 56, 296, 13, "#7FE0CD");
  barre(ctx, 56, 306, 380, 16, s.oxygene / o2Capacite(s), "#33E0B4", "#0C2A26");
  txt(ctx, `${Math.round(s.oxygene)} / ${o2Capacite(s)}`, 56, 330, 12, "#DFF7F0");

  txt(ctx, "INTEGRITE PHYSIQUE", 56, 305 + 45, 13, "#7FE0CD");
  barre(ctx, 56, 306 + 45, 380, 16, s.pvActuel / s.pvMax, "#4FD9C4", "#0C2A26");
  txt(ctx, `${s.pvActuel} / ${s.pvMax} PV`, 56, 330 + 45, 12, "#DFF7F0");

  // Bloc progression
  ctx.save(); ctx.strokeStyle = "#3AA394"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 360, 420, 190); ctx.restore();
  txt(ctx, "PROGRESSION", 56, 384, 16, "#B9FBEF");
  txt(ctx, `NIVEAU ${s.niveau}`, 56, 412, 14, "#9FE8D8");
  barre(ctx, 56, 424, 380, 14, s.xp / xpForLevel(s.niveau), "#5AD1E8", "#0C2226");
  txt(ctx, `XP ${s.xp} / ${xpForLevel(s.niveau)}`, 56, 450, 12, "#DFF7F0");
  txt(ctx, `VICTOIRES : ${s.stats.victoires}   DEFAITES : ${s.stats.defaites}`, 56, 480, 13, "#9FE8D8");
  txt(ctx, `EPAVES FOUILLEES : ${s.stats.epavesFouillees}`, 56, 502, 13, "#9FE8D8");
  txt(ctx, `TABLETTES RESOLUES : ${s.stats.tablettesResolues}`, 56, 524, 13, "#9FE8D8");

  // Bloc sous-marin
  const sx = 500;
  ctx.save(); ctx.strokeStyle = "#3AA394"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(sx, 150, 460, 400); ctx.restore();
  txt(ctx, "ETAT DU SOUS-MARIN", sx + 16, 174, 16, "#B9FBEF");
  const rows = [
    ["COQUE", SUB_UPGRADES.coque[s.sousMarin.coque].nom, s.sousMarin.coque, SUB_UPGRADES.coque.length - 1],
    ["MOTEUR", SUB_UPGRADES.moteur[s.sousMarin.moteur].nom, s.sousMarin.moteur, SUB_UPGRADES.moteur.length - 1],
    ["RESERVOIR", SUB_UPGRADES.reservoir[s.sousMarin.reservoir].nom, s.sousMarin.reservoir, SUB_UPGRADES.reservoir.length - 1],
    ["SONAR", SUB_UPGRADES.sonar[s.sousMarin.sonar].nom, s.sousMarin.sonar, SUB_UPGRADES.sonar.length - 1],
    ["SOUTE", SUB_UPGRADES.soute[s.sousMarin.soute].nom, s.sousMarin.soute, SUB_UPGRADES.soute.length - 1],
  ];
  let ry = 206;
  for (const [label, nom, lvl, max] of rows) {
    txt(ctx, `${label} : ${nom.toUpperCase()}`, sx + 16, ry, 13, "#9FE8D8");
    barre(ctx, sx + 16, ry + 12, 420, 10, (lvl + 1) / (max + 1), "#3AA394", "#0C2A26");
    ry += 44;
  }
  txt(ctx, `SOUTE : ${inventaireTotalCount(s.inventaire)} / ${soutCapacite(s)}`, sx + 16, ry + 10, 13, "#9FE8D8");
  txt(ctx, `PORTEE SONAR : ${porteeSonar(s)} ECHOS`, sx + 16, ry + 32, 13, "#9FE8D8");
  txt(ctx, `SUCCES DEBLOQUES : ${s.succes.length} / ${ACHIEVEMENTS.length}`, sx + 16, ry + 54, 13, "#9FE8D8");

  txt(ctx, "COORDONNEES ESTIMEES : 04S 132W - DERIVE ABYSSALE", 40, H - 34, 12, "#4E9187");
  txt(ctx, new Date().toISOString().slice(0, 19).replace("T", " "), W - 40, H - 34, 12, "#4E9187", { align: "right" });

  return canvas.toBuffer("image/png");
}

async function renderSonarMap(s) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 1000, H = 700;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const zone = getZoneForDepth(s.profondeur);

  drawSonarBackground(ctx, W, H, "#4FD9C4");
  txt(ctx, "SONAR BATHYMETRIQUE", 40, 50, 26, "#B9FBEF", { glow: "#2ED9C0", blur: 16 });
  txt(ctx, `ZONE ACTIVE : ${zone.nom.toUpperCase()} (${zone.min}-${zone.max}M)`, 40, 82, 15, "#8FE9DA");

  const cx = W / 2, cy = H / 2 + 20;
  const range = porteeSonar(s);
  drawSonarSweep(ctx, cx, cy, 280, (Date.now() / 700) % (Math.PI * 2), "rgb(79,217,196)");

  // Échos aléatoires basés sur la portée sonar (créatures / épaves / failles)
  const seedEchoes = s.stats.tour || 0;
  const rand = mulberry32(seedEchoes + s.profondeur + 7);
  const nbEchoes = Math.min(range, 3 + Math.floor(rand() * range));
  for (let i = 0; i < nbEchoes; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 40 + rand() * 250;
    const ex = cx + Math.cos(ang) * dist;
    const ey = cy + Math.sin(ang) * dist * 0.6;
    const type = rand();
    ctx.save();
    ctx.strokeStyle = "#DFF7F0";
    ctx.lineWidth = 1.5;
    if (type < 0.4) {
      // Épave : carré
      ctx.strokeRect(ex - 6, ey - 6, 12, 12);
      txt(ctx, "EPAVE", ex, ey + 20, 10, "#B9FBEF", { align: "center" });
    } else if (type < 0.75) {
      // Créature : triangle
      ctx.beginPath(); ctx.moveTo(ex, ey - 8); ctx.lineTo(ex - 7, ey + 6); ctx.lineTo(ex + 7, ey + 6); ctx.closePath(); ctx.stroke();
      txt(ctx, "CONTACT", ex, ey + 22, 10, "#FF9E9E", { align: "center" });
    } else {
      // Faille hydrothermale : losange
      ctx.beginPath(); ctx.moveTo(ex, ey - 8); ctx.lineTo(ex + 8, ey); ctx.lineTo(ex, ey + 8); ctx.lineTo(ex - 8, ey); ctx.closePath(); ctx.stroke();
      txt(ctx, "FAILLE", ex, ey + 22, 10, "#FFD97E", { align: "center" });
    }
    ctx.restore();
  }
  // Position du sous-marin (centre)
  ctx.save();
  ctx.fillStyle = "#B9FBEF";
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  txt(ctx, "VOUS", cx, cy + 20, 11, "#B9FBEF", { align: "center" });

  txt(ctx, `PORTEE : ${range} ECHOS SIMULTANES`, 40, H - 34, 12, "#4E9187");
  txt(ctx, `CONTACTS DETECTES : ${nbEchoes}`, W - 40, H - 34, 12, "#4E9187", { align: "right" });

  return canvas.toBuffer("image/png");
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function renderCombat(combat, creatureDef) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 1000, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawSonarBackground(ctx, W, H, "#E85D5D");

  txt(ctx, "AFFRONTEMENT ABYSSAL", 40, 50, 26, "#FFD5D5", { glow: "#E85D5D", blur: 16 });
  txt(ctx, `TOUR ${combat.tour}`, W - 40, 50, 16, "#FFB0B0", { align: "right" });

  // Bloc joueur
  ctx.save(); ctx.strokeStyle = "#3AA394"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 90, 420, 160); ctx.restore();
  txt(ctx, "VOTRE SOUS-MARIN", 56, 114, 16, "#B9FBEF");
  barre(ctx, 56, 130, 380, 18, combat.joueur.pv / combat.joueur.pvMax, "#4FD9C4", "#0C2A26");
  txt(ctx, `PV ${combat.joueur.pv} / ${combat.joueur.pvMax}`, 56, 158, 12, "#DFF7F0");
  barre(ctx, 56, 172, 380, 12, combat.joueur.energie / combat.joueur.energieMax, "#5AD1E8", "#0C2226");
  txt(ctx, `ENERGIE ${combat.joueur.energie} / ${combat.joueur.energieMax}`, 56, 194, 12, "#DFF7F0");
  txt(ctx, `STATUTS : ${combat.joueur.statuts.map(s2 => s2.type.toUpperCase()).join(", ") || "AUCUN"}`, 56, 220, 11, "#9FE8D8");

  // Bloc ennemi
  ctx.save(); ctx.strokeStyle = "#B04545"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(540, 90, 420, 160); ctx.restore();
  txt(ctx, creatureDef.nom.toUpperCase(), 556, 114, 16, "#FFD5D5");
  barre(ctx, 556, 130, 380, 18, combat.ennemi.pv / combat.ennemi.pvMax, "#E85D5D", "#2A0C0C");
  txt(ctx, `PV ${combat.ennemi.pv} / ${combat.ennemi.pvMax}`, 556, 158, 12, "#FFE0E0");
  barre(ctx, 556, 172, 380, 12, combat.ennemi.energie / combat.ennemi.energieMax, "#E89B5D", "#2A1A0C");
  txt(ctx, `ENERGIE ${combat.ennemi.energie} / ${combat.ennemi.energieMax}`, 556, 194, 12, "#FFE0E0");
  txt(ctx, `STATUTS : ${combat.ennemi.statuts.map(s2 => s2.type.toUpperCase()).join(", ") || "AUCUN"}`, 556, 220, 11, "#FFB0B0");

  // Silhouette de créature abstraite (formes géométriques, sans emoji)
  ctx.save();
  ctx.translate(750, 340);
  ctx.strokeStyle = "#E89B5D"; ctx.globalAlpha = 0.7; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 70 + 18 * Math.sin(i * 1.7 + combat.tour);
    const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.7;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();

  // Journal de combat
  ctx.save(); ctx.strokeStyle = "#3AA394"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 280, 500, 240); ctx.restore();
  txt(ctx, "JOURNAL DE COMBAT", 56, 304, 15, "#B9FBEF");
  const lines = combat.log.slice(-9);
  let ly = 328;
  for (const l of lines) {
    txt(ctx, l.length > 62 ? l.slice(0, 59) + "..." : l, 56, ly, 12, "#CFEFE6");
    ly += 22;
  }

  return canvas.toBuffer("image/png");
}

async function renderWreck(wreckDef, resultats) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 900, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawSonarBackground(ctx, W, H, "#C9A24A");

  txt(ctx, "FOUILLE D'EPAVE", 40, 50, 26, "#F5E3B8", { glow: "#C9A24A", blur: 16 });
  txt(ctx, wreckDef.nom.toUpperCase(), 40, 84, 16, "#E9D19C");

  // Silhouette d'épave géométrique
  ctx.save();
  ctx.translate(W - 260, 250);
  ctx.strokeStyle = "#E9D19C"; ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-140, 20); ctx.lineTo(-90, -40); ctx.lineTo(60, -50); ctx.lineTo(140, 10); ctx.lineTo(120, 40); ctx.lineTo(-130, 45); ctx.closePath();
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-20, -50); ctx.lineTo(-10, -110); ctx.stroke();
  ctx.restore();

  ctx.save(); ctx.strokeStyle = "#8A7239"; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 120, 480, 320); ctx.restore();
  txt(ctx, "BUTIN RECUPERE", 56, 144, 15, "#F5E3B8");
  let ly = 172;
  if (!resultats.length) {
    txt(ctx, "AUCUN OBJET RECUPERE CETTE FOIS.", 56, ly, 13, "#E9D19C");
  } else {
    for (const r of resultats) {
      txt(ctx, `${(ITEM_LABELS[r.item] || r.item).toUpperCase()} x${r.qte}`, 56, ly, 13, "#E9D19C");
      ly += 26;
    }
  }

  return canvas.toBuffer("image/png");
}


/* ═══════════════════════════════════════════════════════════════════════
 *  XII. RENDU CANVAS SUPPLEMENTAIRES — CLASSEMENT & TABLETTE
 * ═══════════════════════════════════════════════════════════════════════ */

async function renderRanking(rows) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 900, H = 90 + rows.length * 46 + 60;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawSonarBackground(ctx, W, H, "#4FD9C4");
  txt(ctx, "CLASSEMENT DES PLONGEURS", 40, 50, 26, "#B9FBEF", { glow: "#2ED9C0", blur: 16 });
  txt(ctx, "PROFONDEUR MAX / NIVEAU / VICTOIRES", 40, 82, 13, "#8FE9DA");
  let y = 120;
  rows.forEach((r, i) => {
    const medalColor = i === 0 ? "#FFD97E" : i === 1 ? "#D9E4EC" : i === 2 ? "#E1A15C" : "#6FCBBE";
    txt(ctx, `#${i + 1}`, 56, y, 16, medalColor);
    txt(ctx, r.nom.toUpperCase().slice(0, 22), 110, y, 15, "#DFF7F0");
    txt(ctx, `NIV.${r.niveau}`, 480, y, 13, "#9FE8D8");
    txt(ctx, `${r.profondeurMax}M`, 610, y, 13, "#9FE8D8");
    txt(ctx, `${r.victoires}V`, 740, y, 13, "#9FE8D8");
    ctx.save(); ctx.strokeStyle = "#204F48"; ctx.globalAlpha = 0.5; ctx.beginPath();
    ctx.moveTo(40, y + 18); ctx.lineTo(W - 40, y + 18); ctx.stroke(); ctx.restore();
    y += 46;
  });
  return canvas.toBuffer("image/png");
}

async function renderTablet(riddle, tentatives) {
  if (!CANVAS_OK) return null;
  ensureFonts();
  const W = 900, H = 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  drawSonarBackground(ctx, W, H, "#8FA6B8");

  txt(ctx, "TABLETTE ENGLOUTIE", 40, 50, 26, "#E7EEF3", { glow: "#8FA6B8", blur: 16 });
  txt(ctx, "GRAVURES ANCESTRALES A DECHIFFRER", 40, 82, 14, "#B7C6D2");

  ctx.save(); ctx.strokeStyle = "#8FA6B8"; ctx.globalAlpha = 0.7; ctx.lineWidth = 2;
  ctx.strokeRect(40, 110, W - 80, 220); ctx.restore();

  // Décorations vectorielles façon runes gravées
  ctx.save();
  ctx.strokeStyle = "#B7C6D2"; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const rx = 70 + i * 130, ry = 330 - 10 * (i % 2);
    ctx.beginPath();
    ctx.moveTo(rx, ry - 12); ctx.lineTo(rx + 8, ry); ctx.lineTo(rx, ry + 12); ctx.lineTo(rx - 8, ry); ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  const words = riddle.texte.split(" ");
  let line = "", lines = [], maxW = 44;
  for (const w of words) {
    if ((line + " " + w).trim().length > maxW) { lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  let ly = 148;
  for (const l of lines.slice(0, 6)) { txt(ctx, l.toUpperCase(), 60, ly, 14, "#DDE7EE"); ly += 26; }

  txt(ctx, `TENTATIVES ECHOUEES : ${tentatives}`, 60, 358, 13, "#B7C6D2");
  txt(ctx, "REPONDEZ EN MESSAGE DIRECT A CETTE TABLETTE.", 60, 300 + (lines.length > 4 ? 30 : 0), 12, "#8FA6B8");

  return canvas.toBuffer("image/png");
}

/* ═══════════════════════════════════════════════════════════════════════
 *  XIII. FORMATAGE TEXTE — BLOCS RICHES (fonts unicode + emojis)
 * ═══════════════════════════════════════════════════════════════════════ */

function fmtItemList(inv, limit = 12) {
  const keys = Object.keys(inv).filter(k => inv[k] > 0);
  if (!keys.length) return "   └─ (soute vide)";
  return keys.slice(0, limit).map((k, i) => {
    const isLast = i === Math.min(keys.length, limit) - 1;
    return `   ${isLast ? "└─" : "├─"} ${ITEM_LABELS[k] || k} ×${inv[k]}`;
  }).join("\n");
}

function renderDashboardText(s, userName) {
  const zone = getZoneForDepth(s.profondeur);
  return fonts.bold(
`🌊 ═══════ CITÉ ABYSSALE — CONSOLE DE BORD ═══════ 🌊
👤 Plongeur : ${userName}
🎖️ Grade : ${s.grade} (Niveau ${s.niveau})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 PLONGÉE
   ├─ Zone : ${zone.nom}
   ├─ Profondeur : ${s.profondeur} m (record : ${s.profondeurMax} m)
   ├─ Pression : ${zone.pression} ATM
   └─ 🫧 Oxygène : ${Math.round(s.oxygene)} / ${o2Capacite(s)} [${formatBar(s.oxygene, o2Capacite(s), 14)}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ VITALITÉ
   └─ PV : ${s.pvActuel} / ${s.pvMax} [${formatBar(s.pvActuel, s.pvMax, 14)}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ PROGRESSION
   ├─ XP : ${s.xp} / ${xpForLevel(s.niveau)} [${formatBar(s.xp, xpForLevel(s.niveau), 14)}]
   ├─ 🏆 Victoires : ${s.stats.victoires} — ☠️ Défaites : ${s.stats.defaites}
   ├─ 🗿 Épaves fouillées : ${s.stats.epavesFouillees}
   ├─ 📜 Tablettes résolues : ${s.stats.tablettesResolues}
   └─ 🥇 Succès : ${s.succes.length} / ${ACHIEVEMENTS.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚤 SOUS-MARIN
   ├─ Coque : ${SUB_UPGRADES.coque[s.sousMarin.coque].nom}
   ├─ Moteur : ${SUB_UPGRADES.moteur[s.sousMarin.moteur].nom}
   ├─ Réservoir O2 : ${SUB_UPGRADES.reservoir[s.sousMarin.reservoir].nom}
   ├─ Sonar : ${SUB_UPGRADES.sonar[s.sousMarin.sonar].nom} (portée ${porteeSonar(s)})
   └─ Soute : ${SUB_UPGRADES.soute[s.sousMarin.soute].nom} (${inventaireTotalCount(s.inventaire)}/${soutCapacite(s)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Tapez "abyssal aide" pour la liste complète des commandes.`
  );
}

function renderHelpText() {
  return fonts.bold(
`🌊 ═══════ CITÉ ABYSSALE — GUIDE DU PLONGEUR ═══════ 🌊
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 EXPLORATION
   ├─ abyssal dashboard — console de bord
   ├─ abyssal plonger — descendre d'un palier
   ├─ abyssal remonter — remonter d'un palier (récupère de l'O2)
   └─ abyssal sonar — scanner les environs (carte des échos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗿 ÉPAVES & AQUACULTURE
   ├─ abyssal epave — fouiller une épave détectée
   ├─ abyssal aquaculture — voir les bassins
   ├─ abyssal aquaculture recolter <slot> — récolter
   └─ abyssal aquaculture debloquer <slot> — débloquer un bassin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ COMBAT
   ├─ abyssal combat — engager une créature abyssale
   └─ (en combat) répondez : attaque / techniques / fuite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 TABLETTES (énigmes)
   ├─ abyssal tablette — révéler une énigme
   └─ (répondez directement à la tablette avec votre réponse)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚤 SOUS-MARIN
   ├─ abyssal sous-marin — voir les améliorations
   └─ abyssal sous-marin ameliorer <coque|moteur|reservoir|sonar|soute>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROGRESSION
   ├─ abyssal succes — liste des succès
   ├─ abyssal classement — classement des joueurs
   ├─ abyssal historique — dernières actions
   └─ abyssal daily — récompense quotidienne
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Auteur : Christus`
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *  XIV. GESTION DES SOUS-COMMANDES
 * ═══════════════════════════════════════════════════════════════════════ */

const DIVE_COOLDOWN_MS = 30 * 1000;
const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000;

function pushHistorique(s, texte) {
  s.historique.unshift(`[${new Date().toLocaleTimeString("fr-FR")}] ${texte}`);
  if (s.historique.length > 30) s.historique.length = 30;
}

async function envoyerImageOuTexte(message, buffer, texte, nomFichier) {
  if (buffer) {
    const tmp = path.join(require("os").tmpdir(), `${nomFichier}_${Date.now()}.png`);
    await fs.writeFile(tmp, buffer);
    await message.reply({ body: texte, attachment: fs.createReadStream(tmp) });
    fs.unlink(tmp).catch(() => {});
  } else {
    await message.reply(texte);
  }
}

async function handleDashboard({ message, s, userName }) {
  const buf = await renderDashboard(s, userName).catch(() => null);
  await envoyerImageOuTexte(message, buf, renderDashboardText(s, userName), "abyssal_dashboard");
}

async function handlePlonger({ message, s, save }) {
  const now = Date.now();
  if (now - s.dernierPlongeon < DIVE_COOLDOWN_MS) {
    const reste = Math.ceil((DIVE_COOLDOWN_MS - (now - s.dernierPlongeon)) / 1000);
    return message.reply(fonts.bold(`⏳ Vos réacteurs refroidissent encore. Patientez ${reste}s avant de plonger à nouveau.`));
  }
  const zoneAvant = getZoneForDepth(s.profondeur);
  const pas = 30 + s.sousMarin.moteur * 20;
  const nouvelleProfondeur = s.profondeur + pas;
  const resistance = resistancePression(s);

  if (nouvelleProfondeur > resistance) {
    s.pvActuel = Math.max(1, s.pvActuel - 15);
    pushHistorique(s, "Alerte pression critique ! Coque proche de la rupture.");
    await save();
    return message.reply(fonts.bold(
`⚠️ ═══ ALERTE PRESSION ═══ ⚠️
Votre coque (${resistancePression(s)}m max) ne peut pas descendre plus bas sans risquer l'implosion !
🔧 Améliorez votre coque via : abyssal sous-marin ameliorer coque
❤️ PV restants : ${s.pvActuel}/${s.pvMax}`));
  }

  const o2Cost = getZoneForDepth(nouvelleProfondeur).o2drain * 3;
  if (s.oxygene < o2Cost) {
    return message.reply(fonts.bold(`🫧 Oxygène insuffisant pour plonger plus profondément (${Math.round(s.oxygene)} restant, ${o2Cost} requis). Remontez pour vous réoxygéner.`));
  }

  s.dernierPlongeon = now;
  s.profondeur = nouvelleProfondeur;
  s.oxygene = clamp(s.oxygene - o2Cost, 0, o2Capacite(s));
  s.profondeurMax = Math.max(s.profondeurMax, s.profondeur);
  s.stats.plongees++;
  s.stats.tour++;

  if (s.oxygene <= o2Capacite(s) * 0.05) s.stats.oxygeneCritiqueSurvecu++;

  const zoneApres = getZoneForDepth(s.profondeur);
  let evtTxt = "";
  if (zoneApres.id !== zoneAvant.id) {
    evtTxt = `\n\n🌐 Vous entrez dans : ${zoneApres.nom} — ${zoneApres.description}`;
  }

  // Événement aléatoire de plongée
  const roll = Math.random();
  let eventTxt = "";
  if (roll < 0.08) {
    const perte = randInt(5, 15);
    s.oxygene = Math.max(0, s.oxygene - perte);
    eventTxt = `\n\n⚠️ Une fuite mineure dans le circuit d'air vous coûte ${perte} d'oxygène supplémentaire !`;
  } else if (roll < 0.14) {
    const gain = randInt(10, 30);
    addItem(s.inventaire, "minerai_brut", 1);
    eventTxt = `\n\n✨ Un courant favorable vous fait économiser de l'énergie et vous trouvez 1x minerai brut à la dérive !`;
  }

  if (s.oxygene <= 0) {
    s.pvActuel = Math.max(1, s.pvActuel - 25);
    eventTxt += `\n\n💀 ASPHYXIE ! Vous perdez 25 PV et devez remonter d'urgence !`;
  }

  pushHistorique(s, `Plongée à ${s.profondeur}m (zone : ${zoneApres.nom}).`);
  const nouveaux = checkAchievements(s);
  await save();

  const buf = await renderDashboard(s, message.senderID ? "Plongeur" : "Plongeur").catch(() => null);
  let succesTxt = "";
  if (nouveaux.length) succesTxt = `\n\n🥇 SUCCÈS DÉBLOQUÉ(S) :\n${nouveaux.map(a => `   ├─ ${a.nom} — ${a.desc}`).join("\n")}`;

  const texte = fonts.bold(
`🌊 PLONGÉE EN COURS...
📍 Profondeur actuelle : ${s.profondeur} m
🫧 Oxygène : ${Math.round(s.oxygene)} / ${o2Capacite(s)}
❤️ PV : ${s.pvActuel} / ${s.pvMax}${evtTxt}${eventTxt}${succesTxt}`);
  await envoyerImageOuTexte(message, buf, texte, "abyssal_plongee");
}

async function handleRemonter({ message, s, save }) {
  if (s.profondeur <= 0) return message.reply(fonts.bold("🌊 Vous êtes déjà à la surface."));
  const pas = 40 + s.sousMarin.moteur * 15;
  s.profondeur = Math.max(0, s.profondeur - pas);
  const gainO2 = Math.round(o2Capacite(s) * 0.15);
  s.oxygene = clamp(s.oxygene + gainO2, 0, o2Capacite(s));
  pushHistorique(s, `Remontée vers ${s.profondeur}m.`);
  await save();
  return message.reply(fonts.bold(
`⬆️ REMONTÉE EFFECTUÉE
📍 Nouvelle profondeur : ${s.profondeur} m
🫧 Oxygène récupéré : +${gainO2} (total : ${Math.round(s.oxygene)}/${o2Capacite(s)})`));
}

async function handleSonar({ message, s }) {
  const buf = await renderSonarMap(s).catch(() => null);
  const zone = getZoneForDepth(s.profondeur);
  const texte = fonts.bold(
`📡 SONAR BATHYMÉTRIQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Zone active : ${zone.nom}
🔭 Portée sonar : ${porteeSonar(s)} échos
💡 Astuce : tapez "abyssal epave" ou "abyssal combat" selon les contacts détectés !`);
  await envoyerImageOuTexte(message, buf, texte, "abyssal_sonar");
}

async function handleEpave({ message, s, save }) {
  const zone = getZoneForDepth(s.profondeur);
  const zoneIndex = DEPTH_ZONES.findIndex(z => z.id === zone.id);
  const eligibles = WRECK_TYPES.filter(w => DEPTH_ZONES.findIndex(z => z.id === w.zoneMin) <= zoneIndex);
  if (!eligibles.length) return message.reply(fonts.bold("🗿 Aucune épave connue n'est accessible à cette profondeur."));
  const wreck = pick(eligibles);

  if (inventaireTotalCount(s.inventaire) >= soutCapacite(s)) {
    return message.reply(fonts.bold(`🎒 Votre soute est pleine (${soutCapacite(s)}/${soutCapacite(s)}). Améliorez-la ou utilisez vos ressources.`));
  }

  const resultats = [];
  for (const l of wreck.loot) {
    if (Math.random() < l.chance) {
      const qte = randInt(l.qte[0], l.qte[1]);
      addItem(s.inventaire, l.item, qte);
      resultats.push({ item: l.item, qte });
    }
  }
  s.stats.epavesFouillees++;
  const xpGagne = randInt(10, 30) + zoneIndex * 5;
  const leveled = addXp(s, xpGagne);
  const argent = randInt(20, 60) + zoneIndex * 15;
  pushHistorique(s, `Fouille de l'épave "${wreck.nom}" (+${resultats.length} objets).`);
  s.stats.argentGagne += argent;
  const nouveaux = checkAchievements(s);
  await save();

  const buf = await renderWreck(wreck, resultats).catch(() => null);
  let lootTxt = resultats.length
    ? resultats.map((r, i) => `   ${i === resultats.length - 1 ? "└─" : "├─"} ${ITEM_LABELS[r.item] || r.item} ×${r.qte}`).join("\n")
    : "   └─ (rien de récupérable cette fois)";
  const texte = fonts.bold(
`🗿 ═══ FOUILLE D'ÉPAVE ═══ 🗿
🚢 ${wreck.nom}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 BUTIN :
${lootTxt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ +${xpGagne} XP ${leveled ? "(NIVEAU SUPÉRIEUR !)" : ""}
💰 +${argent} pièces
${nouveaux.length ? `\n🥇 SUCCÈS : ${nouveaux.map(a => a.nom).join(", ")}` : ""}`);
  await envoyerImageOuTexte(message, buf, texte, "abyssal_epave");
}

async function handleCombat({ message, event, s, save, api, commandName }) {
  if (s.combat) return message.reply(fonts.bold("⚔️ Vous êtes déjà en plein combat ! Répondez au message de combat pour agir."));
  const zone = getZoneForDepth(s.profondeur);
  const dispo = creaturesForZone(zone.id);
  if (!dispo.length) return message.reply(fonts.bold("🌊 Aucune créature connue ne rôde à cette profondeur."));
  const creatureDef = pick(dispo);
  const combat = buildCombatState(s, creatureDef);
  s.combat = combat;
  await save();

  const buf = await renderCombat(combat, creatureDef).catch(() => null);
  const texte = fonts.bold(
`⚔️ ═══ AFFRONTEMENT ABYSSAL ═══ ⚔️
${combat.log[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ Vos PV : ${combat.joueur.pv}/${combat.joueur.pvMax}   ⚡ Énergie : ${combat.joueur.energie}
👹 ${creatureDef.nom} PV : ${combat.ennemi.pv}/${combat.ennemi.pvMax}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 Répondez avec :
   ├─ "attaque" — attaque basique
   ├─ un nom de technique : ${creatureDef.techniques.map(t => TECHNIQUES[t].nom).join(", ")} + toutes celles apprises
   └─ "fuite" — tenter de fuir`);

  message.reply(texte, (err, info) => {
    if (!err && info && global.GoatBot?.onReply) {
      global.GoatBot.onReply.set(info.messageID, {
        commandName, messageID: info.messageID, author: event.senderID,
        threadID: event.threadID, type: "combat", creatureId: creatureDef.id,
      });
    }
  });
  if (buf) {
    const tmp = path.join(require("os").tmpdir(), `abyssal_combat_${Date.now()}.png`);
    await fs.writeFile(tmp, buf);
    await message.reply({ attachment: fs.createReadStream(tmp) });
    fs.unlink(tmp).catch(() => {});
  }
}

async function handleTablette({ message, event, s, save, commandName }) {
  if (s.tabletteEnCours) return message.reply(fonts.bold("📜 Une tablette est déjà en cours de déchiffrage. Répondez-y directement !"));
  const riddle = pickRiddle();
  s.tabletteEnCours = { id: riddle.id, tentatives: 0 };
  await save();

  const buf = await renderTablet(riddle, 0).catch(() => null);
  const texte = fonts.bold(
`📜 ═══ TABLETTE ENGLOUTIE ═══ 📜
${riddle.texte}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Répondez à ce message avec votre réponse.
🔎 (tapez "indice" pour un indice)`);

  message.reply(texte, (err, info) => {
    if (!err && info && global.GoatBot?.onReply) {
      global.GoatBot.onReply.set(info.messageID, {
        commandName, messageID: info.messageID, author: event.senderID,
        threadID: event.threadID, type: "tablette", riddleId: riddle.id,
      });
    }
  });
  if (buf) {
    const tmp = path.join(require("os").tmpdir(), `abyssal_tablette_${Date.now()}.png`);
    await fs.writeFile(tmp, buf);
    await message.reply({ attachment: fs.createReadStream(tmp) });
    fs.unlink(tmp).catch(() => {});
  }
}

async function handleAquaculture({ message, args, s, save }) {
  const action = (args[1] || "").toLowerCase();
  if (action === "recolter" || action === "recolte") {
    const slotId = (args[2] || "").toLowerCase();
    const slot = AQUACULTURE_SLOTS.find(a => a.id === slotId);
    if (!slot) return message.reply(fonts.bold("❌ Bassin inconnu. Slots : " + AQUACULTURE_SLOTS.map(a => a.id).join(", ")));
    const etat = s.aquaculture[slotId];
    if (!etat || !etat.debloque) return message.reply(fonts.bold("🔒 Ce bassin n'est pas encore débloqué."));
    const now = Date.now();
    if (!etat.dernierRecolte) etat.dernierRecolte = now - slot.tempsMs;
    if (now - etat.dernierRecolte < slot.tempsMs) {
      const reste = Math.ceil((slot.tempsMs - (now - etat.dernierRecolte)) / 60000);
      return message.reply(fonts.bold(`⏳ ${slot.nom} n'est pas encore prêt. Encore ${reste} min.`));
    }
    const qte = randInt(slot.rendement[0], slot.rendement[1]);
    addItem(s.inventaire, slot.item, qte);
    etat.dernierRecolte = now;
    s.stats.recoltes++;
    pushHistorique(s, `Récolte de ${slot.nom} (+${qte} ${ITEM_LABELS[slot.item]}).`);
    const nouveaux = checkAchievements(s);
    await save();
    return message.reply(fonts.bold(
`🌾 RÉCOLTE EFFECTUÉE
🐚 ${slot.nom} : +${qte}x ${ITEM_LABELS[slot.item]}
${nouveaux.length ? `🥇 SUCCÈS : ${nouveaux.map(a => a.nom).join(", ")}` : ""}`));
  }
  if (action === "debloquer") {
    const slotId = (args[2] || "").toLowerCase();
    const slot = AQUACULTURE_SLOTS.find(a => a.id === slotId);
    if (!slot) return message.reply(fonts.bold("❌ Bassin inconnu."));
    if (s.aquaculture[slotId]?.debloque) return message.reply(fonts.bold("✅ Ce bassin est déjà débloqué."));
    return message.reply(fonts.bold(`💰 Débloquer ${slot.nom} coûte ${slot.coutDeblocage} pièces (gérées via l'inventaire abyssal, pas le portefeuille). Fonctionnalité activée automatiquement à la première récolte gratuite.`));
  }

  // Affichage
  let lignes = "";
  for (const slot of AQUACULTURE_SLOTS) {
    if (!s.aquaculture[slot.id]) s.aquaculture[slot.id] = { debloque: slot.coutDeblocage === 0, dernierRecolte: 0 };
    const etat = s.aquaculture[slot.id];
    const pret = etat.debloque && (Date.now() - (etat.dernierRecolte || 0) >= slot.tempsMs);
    lignes += `   ├─ ${slot.nom} [${slot.id}] — ${etat.debloque ? (pret ? "🟢 PRÊT" : "🟡 en cours") : "🔒 verrouillé"}\n`;
  }
  await save();
  return message.reply(fonts.bold(
`🌾 ═══ AQUACULTURE ABYSSALE ═══ 🌾
${lignes}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 abyssal aquaculture recolter <slot>
🎮 abyssal aquaculture debloquer <slot>`));
}

async function handleSousMarin({ message, args, s, save }) {
  const action = (args[1] || "").toLowerCase();
  if (action === "ameliorer" || action === "upgrade") {
    const piece = (args[2] || "").toLowerCase();
    if (!SUB_UPGRADES[piece]) return message.reply(fonts.bold("❌ Pièce inconnue. Choix : coque, moteur, reservoir, sonar, soute."));
    const paliers = SUB_UPGRADES[piece];
    const niveauActuel = s.sousMarin[piece] || 0;
    if (niveauActuel >= paliers.length - 1) return message.reply(fonts.bold(`✅ ${piece.toUpperCase()} est déjà au niveau maximum.`));
    const prochain = paliers[niveauActuel + 1];
    const coutEnItems = Math.floor(prochain.cout / 40);
    const totalInv = inventaireTotalCount(s.inventaire);
    if (totalInv < coutEnItems) {
      return message.reply(fonts.bold(
`🔧 AMÉLIORATION ${piece.toUpperCase()}
Prochain palier : ${prochain.nom}
💰 Coût estimé : ${prochain.cout} pièces (soit ~${coutEnItems} ressources de soute)
🎒 Vous avez : ${totalInv} ressources en soute — insuffisant.`));
    }
    // Consomme des ressources aléatoires de la soute
    let restant = coutEnItems;
    for (const key of Object.keys(s.inventaire)) {
      if (restant <= 0) break;
      const pris = Math.min(s.inventaire[key], restant);
      s.inventaire[key] -= pris;
      restant -= pris;
      if (s.inventaire[key] <= 0) delete s.inventaire[key];
    }
    s.sousMarin[piece] = niveauActuel + 1;
    pushHistorique(s, `Amélioration : ${prochain.nom}.`);
    const nouveaux = checkAchievements(s);
    await save();
    return message.reply(fonts.bold(
`✅ AMÉLIORATION RÉUSSIE !
🚤 ${piece.toUpperCase()} → ${prochain.nom}
${nouveaux.length ? `🥇 SUCCÈS : ${nouveaux.map(a => a.nom).join(", ")}` : ""}`));
  }

  let bloc = "";
  for (const key of Object.keys(SUB_UPGRADES)) {
    const paliers = SUB_UPGRADES[key];
    const lvl = s.sousMarin[key] || 0;
    const actuel = paliers[lvl];
    const suivant = paliers[lvl + 1];
    bloc += `   ├─ ${key.toUpperCase()} : ${actuel.nom}${suivant ? ` (suivant : ${suivant.nom}, ~${suivant.cout} pièces)` : " (NIVEAU MAX)"}\n`;
  }
  return message.reply(fonts.bold(
`🚤 ═══ SOUS-MARIN — AMÉLIORATIONS ═══ 🚤
${bloc}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 abyssal sous-marin ameliorer <coque|moteur|reservoir|sonar|soute>`));
}

async function handleSucces({ message, s }) {
  let lignes = "";
  ACHIEVEMENTS.forEach((a, i) => {
    const obtenu = s.succes.includes(a.id);
    lignes += `   ${i === ACHIEVEMENTS.length - 1 ? "└─" : "├─"} ${obtenu ? "🥇" : "🔒"} ${a.nom} — ${a.desc}\n`;
  });
  return message.reply(fonts.bold(
`🏆 ═══ SUCCÈS ABYSSAUX (${s.succes.length}/${ACHIEVEMENTS.length}) ═══ 🏆
${lignes}`));
}

async function handleClassement({ message, usersData, senderID }) {
  const all = await usersData.getAll();
  const rows = all
    .filter(u => u.data && u.data.abyssal)
    .map(u => ({
      nom: u.name || "Plongeur Anonyme",
      niveau: u.data.abyssal.niveau || 1,
      profondeurMax: u.data.abyssal.profondeurMax || 0,
      victoires: u.data.abyssal.stats?.victoires || 0,
    }))
    .sort((a, b) => b.profondeurMax - a.profondeurMax || b.niveau - a.niveau)
    .slice(0, 12);

  if (!rows.length) return message.reply(fonts.bold("📊 Aucun classement disponible pour l'instant."));
  const buf = await renderRanking(rows).catch(() => null);
  const texte = fonts.bold(
`🏆 ═══ CLASSEMENT DES PLONGEURS ═══ 🏆
${rows.map((r, i) => `   ${i + 1}. ${r.nom} — Niv.${r.niveau} — ${r.profondeurMax}m — ${r.victoires}V`).join("\n")}`);
  await envoyerImageOuTexte(message, buf, texte, "abyssal_classement");
}

async function handleHistorique({ message, s }) {
  if (!s.historique.length) return message.reply(fonts.bold("📜 Aucun historique enregistré."));
  return message.reply(fonts.bold(
`📜 ═══ HISTORIQUE DES ACTIONS ═══ 📜
${s.historique.slice(0, 15).map((h, i) => `   ${i === Math.min(s.historique.length, 15) - 1 ? "└─" : "├─"} ${h}`).join("\n")}`));
}

async function handleDaily({ message, s, save }) {
  const now = Date.now();
  if (now - s.dernierDaily < DAILY_COOLDOWN_MS) {
    const reste = Math.ceil((DAILY_COOLDOWN_MS - (now - s.dernierDaily)) / (60 * 60 * 1000));
    return message.reply(fonts.bold(`⏳ Récompense quotidienne déjà réclamée. Revenez dans ${reste}h.`));
  }
  s.dernierDaily = now;
  const o2Bonus = Math.round(o2Capacite(s) * 0.5);
  s.oxygene = clamp(s.oxygene + o2Bonus, 0, o2Capacite(s));
  const xpBonus = 50;
  addXp(s, xpBonus);
  const itemsBonus = ["minerai_brut", "algue_phosphorescente", "ferraille"];
  const item = pick(itemsBonus);
  const qte = randInt(2, 6);
  addItem(s.inventaire, item, qte);
  pushHistorique(s, "Récompense quotidienne réclamée.");
  await save();
  return message.reply(fonts.bold(
`🎁 ═══ RÉCOMPENSE QUOTIDIENNE ═══ 🎁
🫧 +${o2Bonus} oxygène
✨ +${xpBonus} XP
🎒 +${qte}x ${ITEM_LABELS[item]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
À demain, plongeur !`));
}

/* ═══════════════════════════════════════════════════════════════════════
 *  XV. GESTION onReply — COMBAT ET TABLETTES
 * ═══════════════════════════════════════════════════════════════════════ */

function trouverTechniqueParNom(nomOuKey, creatureDef) {
  const clean = nomOuKey.trim().toLowerCase();
  for (const key of Object.keys(TECHNIQUES)) {
    if (key === clean || TECHNIQUES[key].nom.toLowerCase() === clean) return key;
  }
  return null;
}

async function onReplyCombat({ message, event, s, save, api, Reply }) {
  const creatureDef = CREATURES.find(c => c.id === Reply.creatureId) || CREATURES.find(c => c.id === s.combat?.creatureId);
  if (!s.combat || !creatureDef) {
    global.GoatBot?.onReply?.delete(event.messageID);
    return message.reply(fonts.bold("⚠️ Ce combat n'est plus actif."));
  }
  const body = (event.body || "").trim().toLowerCase();
  let actionKey = "attaque_basique";
  if (body.includes("fuite") || body.includes("fuir")) actionKey = "fuite";
  else if (body.includes("attaque")) actionKey = "attaque_basique";
  else {
    const found = trouverTechniqueParNom(body, creatureDef);
    if (found) actionKey = found;
  }

  const combat = s.combat;
  jouerTour(combat, creatureDef, actionKey);

  if (combat.fini) {
    global.GoatBot?.onReply?.delete(event.messageID);
    if (combat.victoire === "joueur") {
      s.pvActuel = combat.joueur.pv;
      s.stats.victoires++;
      if (!s.stats.creaturesVaincues.includes(creatureDef.id)) s.stats.creaturesVaincues.push(creatureDef.id);
      const argent = randInt(creatureDef.argent[0], creatureDef.argent[1]);
      s.stats.argentGagne += argent;
      const leveled = addXp(s, creatureDef.xp);
      const loots = [];
      for (const l of creatureDef.loot) {
        if (Math.random() < l.chance) { addItem(s.inventaire, l.item, 1); loots.push(l.item); }
      }
      pushHistorique(s, `Victoire contre ${creatureDef.nom} !`);
      const nouveaux = checkAchievements(s);
      s.combat = null;
      await save();
      const buf = await renderCombat(combat, creatureDef).catch(() => null);
      const texte = fonts.bold(
`🏆 ═══ VICTOIRE ! ═══ 🏆
${combat.log.slice(-3).join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ +${creatureDef.xp} XP ${leveled ? "(NIVEAU SUPÉRIEUR !)" : ""}
💰 +${argent} pièces
🎒 Butin : ${loots.length ? loots.map(l => ITEM_LABELS[l] || l).join(", ") : "aucun"}
${nouveaux.length ? `🥇 SUCCÈS : ${nouveaux.map(a => a.nom).join(", ")}` : ""}`);
      return envoyerImageOuTexte(message, buf, texte, "abyssal_victoire");
    } else if (combat.victoire === "fuite") {
      s.pvActuel = combat.joueur.pv;
      s.combat = null;
      await save();
      return message.reply(fonts.bold("🏃 Vous avez fui le combat et regagné des eaux plus sûres."));
    } else {
      s.pvActuel = 1;
      s.stats.defaites++;
      s.combat = null;
      pushHistorique(s, `Défaite face à ${creatureDef.nom}.`);
      await save();
      return message.reply(fonts.bold(
`💀 ═══ DÉFAITE ═══ 💀
${combat.log.slice(-3).join("\n")}
Vous êtes remonté(e) de justesse avec 1 PV. Soignez-vous avant de replonger !`));
    }
  } else {
    s.combat = combat;
    await save();
    const buf = await renderCombat(combat, creatureDef).catch(() => null);
    const texte = fonts.bold(
`⚔️ TOUR ${combat.tour}
${combat.log.slice(-4).join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ Vos PV : ${combat.joueur.pv}/${combat.joueur.pvMax}   ⚡ Énergie : ${combat.joueur.energie}
👹 ${creatureDef.nom} PV : ${combat.ennemi.pv}/${combat.ennemi.pvMax}
🎮 Répondez : attaque / ${creatureDef.techniques.map(t => TECHNIQUES[t].nom).join(", ")} / fuite`);
    message.reply(texte, (err, info) => {
      if (!err && info && global.GoatBot?.onReply) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: Reply.commandName, messageID: info.messageID, author: event.senderID,
          threadID: event.threadID, type: "combat", creatureId: creatureDef.id,
        });
      }
    });
    if (buf) {
      const tmp = path.join(require("os").tmpdir(), `abyssal_combat_${Date.now()}.png`);
      await fs.writeFile(tmp, buf);
      await message.reply({ attachment: fs.createReadStream(tmp) });
      fs.unlink(tmp).catch(() => {});
    }
  }
}

async function onReplyTablette({ message, event, s, save, Reply }) {
  const riddle = TABLET_RIDDLES.find(r => r.id === Reply.riddleId) || TABLET_RIDDLES.find(r => r.id === s.tabletteEnCours?.id);
  if (!s.tabletteEnCours || !riddle) {
    global.GoatBot?.onReply?.delete(event.messageID);
    return message.reply(fonts.bold("⚠️ Cette tablette n'est plus active."));
  }
  const body = (event.body || "").trim();
  if (body.toLowerCase() === "indice") {
    return message.reply(fonts.bold(`💡 INDICE : ${riddle.indice}`));
  }
  const normalise = body.toUpperCase().replace(/\s+/g, "");
  if (normalise === riddle.reponse.toUpperCase().replace(/\s+/g, "")) {
    global.GoatBot?.onReply?.delete(event.messageID);
    s.tabletteEnCours = null;
    s.stats.tablettesResolues++;
    const xpGagne = 60;
    const leveled = addXp(s, xpGagne);
    addItem(s.inventaire, "fragment_gardien", 1);
    pushHistorique(s, "Tablette déchiffrée avec succès.");
    const nouveaux = checkAchievements(s);
    await save();
    return message.reply(fonts.bold(
`✅ ═══ TABLETTE DÉCHIFFRÉE ═══ ✅
Bonne réponse : ${riddle.reponse}
✨ +${xpGagne} XP ${leveled ? "(NIVEAU SUPÉRIEUR !)" : ""}
🎒 +1x Fragment de gardien
${nouveaux.length ? `🥇 SUCCÈS : ${nouveaux.map(a => a.nom).join(", ")}` : ""}`));
  } else {
    s.tabletteEnCours.tentatives = (s.tabletteEnCours.tentatives || 0) + 1;
    await save();
    if (s.tabletteEnCours.tentatives >= 5) {
      global.GoatBot?.onReply?.delete(event.messageID);
      s.tabletteEnCours = null;
      await save();
      return message.reply(fonts.bold(`❌ Trop de tentatives échouées. La tablette se referme.\nLa réponse était : ${riddle.reponse}`));
    }
    message.reply(fonts.bold(`❌ Réponse incorrecte. (${s.tabletteEnCours.tentatives}/5 tentatives) — tapez "indice" pour de l'aide.`), (err, info) => {
      if (!err && info && global.GoatBot?.onReply) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: Reply.commandName, messageID: info.messageID, author: event.senderID,
          threadID: event.threadID, type: "tablette", riddleId: riddle.id,
        });
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 *  XVI. EXPORT GOAT-BOT V2
 * ═══════════════════════════════════════════════════════════════════════ */

module.exports = {
  config: {
    name: "abyssal",
    aliases: ["cite-abyssale", "abysse", "sousmarin"],
    version: "1.0",
    author: "Christus",
    countDown: 3,
    role: 0,
    category: "game",
    shortDescription: { fr: "🌊 Exploration sous-marine vers la Cité Abyssale" },
    description: { fr: "🌊 Pilotez un sous-marin, plongez vers la Cité Abyssale engloutie, combattez des créatures des profondeurs, déchiffrez des tablettes anciennes et améliorez votre équipement." },
    guide: { fr: "Tapez 'abyssal aide' pour voir toutes les sous-commandes disponibles." },
  },

  onStart: async function ({ message, event, args, api, usersData, commandName }) {
    const { senderID } = event;
    let user = await usersData.get(senderID);
    if (!user) user = { name: "Plongeur", money: 0, exp: 0, data: {} };
    const s = initAbyss(user);
    s.grade = getGrade(s.niveau);
    const userName = user.name || "Plongeur Anonyme";

    const save = async () => {
      user.data.abyssal = s;
      await usersData.set(senderID, user);
    };

    const sub = (args[0] || "dashboard").toLowerCase();

    try {
      switch (sub) {
        case "dashboard": case "dash": case "stat": case "status":
          return await handleDashboard({ message, s, userName });

        case "plonger": case "plongee": case "plongée": case "dive":
          return await handlePlonger({ message, s, save });

        case "remonter": case "surface": case "monter":
          return await handleRemonter({ message, s, save });

        case "sonar": case "scan": case "scanner":
          return await handleSonar({ message, s });

        case "epave": case "epaves": case "fouiller":
          return await handleEpave({ message, s, save });

        case "combat": case "affronter": case "chasser":
          return await handleCombat({ message, event, s, save, api, commandName });

        case "tablette": case "tablettes": case "enigme": case "énigme":
          return await handleTablette({ message, event, s, save, commandName });

        case "aquaculture": case "ferme": case "aqua":
          return await handleAquaculture({ message, args, s, save });

        case "sous-marin": case "sousmarin": case "sub": case "upgrade": case "upgrades":
          return await handleSousMarin({ message, args, s, save });

        case "succes": case "succès": case "achievements":
          return await handleSucces({ message, s });

        case "classement": case "ranking": case "top":
          return await handleClassement({ message, usersData, senderID });

        case "historique": case "history": case "log":
          return await handleHistorique({ message, s });

        case "daily": case "quotidien":
          return await handleDaily({ message, s, save });

        case "aide": case "help": case "guide":
          return message.reply(renderHelpText());

        default:
          await save();
          return message.reply(fonts.bold(`❓ Sous-commande inconnue "${sub}".\nTapez "abyssal aide" pour voir toutes les commandes.`));
      }
    } catch (err) {
      console.error("[abyssal.js] Erreur :", err);
      return message.reply(fonts.bold("⚠️ Une erreur inattendue est survenue dans les profondeurs. Réessayez."));
    }
  },

  onReply: async function ({ message, event, Reply, api, usersData, commandName }) {
    const { senderID } = event;
    if (Reply.author && Reply.author !== senderID) return;
    let user = await usersData.get(senderID);
    if (!user) return;
    const s = initAbyss(user);

    const save = async () => {
      user.data.abyssal = s;
      await usersData.set(senderID, user);
    };

    try {
      if (Reply.type === "combat") {
        return await onReplyCombat({ message, event, s, save, api, Reply });
      } else if (Reply.type === "tablette") {
        return await onReplyTablette({ message, event, s, save, Reply });
      }
    } catch (err) {
      console.error("[abyssal.js] Erreur onReply :", err);
      return message.reply(fonts.bold("⚠️ Une erreur est survenue lors du traitement de votre réponse."));
    }
  },
};
