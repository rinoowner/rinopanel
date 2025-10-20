import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Reseller from './models/Reseller.js';
import DepositModel from './models/Deposit.js';
import Coupon from './models/Coupon.js'; // Coupon model import
import { fetchKey } from './puppeteer/fetchKey.js';
import { fetchKeyPhantom } from './puppeteer/fetchKeyPhantom.js';

dotenv.config();
const BOT_USERNAME = process.env.BOT_USERNAME;
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true, request: { family: 4 } });

const OWNER_ID = 1351184742;
const OWNER_USERNAME = "officialrino";

const ACCESS_REQUIRED_CHANNEL_ID = '-1001752764171';
const ACCESS_REQUIRED_CHANNEL_LINK = 'https://t.me/+gQDfmaUr3k5kYzFl';
const PROMOTION_CHANNEL_LINK = "https://t.me/+nCIn-dREyGUxMDI1";

let QR_CODE_FILE_ID = 'YOUR_QR_CODE_FILE_ID';

// --------------------------------------------------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const keyGenerationLogSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    username: { type: String, required: true },
    loaderId: { type: String, required: true },
    loaderName: { type: String, required: true },
    durationId: { type: String, required: true },
    durationLabel: { type: String, required: true },
    price: { type: Number, required: true },
    generatedAt: { type: Date, default: Date.now }
});

const KeyGenerationLog = mongoose.model('KeyGenerationLog', keyGenerationLogSchema);

const loaders = { "57": "69 LOADER", "55": "PAID LOADER", "56": "TRX LOADER + MOD", "52": "UNIQUE CHEATS", "53": "BATTLE LOADER", "65": "KING ANDROID LOADER", "66": "KING ANDROID MOD", "71": "MARS LOADER", "70": "PHANTOM SERVER", "73": "BGMI POWER" };
const baseDurations = { "24": { label: "1 day – ₹99", price: 99 }, "72": { label: "3 days – ₹250", price: 250 }, "168": { label: "7 days – ₹399", price: 399 }, "360": { label: "15 days – ₹599", price: 599 }, "720": { label: "30 days – ₹999", price: 999 }, "1440": { label: "60 days – ₹1499", price: 1499 } };
const phantomDurations = { "5": { label: "5 Hours – ₹50", price: 50 }, ...baseDurations };

const userSteps = {};

// Helper Functions
function getUsername(user) { return user?.username ? `@${user.username}` : user?.first_name || 'Unknown'; }

async function checkMembership(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    if (userId === OWNER_ID) return true;
    try {
        const chatMember = await bot.getChatMember(ACCESS_REQUIRED_CHANNEL_ID, userId);
        if (['creator', 'administrator', 'member'].includes(chatMember.status)) { return true; }
    } catch (error) {}
    bot.sendMessage(chatId, `🛑 **Access Blocked!** 🛑\n\nTo use the bot, you must join our channel first.\n\n👉 [**Click Here to Join**](${ACCESS_REQUIRED_CHANNEL_LINK}) 👈\n\nAfter joining, press the button below.`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "✅ I have joined!", callback_data: "check_join_status" }]] }
    });
    return false;
}

async function proceedToPayment(chatId, userId, loaderId, durationId, coupon, messageId, from) {
    try {
        const user = await User.findOne({ id: userId });
        const reseller = await Reseller.findOne({ id: userId });
        const durationSet = loaderId === "70" ? phantomDurations : baseDurations;
        const selected = durationSet[durationId];
        let price = selected.price;
        let finalPrice = price;

        let priceMessage = "";

        if (coupon) {
            const discountAmount = Math.round(price * (coupon.discountPercentage / 100));
            finalPrice = price - discountAmount;
            priceMessage = `Original Price: ₹${price}\nCoupon Discount (-${coupon.discountPercentage}%): -₹${discountAmount}\n<b>Final Price: ₹${finalPrice}</b>`;
        } else {
            priceMessage = `<b>Price: ₹${price}</b>`;
        }
        
        if (messageId) {
            await bot.editMessageText(priceMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
        } else {
            await bot.sendMessage(chatId, priceMessage, { parse_mode: 'HTML' });
        }
        
        let balance = reseller ? reseller.balance : (user?.referralCount || 0) * 10;
        
        if (balance >= finalPrice) {
            await bot.sendMessage(chatId, `Your balance is sufficient. Generating key...`);
            
            if (reseller) {
                reseller.balance -= finalPrice;
                await reseller.save();
            } else {
                user.referralCount -= Math.ceil(finalPrice / 10);
                await user.save();
            }
            await bot.sendMessage(chatId, `💸 ₹${finalPrice} has been deducted from your balance.`);

            const key = loaderId === "70" ? await fetchKeyPhantom(durationId) : await fetchKey(loaderId, durationId);
            
            await KeyGenerationLog.create({
                userId: userId,
                username: getUsername(from),
                loaderId: loaderId,
                loaderName: loaders[loaderId],
                durationId: durationId,
                durationLabel: selected.label,
                price: finalPrice,
            });

            const successMessage = `✅ <b>Your purchase is complete!</b>\n\nHere is your key:\n<code>${key}</code>\n\nLoader yahan se download karo:\n<a href="${PROMOTION_CHANNEL_LINK}">Setup Channel</a>`;
            await bot.sendMessage(chatId, successMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
        
        } else {
            await bot.sendMessage(chatId, `Your balance is low. Please pay using the QR code.`);
            
            const paymentCaption = `💳 **Complete Your Purchase**\n\n<b>Item:</b> ${loaders[loaderId]}\n<b>Price:</b> ₹${finalPrice}\n\n1. Scan the QR code below and pay the exact amount.\n2. After payment, send the <b>screenshot</b> to get your key.`;
            userSteps[userId] = {
                step: 'awaiting_key_payment_screenshot',
                details: { loaderId, durationId, price: finalPrice }
            };
            await bot.sendPhoto(chatId, QR_CODE_FILE_ID, { caption: paymentCaption, parse_mode: 'HTML' });
        }
        
        if (userSteps[userId] && userSteps[userId].step !== 'awaiting_key_payment_screenshot') {
            delete userSteps[userId];
        }

    } catch (err) {
        console.error("Error in proceedToPayment:", err);
        bot.sendMessage(chatId, "An error occurred during payment processing. Please try again.");
    }
}

// ==========================================================
// BOT COMMAND HANDLERS
// ==========================================================

bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
    if (!await checkMembership(msg)) return;
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const referrerId = match[1] ? parseInt(match[1]) : null;
    let user = await User.findOne({ id: userId });
    if (!user) {
        user = await User.create({ id: userId, username: msg.from.username || null, name: msg.from.first_name, referredBy: referrerId || null, referralCount: 0 });
        if (referrerId && referrerId !== userId) {
            const referrer = await User.findOne({ id: referrerId });
            if (referrer) {
                referrer.referralCount += 1;
                await referrer.save();
                const reseller = await Reseller.findOne({ id: referrerId });
                if (reseller) {
                    reseller.balance += 10;
                    await reseller.save();
                    bot.sendMessage(referrerId, `🎉 ₹10 added for referring ${getUsername(msg.from)}!`);
                }
            }
        }
    }
    bot.sendMessage(chatId, `👋 Welcome to Rino Mods Bot\n\nChoose an option below:`, {
        reply_markup: {
            keyboard: [
                ["🔑 Buy Key"],
                ["📋 My Info", "💰 Balance", "📢 Refer"],
                ["📞 Contact Owner"]
            ],
            resize_keyboard: true
        }
    });
});

bot.onText(/\/setqr/, async (msg) => {
    if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, "🚫 Access denied.");
    userSteps[msg.from.id] = { step: 'awaiting_qr_image' };
    bot.sendMessage(msg.chat.id, "📸 Please send the QR code image now.");
});

bot.onText(/\/addreseller (\d+) (\d+)(?: (\d+))?/, async (msg, match) => {
    if (msg.from.id !== OWNER_ID) return;
    const resellerId = parseInt(match[1]);
    const days = parseInt(match[2]);
    const balance = match[3] ? parseInt(match[3]) : 0;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    await Reseller.updateOne({ id: resellerId }, { id: resellerId, expires: expiry, balance: balance }, { upsert: true });
    bot.sendMessage(msg.chat.id, `✅ Reseller <b>${resellerId}</b> added for <b>${days}</b> days\n💰 Starting Balance: ₹<b>${balance}</b>`, { parse_mode: "HTML" });
});

bot.onText(/\/removereseller (\d+)/, async (msg, match) => {
    if (msg.from.id !== OWNER_ID) return;
    const resellerId = parseInt(match[1]);
    await Reseller.deleteOne({ id: resellerId });
    bot.sendMessage(msg.chat.id, `❌ Reseller *${resellerId}* removed.`, { parse_mode: "Markdown" });
});

bot.onText(/\/getid/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    if (msg.reply_to_message) {
        const repliedToUser = msg.reply_to_message.from;
        bot.sendMessage(OWNER_ID, `User: ${repliedToUser.first_name}\nID: \`${repliedToUser.id}\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(OWNER_ID, "Please reply to a user's message to get their ID.");
    }
});

bot.onText(/\/createcoupon (\w+) (\d+)/, async (msg, match) => {
    if (msg.from.id !== OWNER_ID) return;
    try {
        const code = match[1].toUpperCase();
        const discountPercentage = parseInt(match[2]);
        if (discountPercentage < 1 || discountPercentage > 100) {
            return bot.sendMessage(OWNER_ID, "Discount must be between 1 and 100.");
        }
        if (await Coupon.findOne({ code })) {
            return bot.sendMessage(OWNER_ID, `Coupon "${code}" already exists.`);
        }
        await Coupon.create({ code, discountPercentage });
        bot.sendMessage(OWNER_ID, `✅ Coupon "${code}" created with ${discountPercentage}% discount.`);
    } catch (err) {
        bot.sendMessage(OWNER_ID, `Error: ${err.message}`);
    }
});

bot.onText(/\/deletecoupon (\w+)/, async (msg, match) => {
    if (msg.from.id !== OWNER_ID) return;
    try {
        const code = match[1].toUpperCase();
        const result = await Coupon.deleteOne({ code });
        if (result.deletedCount > 0) {
            bot.sendMessage(OWNER_ID, `✅ Coupon "${code}" deleted.`);
        } else {
            bot.sendMessage(OWNER_ID, `Coupon "${code}" not found.`);
        }
    } catch (err) {
        bot.sendMessage(OWNER_ID, `Error: ${err.message}`);
    }
});

bot.onText(/\/listcoupons/, async (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    const coupons = await Coupon.find({ isActive: true });
    if (coupons.length === 0) return bot.sendMessage(OWNER_ID, "No active coupons.");
    let message = "🎟️ *Active Coupons:*\n\n";
    coupons.forEach(c => {
        message += `*Code:* \`${c.code}\`  -  *Discount:* ${c.discountPercentage}%\n`;
    });
    bot.sendMessage(OWNER_ID, message, { parse_mode: "Markdown" });
});

bot.onText(/\/broadcast/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    bot.sendMessage(msg.chat.id, "📥 Send the message to broadcast.");
    bot.once('message', (broadcastMsg) => {
        User.find().then(async (users) => {
            let successfulSends = 0, failedSends = 0;
            for (const user of users) {
                try {
                    await bot.copyMessage(user.id, broadcastMsg.chat.id, broadcastMsg.message_id);
                    successfulSends++;
                } catch (error) { failedSends++; }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            bot.sendMessage(msg.chat.id, `✅ Broadcast sent. Success: ${successfulSends}, Failed: ${failedSends}`);
        });
    });
});

bot.onText(/\/analytics/, async (msg) => {
    if (msg.from.id !== OWNER_ID) return;
    try {
        const totalUsers = await User.countDocuments();
        const totalResellers = await Reseller.countDocuments();
        const keyLogs = await KeyGenerationLog.find().sort({ generatedAt: -1 }).limit(20);
        const topResellers = await Reseller.find().sort({ balance: -1 }).limit(10);
        const topReferrers = await User.find({ referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(10);

        let keyGenText = "\n🔑 <b>Recent Key Generations:</b>\n";
        if (keyLogs.length > 0) {
            for (const log of keyLogs) {
                keyGenText += `• ${log.username}: ${log.loaderName} (${log.durationLabel.split('–')[0].trim()}) - ₹${log.price}\n`;
            }
        } else {
            keyGenText += "No keys have been generated yet.\n";
        }

        let balanceText = "\n💰 <b>Top Reseller Balances:</b>\n";
        for (const r of topResellers) {
            const u = await User.findOne({id: r.id});
            balanceText += `• ${getUsername(u || { first_name: r.id })} – ₹${r.balance || 0}\n`;
        }
        
        let referralText = "\n👥 <b>Top Referrers:</b>\n";
        for (const u of topReferrers) {
            referralText += `• ${getUsername(u)} – ${u.referralCount} referrals\n`;
        }
        
        const finalMessage = `📊 <b>Bot Analytics:</b>\n👥 Total Users: <b>${totalUsers}</b>\n🧑‍💼 Resellers: <b>${totalResellers}</b>\n${keyGenText}\n${balanceText}\n${referralText}`;

        if (finalMessage.length > 4096) {
            bot.sendMessage(msg.chat.id, "Analytics data is too long, sending in parts...");
            bot.sendMessage(msg.chat.id, `📊 <b>Summary:</b>\n👥 Total Users: <b>${totalUsers}</b>\n🧑‍💼 Resellers: <b>${totalResellers}</b>`, {parse_mode: 'HTML'});
            bot.sendMessage(msg.chat.id, keyGenText, {parse_mode: 'HTML'});
            bot.sendMessage(msg.chat.id, balanceText, {parse_mode: 'HTML'});
            bot.sendMessage(msg.chat.id, referralText, {parse_mode: 'HTML'});
        } else {
            bot.sendMessage(msg.chat.id, finalMessage, { parse_mode: "HTML" });
        }
    } catch (err) {
        console.error("❌ Analytics error:", err);
        bot.sendMessage(msg.chat.id, "❌ Failed to fetch analytics.");
    }
});

// ==========================================================
// MESSAGE HANDLER
// ==========================================================
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if ((!text && !msg.photo) || (text && text.startsWith("/"))) return;
    if (!await checkMembership(msg)) return;

    const stepInfo = userSteps[userId];

    if (stepInfo?.step === 'awaiting_qr_image' && userId === OWNER_ID) {
        if (msg.photo) {
            QR_CODE_FILE_ID = msg.photo[msg.photo.length - 1].file_id;
            delete userSteps[userId];
            return bot.sendMessage(chatId, `✅ QR Code successfully saved!`);
        } else {
            return bot.sendMessage(chatId, "❌ That was not a photo. Please try again.");
        }
    }

    if (stepInfo?.step === 'awaiting_key_payment_screenshot') {
        if (!msg.photo) {
            return bot.sendMessage(chatId, "❌ Please send a screenshot of the payment.");
        }
        
        const { loaderId, durationId, price } = stepInfo.details;
        const screenshotFileId = msg.photo[msg.photo.length - 1].file_id;
        const durationSet = loaderId === "70" ? phantomDurations : baseDurations;

        const approvalMessage = `🔔 <b>NEW KEY PURCHASE REQUEST</b>\n\nUser: ${getUsername(msg.from)} (<code>${userId}</code>)\nItem: ${loaders[loaderId]}\nDuration: ${durationSet[durationId].label}\nPrice: ₹<b>${price}</b>`;

        await bot.sendPhoto(OWNER_ID, screenshotFileId, {
            caption: approvalMessage,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ Approve & Send Key", callback_data: `approve_key_${userId}_${loaderId}_${durationId}` },
                    { text: "❌ Reject", callback_data: `reject_key_${userId}_${price}` }
                ]]
            }
        });

        delete userSteps[userId];
        return bot.sendMessage(chatId, "✅ Your request has been submitted for approval. You will receive the key once approved.");
    }

    if (stepInfo?.step === 'awaiting_coupon_code') {
        const couponCode = text.toUpperCase();
        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });

        if (!coupon) {
            bot.sendMessage(chatId, "❌ Invalid or expired coupon code. Please try again, or continue without one.", {
                reply_markup: {
                    inline_keyboard: [[{ text: "Continue without Coupon", callback_data: "apply_coupon_no" }]]
                }
            });
            return;
        }

        const { loaderId, durationId } = stepInfo.details;
        await bot.sendMessage(chatId, `✅ Coupon "${couponCode}" applied! You get a ${coupon.discountPercentage}% discount.`);
        await proceedToPayment(chatId, userId, loaderId, durationId, coupon, msg.message_id + 1, msg.from);
        return;
    }
    
    if (text === "📞 Contact Owner") return bot.sendMessage(chatId, `📬 Contact: https://t.me/${OWNER_USERNAME}`);
    
    if (text === "📋 My Info") {
        const user = await User.findOne({ id: userId });
        const reseller = await Reseller.findOne({ id: userId });
        const balance = reseller ? reseller.balance : (user?.referralCount || 0) * 10;
        const role = reseller ? "Reseller" : "User";
        const expiry = reseller ? new Date(reseller.expires).toLocaleDateString() : "N/A";
        return bot.sendMessage(chatId, `👤 <b>Your Info</b>\n🔖 Role: <b>${role}</b>\n📅 Expiry: <b>${expiry}</b>\n💰 Balance: ₹<b>${balance}</b>`, { parse_mode: "HTML" });
    }
    
    if (text === "💰 Balance") {
        const user = await User.findOne({ id: userId });
        const reseller = await Reseller.findOne({ id: userId });
        const balance = reseller ? reseller.balance : (user?.referralCount || 0) * 10;
        return bot.sendMessage(chatId, `💰 Your Balance: ₹${balance}`);
    }

    if (text === "📢 Refer") {
        const user = await User.findOne({ id: userId });
        const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;
        return bot.sendMessage(chatId, `🔗 Your Referral Link:\n${link}\n\n👥 Referred: ${user?.referralCount || 0}\n💸 ₹10 per referral!`);
    }

    if (text === "🔑 Buy Key") {
        const loaderButtons = Object.entries(loaders).map(([id, name]) => ([{ text: name, callback_data: `loader_${id}` }]));
        bot.sendMessage(chatId, "🔰 Please choose a loader:", {
            reply_markup: { inline_keyboard: loaderButtons }
        });
    }
});

// ==========================================================
// CALLBACK QUERY HANDLER
// ==========================================================
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    bot.answerCallbackQuery(callbackQuery.id);

    if (data === 'check_join_status') {
        try {
            const chatMember = await bot.getChatMember(ACCESS_REQUIRED_CHANNEL_ID, userId);
            if (['creator', 'administrator', 'member'].includes(chatMember.status)) {
                await bot.editMessageText("🎉 **Success!** You can now use the bot. Press /start.", { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown' });
            } else {
                await bot.answerCallbackQuery(callbackQuery.id, { text: "You have not joined the channel yet.", show_alert: true });
            }
        } catch (error) {
            await bot.editMessageText("An error occurred. Please try again.", { chat_id: chatId, message_id: message.message_id });
        }
        return;
    }

    if (data.startsWith('approve_key_')) {
        if (userId !== OWNER_ID) return;
        try {
            const parts = data.split('_');
            const targetUserId = parts[2];
            const loaderId = parts[3];
            const durationId = parts[4];

            if (isNaN(parseInt(targetUserId))) {
                throw new Error("Invalid User ID in callback data.");
            }

            await bot.editMessageCaption(`✅ Approved. Sending key to user ${targetUserId}...`, { chat_id: chatId, message_id: message.message_id, reply_markup: {} });
            
            const user = await User.findOne({id: parseInt(targetUserId)});
            const key = loaderId === "70" ? await fetchKeyPhantom(durationId) : await fetchKey(loaderId, durationId);
            const durationSet = loaderId === "70" ? phantomDurations : baseDurations;
            const selected = durationSet[durationId];
            
            await KeyGenerationLog.create({
                userId: parseInt(targetUserId),
                username: getUsername(user || {first_name: targetUserId}),
                loaderId: loaderId,
                loaderName: loaders[loaderId],
                durationId: durationId,
                durationLabel: selected.label,
                price: selected.price,
            });

            const successMessage = `✅ <b>Your purchase is approved!</b>\n\nHere is your key:\n<code>${key}</code>\n\nLoader yahan se download karo:\n<a href="${PROMOTION_CHANNEL_LINK}">Setup Channel</a>`;
            await bot.sendMessage(parseInt(targetUserId), successMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
        
        } catch (err) {
            console.error("❌ CRITICAL ERROR during key approval:", err);
            await bot.sendMessage(chatId, `⚠️ **Approval Failed!**\n\n**Reason:** ${err.message}`);
        }
        return;
    }

    if (data.startsWith('reject_key_')) {
        if (userId !== OWNER_ID) return;
        try {
            const parts = data.split('_');
            const targetUserId = parts[2];
            const price = parts[3];
            
            await bot.editMessageCaption(`❌ Rejected. User ${targetUserId} has been notified.`, { chat_id: chatId, message_id: message.message_id, reply_markup: {} });
            await bot.sendMessage(parseInt(targetUserId), `❌ Your purchase request for ₹${price} was rejected.`);
        } catch(err) {
            console.error("Error during rejection:", err);
            await bot.sendMessage(chatId, `⚠️ Could not notify user. Error: ${err.message}`);
        }
        return;
    }

    if (data.startsWith('loader_')) {
        const loaderId = data.split('_')[1];
        const durationSet = loaderId === "70" ? phantomDurations : baseDurations;
        const durationButtons = Object.entries(durationSet).map(([id, details]) => ([{ text: details.label, callback_data: `duration_${loaderId}_${id}` }]));
        bot.editMessageText(`⏳ Please choose a duration for ${loaders[loaderId]}:`, {
            chat_id: chatId, message_id: message.message_id,
            reply_markup: { inline_keyboard: durationButtons }
        });
        return;
    }

    if (data.startsWith('duration_')) {
        try {
            const [, loaderId, durationId] = data.split('_');
            
            userSteps[userId] = { 
                step: 'awaiting_coupon_decision', 
                details: { loaderId, durationId } 
            };
            
            await bot.editMessageText("Do you have a coupon code?", {
                chat_id: chatId,
                message_id: message.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: "✅ Yes, Apply Coupon", callback_data: "apply_coupon_yes" },
                        { text: "❌ No, Continue", callback_data: "apply_coupon_no" }
                    ]]
                }
            });
        } catch (err) {
            console.error("Error at coupon decision step:", err);
            bot.sendMessage(chatId, "An error occurred. Please try again.");
        }
        return;
    }

    if (data === 'apply_coupon_yes') {
        userSteps[userId].step = 'awaiting_coupon_code';
        bot.editMessageText("Please send your coupon code now.", {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: {}
        });
        return;
    }

    if (data === 'apply_coupon_no') {
        const { loaderId, durationId } = userSteps[userId].details;
        await proceedToPayment(chatId, userId, loaderId, durationId, null, message.message_id, callbackQuery.from); 
        return;
    }
});

console.log("🚀 Bot is running...");
