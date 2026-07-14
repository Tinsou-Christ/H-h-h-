const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  fonts = { bold: (t) => t, monospace: (t) => t };
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  if (!bytes || bytes <= 0) return `0 ${units[0]}`;
  const i = Math.floor(Math.log2(bytes) / 10);
  return (bytes / 1024 ** i).toFixed(1) + " " + units[i];
}

function getDirSize(root) {
  let size = 0;
  const stack = [root];
  while (stack.length) {
    const currentDir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch { continue; }

    for (const e of entries) {
      const full = path.join(currentDir, e.name);
      try {
        if (e.isDirectory()) stack.push(full);
        else size += fs.statSync(full).size;
      } catch {}
    }
  }
  return size;
}

function sortName(a, b) {
  return a.name.localeCompare(b.name);
}

async function baseApiUrl() {
  const base = await axios.get('https://raw.githubusercontent.com/noobcore404/NC-STORE/refs/heads/main/NCApiUrl.json');
  return base.data.gist;
}

module.exports = {
  config: {
    name: "file",
    aliases: ["explorer", "ls"],
    version: "5.0.0",
    author: "Christus",
    countDown: 0,
    role: 4,
    description: {
      fr: "📁 Explorer + RAW auto pour fichiers"
    },
    category: "owner"
  },

  onStart: async function ({ args, message, event }) {
    const baseDir = process.cwd();
    const inputPath = args[0] || ".";
    const resolved = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(path.join(baseDir, inputPath));

    const dir = resolved.startsWith(baseDir + path.sep) ? resolved : baseDir;

    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
      try {
        const code = await fs.readFile(dir, "utf-8");
        const encoded = encodeURIComponent(code);
        const apiUrl = await baseApiUrl();
        const res = await axios.post(`${apiUrl}/raw`, { code: encoded });
        const link = res.data?.raw_url;
        if (!link) throw new Error();
        return message.reply(`📄 ${path.basename(dir)}\n🔗 RAW:\n${link}`);
      } catch {
        return message.reply(fonts.bold("⚠️ Impossible de générer le RAW."));
      }
    }

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
      return message.reply(fonts.bold("❌ Chemin invalide."));

    const dirs = [];
    const files = [];
    let total = 0;

    try {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        const isDir = ent.isDirectory();
        let size = 0;

        if (!isDir) {
          try { size = fs.statSync(full).size; } catch { size = 0; }
        } else {
          size = getDirSize(full);
        }

        total += size;
        (isDir ? dirs : files).push({ name: ent.name, path: full, isDir, size });
      }
    } catch {
      return message.reply(fonts.bold("❌ Impossible de lire le dossier."));
    }

    const list = [...dirs.sort(sortName), ...files.sort(sortName)];
    if (list.length === 0)
      return message.reply(fonts.bold("📂 Dossier vide."));

    const msg = list.map((f, i) =>
      `${i + 1}. ${f.isDir ? "📁" : "📄"} ${f.name} (${formatBytes(f.size)})`
    ).join("\n") + `\n\n📦 Total : ${formatBytes(total)}\n\n👉 open <num> | del <num...>`;

    const sent = await message.reply(msg);

    global.GoatBot.onReply.set(sent.messageID, {
      commandName: this.config.name,
      author: event.senderID,
      messageID: sent.messageID,
      data: { dir, list }
    });
  },

  onReply: async function ({ Reply, event, message }) {
    if (event.senderID !== Reply.author) return;

    const body = (event.body || "").trim();
    const [cmdRaw, ...rest] = body.split(/\s+/);
    const cmd = cmdRaw?.toLowerCase();
    const list = Reply.data.list || [];

    if (cmd === "open" || cmd === "o") {
      const idx = parseInt(rest[0], 10);
      if (isNaN(idx) || idx < 1 || idx > list.length)
        return message.reply(fonts.bold("❌ Numéro invalide."));

      const target = list[idx - 1];

      if (target.isDir) {
        return this.onStart({ args: [target.path], message, event });
      }

      try {
        const code = await fs.readFile(target.path, "utf-8");
        const encoded = encodeURIComponent(code);
        const apiUrl = await baseApiUrl();
        const res = await axios.post(`${apiUrl}/raw`, { code: encoded });
        const link = res.data?.raw_url;
        if (!link) throw new Error();
        return message.reply(`📄 ${target.name}\n🔗 RAW:\n${link}`);
      } catch {
        return message.reply(fonts.bold("⚠️ Impossible de générer le RAW."));
      }
    }

    if (["del", "rm", "delete"].includes(cmd)) {
      if (rest.length === 0)
        return message.reply(fonts.bold("❌ Donne un numéro."));

      const results = [];

      for (const token of rest) {
        const idx = parseInt(token, 10);
        if (isNaN(idx) || idx < 1 || idx > list.length) continue;

        const f = list[idx - 1];
        try {
          await fs.remove(f.path);
          results.push(`✔ ${f.name}`);
        } catch {
          results.push(`⚠ ${f.name}`);
        }
      }

      return message.reply(fonts.bold(`🧹 Résultat :\n${results.join("\n")}`));
    }

    return message.reply(fonts.bold("❌ open <num> | del <num...>"));
  }
};
