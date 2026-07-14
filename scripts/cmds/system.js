"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  SYSTEM — Gestion du système de fichiers de commandes du bot
//  Basé sur : system.ts de Cassidy (adapté à l'architecture GoatBot)
//  Auteur   : Christus
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {
  fonts = { bold: (t) => t, sansSerif: (t) => t, monospace: (t) => t, apply: (_, t) => t };
}

const { log, removeHomeDir, loadScripts, unloadScripts } = global.utils;

const COMMANDS_DIR = path.join(process.cwd(), "scripts", "cmds");
const TRASH_DIR = path.join(COMMANDS_DIR, "trash");
fs.ensureDirSync(TRASH_DIR);

// Clé publique de démonstration Pastebin, remplace-la par la tienne pour un usage prolongé
const PASTEBIN_API_KEY = "R02n6-lNPJqKQCd5VtL4bKPjuK6ARhHb";

function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

function ensureJsExt(name) {
  return name.endsWith(".js") ? name : `${name}.js`;
}

function stripJsExt(name) {
  return name.endsWith(".js") ? name.slice(0, -3) : name;
}

function isAdminBot(event) {
  const { adminBot } = global.GoatBot.config;
  return Array.isArray(adminBot) && adminBot.includes(event.senderID);
}

module.exports = {
  config: {
    name: "system",
    aliases: ["sys"],
    version: "1.0",
    author: "Christus",
    countDown: 5,
    role: 6,
    description: {
      fr: "Gère les fichiers de commandes et le système du bot (charger, décharger, installer, corbeille)"
    },
    category: "owner",
    guide: {
      fr: `${fonts.sansSerif("SYSTEM — AIDE")}\n` +
        `${fonts.bold("{pn} restart")} : redémarre le bot\n` +
        `${fonts.bold("{pn} load <fichier1> [fichier2] [...]")} : recharge un ou plusieurs fichiers édités\n` +
        `${fonts.bold("{pn} loadall")} : recharge toutes les commandes\n` +
        `${fonts.bold("{pn} unload <fichier>")} : décharge une commande\n` +
        `${fonts.bold("{pn} install <url> <fichier.js>")} : installe une commande depuis une URL\n` +
        `${fonts.bold("{pn} install <fichier.js> <code...>")} : installe une commande depuis du code\n` +
        `${fonts.bold("{pn} trash <fichier>")} : envoie un fichier à la corbeille (et le décharge)\n` +
        `${fonts.bold("{pn} trash list")} : liste les fichiers de la corbeille\n` +
        `${fonts.bold("{pn} trash recover <fichier> [nouveaunom]")} : restaure un fichier de la corbeille\n` +
        `${fonts.bold("{pn} file <fichier>")} : envoie le fichier en pièce jointe\n` +
        `${fonts.bold("{pn} bin <fichier>")} : upload le fichier sur Pastebin\n` +
        `${fonts.bold("{pn} list")} : liste tous les fichiers de commandes\n` +
        `${fonts.bold("{pn} info")} : informations système du bot\n\n` +
        `${fonts.bold("Exemples")}\n` +
        `${fonts.monospace("system load admin.js")}\n` +
        `${fonts.monospace("system trash recover admin.js")}\n` +
        `${fonts.monospace("system bin cmd.js")}`
    }
  },

  langs: {
    fr: {
      notAdmin: "Tu dois être admin du bot pour utiliser cette opération.",
      missingArg: "Veuillez préciser le nom du fichier."
    },
    en: {
      notAdmin: "You must be a bot admin to use this operation.",
      missingArg: "Please specify the file name."
    }
  },

  onStart: async function ({
    args, message, api, event, getLang,
    threadModel, userModel, dashBoardModel, globalModel,
    threadsData, usersData, dashBoardData, globalData
  }) {
    const { configCommands } = global.GoatBot;

    function requireAdmin() {
      if (!isAdminBot(event)) {
        message.reply(fonts.bold(`❌ ${getLang("notAdmin")}`));
        return false;
      }
      return true;
    }

    function doLoad(fileNames) {
      const success = [];
      const failed = [];
      for (const raw of fileNames) {
        const fileName = stripJsExt(raw);
        const info = loadScripts(
          "cmds", fileName, log, configCommands, api,
          threadModel, userModel, dashBoardModel, globalModel,
          threadsData, usersData, dashBoardData, globalData, getLang
        );
        if (info.status === "success") success.push(fileName);
        else failed.push(`${fileName} → ${info.error.name}: ${info.error.message}`);
      }
      let msg = "";
      if (success.length) {
        msg += fonts.bold(`✅ ${success.length} fichier(s) rechargé(s) :\n`) + success.map((f) => `• ${f}`).join("\n");
      }
      if (failed.length) {
        if (msg) msg += "\n\n";
        msg += fonts.bold(`❌ Échec pour ${failed.length} fichier(s) :\n`) + failed.join("\n");
      }
      return message.reply(msg || fonts.bold("⚠️ Rien à recharger."));
    }

    async function doTrashDelete(fileName) {
      fileName = ensureJsExt(fileName);
      if (fileName === "system.js") {
        return message.reply(fonts.bold("❌ Tu ne peux pas mettre ce fichier lui-même à la corbeille."));
      }
      const filePath = path.join(COMMANDS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        return message.reply(fonts.bold(`❌ Le fichier "${fileName}" n'existe pas.`));
      }
      let trashPath = path.join(TRASH_DIR, fileName);
      let num = 0;
      while (fs.existsSync(trashPath)) {
        num++;
        trashPath = path.join(TRASH_DIR, `${num}_${fileName}`);
      }
      fs.copySync(filePath, trashPath);
      try {
        unloadScripts("cmds", stripJsExt(fileName), configCommands, getLang);
      } catch (error) {
        // le fichier peut déjà être déchargé, on continue quand même
      }
      fs.removeSync(filePath);
      return message.reply(fonts.bold(`✅ "${fileName}" a été déplacé vers la corbeille et déchargé.`));
    }

    async function doTrashRecover(trashName, newName) {
      trashName = ensureJsExt(trashName);
      const fileName = ensureJsExt(newName || trashName);
      const trashPath = path.join(TRASH_DIR, trashName);
      const newPath = path.join(COMMANDS_DIR, fileName);
      if (!fs.existsSync(trashPath)) {
        return message.reply(fonts.bold(`❌ Le fichier "${trashName}" n'existe pas dans la corbeille.`));
      }
      if (fs.existsSync(newPath)) {
        return message.reply(fonts.bold(`❌ Le fichier "${fileName}" existe déjà, supprime-le ou mets-le à la corbeille d'abord.`));
      }
      fs.copySync(trashPath, newPath);
      const info = loadScripts(
        "cmds", stripJsExt(fileName), log, configCommands, api,
        threadModel, userModel, dashBoardModel, globalModel,
        threadsData, usersData, dashBoardData, globalData, getLang
      );
      if (info.status === "success") {
        return message.reply(fonts.bold(`✅ "${fileName}" a été restauré et rechargé avec succès.`));
      }
      return message.reply(fonts.bold(`⚠️ "${fileName}" a été restauré mais le rechargement a échoué : ${info.error.name} — ${info.error.message}`));
    }

    async function doFile(fileName) {
      fileName = ensureJsExt(fileName);
      const filePath = path.join(COMMANDS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        return message.reply(fonts.bold(`❌ Le fichier "${fileName}" n'existe pas.`));
      }
      return message.reply({
        body: fonts.bold(`📖 ${fileName}`),
        attachment: fs.createReadStream(filePath)
      });
    }

    async function doBin(fileName) {
      fileName = ensureJsExt(fileName);
      const filePath = path.join(COMMANDS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        return message.reply(fonts.bold(`❌ Le fichier "${fileName}" n'existe pas.`));
      }
      const code = fs.readFileSync(filePath, "utf-8");
      try {
        const params = new URLSearchParams();
        params.append("api_dev_key", PASTEBIN_API_KEY);
        params.append("api_option", "paste");
        params.append("api_paste_code", code);
        params.append("api_paste_name", fileName);
        params.append("api_paste_format", "javascript");
        params.append("api_paste_expire_date", "N");
        params.append("api_paste_private", "1");
        const res = await axios.post("https://pastebin.com/api/api_post.php", params.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const url = String(res.data).trim();
        if (!url.startsWith("http")) throw new Error(url);
        return message.reply(fonts.bold(`✅ "${fileName}" uploadé : `) + url.replace("pastebin.com/", "pastebin.com/raw/"));
      } catch (error) {
        return message.reply(fonts.bold(`❌ Échec de l'upload sur Pastebin : ${error.message}`));
      }
    }

    async function doInstall(rest) {
      let url = rest[0];
      let fileName = rest[1];
      let code;

      if (url && url.endsWith(".js") && !isURL(url)) {
        const tmp = fileName;
        fileName = url;
        url = tmp;
      }

      if (!fileName || !fileName.endsWith(".js")) {
        return message.reply(fonts.bold("❌ Le nom du fichier doit se terminer par .js"));
      }

      if (url && isURL(url)) {
        try {
          if (url.includes("pastebin.com") && !url.includes("/raw/")) {
            url = url.replace("pastebin.com/", "pastebin.com/raw/");
          }
          if (url.includes("github.com") && url.includes("/blob/")) {
            url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
          }
          const res = await axios.get(url);
          code = res.data;
        } catch (error) {
          return message.reply(fonts.bold("❌ Impossible de télécharger le fichier depuis l'URL fournie."));
        }
      } else {
        code = rest.slice(1).join(" ");
      }

      if (!code) {
        return message.reply(fonts.bold("❌ Aucun code à installer."));
      }

      const filePath = path.join(COMMANDS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        const orig = fs.readFileSync(filePath, "utf-8");
        let trashPath = path.join(TRASH_DIR, `replace_${fileName}`);
        let num = 0;
        while (fs.existsSync(trashPath)) {
          num++;
          trashPath = path.join(TRASH_DIR, `${num}_replace_${fileName}`);
        }
        fs.writeFileSync(trashPath, orig);
      }

      fs.writeFileSync(filePath, typeof code === "string" ? code : String(code));

      const info = loadScripts(
        "cmds", stripJsExt(fileName), log, configCommands, api,
        threadModel, userModel, dashBoardModel, globalModel,
        threadsData, usersData, dashBoardData, globalData, getLang
      );
      if (info.status === "success") {
        return message.reply(fonts.bold(`✅ "${fileName}" a été installé et chargé avec succès.`));
      }
      return message.reply(fonts.bold(`❌ Échec du chargement de "${fileName}" : ${info.error.name} — ${info.error.message}`));
    }

    function doList() {
      const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));
      return message.reply(
        fonts.bold(`📃 ${files.length} fichier(s) de commande trouvé(s)\n`) +
        files.map((f) => `• ${f}`).join("\n")
      );
    }

    function doTrashList() {
      const files = fs.readdirSync(TRASH_DIR).filter((f) => f.endsWith(".js"));
      return message.reply(
        fonts.bold(`🗑️ ${files.length} fichier(s) dans la corbeille\n`) +
        (files.length ? files.map((f) => `• ${f}`).join("\n") : "La corbeille est vide.")
      );
    }

    function doInfo() {
      const { commands, aliases, config } = global.GoatBot;
      const uptimeSec = Math.floor((Date.now() - global.GoatBot.startTime) / 1000);
      const h = Math.floor(uptimeSec / 3600);
      const m = Math.floor((uptimeSec % 3600) / 60);
      const s = uptimeSec % 60;
      const mem = process.memoryUsage().rss / 1024 / 1024;
      return message.reply(
        fonts.bold("💽 SYSTEM — INFOS DU BOT") + "\n" +
        `Commandes chargées : ${commands.size}\n` +
        `Alias enregistrés : ${aliases.size}\n` +
        `Administrateurs du bot : ${(config.adminBot || []).length}\n` +
        `Uptime : ${h}h ${m}m ${s}s\n` +
        `Mémoire utilisée : ${mem.toFixed(1)} Mo`
      );
    }

    const sub = (args[0] || "").toLowerCase();

    switch (sub) {
      case "restart": {
        if (!requireAdmin()) return;
        await message.reply(fonts.bold("♻️ Redémarrage du bot..."));
        return process.exit(2);
      }

      case "load": {
        if (!requireAdmin()) return;
        const files = args.slice(1);
        if (!files.length) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
        return doLoad(files);
      }

      case "loadall": {
        if (!requireAdmin()) return;
        const files = fs.readdirSync(COMMANDS_DIR)
          .filter((f) => f.endsWith(".js") && !(configCommands.commandUnload || []).includes(f))
          .map((f) => stripJsExt(f));
        return doLoad(files);
      }

      case "unload": {
        if (!requireAdmin()) return;
        if (!args[1]) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
        try {
          const info = unloadScripts("cmds", stripJsExt(args[1]), configCommands, getLang);
          return message.reply(fonts.bold(`✅ "${info.name}" a été déchargé avec succès.`));
        } catch (error) {
          return message.reply(fonts.bold(`❌ Échec du déchargement : ${error.name} — ${error.message}`));
        }
      }

      case "install": {
        if (!requireAdmin()) return;
        if (args.length < 3) return message.reply(fonts.bold("❌ Veuillez fournir une URL ou du code, ainsi que le nom du fichier."));
        return doInstall(args.slice(1));
      }

      case "trash": {
        if (!requireAdmin()) return;
        const action = args[1];
        if (action === "list") return doTrashList();
        if (action === "recover") {
          if (!args[2]) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
          return doTrashRecover(args[2], args[3]);
        }
        if (!action) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
        return doTrashDelete(action);
      }

      case "file":
      case "send": {
        if (!requireAdmin()) return;
        if (!args[1]) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
        return doFile(args[1]);
      }

      case "bin":
      case "paste": {
        if (!requireAdmin()) return;
        if (!args[1]) return message.reply(fonts.bold(`❌ ${getLang("missingArg")}`));
        return doBin(args[1]);
      }

      case "list":
      case "files": {
        return doList();
      }

      case "info": {
        return doInfo();
      }

      default: {
        return message.reply(this.config.guide.fr.replace(/\{pn\}/g, "system"));
      }
    }
  }
};
