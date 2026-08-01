const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = {
  config: {
    name: "lyrics",
    version: "3.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    shortDescription: "Récupère les paroles d'une chanson",
    longDescription: "Obtenez les paroles détaillées avec titre, artiste, album et pochette.",
    category: "search",
    guide: {
      en: "{pn} <nom de la chanson>\nExemple: {pn} Adele Hello"
    }
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ");
    if (!query) {
      return api.sendMessage(
        "⚠️ Veuillez donner un nom de chanson !\nExemple: lyrics Adele Hello",
        event.threadID,
        event.messageID
      );
    }

    try {
      const { data } = await axios.get(
        `https://lyric-stream-api.onrender.com/api/lyrics?song=${encodeURIComponent(query)}`,
        { timeout: 15000 }
      );

      if (!data?.success) {
        return api.sendMessage(
          "❌ Paroles non trouvées. Essayez un autre titre ou vérifiez l'orthographe.",
          event.threadID,
          event.messageID
        );
      }

      const { 
        song, 
        artist, 
        album, 
        lyrics, 
        image
      } = data;

      let lyricsText = lyrics || "Paroles non disponibles";

      if (lyricsText.length > 15000) {
        lyricsText = lyricsText.slice(0, 15000) + "\n\n... (suite tronquée)";
      }

      let messageBody = `🎵 ${song || query}\n`;
      if (artist) messageBody += `👤 Artiste: ${artist}\n`;
      if (album) messageBody += `💿 Album: ${album}\n`;
      messageBody += `\n📜 Paroles:\n${lyricsText}`;

      let attachment = null;
      if (image) {
        try {
          const imgExt = image.split(".").pop().split("?")[0] || "jpg";
          const imgName = crypto.createHash("md5").update(image).digest("hex");
          const imgPath = path.join(__dirname, `lyrics_${imgName}.${imgExt}`);

          if (!fs.existsSync(imgPath)) {
            const imgResp = await axios.get(image, { 
              responseType: "stream",
              timeout: 15000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
              }
            });
            
            const writer = fs.createWriteStream(imgPath);
            imgResp.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });
          }

          attachment = fs.createReadStream(imgPath);
          
          setTimeout(() => {
            if (fs.existsSync(imgPath)) {
              try { fs.unlinkSync(imgPath); } catch(e) {}
            }
          }, 3600000);

        } catch (imgError) {
          console.error("Erreur téléchargement image:", imgError.message);
        }
      }

      await api.sendMessage(
        {
          body: messageBody,
          attachment: attachment
        },
        event.threadID,
        () => {
          if (attachment) {
            try {
              const imgPath = attachment.path;
              if (fs.existsSync(imgPath)) {
                fs.unlinkSync(imgPath);
              }
            } catch(e) {}
          }
        },
        event.messageID
      );

    } catch (err) {
      console.error("Erreur API Lyrics:", err);
      
      let errorMsg = "❌ Erreur: Impossible de récupérer les paroles.\n";
      
      if (err.code === 'ECONNABORTED') {
        errorMsg += "⏰ Délai d'attente dépassé. Le serveur est peut-être lent ou la chanson n'existe pas.";
      } else if (err.response?.status === 404) {
        errorMsg += "📭 Aucune parole trouvée pour cette chanson.";
      } else if (err.response?.status === 429) {
        errorMsg += "🚦 Trop de requêtes. Attendez un peu avant de réessayer.";
      } else if (err.response?.status === 500) {
        errorMsg += "🔧 Erreur serveur. Réessayez plus tard.";
      } else {
        errorMsg += "🔧 Essayez plus tard ou vérifiez votre connexion internet.";
      }
      
      api.sendMessage(errorMsg, event.threadID, event.messageID);
    }
  }
};
