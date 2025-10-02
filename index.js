// index.js (CommonJS)
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === ENV ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || "super_long_random_secret";

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}
if (!CHAT_IDS.length) {
  console.error("❌ TELEGRAM_CHAT_ID is missing!");
  process.exit(1);
}
if (!WEBHOOK_TOKEN) {
  console.error("❌ WEBHOOK_TOKEN is missing!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// рассылка всем администраторам
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

const ALLOWED = ["confirmed", "approved", "sale", "success"];

// Health-check
app.get("/health", (_req, res) => res.json({ ok: true, t: Date.now() }));

// Основной хук
app.get("/ftd-hook", async (req, res) => {
  const { token, subid, status } = req.query;
  const currency = (req.query.currency || "usd").toUpperCase();

  // универсальный payout для разных ПП
  const payout = req.query.payout || req.query.revenue || req.query.sum || "0";

  if (token !== WEBHOOK_TOKEN) {
    console.log("❌ Bad token");
    return res.status(403).send("Bad token");
  }

  const st = (status || "").toLowerCase();
  if (!ALLOWED.includes(st)) {
    console.log(`⏭️ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  const text =
    `✅ <b>FTD</b>\n` +
    `<b>SubID:</b> ${subid || "-"}\n` +
    `<b>Payout:</b> ${payout} ${currency}\n` +
    `<b>Status:</b> ${status}`;

  try {
    await notifyAll(text);
    return res.json({ ok: true, sent: true });
  } catch (e) {
    console.error("Telegram send error:", e?.response || e);
    return res.status(500).send("Telegram send error");
  }
});

// Запуск сервера (polling не нужен)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
