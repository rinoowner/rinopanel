# Rino Multi Panel Bot 🔐

A secure Telegram bot that generates keys from the Tenda panel using Puppeteer automation and MongoDB for storage.

## Features
- Reseller system with expiry
- Key tracking
- Broadcast system
- MongoDB integration
- Owner-only admin commands

## Setup Instructions

1. Clone the repo
2. Run `npm install`
3. Create `.env` file based on `.env.example`
4. Run `npm start` or `pm2 start bot.js`

## Commands

| Command         | Description                |
|----------------|----------------------------|
| /start          | Start key purchase flow     |
| /addreseller    | Add reseller (owner only)   |
| /broadcast      | Broadcast message (owner)   |
| /analytics      | View bot stats (owner)      |
| /myinfo         | Reseller expiry info        |

---

## 🧠 How to Upload to GitHub

```bash
git init
git add .
git commit -m "Initial commit - Tenda Bot"
gh repo create tenda-bot --public --source=. --remote=origin --push
