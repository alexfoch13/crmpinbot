// index.js
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 8080;

// ENV
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}
if (!CHAT_ID) {
  console.error("❌ TELEGRAM_CHAT_ID is missing");
  process.exit(1);
}
if (!WEBHOOK_TOKEN) {
  console.error("❌ WEBHOOK_TOKEN is missing");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Health-check
app.get("/health", (_req, res) => res.send("ok"));

// FTD Webhook
app.get("/ftd-hook", async (req, res) => {
  const token   = req.query.token || "";
  const subid   = req.query.subid || "-";
  const status  = (req.query.status || "").toLowerCase();
  const curr    = (req.query.currency || "usd").toUpperCase();

  // ✅ Универсальный payout для разных ПП
  const payout =
    req.query.payout ||
    req.query.revenue ||
    req.query.sum ||
    "0";

  // Token check
  if (token !== WEBHOOK_TOKEN) {
    console.log("❌ Bad token");
    return res.status(403).send("Bad token");
  }

  // Status filter
  const allowed = ["confirmed", "approved", "sale", "success"];
  if (!allowed.includes(status)) {
    console.log(`⏩ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  const text = `✅ FTD
SubID: ${subid}
Payout: ${payout} ${curr}
Status: ${status}`;

  try {
    await bot.telegram.sendMessage(CHAT_ID, text);
    console.log("📩 Sent:", text.replace(/\n/g, " | "));
    return res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("⚠️ Telegram send error:", err?.response || err);
    return res.status(500).send("Telegram send error");
  }
});

// Без bot.launch() — нам не нужен polling
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
