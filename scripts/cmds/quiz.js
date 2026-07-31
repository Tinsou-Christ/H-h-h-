const axios = require('axios');

const BASE_URL = 'https://dockerfile-fixer.onrender.com/api';

module.exports = {
  config: {
    name: "quiz",
    aliases: ["q"],
    version: "3.0",
    author: "Christus",
    countDown: 0, 
    role: 0,
    longDescription: { 
      en: "Advanced quiz game with social features, multiplayer, achievements, and comprehensive analytics" 
    },
    category: "game",
    guide: {
      en: `{pn} <category>`
    }
  },

  langs: {
    en: {
      reply: "🎯 𝗤𝘂𝗶𝘇 𝗖𝗵𝗮𝗹𝗹𝗲𝗻𝗴𝗲\n━━━━━━━━━━\n\n📚 𝖢𝖺𝗍𝖾𝗀𝗈𝗋𝗒: {category}\n🎚️ 𝖣𝗂𝖿𝖿𝗂𝖼𝗎𝗅𝗍𝗒: {difficulty}\n❓ 𝗤𝘂𝗲𝘀𝗍𝗂𝗈𝗇: {question}\n\n{options}\n\n⏰ 𝖸𝗈𝗎 𝗁𝖺𝗏𝖾 30 𝗌𝖾𝖼𝗈𝗇𝖽𝗌 𝗍𝗈 𝖺𝗇𝗌𝗐𝖾𝗋 (A/B/C/D):",
      torfReply: "⚙ 𝗤𝘂𝗶𝘇 ( True/False )\n━━━━━━━━━━\n\n💭 𝗤𝘂𝖾𝗌𝗍𝗂𝗈𝗇: {question}\n\n😆: True\n😮: False\n\nReact with emojis\n⏰ 30 seconds to answer",
      correctMessage: "🎉 𝗖𝗼𝗿𝗿𝗲𝗰𝘁 𝗔𝗻𝘀𝘄𝗲𝗿!\n━━━━━━━━━━\n\n✅ 𝖲𝖼𝗈𝗋𝖾: {correct}/{total}\n🏆 𝖠𝖼𝖼𝗎𝗋𝖺𝖼𝗒: {accuracy}%\n🔥 𝖢𝗎𝗋𝗋𝖾𝗇𝗍 𝖲𝗍𝗋𝖾𝖺𝗄: {streak}\n⚡ 𝖱𝖾𝗌𝗉𝗈𝗇𝗌𝖾 𝖳𝗂𝗆𝖾: {time}s\n🎯 𝖷𝖯 𝖦𝖺𝗂𝗇𝖾𝖽: +{xp}\n💰 𝖬𝗈𝗇𝖾𝗒 𝖤𝖺𝗋𝗇𝖾𝖽: +{money}",
      wrongMessage: "❌ 𝗜𝗻𝗰𝗼𝗿𝗿𝗲𝗰𝘁 𝗔𝗻𝘀𝘄𝗲𝗿\n━━━━━━━━━━\n\n🎯 𝖢𝗈𝗋𝗋𝖾𝖼𝗍: {correctAnswer}\n📊 𝖲𝖼𝗈𝗋𝖾: {correct}/{total}\n📈 𝖠𝖼𝖼𝗎𝗋𝖺𝖼𝗒: {accuracy}%\n💔 𝖲𝗍𝗋𝖾𝖺𝗄 𝖱𝖾𝗌𝖾𝗍",
      timeoutMessage: "⏰ 𝖳𝗂𝗆𝖾'𝗌 𝖴𝗉! 𝖢𝗈𝗋𝗋𝖾𝖼𝗍 𝖺𝗇𝗌𝗐𝖾𝗋: {correctAnswer}",
      achievementUnlocked: "🏆 𝗔𝗰𝗵𝗶𝗲𝘃𝗲𝗺𝗲𝗻𝘁 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱!\n{achievement}\n💰 +{bonus} bonus coins!"
    }
  },

  generateProgressBar(percentile) {
    const filled = Math.round(percentile / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  },

  getUserTitle(correct) {
    if (correct >= 50000) return '🌟 Quiz Omniscient';
    if (correct >= 25000) return '👑 Quiz Deity';
    if (correct >= 15000) return '⚡ Quiz Titan';
    if (correct >= 10000) return '🏆 Quiz Legend';
    if (correct >= 7500) return '🎓 Grandmaster';
    if (correct >= 5000) return '👨‍🎓 Quiz Master';
    if (correct >= 2500) return '🔥 Quiz Expert';
    if (correct >= 1500) return '📚 Quiz Scholar';
    if (correct >= 1000) return '🎯 Quiz Apprentice';
    if (correct >= 750) return '🌟 Knowledge Seeker';
    if (correct >= 500) return '📖 Quick Learner';
    if (correct >= 250) return '🚀 Rising Star';
    if (correct >= 100) return '💡 Getting Started';
    if (correct >= 50) return '🎪 First Steps';
    if (correct >= 25) return '🌱 Newcomer';
    if (correct >= 10) return '🔰 Beginner';
    if (correct >= 1) return '👶 Rookie';
    return '🆕 New Player';
  },

  async getUserName(api, userId) {
    try {
      const userInfo = await api.getUserInfo(userId);
      return userInfo[userId]?.name || 'Anonymous Player';
    } catch (error) {
      console.warn("User info fetch failed for", userId, error);
      return 'Anonymous Player';
    }
  },

  async getAvailableCategories() {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      return res.data.map(cat => cat.toLowerCase());
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  },

  onStart: async function ({ message, event, args, commandName, getLang, api, usersData }) {
    try {
      const command = args[0]?.toLowerCase();

      if (!args[0] || command === "help") {
        return await this.handleDefaultView(message, getLang);
      }

      switch (command) {
        case "rank":
        case "profile":
          return await this.handleRank(message, event, getLang, api, usersData);
        case "leaderboard":
        case "lb":
          return await this.handleLeaderboard(message, getLang, args.slice(1), api);
        case "category":
          if (args.length > 1) {
            return await this.handleCategoryLeaderboard(message, getLang, args.slice(1), api);
          }
          return await this.handleCategories(message, getLang);
        case "daily":
          return await this.handleDailyChallenge(message, event, commandName, api);
        case "torf":
          return await this.handleTrueOrFalse(message, event, commandName, api);
        case "flag":
          return await this.handleFlagQuiz(message, event, commandName, api);
        case "anime":
          return await this.handleAnimeQuiz(message, event, commandName, api);
        case "hard":
          return await this.handleQuiz(message, event, ["general"], commandName, getLang, api, usersData, "hard");
        case "medium":
          return await this.handleQuiz(message, event, ["general"], commandName, getLang, api, usersData, "medium");
        case "easy":
          return await this.handleQuiz(message, event, ["general"], commandName, getLang, api, usersData, "easy");
        case "random":
          return await this.handleQuiz(message, event, [], commandName, getLang, api, usersData);
        default:
          const categories = await this.getAvailableCategories();
          if (categories.includes(command)) {
            return await this.handleQuiz(message, event, [command], commandName, getLang, api, usersData);
          } else {
            return await this.handleDefaultView(message, getLang);
          }
      }
    } catch (err) {
      console.error("Quiz start error:", err);
      return message.reply("⚠️ Error occurred, try again.");
    }
  },

  async handleDefaultView(message, getLang) {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      const categories = res.data;

      const catText = categories.map(c => `📍 ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");

      return message.reply(
        `🎯 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n` +
        `📚 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝗶𝗲𝘀\n\n${catText}\n\n` +
        `━━━━━━━━━\n\n` +
        `🏆 Usages\n` +
        `• quiz rank - Show your rank\n` +
        `• quiz leaderboard - Show leaderboard\n` +
        `• quiz torf - Play True/False quiz\n` +
        `• quiz flag - Play flag guessing quiz\n` +
        `• quiz anime - Play anime character quiz\n\n` +
        `🎮 Use: quiz <category> to start quiz`
      );
    } catch (err) {
      console.error("Default view error:", err);
      return message.reply("⚠️ Could not fetch categories. Try 'quiz help' for commands.");
    }
  },

  async handleRank(message, event, getLang, api, usersData) {
    try {
      const userName = await this.getUserName(api, event.senderID);

      await axios.post(`${BASE_URL}/user/update`, {
        userId: event.senderID,
        name: userName
      });

      const res = await axios.get(`${BASE_URL}/user/${event.senderID}`);
      const user = res.data;

      if (!user || user.total === 0) {
        return message.reply(`❌ You haven't played any quiz yet! Use 'quiz random' to start.\n👤 Welcome, ${userName}!`);
      }

      const position = user.position ?? "N/A";
      const totalUser = user.totalUsers ?? "N/A";
      const progressBar = this.generateProgressBar(user.percentile ?? 0);
      const title = this.getUserTitle(user.correct || 0);

      const streakInfo = user.currentStreak > 0 ? 
        `🔥 𝖢𝗎𝗋𝗋𝖾𝗇𝗍 𝖲𝗍𝗋𝖾𝖺𝗄: ${user.currentStreak}${user.currentStreak >= 5 ? ' 🚀' : ''}` :
        `🔥 𝖢𝗎𝗋𝗋𝖾𝗇𝗍 𝖲𝗍𝗋𝖾𝖺𝗄: 0`;

      const bestStreakInfo = user.bestStreak > 0 ?
        `🏅 𝖡𝖾𝗌𝗍 𝖲𝗍𝗋𝖾𝖺𝗄: ${user.bestStreak}${user.bestStreak >= 10 ? ' 👑' : user.bestStreak >= 5 ? ' ⭐' : ''}` :
        `🏅 𝖡𝖾𝗌𝗍 𝖲𝗍𝗋𝖾𝖺𝗄: 0`;

      const userData = await usersData.get(event.senderID) || {};
      const userMoney = userData.money || 0;

      const currentXP = user.xp ?? 0;
      const xpTo1000 = Math.max(0, 1000 - currentXP);
      const xpProgress = Math.min(100, (currentXP / 1000) * 100);
      const xpProgressBar = this.generateProgressBar(xpProgress);

      return message.reply(
        `🎮 𝗤𝘂𝗶𝘇 𝗣𝗿𝗼𝗳𝗂𝗹𝗲\n━━━━━━━━━\n\n` +
        `👤 ${userName}\n` +
        `🎖️ ${title}\n` +
        `🏆 𝖦𝗅𝗈𝖻𝖺𝗅 𝖱𝖺𝗇𝗄: #${position}/${totalUser}\n` +
        `📈 𝖯𝖾𝗋𝖼𝖾𝗇𝗍𝗂𝗅𝖾: ${progressBar} ${user.percentile ?? 0}%\n\n` +
        `📊 𝗦𝘁𝗮𝗍𝗂𝘀𝘁𝗂𝗰𝘀\n` +
        `✅ 𝖢𝗈𝗋𝗋𝖾𝖼𝗍: ${user.correct ?? 0}\n` +
        `❌ 𝖶𝗋𝗈𝗇𝗀: ${user.wrong ?? 0}\n` +
        `📝 𝖳𝗈𝗍𝖺𝗅: ${user.total ?? 0}\n` +
        `🎯 𝖠𝖼𝖼𝗎𝗋𝖺𝖼𝗒: ${user.accuracy ?? 0}%\n` +
        `⚡ 𝖠𝗏𝗀 𝖱𝖾𝗌𝗉𝗈𝗇𝗌𝖾: ${(user.avgResponseTime ?? 0).toFixed(1)}s\n\n` +
        `💰 𝗪𝗲𝗮𝗹𝘁𝗵 & 𝗫𝗣\n` +
        `💵 𝖬𝗈𝗇𝖾𝗒: ${userMoney.toLocaleString()}\n` +
        `✨ 𝖷𝖯: ${currentXP}/1000\n` +
        `🎯 𝖷𝖯 𝖳𝗈 1000: ${xpTo1000}\n` +
        `${xpProgressBar} ${xpProgress.toFixed(1)}%\n\n` +
        `🔥 𝗦𝘁𝗿𝗲𝗮𝗸 𝗜𝗻𝗳𝗼\n` +
        `${streakInfo}\n` +
        `${bestStreakInfo}\n\n` +
        `🎯 𝖭𝖾𝗑𝗍 𝖬𝗂𝗅𝖾𝗌𝗍𝗈𝗇𝖾: ${user.nextMilestone || "Keep playing!"}`
      );
    } catch (err) {
      console.error("Rank error:", err);
      return message.reply("⚠️ Could not fetch rank. Please try again later.");
    }
  },

  async handleLeaderboard(message, getLang, args, api) {
    try {
      const page = parseInt(args?.[0]) || 1;
      const sortBy = args?.[1] || 'correct';

      const res = await axios.get(`${BASE_URL}/leaderboards?page=${page}&limit=8`);
      const { rankings, stats, pagination } = res.data;

      if (!rankings || rankings.length === 0) {
        return message.reply("🏆 No players found in leaderboard. Start playing to be the first!");
      }

      const now = new Date();
      const currentDate = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      });
      const currentTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC'
      });

      const players = await Promise.all(rankings.map(async (u, i) => {
        let userName = u.name || 'Anonymous Player';

        if (u.userId && userName === 'Anonymous Player') {
          try {
            userName = await this.getUserName(api, u.userId);
          } catch {
            userName = u.name || 'Anonymous Player';
          }
        }

        const position = (pagination.currentPage - 1) * 8 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : position <= 10 ? "🏅" : "🎯";
        const title = this.getUserTitle(u.correct || 0);

        const level = u.level ?? Math.floor((u.correct || 0) / 50) + 1;
        const xp = u.xp ?? (u.correct || 0) * 10;
        const accuracy = u.accuracy ?? (u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0);
        const avgResponseTime = typeof u.avgResponseTime === 'number' ? `${u.avgResponseTime.toFixed(2)}s` : 'N/A';
        const totalResponseTime = u.totalResponseTime?.toFixed(2) || '0';
        const fastest = u.fastestResponse?.toFixed(2) || 'N/A';
        const slowest = u.slowestResponse?.toFixed(2) || 'N/A';
        const playTime = u.totalPlayTime ? `${(u.totalPlayTime / 60).toFixed(1)} min` : '0 min';
        const games = u.gamesPlayed || u.total || 0;
        const perfectGames = u.perfectGames || 0;
        const longestSession = u.longestSession?.toFixed(2) || '0';
        const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown';

        return `${crown} #${position} ${userName}\n` +
               `🎖️ ${title} | 🌟 Lv.${level} | ✨ XP: ${xp.toLocaleString()}\n` +
               `📊 ${u.correct} ✅ / ${u.wrong} ❌ (Accuracy: ${accuracy}%)\n` +
               `🔥 Current Streak: ${u.currentStreak || 0} | 🏅 Best Streak: ${u.bestStreak || 0}\n` +
               `⚡ Avg Time: ${avgResponseTime} | ⏱️ Total Time: ${totalResponseTime}s\n` +
               `🚀 Fastest: ${fastest}s | 🐌 Slowest: ${slowest}s\n` +
               `🎯 Questions Answered: ${u.questionsAnswered} | Games: ${games}\n` +
               `🎮 Play Time: ${playTime} | 📈 Perfect Games: ${perfectGames}\n` +
               `📅 Joined: ${joinDate}`;
      }));

      return message.reply(
        `🏆 𝗚𝗹𝗼𝗯𝗮𝗹 𝗟𝗲𝗮𝗱𝗲𝗿𝗯𝗼𝗮𝗿𝗱\n━━━━━━━━━\n\n` +
        `📅 ${currentDate}\n⏰ ${currentTime} UTC\n\n` +
        `━━━━━━━━━\n\n${players.join('\n\n')}\n\n` +
        `📖 Page ${pagination?.currentPage || 1}/${pagination?.totalPages || 1} | 👥 Total Users: ${stats?.totalUsers || 0}\n` +
        `🔄 Use: quiz leaderboard <page> <sort>\n` +
        `📊 Sort options: correct, accuracy, streak, level`
      );

    } catch (err) {
      console.error("Leaderboard error:", err);
      return message.reply("⚠️ Could not fetch leaderboard. Server may be busy, try again later.");
    }
  },

  async handleCategories(message, getLang) {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      const categories = res.data;

      const catText = categories.map(c => `📍 ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");

      return message.reply(
        `📚 𝗤𝘂𝗶𝘇 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝗶𝗲𝘀\n━━━━━━━━\n\n${catText}\n\n` +
        `🎯 Use: quiz <category>\n` +
        `🎲 Random: quiz random\n` +
        `🏆 Daily: quiz daily\n` +
        `🌟 Special: quiz torf, quiz flag`
      );
    } catch (err) {
      console.error("Categories error:", err);
      return message.reply("⚠️ Could not fetch categories.");
    }
  },

  async handleDailyChallenge(message, event, commandName, api) {
    try {
      const res = await axios.get(`${BASE_URL}/challenge/daily?userId=${event.senderID}`);
      const { question, challengeDate, reward, streak } = res.data;

      const userName = await this.getUserName(api, event.senderID);

      const optText = question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const info = await message.reply(
        `🌟 𝗗𝗮𝗶𝗹𝘆 𝗖𝗵𝗮𝗹𝗹𝗲𝗻𝗴𝗲\n━━━━━━━━━\n\n` +
        `📅 ${challengeDate}\n` +
        `🎯 Bonus Reward: +${reward} XP\n` +
        `🔥 Daily Streak: ${streak}\n\n\n` +
        `❓ ${question.question}\n\n${optText}\n\n⏰ 30 seconds to answer!`
      );

      global.GoatBot.onReply.set(info.messageID, {
        commandName,
        author: event.senderID,
        messageID: info.messageID,
        answer: question.answer,
        questionId: question._id,
        startTime: Date.now(),
        isDailyChallenge: true,
        bonusReward: reward
      });

      setTimeout(() => {
        const r = global.GoatBot.onReply.get(info.messageID);
        if (r) {
          message.reply(`⏰ Time's up! The correct answer was: ${question.answer}`);
          message.unsend(info.messageID);
          global.GoatBot.onReply.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("Daily challenge error:", err);
      return message.reply("⚠️ Could not create daily challenge.");
    }
  },

  async handleTrueOrFalse(message, event, commandName, api) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=torf&userId=${event.senderID}`);
      const { _id, question, answer } = res.data;

      const info = await message.reply(this.langs.en.torfReply.replace("{question}", question));

      const correctAnswer = answer.toUpperCase();

      global.GoatBot.onReaction.set(info.messageID, {
        commandName,
        author: event.senderID,
        messageID: info.messageID,
        answer: correctAnswer,
        reacted: false,
        reward: 10000,
        questionId: _id,
        startTime: Date.now()
      });

      setTimeout(() => {
        const reaction = global.GoatBot.onReaction.get(info.messageID);
        if (reaction && !reaction.reacted) {
          const correctText = correctAnswer === "A" ? "True" : "False";
          message.reply(this.langs.en.timeoutMessage.replace("{correctAnswer}", correctText));
          message.unsend(info.messageID);
          global.GoatBot.onReaction.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("True/False error:", err);
      return message.reply("⚠️ Could not create True/False question.");
    }
  },

  async handleFlagQuiz(message, event, commandName, api) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=flag&userId=${event.senderID}`);
      const { _id, question, options, answer } = res.data;

      const flagEmbed = {
        body: `🏁 𝗙𝗹𝗮𝗴 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n🌍 Guess this country's flag:\n\n` +
              options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
              `\n\n⏰ Time: 30 seconds for answer.`,
        attachment: question ? await global.utils.getStreamFromURL(question) : null
      };

      const info = await message.reply(flagEmbed);

      global.GoatBot.onReply.set(info.messageID, {
        commandName,
        author: event.senderID,
        messageID: info.messageID,
        answer,
        options,
        questionId: _id,
        startTime: Date.now(),
        isFlag: true,
        reward: this.envConfig.flagReward || 10000
      });

      setTimeout(() => {
        const r = global.GoatBot.onReply.get(info.messageID);
        if (r) {
          message.reply(`⏰ Time's up! The correct answer was: ${answer}`);
          message.unsend(info.messageID);
          global.GoatBot.onReply.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("Flag quiz error:", err);
      return message.reply("⚠️ Could not create flag quiz.");
    }
  },

  async handleAnimeQuiz(message, event, commandName, api) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=anime&userId=${event.senderID}`);
      const { _id, question, options, answer, imageUrl } = res.data;

      const animeEmbed = {
        body: `🎌 𝗔𝗻𝗶𝗺𝗲 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n❔ 𝗛𝗶𝗻𝘁: ${question}\n\n` +
              options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
              `\n\n⏰ Time: 30 seconds\n🎯 Anime Character Recognition Challenge!`,
        attachment: imageUrl ? await global.utils.getStreamFromURL(imageUrl) : null
      };

      const info = await message.reply(animeEmbed);

      global.GoatBot.onReply.set(info.messageID, {
        commandName,
        author: event.senderID,
        messageID: info.messageID,
        answer,
        options,
        questionId: _id,
        startTime: Date.now(),
        isAnime: true,
        reward: this.envConfig.animeReward || 15000
      });

      setTimeout(() => {
        const r = global.GoatBot.onReply.get(info.messageID);
        if (r) {
          message.reply(`⏰ Time's up! The correct answer was: ${answer}\n🎌 Keep watching anime to improve your skills!`);
          message.unsend(info.messageID);
          global.GoatBot.onReply.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("Anime quiz error:", err);
      return message.reply("⚠️ Could not create anime quiz. Make sure anime questions are available in the database.");
    }
  },

  async handleQuiz(message, event, args, commandName, getLang, api, usersData, forcedDifficulty = null) {
    try {
      const userName = await this.getUserName(api, event.senderID);

      await axios.post(`${BASE_URL}/user/update`, {
        userId: event.senderID,
        name: userName
      });

      const category = args[0]?.toLowerCase() || "";

      let queryParams = {
        userId: event.senderID
      };
      if (category && category !== "random") {
        queryParams.category = category;
      }
      if (forcedDifficulty) {
        queryParams.difficulty = forcedDifficulty;
      }

      const res = await axios.get(`${BASE_URL}/question`, { params: queryParams });
      const { _id, question, options, answer, category: qCategory, difficulty } = res.data;

      const optText = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const info = await message.reply(getLang("reply")
        .replace("{category}", qCategory?.charAt(0).toUpperCase() + qCategory?.slice(1) || "Random")
        .replace("{difficulty}", difficulty?.charAt(0).toUpperCase() + difficulty?.slice(1) || "Medium")
        .replace("{question}", question)
        .replace("{options}", optText));

      global.GoatBot.onReply.set(info.messageID, {
        commandName,
        author: event.senderID,
        messageID: info.messageID,
        answer,
        questionId: _id,
        startTime: Date.now(),
        difficulty,
        category: qCategory
      });

      setTimeout(() => {
        const r = global.GoatBot.onReply.get(info.messageID);
        if (r) {
          message.reply(getLang("timeoutMessage").replace("{correctAnswer}", answer));
          message.unsend(info.messageID);
          global.GoatBot.onReply.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("Quiz error:", err);
      message.reply("⚠️ Could not get quiz question. Try 'quiz categories' to see available options.");
    }
  },

  async handleCategoryLeaderboard(message, getLang, args, api) {
    try {
      const category = args[0]?.toLowerCase();
      if (!category) {
        return message.reply("📚 Please specify a category to view the leaderboard for.");
      }

      const page = parseInt(args[1]) || 1;
      const res = await axios.get(`${BASE_URL}/leaderboard/category/${category}?page=${page}&limit=10`);
      const { users, pagination } = res.data;

      if (!users || users.length === 0) {
        return message.reply(`🏆 No players found for the category: ${category}.`);
      }

      const topPlayersWithNames = await Promise.all(users.map(async (u, i) => {
        let userName = 'Anonymous Player';
        if (u.userId) {
          userName = await this.getUserName(api, u.userId);
        }

        const position = (pagination.currentPage - 1) * 10 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
        const title = this.getUserTitle(u.correct || 0);
        return `${crown} #${position} ${userName}\n🎖️ ${title}\n📊 ${u.correct || 0}/${u.total || 0} (${u.accuracy || 0}%)`;
      }));

      const topPlayers = topPlayersWithNames.join('\n\n');

      return message.reply(
        `🏆 𝗟𝗲𝗮𝗱𝗲𝗿𝗯𝗼𝗮𝗿𝗱: ${category.charAt(0).toUpperCase() + category.slice(1)}\n━━━━━━━━━\n\n${topPlayers}\n\n` +
        `📖 Page ${pagination.currentPage}/${pagination.totalPages}\n` +
        `👥 Total Players: ${pagination.totalUsers}`
      );
    } catch (err) {
      console.error("Category leaderboard error:", err);
      return message.reply("⚠️ Could not fetch category leaderboard.");
    }
  },



  onReaction: async function ({ message, event, Reaction, api, usersData }) {
    try {
      const { author, messageID, answer, reacted, reward } = Reaction;

      if (event.userID !== author || reacted) return;

      const userAnswer = event.reaction === '😆' ? "A" : "B"; 
      const isCorrect = userAnswer === answer;

      const timeSpent = (Date.now() - Reaction.startTime) / 1000;
      if (timeSpent > 30) {
        return message.reply("⏰ Time's up!");
      }

      const userName = await this.getUserName(api, event.userID);

      const answerData = {
        userId: event.userID,
        questionId: Reaction.questionId,
        answer: userAnswer,
        timeSpent,
        userName
      };

      try {
        const res = await axios.post(`${BASE_URL}/answer`, answerData);
        const { user, xpGained } = res.data;

        const userData = await usersData.get(event.userID) || {};
        if (isCorrect) {
          const baseMoneyReward = 10000;
          const streakBonus = (user.currentStreak || 0) * 1000;
          const totalMoneyReward = baseMoneyReward + streakBonus;

          userData.money = (userData.money || 0) + totalMoneyReward;
          await usersData.set(event.userID, userData);

          const correctText = answer === "A" ? "True" : "False";

          const torfSuccessMessages = [
            "🎯 𝗔𝗕𝗦𝗢𝗟𝗨𝗧𝗘𝗟𝗬 𝗧𝗥𝗨𝗘! 𝗬𝗼𝘂’𝗿𝗲 𝗮 𝗴𝗲𝗻𝗶𝘂𝘀! ✨",
            "⚡ 𝗣𝗘𝗥𝗙𝗘𝗖𝗧! 𝗧𝗿𝘂𝗲/𝗙𝗮𝗹𝘀𝗲 𝗺𝗮𝘀𝘁𝗲𝗿! 🏆",
            "🔥 𝗙𝗔𝗡𝗧𝗔𝗦𝗧𝗜𝗖! 𝗬𝗼𝘂 𝗻𝗮𝗶𝗹𝗲𝗱 𝗶𝘁! 🎯",
            "🌟 𝗕𝗥𝗔𝗩𝗢! 𝗦𝗶𝗺𝗽𝗹𝗲 𝗯𝘂𝘁 𝗲𝗳𝗳𝗲𝗰𝘁𝗶𝘃𝗲! ⭐",
            "🎊 𝗘𝗫𝗖𝗘𝗟𝗟𝗘𝗡𝗧! 𝗤𝘂𝗶𝗰𝗸 𝗮𝗻𝗱 𝗰𝗼𝗿𝗿𝗲𝗰𝘁! 🚀"
          ];

          const randomTorfMsg = torfSuccessMessages[Math.floor(Math.random() * torfSuccessMessages.length)];

          let streakMessage = "";
          const streak = user.currentStreak || 0;
          if (streak >= 5) streakMessage = "\n🔥 𝗔𝗺𝗮𝘇𝗶𝗻𝗴 𝘀𝘁𝗿𝗲𝗮𝗸! 𝗞𝗲𝗲𝗽 𝗶𝘁 𝗴𝗼𝗶𝗻𝗴! 🚀";

          const successMsg = `${randomTorfMsg}\n` +
            `━━━━━━━━━\n\n` +
            `🎉 𝗖𝗼𝗻𝗴𝗿𝗮𝘁𝘂𝗹𝗮𝘁𝗶𝗼𝗻𝘀, ${userName}! 🎉\n\n` +
            `💰 𝗠𝗼𝗻𝗲𝘆 𝗘𝗮𝗿𝗻𝗲𝗱: +${totalMoneyReward.toLocaleString()} 💎\n` +
            `✨ 𝗫𝗣 𝗚𝗮𝗶𝗻𝗲𝗱: +${xpGained || 15} ⚡\n` +
            `🔥 𝗦𝘁𝗿𝗲𝗮𝗸: ${user.currentStreak || 0} 🚀\n` +
            `⏱️ 𝗧𝗶𝗺𝗲: ${timeSpent.toFixed(1)}s` + streakMessage +
            `\n\n🎯 𝗧𝗿𝘂𝗲/𝗙𝗮𝗹𝘀𝗲 𝗺𝗮𝘀𝘁𝗲𝗿! 𝗞𝗲𝗲𝗽 𝗴𝗼𝗶𝗻𝗴! 🌟`;
          message.reply(successMsg);
        } else {
          const correctText = answer === "A" ? "True" : "False";

          const torfWrongMessages = [
            "💔 𝗔𝘄𝘄! 𝗧𝗿𝘂𝗲/𝗙𝗮𝗹𝘀𝗲 𝗰𝗮𝗻 𝗯𝗲 𝘁𝗿𝗶𝗰𝗸𝘆! 🤔",
            "🌱 𝗢𝗼𝗽𝘀! 𝗡𝗼 𝘄𝗼𝗿𝗿𝗶𝗲𝘀, 𝗸𝗲𝗲𝗽 𝗹𝗲𝗮𝗿𝗻𝗶𝗻𝗴! 📚",
            "🔄 𝗡𝗼𝘁 𝗾𝘂𝗶𝘁𝗲! 𝗦𝗼𝗺𝗲𝘁𝗶𝗺𝗲𝘀 𝗶𝘁'𝘀 𝗮 𝗴𝘂𝗲𝘀𝘀! 🎲",
            "⭐ 𝗪𝗿𝗼𝗻𝗴! 𝗣𝗿𝗮𝗰𝘁𝗶𝗰𝗲 𝗺𝗮𝗸𝗲𝘀 𝗽𝗲𝗿𝗳𝗲𝗰𝘁! 💪",
            "💫 𝗠𝗶𝘀𝘀! 𝗘𝘃𝗲𝗻 𝗺𝗮𝘀𝘁𝗲𝗿𝘀 𝗺𝗶𝘀𝘀 𝘀𝗼𝗺𝗲𝘁𝗶𝗺𝗲𝘀! 🌟"
          ];

          const randomTorfWrongMsg = torfWrongMessages[Math.floor(Math.random() * torfWrongMessages.length)];

          message.reply(`${randomTorfWrongMsg}\n` +
            `━━━━━━━━━\n\n` +
            `🎯 𝗖𝗼𝗿𝗿𝗲𝗰𝘁 𝗔𝗻𝘀𝘄𝗲𝗿: ${correctText} ✅\n` +
            `👤 ${userName}\n` +
            `💔 𝗦𝘁𝗿𝗲𝗮𝗸 𝗥𝗲𝘀𝗲𝘁\n\n` +
            `🔥 𝗡𝗲𝘅𝘁 𝗾𝘂𝗲𝘀𝘁𝗶𝗼𝗻 𝗮𝘄𝗮𝗶𝘁𝘀! 𝗟𝗲𝘁'𝘀 𝗴𝗲𝘁 𝗶𝘁! 🚀`);
        }
      } catch (error) {
        console.error("Error updating score:", error);
      }

      global.GoatBot.onReaction.get(messageID).reacted = true;
      setTimeout(() => global.GoatBot.onReaction.delete(messageID), 1000);
    } catch (err) {
      console.error("Quiz reaction error:", err);
    }
  },

  onReply: async function ({ message, event, Reply, getLang, api, usersData }) {
    if (Reply.author !== event.senderID) return;

    try {
      const ans = event.body.trim().toUpperCase();
      if (!["A", "B", "C", "D"].includes(ans)) {
        return message.reply("❌ Please reply with A, B, C, or D only!");
      }

      const timeSpent = (Date.now() - Reply.startTime) / 1000;
      if (timeSpent > 30) {
        return message.reply("⏰ Time's up!");
      }

      const userName = await this.getUserName(api, event.senderID);

      let correctAnswer = Reply.answer;
      let userAnswer = ans;

      if ((Reply.isFlag || Reply.isAnime) && Reply.options) {
        const optionIndex = ans.charCodeAt(0) - 65;
        if (optionIndex >= 0 && optionIndex < Reply.options.length) {
          userAnswer = Reply.options[optionIndex];
        }
      }

      const answerData = {
        userId: event.senderID,
        questionId: Reply.questionId,
        answer: userAnswer,
        timeSpent,
        userName
      };

      const res = await axios.post(`${BASE_URL}/answer`, answerData);

      if (!res.data) {
        throw new Error('No response data received');
      }

      const { result, user } = res.data;

      let responseMsg;

      if (result === "correct") {
        const userData = await usersData.get(event.senderID) || {};

        let baseMoneyReward = 10000;
        if (Reply.difficulty === 'hard') baseMoneyReward = 15000;
        if (Reply.difficulty === 'easy') baseMoneyReward = 7500;
        if (Reply.isFlag) baseMoneyReward = 12000;
        if (Reply.isAnime) baseMoneyReward = 15000;
        if (Reply.isDailyChallenge) baseMoneyReward = 20000;

        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;

        userData.money = (userData.money || 0) + totalMoneyReward;
        await usersData.set(event.senderID, userData);

        const difficultyBonus = Reply.difficulty === 'hard' ? ' 🔥' : Reply.difficulty === 'easy' ? ' ⭐' : '';
        const streakBonus2 = (user.currentStreak || 0) >= 5 ? ` 🚀 ${user.currentStreak}x streak!` : '';
        const flagBonus = Reply.isFlag ? ' 🏁' : '';
        const animeBonus = Reply.isAnime ? ' 🎌' : '';
        const dailyBonus = Reply.isDailyChallenge ? ' 🌟' : '';

        responseMsg = `🎉 Correct! 💰\n` +
          `💵 Money: +${totalMoneyReward.toLocaleString()}\n` +
          `✨ XP: +${user.xpGained || 15}\n` +
          `📊 Score: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `🔥 Streak: ${user.currentStreak || 0}\n` +
          `⚡ Response Time: ${timeSpent.toFixed(1)}s\n` +
          `🎯 XP Progress: ${user.xp || 0}/1000\n` +
          `👤 ${userName}` + difficultyBonus + streakBonus2 + flagBonus + animeBonus + dailyBonus;
      } else {
        responseMsg = `❌ Wrong! Correct answer: ${correctAnswer}\n` +
          `📊 Score: ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `💔 Streak Reset\n` +
          `👤 ${userName}` + (Reply.isFlag ? ' 🏁' : '') + (Reply.isAnime ? ' 🎌' : '');
      }

      await message.reply(responseMsg);

      if (user.achievements && user.achievements.length > 0) {
        const achievementMsg = user.achievements.map(ach => `🏆 ${ach}`).join('\n');
        await message.reply(`🏆 Achievement Unlocked!\n${achievementMsg}\n💰 +50,000 bonus coins!\n✨ +100 bonus XP!`);

        const userData = await usersData.get(event.senderID) || {};
        userData.money = (userData.money || 0) + 50000;
        await usersData.set(event.senderID, userData);
      }

      message.unsend(Reply.messageID);
      global.GoatBot.onReply.delete(Reply.messageID);
    } catch (err) {
      console.error("Answer error:", err);
      const errorMsg = err.response?.data?.error || err.message || "Unknown error occurred";
      message.reply(`⚠️ Error processing your answer: ${errorMsg}`);
    }
  },

  envConfig: {
    reward: 10000,
    achievementReward: 50000,
    streakReward: 1000,
    flagReward: 12000,
    animeReward: 15000,
    dailyChallengeBonus: 20000,
    hardDifficultyReward: 15000,
    easyDifficultyReward: 7500
  }
};
