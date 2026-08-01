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

const API_ENDPOINT = "https://future-chat-api.onrender.com/chat";
const CLEAR_ENDPOINT = "https://future-chat-api.onrender.com/chat/clear";
const TMP_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const getRandomSticker = () => {
  return STICKERS[Math.floor(Math.random() * STICKERS.length)];
};

const formatCoolText = (text) => {
  if (!text) return "";
  return fonts.sansSerif(text);
};

const downloadFile = async (url, ext) => {
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
};

const resetConversation = async (api, event, message) => {
  api.setMessageReaction("♻️", event.messageID, () => {}, true);
  try {
    await axios.delete(`${CLEAR_ENDPOINT}/${event.senderID}`);
    return message.reply("✅ Conversation réinitialisée.");
  } catch {
    return message.reply("❌ Échec de la réinitialisation.");
  }
};

const handleAIRequest = async (api, event, userInput, message) => {
  const userId = event.senderID;
  let imageUrl = null;
  let messageContent = userInput;

  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  if (event.messageReply) {
    const att = event.messageReply.attachments?.[0];
    if (att?.type === 'photo') imageUrl = att.url;
  }

  const urlMatch = messageContent.match(/(https?:\/\/[^\s]+)/)?.[0];
  if (urlMatch && validUrl.isWebUri(urlMatch)) {
    imageUrl = urlMatch;
    messageContent = messageContent.replace(urlMatch, '').trim();
  }

  if (!messageContent && !imageUrl) {
    api.setMessageReaction("❌", event.messageID, () => {}, true);
    return message.reply("❌ Veuillez fournir un message ou une image.");
  }

  try {
    const response = await axios.post(
      API_ENDPOINT,
      { uid: userId, message: messageContent, image_url: imageUrl },
      { timeout: 60000 }
    );

    const { reply, model } = response.data;

    const finalBody = formatCoolText(reply);

    let attachments = [];
    if (imageUrl) {
      try {
        attachments.push(fs.createReadStream(await downloadFile(imageUrl, 'jpg')));
      } catch (e) {}
    }

    const sent = await message.reply({
      body: `🤖 Christus AI\n━━━━━━━━━\n${finalBody}\n━━━━━━━━━\n🔮 Modèle: ${model || 'GPT-5.6'}`,
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
    console.error(err);
    
    let errorMsg = "❌ Désolé, une erreur est survenue.\n";
    if (err.code === 'ECONNABORTED') {
      errorMsg += "⏰ Le serveur met trop de temps à répondre.";
    } else if (err.response?.status === 429) {
      errorMsg += "🚦 Trop de requêtes. Attendez un peu.";
    } else if (err.response?.status === 503) {
      errorMsg += "🔧 Service en maintenance. Réessayez plus tard.";
    } else {
      errorMsg += "🔧 Erreur interne. Réessayez plus tard.";
    }
    
    message.reply(errorMsg);
    api.setMessageReaction("❌", event.messageID, () => {}, true);
  }
};

module.exports = {
  config: {
    name: 'ai',
    aliases: [],
    version: '3.0.0',
    author: 'Christus',
    role: 0,
    category: 'ai',
    shortDescription: { en: 'Chat with Christus AI (GPT-5.6)' },
    longDescription: { en: 'Advanced AI chat with image recognition support.' },
    guide: { en: '{pn} <message> | {pn} clear' }
  },

  onStart: async function ({ api, event, args, message }) {
    const input = args.join(' ').trim();

    if (!input) {
      const sticker = getRandomSticker();
      api.sendMessage({ sticker }, event.threadID);
      api.setMessageReaction("🟡", event.messageID, () => {}, true);
      return message.reply(
        "🤖 Christus AI\n━━━━━━━━━\n" +
        "💬 Envoyez un message pour discuter avec moi.\n" +
        "🖼️ Répondez à un message avec une image.\n" +
        "♻️ Tapez 'ai clear' pour réinitialiser la conversation.\n" +
        "━━━━━━━━━\n🔮 Modèle: GPT-5.6"
      );
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
