const { getTime } = global.utils;
const title = "🏦| 𝗩𝗼𝗹𝗱𝗶𝗕𝗮𝗻𝗸 v1.0";

module.exports = {
  config: {
    name: "bank",
    version: "2.0",
    author: "Christus",
    countDown: 0,
    role: 0,
    description: {
      fr: "Système bancaire simple avec fonctionnalités essentielles",
      en: "Simple banking system with essential features"
    },
    category: "game",
    guide: {
      fr: "Utilisez {pn} help pour voir toutes les commandes",
      en: "Use {pn} help to see all commands"
    }
  },

  langs: {
    fr: {
      help: "Liste des commandes bancaires",
      success: "Succès",
      error: "Erreur",
      insufficientFunds: "Fonds insuffisants",
      invalidAmount: "Montant invalide"
    },
    en: {
      help: "Banking commands list",
      success: "Success",
      error: "Error",
      insufficientFunds: "Insufficient funds",
      invalidAmount: "Invalid amount"
    }
  },

  onStart: async function ({ message, args, event, usersData, threadsData, getLang, api }) {
    const { senderID, threadID } = event;
    const command = args[0]?.toLowerCase();
    const API_BASE = 'https://secure-bank-api-e5lo.onrender.com';

    const userData = await usersData.get(senderID);
    const walletBalance = userData.money || 0;

    switch (command) {
      case "help":
      case undefined:
        return this.showHelp(message, usersData, senderID);

      case "balance":
      case "bal":
        return this.showBalance(message, senderID, usersData, API_BASE);

      case "deposit":
      case "dep":
        return this.deposit(message, args, userData, usersData, senderID, API_BASE);
      case "withdraw":
      case "wd":
        return this.withdraw(message, args, userData, usersData, senderID, API_BASE);

      case "interest":
        return this.collectInterest(message, senderID, API_BASE);

      case "leaderboard":
      case "top":
        return this.showLeaderboard(message, API_BASE, api);

      case "card":
        return this.handleCard(message, args, userData, usersData, senderID, API_BASE);

      case "stocks":
        return this.handleStocks(message, args, userData, usersData, senderID, API_BASE);

      case "crypto":
        return this.handleCrypto(message, args, userData, usersData, senderID, API_BASE);

      case "lottery":
        return this.handleLottery(message, args, userData, usersData, senderID, API_BASE);

      case "history":
      case "transactions":
        return this.showHistory(message, senderID, API_BASE);

      default:
        return message.reply(`🏦 ${title}\n\n❌ Commande inconnue. Utilisez 'bank help' pour voir toutes les commandes.`);
    }
  },

  showHelp: async function (message, usersData, senderID) {
    const userData = await usersData.get(senderID);
    const userName = userData.name || "Utilisateur";
    
    const helpText = `
🏦 ${title}
━━━━━━━━━━━━━
Bonjour ${userName} ! Choisissez votre service :

💰 BANQUE DE BASE
• bank balance - Voir le solde du compte
• bank deposit <montant> - Déposer de l'argent
• bank withdraw <montant> - Retirer de l'argent
• bank interest - Collecter les intérêts quotidiens
• bank history - Voir l'historique des transactions
• bank leaderboard - Voir les meilleurs utilisateurs

💳 CARTE DE DÉBIT
• bank card create - Créer une carte de débit
• bank card deposit <montant> - Déposer sur la carte
• bank card withdraw <montant> - Retirer de la carte

📈 INVESTISSEMENTS
• bank stocks list - Voir les actions disponibles
• bank stocks buy <symbole> <parts> - Acheter des actions
• bank stocks sell <symbole> <parts> - Vendre des actions

₿ CRYPTOMONNAIE
• bank crypto list - Voir les cryptos disponibles
• bank crypto buy <nom> <montant> - Acheter des cryptos
• bank crypto sell <nom> <montant> - Vendre des cryptos

🎰 LOTERIE
• bank lottery info - Voir les infos de la loterie
• bank lottery buy <numéro> - Acheter un ticket (1-100)

━━━━━━━━━━━━━
Commencez avec 'bank balance' pour voir votre compte !
`;
    return message.reply(helpText);
  },

  showBalance: async function (message, senderID, usersData, API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/balance/${senderID}`);
      const data = await response.json();
      const userData = await usersData.get(senderID);
      const userName = userData.name || "Utilisateur";

      if (data.success) {
        const balanceText = `
🏦 ${title}
━━━━━━━━━━━━━
Bonjour ${userName} !

💳 APERÇU DE VOTRE COMPTE

💰 ACTIFS LIQUIDES
• Espèces en portefeuille: $${data.data.cash.toLocaleString()}
• Compte bancaire: $${data.data.bank.toLocaleString()}
• Carte de débit: $${data.data.card.toLocaleString()}

📊 PORTEFEUILLE D'INVESTISSEMENT
• Actions: $${data.data.stocks.toLocaleString()}
• Cryptomonnaies: $${data.data.crypto.toLocaleString()}

💎 RÉSUMÉ DU COMPTE
• Patrimoine net: $${data.data.totalAssets.toLocaleString()}
• Score de crédit: ${data.data.creditScore}/850
• Tickets de loterie: ${data.data.lotteryTickets} actifs
• ID du compte: ${data.data.userId}

💡 ASTUCE: Diversifiez votre portefeuille avec des actions et des cryptos !
`;
        return message.reply(balanceText);
      } else {
        return message.reply("❌ " + data.message);
      }
    } catch (error) {
      return message.reply("❌ Erreur lors de la récupération du solde");
    }
  },

  deposit: async function (message, args, userData, usersData, senderID, API_BASE) {
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0 || isNaN(amount)) {
      return message.reply(`🏦 ${title}\n\n❌ Veuillez entrer un montant valide à déposer.`);
    }
    try {
      const balanceResponse = await fetch(`${API_BASE}/balance/${senderID}`);
      const balanceData = await balanceResponse.json();
      
      if (!balanceData.success) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur d'accès à votre compte bancaire.`);
      }

      const currentUserData = await usersData.get(senderID);
      let userMoney = currentUserData.money || 0;
      const userName = currentUserData.name || "Utilisateur";

      if (userMoney > Number.MAX_SAFE_INTEGER || userMoney < 0) {
        userMoney = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, userMoney));
        currentUserData.money = userMoney;
        await usersData.set(senderID, currentUserData);
      }

      if (userMoney < amount) {
        return message.reply(`🏦 ${title}\n\nBonjour ${userName} !\n\n❌ Fonds insuffisants dans votre portefeuille. Vous avez $${userMoney.toLocaleString()}, mais vous avez besoin de $${amount.toLocaleString()}`);
      }

      const response = await fetch(`${API_BASE}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: senderID, amount })
      });
      const data = await response.json();
      if (data.success) {
        const newMoney = Math.max(0, userMoney - amount);
        currentUserData.money = newMoney;
        await usersData.set(senderID, currentUserData);

        const bonusMessage = data.depositInterest > 0 ? 
          `\n💰 Intérêts bonus: $${data.depositInterest.toLocaleString()}` : '';
        return message.reply(`🏦 ${title}\n\nBonjour ${userName} !\n\n✅ ${data.message}${bonusMessage}\nPortefeuille: $${newMoney.toLocaleString()} | Banque: $${data.newBank.toLocaleString()}`);
      } else {
        return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Deposit error:', error);
      return message.reply(`🏦 ${title}\n\n❌ Erreur lors du traitement du dépôt. Veuillez réessayer.`);
    }
  },

  withdraw: async function (message, args, userData, usersData, senderID, API_BASE) {
    const amount = parseInt(args[1]);
    if (!amount || amount <= 0 || isNaN(amount)) {
      return message.reply(`🏦 ${title}\n\n❌ Veuillez entrer un montant valide à retirer.`);
    }

    try {
      const balanceResponse = await fetch(`${API_BASE}/balance/${senderID}`);
      const balanceData = await balanceResponse.json();
      
      if (!balanceData.success) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur d'accès à votre compte bancaire.`);
      }
      const bankBalance = balanceData.data.bank;
      
      const gstAmount = Math.floor(amount * 0.02);
      const totalNeeded = amount + gstAmount;

      if (bankBalance < totalNeeded) {
        return message.reply(`🏦 ${title}\n\n❌ Solde bancaire insuffisant. Vous avez $${bankBalance.toLocaleString()} mais avez besoin de $${totalNeeded.toLocaleString()} (incluant $${gstAmount.toLocaleString()} de taxe)`);
      }

      const response = await fetch(`${API_BASE}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: senderID, amount })
      });
      const data = await response.json();

      if (data.success) {
        const currentUserData = await usersData.get(senderID);
        let currentMoney = currentUserData.money || 0;
        const userName = currentUserData.name || "Utilisateur";

        if (currentMoney > Number.MAX_SAFE_INTEGER || currentMoney < 0) {
          currentMoney = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, currentMoney));
        }
        const newMoney = Math.min(Number.MAX_SAFE_INTEGER, currentMoney + amount);
        currentUserData.money = newMoney;
        await usersData.set(senderID, currentUserData);

        const gstMessage = data.gstAmount > 0 ? 
          `\n💸 Taxe déduite: $${data.gstAmount.toLocaleString()}` : '';
        return message.reply(`🏦 ${title}\n\nBonjour ${userName} !\n\n✅ ${data.message}${gstMessage}\nPortefeuille: $${newMoney.toLocaleString()} | Banque: $${data.newBank.toLocaleString()}`);
      } else {
        return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Withdraw error:', error);
      return message.reply(`🏦 ${title}\n\n❌ Erreur lors du traitement du retrait. Veuillez réessayer.`);
    }
  },

  collectInterest: async function (message, senderID, API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/interest/collect/${senderID}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        return message.reply(`🏦 ${title}\n\n💰 Intérêts collectés ! Vous avez gagné $${data.interest.toLocaleString()} après ${data.hoursWaited} heures d'attente.\nNouveau solde bancaire: $${data.newBank.toLocaleString()}`);
      } else {
        return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
      }
    } catch (error) {
      return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la collecte des intérêts`);
    }
  },

  showLeaderboard: async function (message, API_BASE, api) {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      const data = await response.json();

      if (data.success) {
        let leaderboardText = `🏦 ${title}\n\n🏆 CLASSEMENT DES JOUEURS LES PLUS RICHES\n━━━━━━━━━━\n\n`;

        const userIds = data.leaderboard.map(user => user.userId);
        let userInfos = {};

        try {
          if (api && userIds.length > 0) {
            userInfos = await api.getUserInfo(userIds);
          }
        } catch (error) {
          console.log("Impossible de récupérer les noms des utilisateurs");
        }

        data.leaderboard.forEach((user, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
          const userName = userInfos[user.userId] ? userInfos[user.userId].name : 'Utilisateur inconnu';

          leaderboardText += `${medal} ${userName}\n`;
          leaderboardText += `   🆔 UID: ${user.userId}\n`;
          leaderboardText += `   📅 Inscrit le: ${user.createdDate}\n`;
          leaderboardText += `   💎 Actifs totaux: $${user.totalAssets.toLocaleString()}\n`;
          leaderboardText += `   💰 Espèces: $${user.cash.toLocaleString()}\n`;
          leaderboardText += `   🏦 Banque: $${user.bank.toLocaleString()}\n`;
          leaderboardText += `   💳 Carte: $${user.card.toLocaleString()}\n`;
          leaderboardText += `   📈 Actions: $${user.stocksValue.toLocaleString()}\n`;
          leaderboardText += `   ₿ Crypto: $${user.cryptoValue.toLocaleString()}\n`;
          leaderboardText += `   📊 Crédit: ${user.creditScore}\n`;
          leaderboardText += `━━━━━━━━━━\n\n`;
        });
        leaderboardText += `💡 ASTUCE: Investissez dans les actions et les cryptos pour grimper dans le classement !`;

        return message.reply(leaderboardText);
      } else {
        return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
      }
    } catch (error) {
      return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la récupération du classement`);
    }
  },

  handleCard: async function (message, args, userData, usersData, senderID, API_BASE) {
    const action = args[1]?.toLowerCase();
    const amount = parseInt(args[2]);

    if (action === "create") {
      try {
        const response = await fetch(`${API_BASE}/card/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID })
        });
        const data = await response.json();

        if (data.success) {
          return message.reply(`🏦 ${title}\n\n✅ Carte de débit créée !\nNuméro de carte: ${data.cardNumber}\nLimite quotidienne: $${data.dailyLimit.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la création de la carte`);
      }
    }

    if (action === "deposit") {
      if (!amount || amount <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Veuillez entrer un montant valide.`);
      }

      const currentUserData = await usersData.get(senderID);
      const userMoney = currentUserData.money || 0;
      if (userMoney < amount) {
        return message.reply(`🏦 ${title}\n\n❌ Fonds insuffisants dans le portefeuille.`);
      }
      try {
        const response = await fetch(`${API_BASE}/card/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, amount })
        });
        const data = await response.json();

        if (data.success) {
          currentUserData.money = userMoney - amount;
          await usersData.set(senderID, currentUserData);

          return message.reply(`🏦 ${title}\n\n✅ Dépôt de $${amount.toLocaleString()} sur la carte effectué.\nSolde de la carte: $${data.newCardBalance.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors du dépôt sur la carte`);
      }
    }

    if (action === "withdraw") {
      if (!amount || amount <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Veuillez entrer un montant valide.`);
      }

      try {
        const response = await fetch(`${API_BASE}/card/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, amount })
        });
        const data = await response.json();

        if (data.success) {
          const currentUserData = await usersData.get(senderID);
          currentUserData.money = (currentUserData.money || 0) + amount;
          await usersData.set(senderID, currentUserData);

          return message.reply(`🏦 ${title}\n\n✅ Retrait de $${amount.toLocaleString()} de la carte effectué.\nPortefeuille: $${currentUserData.money.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors du retrait de la carte`);
      }
    }
    return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank card <create/deposit/withdraw> [montant]`);
  },

  handleStocks: async function (message, args, userData, usersData, senderID, API_BASE) {
    const action = args[1]?.toLowerCase();

    if (action === "list") {
      try {
        const response = await fetch(`${API_BASE}/stocks/list`);
        const data = await response.json();

        if (data.success) {
          let stockList = `🏦 ${title}\n\n📈 MARCHÉ BOURSIER - POTENTIEL DE GAIN ÉLEVÉ\n━━━━━━━━━━\n\n`;

          data.stocks.forEach(stock => {
            stockList += `${stock.trend} ${stock.symbol}: $${stock.price.toLocaleString()}\n`;
            stockList += `   💰 Multiplicateur de gain: ${stock.multiplier}x\n`;
            stockList += `   📊 Volatilité: ${(stock.volatility * 100).toFixed(1)}%\n`;
            stockList += `   🎯 Potentiel: ${stock.multiplier > 2 ? 'ÉLEVÉ' : stock.multiplier > 1.5 ? 'MOYEN' : 'STABLE'}\n\n`;
          });

          stockList += `💡 CONSEILS:\n`;
          stockList += `• Multiplicateurs élevés = Plus de potentiel de profit\n`;
          stockList += `• Prix bas = Point d'entrée facile\n`;
          stockList += `• Vérifiez les tendances avant d'acheter\n\n`;
          stockList += `Utilisation:\n`;
          stockList += `• bank stocks buy <symbole> <parts>\n`;
          stockList += `• bank stocks sell <symbole> <parts>`;
          return message.reply(stockList);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`❌ Erreur lors de la récupération des actions`);
      }
    }

    const symbol = args[2]?.toUpperCase();
    const shares = parseInt(args[3]);

    if (action === "buy") {
      if (!symbol || !shares || shares <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank stocks buy <symbole> <parts>`);
      }

      try {
        const response = await fetch(`${API_BASE}/stocks/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, symbol, shares })
        });
        const data = await response.json();

        if (data.success) {
          return message.reply(`🏦 ${title}\n\n✅ Achat de ${data.shares} parts de ${data.symbol} pour $${data.totalCost.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de l'achat d'actions`);
      }
    }

    if (action === "sell") {
      if (!symbol || !shares || shares <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank stocks sell <symbole> <parts>`);
      }

      try {
        const response = await fetch(`${API_BASE}/stocks/sell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, symbol, shares })
        });
        const data = await response.json();

        if (data.success) {
          return message.reply(`🏦 ${title}\n\n✅ Vente de ${data.shares} parts de ${data.symbol} pour $${data.totalValue.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la vente d'actions`);
      }
    }

    return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank stocks <list/buy/sell>`);
  },

  handleCrypto: async function (message, args, userData, usersData, senderID, API_BASE) {
    const action = args[1]?.toLowerCase();

    if (action === "list") {
      try {
        const response = await fetch(`${API_BASE}/crypto/list`);
        const data = await response.json();
        if (data.success) {
          let cryptoList = `🏦 ${title}\n\n₿ CRYPTOMONNAIES - POTENTIEL ÉNORME\n━━━━━━━━━━\n\n`;

          data.cryptos.forEach(crypto => {
            cryptoList += `${crypto.trend} ${crypto.name.toUpperCase()} (${crypto.symbol}): $${crypto.price.toFixed(3)}\n`;
            cryptoList += `   🚀 Multiplicateur de gain: ${crypto.multiplier}x\n`;
            cryptoList += `   📊 Volatilité: ${(crypto.volatility * 100).toFixed(1)}%\n`;
            cryptoList += `   🎯 Niveau de risque: ${crypto.multiplier > 2.5 ? 'EXTRÊME' : crypto.multiplier > 2 ? 'ÉLEVÉ' : 'MOYEN'}\n\n`;
          });

          cryptoList += `💡 CONSEILS CRYPTO:\n`;
          cryptoList += `• Multiplicateurs élevés = Risque/récompense élevé\n`;
          cryptoList += `• DOGE a une volatilité extrême pour de gros gains\n`;
          cryptoList += `• Commencez petit, réinvestissez les profits\n\n`;
          cryptoList += `Utilisation:\n`;
          cryptoList += `• bank crypto buy <nom> <montant>\n`;
          cryptoList += `• bank crypto sell <nom> <montant>`;

          return message.reply(cryptoList);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`❌ Erreur lors de la récupération des cryptos`);
      }
    }

    const cryptoName = args[2]?.toLowerCase();
    const amount = parseFloat(args[3]);

    if (action === "buy") {
      if (!cryptoName || !amount || amount <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank crypto buy <nom> <montant>`);
      }

      try {
        const response = await fetch(`${API_BASE}/crypto/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, cryptoName, amount })
        });
        const data = await response.json();
        if (data.success) {
          return message.reply(`🏦 ${title}\n\n✅ Achat de ${data.amount} ${data.cryptoName.toUpperCase()} pour $${data.totalCost.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de l'achat de cryptos`);
      }
    }

    if (action === "sell") {
      if (!cryptoName || !amount || amount <= 0) {
        return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank crypto sell <nom> <montant>`);
      }

      try {
        const response = await fetch(`${API_BASE}/crypto/sell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, cryptoName, amount })
        });
        const data = await response.json();

        if (data.success) {
          return message.reply(`🏦 ${title}\n\n✅ Vente de ${data.amount} ${data.cryptoName.toUpperCase()} pour $${data.totalValue.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la vente de cryptos`);
      }
    }

    return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank crypto <list/buy/sell>`);
  },

  handleLottery: async function (message, args, userData, usersData, senderID, API_BASE) {
    const action = args[1]?.toLowerCase();

    if (action === "info") {
      try {
        const response = await fetch(`${API_BASE}/lottery/info/${senderID}`);
        const data = await response.json();

        if (data.success) {
          const lotteryText = `🏦 ${title}
🎰 INFORMATIONS SUR LA LOTERIE
━━━━━━━━━━

💰 Cagnotte: $${data.prizePool.toLocaleString()}
🎫 Prix du ticket: $${data.ticketPrice.toLocaleString()}
🎟️ Vos tickets: ${data.userTickets}
⏰ Prochain tirage: ${data.nextDraw}

🎯 Comment jouer:
• Choisissez un nombre entre 1-100
• Achetez des tickets avec 'bank lottery buy <numéro>'
• Gagnez si votre numéro est tiré !

💡 ASTUCE: Chaque ticket vous donne une chance de gagner la cagnotte !
`;
          return message.reply(lotteryText);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la récupération des infos de la loterie`);
      }
    }

    if (action === "buy") {
      const number = parseInt(args[2]);
      if (!number || number < 1 || number > 100) {
        return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank lottery buy <numéro> (1-100)`);
      }

      try {
        const response = await fetch(`${API_BASE}/lottery/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: senderID, number })
        });
        const data = await response.json();

        if (data.success) {
          const currentUserData = await usersData.get(senderID);
          currentUserData.money = (currentUserData.money || 0) - data.ticketPrice;
          await usersData.set(senderID, currentUserData);
          return message.reply(`🏦 ${title}\n\n🎫 Ticket de loterie #${data.number} acheté pour $${data.ticketPrice.toLocaleString()} !\nCagnotte: $${data.prizePool.toLocaleString()}`);
        } else {
          return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
        }
      } catch (error) {
        return message.reply(`🏦 ${title}\n\n❌ Erreur lors de l'achat du ticket de loterie`);
      }
    }

    return message.reply(`🏦 ${title}\n\n❌ Utilisation: bank lottery <info/buy>`);
  },

  showHistory: async function (message, senderID, API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/transactions/${senderID}?limit=10`);
      const data = await response.json();

      if (data.success) {
        let historyText = `🏦 ${title}\n\n📋 HISTORIQUE DES TRANSACTIONS (10 dernières)\n━━━━━━━━━━\n\n`;

        if (data.transactions.length === 0) {
          historyText += `📭 Aucune transaction trouvée\n`;
          historyText += `Commencez à utiliser la banque pour voir votre historique ici !`;
        } else {
          data.transactions.forEach((tx, index) => {
            historyText += `${tx.icon} ${tx.description}\n`;
            historyText += `   🕒 ${tx.timeAgo} (${tx.date})\n`;
            
            if (tx.type === 'stock_buy' || tx.type === 'stock_sell') {
              historyText += `   💹 ${tx.type === 'stock_buy' ? 'Investissement' : 'Profit'}: $${tx.amount.toLocaleString()}\n`;
            } else if (tx.type === 'crypto_buy' || tx.type === 'crypto_sell') {
              historyText += `   ₿ ${tx.type === 'crypto_buy' ? 'Investissement' : 'Profit'}: $${tx.amount.toLocaleString()}\n`;
            }
            historyText += `━━━━━━━━━━\n`;
          });

          historyText += `\n📊 RÉSUMÉ:\n`;
          historyText += `• Total des transactions: ${data.totalTransactions}\n`;
          historyText += `• Affichage: ${data.transactions.length} dernières transactions\n`;
          historyText += `\n💡 ASTUCE: Utilisez 'bank balance' pour voir la valeur actuelle du portefeuille !`;
        }

        return message.reply(historyText);
      } else {
        return message.reply(`🏦 ${title}\n\n❌ ${data.message}`);
      }
    } catch (error) {
      console.error('History error:', error);
      return message.reply(`🏦 ${title}\n\n❌ Erreur lors de la récupération de l'historique des transactions`);
    }
  }
};