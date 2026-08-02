const axios = require('axios');
const validUrl = require('valid-url');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let fonts;
try {
  fonts = require('../../func/font.js');
} catch {
  fonts = {
    serif: (t) => t,
    sansSerif: (t) => t
  };
}

const STICKERS = [
  "254594829337221",
  "254594546003916",
  "254593389337365",
  "254595126003858",
  "254593766003994",
  "254595732670464",
  "254595959337108",
  "526207648112667",
  "374675960117310",
  "374676263450613",
  "380333206218252",
  "380333506218222",
  "375055800079326",
  "387545578037993"
];

const BASE = "https://testai-christus-api-3xjn.vercel.app";
const CHAT_URL = `${BASE}/api/public/chat`;
const TMP_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const getRandomSticker = () => {
  return STICKERS[Math.floor(Math.random() * STICKERS.length)];
};

const HEADER = "🤖 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀 𝗔𝗜\n━━━━━━━━━\n\n";

const formatCoolText = (text) => {
  if (!text) return "";

  const formatted = text.replace(/\*(.*?)\*/g, (_, p1) => fonts.serif(p1));
  return HEADER + fonts.sansSerif(formatted);
};

const downloadFile = async (url, ext) => {
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
};

const urlToBase64 = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data).toString('base64');
};

// --- Anti-surcharge -------------------------------------------------
// L'API partage un quota Groq entre tous les utilisateurs : quand trop
// de requêtes arrivent en même temps/trop vite, elle répond (en 200)
// avec un message de type "connexions IA surchargées". On limite les
// rafales avec une file d'attente, et on réessaie en silence avant de
// montrer quoi que ce soit à l'utilisateur.

const OVERLOAD_PATTERNS = [/surcharg/i, /quota/i, /groq/i];
const isOverloadReply = (text) => !!text && OVERLOAD_PATTERNS.some((r) => r.test(text));

let requestQueue = Promise.resolve();
const MIN_INTERVAL_MS = 1500; // délai mini entre deux requêtes à l'API

const enqueue = (task) => {
  const run = requestQueue.then(async () => {
    try {
      return await task();
    } finally {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS));
    }
  });
  requestQueue = run.catch(() => {}); // la file continue même si une tâche échoue
  return run;
};

const callChatWithRetry = async (payload, maxAttempts = 3) => {
  let lastResponse;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResponse = await axios.post(CHAT_URL, payload, { timeout: 60000 });
    const replyText = lastResponse.data?.reply;
    if (!isOverloadReply(replyText)) return lastResponse;
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  return lastResponse;
};
// ---------------------------------------------------------------------

const resetConversation = async (api, event, message) => {
  api.setMessageReaction("♻️", event.messageID, () => {}, true);
  try {
    await axios.post(CHAT_URL, { uid: event.senderID, message: "reset", reset: true });
    return message.reply("✅ Conversation réinitialisée.");
  } catch {
    return message.reply("❌ Échec de la réinitialisation.");
  }
};

const handleAIRequest = async (api, event, userInput, message) => {
  const userId = event.senderID;
  let imageBase64 = null;
  let messageContent = userInput;

  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  if (event.messageReply) {
    const att = event.messageReply.attachments?.[0];
    if (att?.type === 'photo') {
      try { imageBase64 = await urlToBase64(att.url); } catch {}
    }
  }

  const urlMatch = messageContent.match(/(https?:\/\/[^\s]+)/)?.[0];
  if (urlMatch && validUrl.isWebUri(urlMatch)) {
    messageContent = messageContent.replace(urlMatch, '').trim();
    if (!imageBase64) {
      try { imageBase64 = await urlToBase64(urlMatch); } catch {}
    }
  }

  if (!messageContent && !imageBase64) {
    api.setMessageReaction("❌", event.messageID, () => {}, true);
    return;
  }

  try {
    const response = await enqueue(() =>
      callChatWithRetry({
        message: messageContent || "Décris cette image.",
        uid: userId,
        image: imageBase64 || undefined
      })
    );

    const { reply, images, lyrics } = response.data;

    let finalBody = formatCoolText(reply);

    if (lyrics) {
      const title = lyrics.title || "";
      const artist = lyrics.artist || "";
      const lyricsText = lyrics.lyrics || lyrics.text || "";
      if (title || lyricsText) {
        finalBody += `\n\n🎵 ${title}${artist ? " · " + artist : ""}\n${lyricsText}`;
      }
    }

    const attachments = [];
    if (Array.isArray(images) && images.length) {
      for (const imgUrl of images.slice(0, 4)) {
        try { attachments.push(fs.createReadStream(await downloadFile(imgUrl, 'jpg'))); } catch {}
      }
    }

    const sent = await message.reply({
      body: finalBody,
      attachment: attachments.length ? attachments : undefined
    });

    if (sent?.messageID) {
      global.GoatBot.onReply.set(sent.messageID, {
        commandName: 'ai',
        messageID: sent.messageID,
        author: userId
      });
    }

    api.setMessageReaction("✅", event.messageID, () => {}, true);

  } catch (err) {
    console.error("❌ Christus AI error:", err.response?.data || err.message);
    api.setMessageReaction("❌", event.messageID, () => {}, true);
  }
};

module.exports = {
  config: {
    name: 'ai',
    aliases: [],
    version: '3.0',
    author: 'Christus',
    role: 0,
    category: 'ai'
  },

  onStart: async function ({ api, event, args, message }) {
    const input = args.join(' ').trim();

    if (!input) {
      const sticker = getRandomSticker();
      api.sendMessage({ sticker }, event.threadID);
      api.setMessageReaction("🟡", event.messageID, () => {}, true);
      return;
    }

    if (['clear', 'reset'].includes(input.toLowerCase())) {
      return resetConversation(api, event, message);
    }

    return handleAIRequest(api, event, input, message);
  },

  onReply: async function ({ api, event, Reply, message }) {
    if (event.senderID !== Reply.author) return;
    return handleAIRequest(api, event, event.body, message);
  },

  onChat: async function ({ api, event, message }) {
    const body = event.body?.trim();
    if (!body?.toLowerCase().startsWith('ai')) return;

    const input = body.slice(2).trim();

    if (!input) {
      const sticker = getRandomSticker();
      api.sendMessage({ sticker }, event.threadID);
      api.setMessageReaction("🟡", event.messageID, () => {}, true);
      return;
    }

    if (['clear', 'reset'].includes(input.toLowerCase())) {
      return resetConversation(api, event, message);
    }

    return handleAIRequest(api, event, input, message);
  }
};
                                                        
