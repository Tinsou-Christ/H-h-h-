const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const BASE = "https://downloader-christus.onrender.com";
const AUTO_URL = `${BASE}/api/auto`;
const SUPPORTED_URL = `${BASE}/api/supported`;

const HEADER = "📥 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n━━━━━━━━━\n\n";

// Liste de secours si /api/supported est injoignable (ex: cold start Render)
let supportedDomains = [
  "facebook.com", "fb.watch",
  "youtube.com", "youtu.be",
  "tiktok.com",
  "instagram.com", "instagr.am",
  "likee.com", "likee.video",
  "capcut.com",
  "spotify.com",
  "terabox.com",
  "twitter.com", "x.com",
  "drive.google.com",
  "soundcloud.com",
  "ndown.app",
  "pinterest.com", "pin.it"
];

const refreshSupportedDomains = async () => {
  try {
    const res = await axios.get(SUPPORTED_URL, { timeout: 15000 });
    const list = Array.isArray(res.data) ? res.data : res.data?.domains;
    if (Array.isArray(list) && list.length) supportedDomains = list;
  } catch {
    // on garde la liste de secours en cas d'échec
  }
};

refreshSupportedDomains();
setInterval(refreshSupportedDomains, 30 * 60 * 1000); // rafraîchi toutes les 30 min

module.exports = {
  config: {
    name: "autodl",
    version: "3.0",
    author: "Christus",
    role: 0,
    shortDescription: "Téléchargeur vidéo/média tout-en-un",
    longDescription:
      "Télécharge automatiquement des vidéos ou médias depuis Facebook, YouTube, TikTok, Instagram, Likee, CapCut, Spotify, Terabox, Twitter, Google Drive, SoundCloud, NDown, Pinterest et plus.",
    category: "utility",
    guide: { fr: "Envoyez simplement un lien média supporté (https://) pour le télécharger automatiquement." }
  },

  onStart: async function ({ message }) {
    return message.reply(
      `${HEADER}Envoie un lien vidéo/média (https://) depuis n'importe quel site supporté (YouTube, Facebook, TikTok, Instagram, Likee, CapCut, Spotify, Terabox, Twitter, Google Drive, SoundCloud, NDown, Pinterest, etc.) pour le télécharger automatiquement.`
    );
  },

  onChat: async function ({ message, event, api }) {
    const content = event.body ? event.body.trim() : "";
    if (content.toLowerCase().startsWith("auto")) return;
    if (!content.startsWith("https://")) return;
    if (!supportedDomains.some(domain => content.includes(domain))) return;

    api.setMessageReaction("⌛️", event.messageID, () => {}, true);

    const cacheDir = path.join(__dirname, "cache");
    let filePath;

    try {
      const res = await axios.get(AUTO_URL, {
        params: { url: content },
        timeout: 30000
      });

      if (!res.data) throw new Error("Pas de réponse de l'API");

      const { title, platform } = res.data;

      // On ne se fie pas au champ "type" de l'API (peu fiable, ex: Snapchat
      // renvoie parfois "audio" alors qu'un format vidéo existe). On privilégie
      // systématiquement la vidéo si un format vidéo est disponible, et on ne
      // bascule sur l'audio que s'il n'y a aucun format vidéo (Spotify, SoundCloud...).
      const mediaURL = res.data.high_quality || res.data.low_quality || res.data.audio;
      const isAudio = !res.data.high_quality && !res.data.low_quality && !!res.data.audio;

      if (!mediaURL) throw new Error("Média introuvable");

      const extension = isAudio ? "mp3" : "mp4";
      const buffer = (await axios.get(mediaURL, { responseType: "arraybuffer", timeout: 60000 })).data;

      await fs.ensureDir(cacheDir);
      filePath = path.join(cacheDir, `auto_media_${Date.now()}.${extension}`);
      fs.writeFileSync(filePath, Buffer.from(buffer));

      api.setMessageReaction("✅️", event.messageID, () => {}, true);

      const infoMsg =
        `${HEADER}` +
        `Titre      : ${title || "Titre inconnu"}\n` +
        `Plateforme : ${platform || "Inconnue"}\n` +
        `Statut     : Succès`;

      await message.reply({
        body: infoMsg,
        attachment: fs.createReadStream(filePath)
      });

      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("❌ Christus Downloader error:", err.response?.data || err.message);
      api.setMessageReaction("❌️", event.messageID, () => {}, true);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};
    
