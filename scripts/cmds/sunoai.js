const a = require("axios");
const b = require("fs");
const c = require("path");
const d = c.join(__dirname, "cache");
if (!b.existsSync(d)) b.mkdirSync(d);

const e = ["pop", "rock", "rap", "jazz", "electronic", "classical"];

module.exports = {
  config: {
    name: "sunoai",
    aliases: ["suno"],
    version: "2.9",
    author: "Christus",
    countDown: 20,
    role: 0,
    shortDescription: { en: "Generate AI music with Q&A" },
    longDescription: {
      en: "Interactive SunoAI music generation with prompt, lyrics, tags, and instrumental."
    },
    category: "ai",
    guide: { en: "{pn} → Start generating music interactively" }
  },

  onStart: async function ({ message: f, event: g, api: h }) {
    const i = await f.reply("🎤 𝗪𝗵𝗮𝘁’𝘀 𝘆𝗼𝘂𝗿 𝘀𝗼𝗻𝗴 𝗽𝗿𝗼𝗺𝗽𝘁?");
    global.GoatBot.onReply.set(i.messageID, {
      commandName: "sunoai",
      step: "a",
      author: g.senderID,
      data: {},
      oldMsgID: i.messageID
    });
  },

  onReply: async function ({ message: j, event: k, Reply: l, api: m }) {
    if (k.senderID !== l.author) return;

    const { step: n, data: o, oldMsgID: p } = l;
    if (p) try { m.unsendMessage(p); } catch {}

    let q;

    if (n === "a") {
      o.prompt = k.body;
      q = await j.reply("✍️ 𝗪𝗮𝗻𝘁 𝘁𝗼 𝗮𝗱𝗱 𝗰𝘂𝘀𝘁𝗼𝗺 𝗹𝘆𝗿𝗶𝗰𝘀? (send lyrics or reply 'no')");
      global.GoatBot.onReply.set(q.messageID, {
        commandName: "sunoai",
        step: "b",
        author: k.senderID,
        data: o,
        oldMsgID: q.messageID
      });

    } else if (n === "b") {
      const r = k.body.trim().toLowerCase();
      o.lyrics = r === "no" ? undefined : k.body;
      q = await j.reply("🥁 𝗜𝗻𝘀𝘁𝗿𝘂𝗺𝗲𝗻𝘁𝗮𝗹 𝗼𝗻𝗹𝘆? (yes/no)");
      global.GoatBot.onReply.set(q.messageID, {
        commandName: "sunoai",
        step: "c",
        author: k.senderID,
        data: o,
        oldMsgID: q.messageID
      });

    } else if (n === "c") {
      const s = k.body.trim().toLowerCase();
      o.instrumental = s === "yes" || s === "y";
      q = await j.reply(
        `🎼 𝗔𝗱𝗱 𝘁𝗮𝗴𝘀 (comma-separated) or reply 'no'\n\n✅ 𝗩𝗮𝗹𝗶𝗱 𝘁𝗮𝗴𝘀:\n${e.join(", ")}`
      );
      global.GoatBot.onReply.set(q.messageID, {
        commandName: "sunoai",
        step: "d",
        author: k.senderID,
        data: o,
        oldMsgID: q.messageID
      });

    } else if (n === "d") {
      const t = k.body.toLowerCase().trim();

      if (t === "no") {
        o.tags = undefined;
      } else {
        const u = t.split(",").map(v => v.trim());
        const w = u.filter(x => !e.includes(x));
        if (w.length > 0)
          return j.reply(`❌ 𝗜𝗻𝘃𝗮𝗹𝗶𝗱 𝘁𝗮𝗴(𝘀): ${w.join(", ")}\n\n✅ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘂𝘀𝗲 𝗼𝗻𝗹𝘆:\n${e.join(", ")}`);
        o.tags = u.join(",");
      }

      const x = await j.reply("⏳ 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗶𝗻𝗴 𝘆𝗼𝘂𝗿 𝘀𝗼𝗻𝗴, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁...");

      const y = { instrumental: o.instrumental };
      const A = !!o.prompt;
      const B = !!o.lyrics;
      const C = !!o.tags;

      if (A && B && C) {
        y.prompt = o.prompt;
        y.lyrics = o.lyrics;
      } else {
        if (A) y.prompt = o.prompt;
        if (B) y.lyrics = o.lyrics;
        if (C) y.tags = o.tags;
      }

      try {
        const D = await a.get("https://ai-song-crafter.onrender.com/sunoai", { params: y });

        const {
          song_paths: E,
          prompt: F,
          lyrics: G,
          tags: H,
          seed: I,
          prompt_strength: J,
          balance_strength: K
        } = D.data;

        if (!E?.length) return j.reply("❌ 𝗙𝗮𝗶𝗹𝗲𝗱 𝘁𝗼 𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗲 𝘀𝗼𝗻𝗴.");

        const L = E[0];
        const M = c.join(d, `${Date.now()}.ogg`);
        const N = await a.get(L, { responseType: "stream" });

        if (x?.messageID) try { m.unsendMessage(x.messageID); } catch {}

        N.data.pipe(b.createWriteStream(M)).on("finish", () => {
          const O =
            `🎶 𝗦𝘂𝗻𝗼 𝗔𝗜\n\n` +
            `🎤 𝗣𝗿𝗼𝗺𝗽𝘁: ${F || "None"}\n` +
            `📝 𝗟𝘆𝗿𝗶𝗰𝘀: ${G ? "Yes" : "No"}\n` +
            `🥁 𝗜𝗻𝘀𝘁𝗿𝘂𝗺𝗲𝗻𝘁𝗮𝗹: ${o.instrumental ? "Yes" : "No"}\n` +
            `🏷️ 𝗧𝗮𝗴𝘀: ${H?.join(", ") || "None"}\n` +
            `🎲 𝗦𝗲𝗲𝗱: ${I || "Random"}\n` +
            `💡 𝗣𝗿𝗼𝗺𝗽𝘁 𝗦𝘁𝗿𝗲𝗻𝗴𝘁𝗵: ${J}\n` +
            `⚖️ 𝗕𝗮𝗹𝗮𝗻𝗰𝗲 𝗦𝘁𝗿𝗲𝗻𝗴𝘁𝗵: ${K}`;

          j.reply({ body: O, attachment: b.createReadStream(M) }, () => b.unlinkSync(M));
        });

      } catch (P) {
        console.error("❌ 𝗘𝗿𝗿𝗼𝗿:", P.response?.data || P.message);
        j.reply("❌ 𝗦𝗼𝗻𝗴 𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗶𝗼𝗻 𝗳𝗮𝗶𝗹𝗲𝗱. 𝗧𝗿𝘆 𝗮𝗴𝗮𝗶𝗻 𝗼𝗿 𝗿𝗲𝗱𝘂𝗰𝗲 𝗶𝗻𝗽𝘂𝘁𝘀.");
      }
    }
  }
};
        
