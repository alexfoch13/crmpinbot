// index.js
import express from "express";
import { Telegraf } from "telegraf";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === ENV ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);
const SECRET = process.env.WEBHOOK_TOKEN || "super_long_random_secret";

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}
if (!CHAT_IDS.length) {
  console.error("❌ TELEGRAM_CHAT_ID is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// === Helper: рассылка всем админам ===
async function notifyAll(text) {
  for (const chatId of CHAT_IDS) {
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: "HTML" });
      console.log(`📩 Sent to ${chatId}`);
    } catch (err) {
      console.error(`⚠️ Error sending to ${chatId}:`, err?.response || err);
    }
  }
}

// === Allowed statuses ===
const allowed = ["confirmed", "approved", "sale", "success"];

// === Webhook ===
app.get("/ftd-hook", async (req, res) => {
  const { token, subid, payout, revenue, status, currency } = req.query;

  if (token !== SECRET) {
    return res.status(403).send("Bad token");
  }

  const st = (status || "").toLowerCase();
  if (!allowed.includes(st)) {
    console.log(`⏭️ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  const payoutVal = payout || revenue || 0;

  const text = `✅ <b>FTD</b>\n<b>SubID:</b> ${subid}\n<b>Payout:</b> ${payoutVal} ${currency?.toUpperCase()}\n<b>Status:</b> ${status}`;
  await notifyAll(text);

  return res.json({ ok: true });
});

// === Healthcheck ===
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// === Start server ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

bot.launch();
