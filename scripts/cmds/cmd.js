const axios = require("axios");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const { client } = global;

const { configCommands } = global.GoatBot;
const { log, loading, removeHomeDir } = global.utils;

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  fonts = { bold: (t) => t, sansSerif: (t) => t, monospace: (t) => t };
}

function getDomain(url) {
  const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  config: {
    name: "cmd",
    aliases: ["commande", "gestioncmd"],
    version: "1.17",
    author: "Christus",
    countDown: 5,
    role: 6,
    description: {
      fr: "📦 Gérer les fichiers de commandes du bot (charger, décharger, installer)"
    },
    category: "owner",
    guide: {
      fr: `${fonts.sansSerif("✨ GESTION DES COMMANDES ✨")}\n` +
           `${fonts.bold("{pn} load <nom_fichier>")} : charger une commande\n` +
           `${fonts.bold("{pn} loadAll")} : charger toutes les commandes\n` +
           `${fonts.bold("{pn} unload <nom_fichier>")} : décharger une commande\n` +
           `${fonts.bold("{pn} install <url> <fichier.js>")} : installer depuis une URL\n` +
           `${fonts.bold("{pn} install <fichier.js> <code>")} : installer depuis un code\n\n` +
           `${fonts.bold("💡 Exemples :")}\n` +
           `• ${fonts.monospace("cmd load admin")}\n` +
           `• ${fonts.monospace("cmd install admin.js code...")}\n` +
           `• ${fonts.monospace("cmd unload admin")}`
    }
  },

  onStart: async ({ args, message, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, event, commandName, getLang }) => {
    const { unloadScripts, loadScripts } = global.utils;

    if (!args[0] || args[0].toLowerCase() === "help") {
      const helpMsg = `${fonts.bold("🚀 COMMANDES DISPONIBLES")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${fonts.bold("load <commande>")} – charge une commande\n` +
        `${fonts.bold("loadAll")} – charge toutes les commandes\n` +
        `${fonts.bold("unload <commande>")} – décharge une commande\n` +
        `${fonts.bold("install <url> <fichier.js>")} – installe depuis une URL\n` +
        `${fonts.bold("install <fichier.js> <code>")} – installe depuis un code\n\n` +
        `${fonts.bold("📌 Exemples :")}\n` +
        `• ${fonts.monospace("cmd load admin")}\n` +
        `• ${fonts.monospace("cmd install admin.js code...")}\n` +
        `• ${fonts.monospace("cmd unload admin")}`;
      return message.reply(helpMsg);
    }

    if (args[0] === "load" && args.length === 2) {
      if (!args[1]) return message.reply(fonts.bold("❌ Veuillez préciser le nom de la commande à charger."));
      const infoLoad = loadScripts("cmds", args[1], log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang);
      if (infoLoad.status === "success") {
        message.reply(fonts.bold(`✅ Commande "${infoLoad.name}" chargée avec succès.`));
      } else {
        message.reply(fonts.bold(`❌ Échec du chargement de "${infoLoad.name}" : ${infoLoad.error.name} — ${infoLoad.error.message}`));
      }
    }
    else if ((args[0] || "").toLowerCase() === "loadall" || (args[0] === "load" && args.length > 2)) {
      const fileNeedToLoad = args[0].toLowerCase() === "loadall" ?
        fs.readdirSync(__dirname)
          .filter(file =>
            file.endsWith(".js") &&
            !file.match(/(eg)\.js$/g) &&
            (process.env.NODE_ENV === "development" ? true : !file.match(/(dev)\.js$/g)) &&
            !configCommands.commandUnload?.includes(file)
          )
          .map(item => item.split(".")[0]) :
        args.slice(1);
      const successList = [];
      const failList = [];

      for (const fileName of fileNeedToLoad) {
        const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang);
        if (infoLoad.status === "success") successList.push(fileName);
        else failList.push(`❌ ${fileName} → ${infoLoad.error.name}: ${infoLoad.error.message}`);
      }

      let msg = "";
      if (successList.length) msg += fonts.bold(`✅ ${successList.length} commande(s) chargée(s) avec succès.`);
      if (failList.length) {
        if (msg) msg += "\n\n";
        msg += fonts.bold(`❌ Échec du chargement de ${failList.length} commande(s) :\n`) + failList.join("\n");
      }
      message.reply(msg);
    }
    else if (args[0] === "unload") {
      if (!args[1]) return message.reply(fonts.bold("❌ Veuillez préciser le nom de la commande à décharger."));
      try {
        const infoUnload = unloadScripts("cmds", args[1], configCommands, getLang);
        if (infoUnload.status === "success") {
          message.reply(fonts.bold(`✅ Commande "${infoUnload.name}" déchargée avec succès.`));
        } else {
          message.reply(fonts.bold(`❌ Échec du déchargement de "${infoUnload.name}" : ${infoUnload.error.name} — ${infoUnload.error.message}`));
        }
      } catch (error) {
        message.reply(fonts.bold(`❌ Échec du déchargement : ${error.name} — ${error.message}`));
      }
    }
    else if (args[0] === "install") {
      let url = args[1];
      let fileName = args[2];
      let rawCode;

      if (!url || !fileName) return message.reply(fonts.bold("❌ Veuillez fournir l’URL (ou le code) et le nom du fichier."));

      if (url.endsWith(".js") && !isURL(url)) {
        const tmp = fileName;
        fileName = url;
        url = tmp;
      }

      if (url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
        if (!fileName || !fileName.endsWith(".js")) return message.reply(fonts.bold("❌ Nom de fichier invalide, il doit se terminer par .js"));

        const domain = getDomain(url);
        if (!domain) return message.reply(fonts.bold("❌ Domaine non reconnu."));

        if (domain === "pastebin.com") {
          const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
          if (url.match(regex)) url = url.replace(regex, "https://pastebin.com/raw/$1");
          if (url.endsWith("/")) url = url.slice(0, -1);
        } else if (domain === "github.com") {
          const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
          if (url.match(regex)) url = url.replace(regex, "https://raw.githubusercontent.com/$1/$2");
        }

        rawCode = (await axios.get(url)).data;

        if (domain === "savetext.net") {
          const $ = cheerio.load(rawCode);
          rawCode = $("#content").text();
        }
      } else {
        if (args[args.length - 1].endsWith(".js")) {
          fileName = args[args.length - 1];
          rawCode = event.body.slice(event.body.indexOf('install') + 7, event.body.indexOf(fileName) - 1);
        } else if (args[1].endsWith(".js")) {
          fileName = args[1];
          rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1);
        } else {
          return message.reply(fonts.bold("❌ Nom de fichier manquant ou invalide."));
        }
      }

      if (!rawCode) return message.reply(fonts.bold("❌ Impossible de récupérer le code source."));

      if (fs.existsSync(path.join(__dirname, fileName))) {
        try {
          fs.unlinkSync(path.join(__dirname, fileName));
        } catch (err) {}
      }

      const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode);
      if (infoLoad.status === "success") {
        message.reply(fonts.bold(`✅ Commande "${infoLoad.name}" installée avec succès. Fichier : ${path.join(__dirname, fileName).replace(process.cwd(), "")}`));
      } else {
        message.reply(fonts.bold(`❌ Échec de l’installation de "${infoLoad.name}" : ${infoLoad.error.name} — ${infoLoad.error.message}`));
      }
    }
    else {
      message.reply(fonts.bold("❓ Commande inconnue. Utilisez `cmd help` pour voir les commandes disponibles."));
    }
  },

  onReaction: async function ({ Reaction, message, event, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang }) {
    const { loadScripts } = global.utils;
    const { author, data: { fileName, rawCode } } = Reaction;
    if (event.userID !== author) return;
    const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode);
    if (infoLoad.status === "success") {
      message.reply(fonts.bold(`✅ Commande "${infoLoad.name}" installée avec succès. Fichier : ${path.join(__dirname, fileName).replace(process.cwd(), "")}`));
    } else {
      message.reply(fonts.bold(`❌ Échec de l’installation : ${infoLoad.error.name} — ${infoLoad.error.message}`));
    }
  }
};

// Ne pas modifier ce qui suit – utilisé par le système de chargement
const packageAlready = [];
const spinner = "\\|/-";
let count = 0;

function loadScripts(folder, fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode) {
  const storageCommandFilesPath = global.GoatBot[folder == "cmds" ? "commandFilesPath" : "eventCommandsFilesPath"];

  try {
    if (rawCode) {
      fileName = fileName.slice(0, -3);
      fs.writeFileSync(path.normalize(`${process.cwd()}/scripts/${folder}/${fileName}.js`), rawCode);
    }
    const regExpCheckPackage = /require(\s+|)\((\s+|)[`'"]([^`'"]+)[`'"](\s+|)\)/g;
    const { GoatBot } = global;
    const { onFirstChat: allOnFirstChat, onChat: allOnChat, onEvent: allOnEvent, onAnyEvent: allOnAnyEvent } = GoatBot;
    let setMap, typeEnvCommand, commandType;
    if (folder == "cmds") {
      typeEnvCommand = "envCommands";
      setMap = "commands";
      commandType = "command";
    } else if (folder == "events") {
      typeEnvCommand = "envEvents";
      setMap = "eventCommands";
      commandType = "event command";
    }
    let pathCommand;
    if (process.env.NODE_ENV == "development") {
      const devPath = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.dev.js`);
      if (fs.existsSync(devPath)) pathCommand = devPath;
      else pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.js`);
    } else {
      pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.js`);
    }

    const contentFile = fs.readFileSync(pathCommand, "utf8");
    let allPackage = contentFile.match(regExpCheckPackage);
    if (allPackage) {
      allPackage = allPackage
        .map(p => p.match(/[`'"]([^`'"]+)[`'"]/)[1])
        .filter(p => p.indexOf("/") !== 0 && p.indexOf("./") !== 0 && p.indexOf("../") !== 0 && p.indexOf(__dirname) !== 0);
      for (let packageName of allPackage) {
        if (packageName.startsWith('@')) packageName = packageName.split('/').slice(0, 2).join('/');
        else packageName = packageName.split('/')[0];

        if (!packageAlready.includes(packageName)) {
          packageAlready.push(packageName);
          if (!fs.existsSync(`${process.cwd()}/node_modules/${packageName}`)) {
            let wating;
            try {
              wating = setInterval(() => {
                count++;
                loading.info("PACKAGE", `Installing ${packageName} ${spinner[count % spinner.length]}`);
              }, 80);
              execSync(`npm install ${packageName} --save`, { stdio: "pipe" });
              clearInterval(wating);
              if (typeof process.stderr.clearLine === "function") process.stderr.clearLine(0);
            } catch (error) {
              clearInterval(wating);
              if (typeof process.stderr.clearLine === "function") process.stderr.clearLine(0);
              throw new Error(`Can't install package ${packageName}`);
            }
          }
        }
      }
    }
    const oldCommand = require(pathCommand);
    const oldCommandName = oldCommand?.config?.name;
    if (!oldCommandName) {
      if (GoatBot[setMap].get(oldCommandName)?.location != pathCommand)
        throw new Error(`${commandType} name "${oldCommandName}" is already exist in command "${removeHomeDir(GoatBot[setMap].get(oldCommandName)?.location || "")}"`);
    }
    if (oldCommand.config.aliases) {
      let oldAliases = oldCommand.config.aliases;
      if (typeof oldAliases == "string") oldAliases = [oldAliases];
      for (const alias of oldAliases) GoatBot.aliases.delete(alias);
    }
    delete require.cache[require.resolve(pathCommand)];

    const command = require(pathCommand);
    command.location = pathCommand;
    const configCommand = command.config;
    if (!configCommand || typeof configCommand != "object") throw new Error("config of command must be an object");
    const scriptName = configCommand.name;

    const indexOnChat = allOnChat.findIndex(item => item == oldCommandName);
    if (indexOnChat != -1) allOnChat.splice(indexOnChat, 1);

    const indexOnFirstChat = allOnChat.findIndex(item => item == oldCommandName);
    let oldOnFirstChat;
    if (indexOnFirstChat != -1) {
      oldOnFirstChat = allOnFirstChat[indexOnFirstChat];
      allOnFirstChat.splice(indexOnFirstChat, 1);
    }

    const indexOnEvent = allOnEvent.findIndex(item => item == oldCommandName);
    if (indexOnEvent != -1) allOnEvent.splice(indexOnEvent, 1);

    const indexOnAnyEvent = allOnAnyEvent.findIndex(item => item == oldCommandName);
    if (indexOnAnyEvent != -1) allOnAnyEvent.splice(indexOnAnyEvent, 1);

    if (command.onLoad) command.onLoad({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData });

    const { envGlobal, envConfig } = configCommand;
    if (!command.onStart) throw new Error('Function onStart is missing!');
    if (typeof command.onStart != "function") throw new Error('Function onStart must be a function!');
    if (!scriptName) throw new Error('Name of command is missing!');
    if (configCommand.aliases) {
      let { aliases } = configCommand;
      if (typeof aliases == "string") aliases = [aliases];
      for (const alias of aliases) {
        if (aliases.filter(item => item == alias).length > 1) throw new Error(`alias "${alias}" duplicate in ${commandType} "${scriptName}" with file name "${removeHomeDir(pathCommand || "")}"`);
        if (GoatBot.aliases.has(alias)) throw new Error(`alias "${alias}" is already exist in ${commandType} "${GoatBot.aliases.get(alias)}" with file name "${removeHomeDir(GoatBot[setMap].get(GoatBot.aliases.get(alias))?.location || "")}"`);
        GoatBot.aliases.set(alias, scriptName);
      }
    }
    if (envGlobal) {
      if (typeof envGlobal != "object" || Array.isArray(envGlobal)) throw new Error("envGlobal must be an object");
      for (const key in envGlobal) configCommands.envGlobal[key] = envGlobal[key];
    }
    if (envConfig && typeof envConfig == "object" && !Array.isArray(envConfig)) {
      if (!configCommands[typeEnvCommand][scriptName]) configCommands[typeEnvCommand][scriptName] = {};
      configCommands[typeEnvCommand][scriptName] = envConfig;
    }
    GoatBot[setMap].delete(oldCommandName);
    GoatBot[setMap].set(scriptName, command);
    fs.writeFileSync(client.dirConfigCommands, JSON.stringify(configCommands, null, 2));
    const keyUnloadCommand = folder == "cmds" ? "commandUnload" : "commandEventUnload";
    const findIndex = (configCommands[keyUnloadCommand] || []).indexOf(`${fileName}.js`);
    if (findIndex != -1) configCommands[keyUnloadCommand].splice(findIndex, 1);
    fs.writeFileSync(client.dirConfigCommands, JSON.stringify(configCommands, null, 2));

    if (command.onChat) allOnChat.push(scriptName);
    if (command.onFirstChat) allOnFirstChat.push({ commandName: scriptName, threadIDsChattedFirstTime: oldOnFirstChat?.threadIDsChattedFirstTime || [] });
    if (command.onEvent) allOnEvent.push(scriptName);
    if (command.onAnyEvent) allOnAnyEvent.push(scriptName);

    const indexStorageCommandFilesPath = storageCommandFilesPath.findIndex(item => item.filePath == pathCommand);
    if (indexStorageCommandFilesPath != -1) storageCommandFilesPath.splice(indexStorageCommandFilesPath, 1);
    storageCommandFilesPath.push({
      filePath: pathCommand,
      commandName: [scriptName, ...configCommand.aliases || []]
    });

    return { status: "success", name: fileName, command };
  } catch (err) {
    const defaultError = new Error();
    defaultError.name = err.name;
    defaultError.message = err.message;
    defaultError.stack = err.stack;
    err.stack ? err.stack = removeHomeDir(err.stack || "") : "";
    fs.writeFileSync(global.client.dirConfigCommands, JSON.stringify(configCommands, null, 2));
    return { status: "failed", name: fileName, error: err, errorWithThoutRemoveHomeDir: defaultError };
  }
}

function unloadScripts(folder, fileName, configCommands, getLang) {
  const pathCommand = `${process.cwd()}/scripts/${folder}/${fileName}.js`;
  if (!fs.existsSync(pathCommand)) {
    const err = new Error(getLang("missingFile", `${fileName}.js`));
    err.name = "FileNotFound";
    throw err;
  }
  const command = require(pathCommand);
  const commandName = command.config?.name;
  if (!commandName) throw new Error(getLang("invalidFileName", `${fileName}.js`));
  const { GoatBot } = global;
  const { onChat: allOnChat, onEvent: allOnEvent, onAnyEvent: allOnAnyEvent } = GoatBot;
  const indexOnChat = allOnChat.findIndex(item => item == commandName);
  if (indexOnChat != -1) allOnChat.splice(indexOnChat, 1);
  const indexOnEvent = allOnEvent.findIndex(item => item == commandName);
  if (indexOnEvent != -1) allOnEvent.splice(indexOnEvent, 1);
  const indexOnAnyEvent = allOnAnyEvent.findIndex(item => item == commandName);
  if (indexOnAnyEvent != -1) allOnAnyEvent.splice(indexOnAnyEvent, 1);
  if (command.config.aliases) {
    let aliases = command.config?.aliases || [];
    if (typeof aliases == "string") aliases = [aliases];
    for (const alias of aliases) GoatBot.aliases.delete(alias);
  }
  const setMap = folder == "cmds" ? "commands" : "eventCommands";
  delete require.cache[require.resolve(pathCommand)];
  GoatBot[setMap].delete(commandName);
  log.master("UNLOADED", getLang("unloaded", commandName));
  const commandUnload = configCommands[folder == "cmds" ? "commandUnload" : "commandEventUnload"] || [];
  if (!commandUnload.includes(`${fileName}.js`)) commandUnload.push(`${fileName}.js`);
  configCommands[folder == "cmds" ? "commandUnload" : "commandEventUnload"] = commandUnload;
  fs.writeFileSync(global.client.dirConfigCommands, JSON.stringify(configCommands, null, 2));
  return { status: "success", name: fileName };
}

global.utils.loadScripts = loadScripts;
global.utils.unloadScripts = unloadScripts;
