const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GoatMart = "https://christus-mart.vercel.app"; // Christus Store

module.exports = {
  config: {
    name: "christustore",
    aliases: ["cs", "store"],
    shortDescription: { en: "✝️ Christus Store - Command Marketplace" },
    longDescription: { en: "Browse, search, upload and manage commands on Christus Store (GoatBot, Mirai Bot, AutoBot)." },
    category: "utility",
    version: "3.0",
    role: 0,
    author: "Christus",
    cooldowns: 0,
  },

  onStart: async ({ api, event, args, message }) => {
    // Design minimal - Christus Store : pas de cadres, une seule ligne de titre.
    // On passe par api.sendMessage() directement (au lieu de message.reply)
    // car message.reply() applique automatiquement fonts.auto() à TOUT le texte
    // (via applyAutoFont dans utils.js), ce qui transforme même les liens en
    // caractères unicode stylés et les rend illisibles/non cliquables.
    // api.sendMessage() ne passe pas par ce filtre : le texte (et les liens) restent normaux.
    const a = (title, content) =>
      api.sendMessage(`✝️ Christus Store · ${title}\n\n${content}`, event.threadID, event.messageID);

    const b = (error, action) => {
      console.error(`Christus Store ${action} error:`, error);

      if (error.response?.status === 503) return a("Maintenance", "🚧 Service en maintenance, réessaie plus tard.");
      if (error.response?.status === 404) return a("Introuvable", "❌ La ressource demandée n'existe pas.");
      if (error.response?.status === 500) return a("Erreur serveur", "⚠️ Réessaie dans quelques instants.");

      if (["ECONNREFUSED", "ENOTFOUND"].includes(error.code)) {
        return a("Connexion", `🔌 Impossible de joindre Christus Store.\n${GoatMart}`);
      }

      if (error.response?.data?.maintenanceMode) {
        return a("Maintenance", `🚧 ${error.response.data.title}\n💬 ${error.response.data.message}` +
          (error.response.data.estimatedTime ? `\n⏰ Estimé : ${error.response.data.estimatedTime}` : ""));
      }

      return a("Erreur", `❌ Impossible de ${action}.\nStatut : ${error.response?.status || "Inconnu"}\n${error.response?.data?.error || error.message || "Erreur inconnue"}`);
    };

    const catEmoji = { goatbot: "🐐", mirai: "🌸", autobot: "🤖" };
    const listItems = (items, offset = 0) =>
      items.map((x, y) =>
        `${offset + y + 1}. ${catEmoji[x.category] || "📦"} ${x.itemName} (ID: ${x.itemID})\n👀 ${x.views || 0} · 💝 ${x.likes || 0} · 👨‍💻 ${x.authorName}`
      ).join("\n\n");

    try {
      if (!args[0]) {
        return a(
          "Aide",
          `📦 ${event.body} show <ID>\n📄 ${event.body} page <numéro>\n🔍 ${event.body} search <requête>\n🗂️ ${event.body} category <goatbot|mirai|autobot>\n📊 ${event.body} stats\n🎯 ${event.body} trending\n🔧 ${event.body} maintenance\n⬆️ ${event.body} upload <fichier>\n🔗 ${event.body} raw <ID>\n💝 ${event.body} like <ID>\n\nExemple : ${event.body} show 1`
        );
      }

      const c = args[0].toLowerCase();

      switch (c) {
        case "show": {
          const d = args[1];
          if (!d) return a("Erreur", "⚠️ Fournis un ID de commande valide.");
          try {
            const e = await axios.get(`${GoatMart}/api/item/${encodeURIComponent(d)}`);
            const f = e.data;
            return a("Commande", `📦 ${f.itemName}\n🆔 ${f.itemID}${f.shortId ? ` · 🔤 ${f.shortId}` : ""}\n🗂️ ${f.category || f.type}\n📝 ${f.description}\n👨‍💻 ${f.authorName}\n📅 ${new Date(f.createdAt).toLocaleDateString()}\n👀 ${f.views} · 💝 ${f.likes}\n📄 Raw : ${f.rawLink}\n🔗 Voir : ${GoatMart}/view?id=${f.itemID}`);
          } catch (err) {
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "récupérer la commande");
          }
        }

        case "get":
        case "lookup": {
          const id = args[1];
          if (!id) return a("Erreur", "⚠️ Fournis un ID ou un short ID.");
          try {
            const response = await axios.get(`${GoatMart}/api/lookup/${encodeURIComponent(id)}`);
            const f = response.data;
            return a("Commande", `📦 ${f.itemName}\n🆔 ${f.itemID} · 🔤 ${f.shortId}\n📊 Séquentiel : ${f.sequentialId}\n🗂️ ${f.category || f.type}\n📝 ${f.description}\n👨‍💻 ${f.authorName}\n📅 ${new Date(f.createdAt).toLocaleDateString()}\n👀 ${f.views} · 💝 ${f.likes}\n📄 Raw : ${f.rawLink}\n🔗 Voir : ${GoatMart}/view?id=${f.itemID}`);
          } catch (err) {
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "chercher la commande");
          }
        }

        case "page": {
          const g = parseInt(args[1]) || 1;
          if (g <= 0) return a("Erreur", "⚠️ Le numéro de page doit être supérieur à 0.");

          try {
            const h = await axios.get(`${GoatMart}/api/items?page=${g}&limit=20`);
            const { items, total, totalPages } = h.data;

            if (g > totalPages && totalPages > 0) return a("Erreur", `⚠️ La page ${g} n'existe pas. Total : ${totalPages}`);
            if (!items.length) return a("Vide", "📭 Aucune commande trouvée.");

            return a("Catalogue", `Page ${g}/${totalPages} · ${total} commandes\n\n${listItems(items, (g - 1) * 20)}\n\n💡 "${event.body} show <ID>"`);
          } catch (err) {
            return b(err, "parcourir le catalogue");
          }
        }

        case "category":
        case "cat": {
          const cat = (args[1] || "").toLowerCase();
          if (!["goatbot", "mirai", "autobot"].includes(cat)) return a("Erreur", "⚠️ Catégories : goatbot, mirai, autobot.");
          const g = parseInt(args[2]) || 1;

          try {
            const h = await axios.get(`${GoatMart}/api/items?category=${cat}&page=${g}&limit=20`);
            const { items, total, totalPages } = h.data;
            if (!items.length) return a("Vide", `📭 Aucune commande dans "${cat}".`);

            return a(`${catEmoji[cat]} ${cat}`, `Page ${g}/${totalPages} · ${total} commandes\n\n${listItems(items, (g - 1) * 20)}`);
          } catch (err) {
            return b(err, "parcourir la catégorie");
          }
        }

        case "categories": {
          try {
            const r = await axios.get(`${GoatMart}/api/categories`);
            const cats = r.data;
            const list = (Array.isArray(cats) ? cats : Object.keys(cats)).map(x => {
              const name = typeof x === "string" ? x : x.name;
              const count = typeof x === "object" ? (x.count ?? "") : "";
              return `${catEmoji[name] || "📦"} ${name}${count !== "" ? ` (${count})` : ""}`;
            }).join("\n");
            return a("Catégories", list);
          } catch (err) {
            return b(err, "récupérer les catégories");
          }
        }

        case "search": {
          const j = args.slice(1).join(" ");
          if (!j) return a("Erreur", "⚠️ Fournis une requête de recherche.");

          try {
            const k = await axios.get(`${GoatMart}/api/items?search=${encodeURIComponent(j)}&limit=8`);
            const results = k.data.items;
            if (!results.length) return a("Aucun résultat", `❌ Rien pour "${j}"`);

            return a("Recherche", `"${j}" · ${k.data.total} résultats\n\n${listItems(results)}` +
              (k.data.total > 8 ? `\n\n📄 Top 8 affichés` : ""));
          } catch (err) {
            return b(err, "chercher");
          }
        }

        case "trending": {
          try {
            const m = await axios.get(`${GoatMart}/api/trending`);
            const trending = m.data;
            if (!trending.length) return a("Vide", "📭 Aucune tendance pour le moment.");

            return a("Tendances", listItems(trending));
          } catch (err) {
            return b(err, "récupérer les tendances");
          }
        }

        case "raw": {
          const id = args[1];
          if (!id) return a("Erreur", "⚠️ Fournis un ID ou un short ID.");
          try {
            const rawUrl = /^\d+$/.test(id) ? `${GoatMart}/raw/seq/${id}` : `${GoatMart}/raw/${id}`;
            const response = await axios.get(rawUrl);
            const codeLines = response.data.split("\n").length;
            return a("Code brut", `🔗 ${rawUrl}\n📊 ${codeLines} lignes\n\n💡 Ouvre l'URL pour récupérer le code`);
          } catch (err) {
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "récupérer le code brut");
          }
        }

        case "maintenance": {
          try {
            const status = await axios.get(`${GoatMart}/api/maintenance`);
            const maintenance = status.data;
            if (maintenance.enabled) {
              return a("Maintenance", `🚧 Active\n📝 ${maintenance.title}\n💬 ${maintenance.message}` +
                (maintenance.estimatedTime ? `\n⏰ ${maintenance.estimatedTime}` : ""));
            }
            return a("Maintenance", "✅ Désactivée — tout fonctionne normalement.");
          } catch (err) {
            return b(err, "vérifier la maintenance");
          }
        }

        case "stats": {
          try {
            const m = await axios.get(`${GoatMart}/api/stats`);
            const n = m.data;
            return a("Statistiques", `📦 Commandes : ${n.totalCommands || 0}\n💝 Likes : ${n.totalLikes || 0}\n👥 Utilisateurs actifs : ${n.dailyActiveUsers || 0}\n📈 Vues : ${n.totalViews || 0}\n📤 Uploads : ${n.totalUploads || 0}\n🔗 Requêtes API : ${n.totalRequests || 0}\n⏰ Uptime : ${n.hosting?.uptime ? `${n.hosting.uptime.days}j ${n.hosting.uptime.hours}h` : "N/A"}\n🌟 Top auteur : ${n.topAuthors?.[0]?._id || "N/A"}\n🔥 Plus vu : ${n.topViewed?.[0]?.itemName || "N/A"}`);
          } catch (err) {
            return b(err, "récupérer les statistiques");
          }
        }

        case "like": {
          const itemId = args[1];
          if (!itemId) return a("Erreur", "⚠️ Fournis un ID valide.");
          try {
            const response = await axios.post(`${GoatMart}/api/items/${encodeURIComponent(itemId)}/like`);
            return a("Like ajouté", `💝 Total : ${response.data.likes}`);
          } catch (err) {
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "liker la commande");
          }
        }

        case "upload": {
          const o = event.senderID;
          const p = global.GoatBot?.config?.adminBot || [];
          if (!p.includes(o)) return a("Refusé", "🚫 Réservé aux administrateurs du bot.");

          const q = args[1];
          if (!q) return a("Erreur", "⚠️ Fournis le nom d'un fichier de commande.");
          const r = path.join(__dirname, q.endsWith(".js") ? q : `${q}.js`);
          if (!fs.existsSync(r)) return a("Erreur", `❌ Fichier introuvable : ${r}`);

          try {
            const s = fs.readFileSync(r, "utf-8");
            let t;
            try {
              t = require(r);
            } catch {
              return a("Erreur", "❌ Impossible d'analyser le fichier.");
            }

            const category = args[2]?.toLowerCase() && ["goatbot", "mirai", "autobot"].includes(args[2].toLowerCase())
              ? args[2].toLowerCase()
              : "goatbot";

            const u = {
              itemName: t.config?.name || q,
              description: t.config?.longDescription?.en || t.config?.shortDescription?.en || "Commande de bot.",
              category,
              code: s,
              authorName: t.config?.author || "Anonymous",
            };

            const v = await axios.post(`${GoatMart}/api/items`, u, { headers: { "Content-Type": "application/json" } });
            const { success, shortId, itemId, message: responseMessage } = v.data;
            if (!success) return a("Échec", responseMessage || "❌ Échec de l'upload, réessaie plus tard.");

            return a("Upload réussi", `📦 ${u.itemName}\n🧑 ${u.authorName}\n🗂️ ${category}\n📄 ${s.split("\n").length} lignes\n\n🆔 ${itemId}\n🔐 ${shortId}\n\n🔗 Raw : ${GoatMart}/raw/${shortId}\n🌐 Voir : ${GoatMart}/view?id=${itemId}`);
          } catch (err) {
            console.error("Upload error:", err);
            return a("Échec", "❌ Échec de l'upload (erreur serveur).");
          }
        }

        case "edit": {
          const o = event.senderID;
          const p = global.GoatBot?.config?.adminBot || [];
          if (!p.includes(o)) return a("Refusé", "🚫 Réservé aux administrateurs du bot.");

          const itemId = args[1];
          const adminCode = args[2];
          if (!itemId || !adminCode) return a("Erreur", `⚠️ Usage : ${event.body} edit <ID> <adminCode>`);

          try {
            const v = await axios.put(`${GoatMart}/api/items/${encodeURIComponent(itemId)}`, { adminCode });
            return a("Modifié", `✅ Commande ${itemId} mise à jour.`);
          } catch (err) {
            if (err.response?.status === 403 || err.response?.status === 401) return a("Refusé", "🚫 Code admin invalide.");
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "modifier la commande");
          }
        }

        case "delete":
        case "remove": {
          const o = event.senderID;
          const p = global.GoatBot?.config?.adminBot || [];
          if (!p.includes(o)) return a("Refusé", "🚫 Réservé aux administrateurs du bot.");

          const itemId = args[1];
          const adminCode = args[2];
          if (!itemId || !adminCode) return a("Erreur", `⚠️ Usage : ${event.body} delete <ID> <adminCode>`);

          try {
            await axios.delete(`${GoatMart}/api/items/${encodeURIComponent(itemId)}`, { headers: { "x-admin-code": adminCode } });
            return a("Supprimé", `🗑️ Commande ${itemId} supprimée.`);
          } catch (err) {
            if (err.response?.status === 403 || err.response?.status === 401) return a("Refusé", "🚫 Code admin invalide.");
            if (err.response?.status === 404) return a("Introuvable", "❌ Commande introuvable.");
            return b(err, "supprimer la commande");
          }
        }

        default:
          return a("Inconnu", `⚠️ "${c}" n'existe pas.\n💡 Tape "${event.body}" pour voir les commandes disponibles.`);
      }
    } catch (err) {
      console.error("Christus Store Error:", err);
      return a("Erreur", "❌ Une erreur inattendue est survenue.");
    }
  }
};
              
