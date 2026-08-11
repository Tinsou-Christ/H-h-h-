const axios = require("axios");

const API_URL = "https://effortless-api-access.onrender.com/api/na/ai/gemini";
const HEADER = "🤖 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗜\n━━━━━━━━━\n\n";

const extractAnswer = (data) => {
  if (!data) return null;
  const candidate =
    data.result?.answer ??
    (typeof data.result === "string" ? data.result : null) ??
    data.answer ??
    data.response ??
    data.message ??
    data.reply;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
};

// Même logique que ai.js : on télécharge l'image et on l'envoie en base64.
const urlToBase64 = async (url) => {
  const response = await axios.get(url, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(response.data).toString("base64");
};

const askGemini = async (prompt, imageBase64) => {
  const body = { prompt };
  if (imageBase64) body.image = imageBase64;

  try {
    const res = await axios.post(API_URL, body, {
      headers: { "Content-Type": "application/json" },
      timeout: 50000
    });

    const answer = extractAnswer(res.data);
    if (answer) return answer;

    console.error("❌ Gemini AI - réponse inattendue :\n" + JSON.stringify(res.data, null, 2));
    throw new Error("Réponse de l'API dans un format inattendu.");
  } catch (err) {
    if (err.response) {
      console.error("❌ Gemini AI - erreur API :\n" + JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("❌ Gemini AI - erreur réseau :", err.message);
    }
    throw err;
  }
};

module.exports = {
  config: {
    name: "gemini",
    aliases: [],
    version: "3.0",
    author: "Christus",
    role: 0,
    countDown: 5,
    shortDescription: "Pose une question à Gemini AI (texte + image)",
    longDescription: "Interroge Gemini (via Christus Apis) et renvoie une réponse détaillée. Peut aussi analyser une image envoyée ou en réponse.",
    category: "ai",
    guide: {
      fr:
        "{pn} <question>\n" +
        "{pn} <question> (en réponse à une image, ou avec un lien d'image dans le message)\n\n" +
        "Exemples :\n" +
        "{pn} qui est Naruto Uzumaki ?\n" +
        "{pn} décris cette image [en réponse à une photo]"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const prefix = event.body?.split(" ")[0] || "gemini";

    const raw = args.join(" ");
    const urlMatch = raw.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?/i) || raw.match(/https?:\/\/\S+/);
    let imageUrl = null;
    let question = raw.trim();

    // 1) Image en réponse à un message
    if (event.messageReply?.attachments?.[0]?.type === "photo") {
      imageUrl = event.messageReply.attachments[0].url;
    }

    // 2) Sinon, lien d'image collé dans le message
    if (!imageUrl && urlMatch) {
      imageUrl = urlMatch[0];
      question = raw.replace(imageUrl, "").trim();
    }

    if (!question && !imageUrl) {
      return message.reply(`${HEADER}❓ Pose ta question.\n\n💡 Exemple : ${prefix} qui est Naruto Uzumaki ?\n💡 Ou réponds à une image avec : ${prefix} décris cette image`);
    }

    let imageBase64 = null;
    if (imageUrl) {
      try {
        imageBase64 = await urlToBase64(imageUrl);
      } catch (err) {
        console.error("❌ Gemini AI - échec du téléchargement de l'image :", err.message);
        return message.reply(`${HEADER}❌ Impossible de récupérer l'image, réessaie.`);
      }
    }

    const prompt = question || "Décris cette image en détail.";

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const answer = await askGemini(prompt, imageBase64);
      api.setMessageReaction("✅️", event.messageID, () => {}, true);
      return message.reply(`${HEADER}${answer}`);
    } catch (err) {
      api.setMessageReaction("❌️", event.messageID, () => {}, true);
      return message.reply(`${HEADER}❌ Impossible d'obtenir une réponse pour le moment. Réessaie dans un instant.`);
    }
  }
};
    
