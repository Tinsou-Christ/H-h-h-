const axios = require("axios");

module.exports = {
  config: {
    name: "lyrics",
    aliases: ["paroles", "songlyrics"],
    version: "2.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    shortDescription: "Obtenir les paroles d'une chanson",
    category: "tools",
    guide: "{pn} [nom de la chanson]"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const songName = args.join(" ");

    if (!songName) {
      return api.sendMessage(
        "╭─❍\n│ Veuillez fournir un nom de chanson !\n╰───────────⟡",
        threadID,
        messageID
      );
    }

    const waitMsg = await api.sendMessage(
      `🔍 | Recherche des paroles pour : ${songName}...`,
      threadID,
      messageID
    );

    try {
      const res = await axios.get(
        `https://azadx69x-all-apis-top.vercel.app/api/lyrics?song=${encodeURIComponent(songName)}`
      );

      if (res.data.success && res.data.lyrics) {
        const { song, artist, lyrics, image, url } = res.data;

        const truncatedLyrics = lyrics.length > 1500 
          ? lyrics.substring(0, 1500) + "...\n[Paroles tronquées]"
          : lyrics;

        const responseText = 
`╭───────❍
│  『 𝗣𝗔𝗥𝗢𝗟𝗘𝗦 』
╰───────────⟡
🎵 𝗧𝗶𝘁𝗿𝗲    : ${song}
👤 𝗔𝗿𝘁𝗶𝘀𝘁𝗲 : ${artist}
📸 𝗣𝗼𝘂𝗿𝗰𝗲𝗹𝗹𝗲 : ${image || "Non disponible"}
🔗 𝗟𝗶𝗲𝗻    : ${url || "Non disponible"}

📜 𝗣𝗮𝗿𝗼𝗹𝗲𝘀 :
━━━━━━━━━━━━━━━━━━
${truncatedLyrics}
━━━━━━━━━━━━━━━━━━
🎵 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗖𝗵𝗿𝗶𝘀𝘁𝘂𝘀`;

        return api.editMessage(responseText, waitMsg.messageID);
      } else {
        throw new Error(res.data.message || "Aucune donnée trouvée");
      }
    } catch (error) {
      console.error("Erreur lyrics:", error);
      return api.editMessage(
        `❌ Impossible de trouver les paroles pour "${songName}" !
        
💡 Vérifiez l'orthographe ou essayez avec :
• Le nom complet de la chanson
• Artiste + titre (ex: "Tiakola TIA")
• Un autre titre`,
        waitMsg.messageID
      );
    }
  }
};
