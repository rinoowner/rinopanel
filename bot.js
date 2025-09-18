import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Reseller from './models/Reseller.js';
import KeyLog from './models/KeyLog.js';
import { fetchKey } from './puppeteer/fetchKey.js';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const OWNER_ID = 1351184742;
const OWNER_USERNAME = "officialrino";
const CHANNEL_LINK = "https://t.me/rinosetup";

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("✅ MongoDB Connected");
}).catch((err) => {
  console.error("❌ MongoDB Connection Error:", err);
});

// ✅ Utility
async function isAuthorized(userId) {
  if (userId === OWNER_ID) return true;
  const reseller = await Reseller.findOne({ id: userId });
  return reseller && new Date(reseller.expires) > new Date();
}

function getUsername(user) {
  return user.username ? `@${user.username}` : user.first_name || 'Unknown';
}

// ✅ Loaders & Durations
const loaders = {
  "57": "69 LOADER",
  "59": "AUSPICIOUS CHEATS",
  "54": "NO NAME LOADER MOD",
  "55": "PAID LOADER",
  "58": "SAFE LOADER",
  "56": "TRX LOADER + MOD",
  "52": "UNIQUE CHEATS",
  "53": "BATTLE LOADER",
  "62": "BGMI LOADER",
  "60": "CROZON LOADER",
  "61": "IGNIS LOADER + MOD"
};

const durations = {
  "24": "1 day – ₹150",
  "72": "3 days – ₹350",
  "168": "7 days – ₹450",
  "360": "15 days – ₹750",
  "720": "30 days – ₹1200",
  "1440": "60 days – ₹1800"
};

const userSteps = {};

// ✅ /start
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Save user to DB
  await User.updateOne(
    { id: userId },
    {
      id: userId,
      username: msg.from.username || null,
      name: msg.from.first_name
    },
    { upsert: true }
  );

  if (!(await isAuthorized(userId))) {
    return bot.sendMessage(chatId, "🚫 *Access Denied:*\nYou are not authorized to use this bot.", {
      parse_mode: "Markdown"
    });
  }

  const loaderList = Object.entries(loaders)
    .map(([id, name]) => `*${id}* – ${name}`)
    .join('\n');

  bot.sendMessage(chatId, `🔰 *Available Loaders:*\n${loaderList}\n\n📩 Reply with the *Loader ID* you want:`, {
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [[{ text: "📞 Contact Owner" }]],
      resize_keyboard: true
    }
  });

  userSteps[userId] = { step: 'awaiting_loader' };
});

// ✅ Message Handler
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) return;

  if (text === "📞 Contact Owner") {
    return bot.sendMessage(chatId, `📬 Contact the owner: https://t.me/${OWNER_USERNAME}`);
  }

  if (!(await isAuthorized(userId))) {
    return bot.sendMessage(chatId, "🚫 You are not authorized.");
  }

  const step = userSteps[userId]?.step;

  if (step === 'awaiting_loader') {
    if (!loaders[text]) {
      return bot.sendMessage(chatId, "❌ Invalid Loader ID.");
    }

    userSteps[userId] = { step: 'awaiting_duration', loaderId: text };

    const durationList = Object.entries(durations)
      .map(([id, label]) => `*${id}* – ${label}`)
      .join('\n');

    return bot.sendMessage(chatId, `⏳ *Available Durations:*\n${durationList}\n\n📩 Reply with the *Duration ID*:`, {
      parse_mode: "Markdown"
    });
  }

  if (step === 'awaiting_duration') {
    const { loaderId } = userSteps[userId];

    if (!durations[text]) {
      return bot.sendMessage(chatId, "❌ Invalid Duration ID.");
    }

    bot.sendMessage(chatId, "⏳ Generating your key...");

    try {
      const key = await fetchKey(loaderId, text);

      const log = await KeyLog.findOne({ userId });
      if (log) {
        log.count += 1;
        await log.save();
      } else {
        await KeyLog.create({ userId, count: 1 });
      }

      bot.sendMessage(chatId, `✅ *Your Key:*\n\`\`\`${key}\`\`\`\n\n📢 Join our channel:\n${CHANNEL_LINK}`, {
        parse_mode: "Markdown"
      });

    } catch (err) {
      bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }

    delete userSteps[userId];
  }
});

// ✅ /addreseller
bot.onText(/\/addreseller (\d+) (\d+)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;

  const resellerId = parseInt(match[1]);
  const days = parseInt(match[2]);

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);

  await Reseller.updateOne({ id: resellerId }, { id: resellerId, expires: expiry }, { upsert: true });

  bot.sendMessage(msg.chat.id, `✅ Reseller *${resellerId}* added for *${days}* days.`, { parse_mode: "Markdown" });
});

// ✅ /removereseller
bot.onText(/\/removereseller (\d+)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;

  const resellerId = parseInt(match[1]);

  await Reseller.deleteOne({ id: resellerId });

  bot.sendMessage(msg.chat.id, `❌ Reseller *${resellerId}* removed.`, { parse_mode: "Markdown" });
});

// ✅ /broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;

  const text = match[1];
  const allUsers = await User.find();

  for (const user of allUsers) {
    bot.sendMessage(user.id, `📢 *Broadcast:*\n${text}`, { parse_mode: "Markdown" });
  }
});

// ✅ /myinfo
bot.onText(/\/myinfo/, async (msg) => {
  const reseller = await Reseller.findOne({ id: msg.from.id });

  if (reseller) {
    const expiry = new Date(reseller.expires).toLocaleDateString();
    bot.sendMessage(msg.chat.id, `👤 *Reseller Info:*\n✅ You are a Reseller\n📅 Expiry: *${expiry}*`, {
      parse_mode: "Markdown"
    });
  } else {
    bot.sendMessage(msg.chat.id, "❌ You are not a reseller or your access has expired.");
  }
});

// ✅ /analytics
bot.onText(/\/analytics/, async (msg) => {
  if (msg.from.id !== OWNER_ID) return;

  const totalUsers = await User.countDocuments();
  const totalResellers = await Reseller.countDocuments();
  const keyLogs = await KeyLog.find();

  let logText = "🔑 *Key Count by User:*\n";
  for (const log of keyLogs) {
    const user = await User.findOne({ id: log.userId });
    const name = user?.username ? `@${user.username}` : user?.name || log.userId;
    logText += `• ${name} – ${log.count} keys\n`;
  }

  bot.sendMessage(msg.chat.id,
    `📊 *Bot Analytics:*\n👥 Total Users: *${totalUsers}*\n🧑‍💼 Resellers: *${totalResellers}*\n\n${logText}`, {
    parse_mode: "Markdown"
  });
});
