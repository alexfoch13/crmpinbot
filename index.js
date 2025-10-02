// index.js
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 8080;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ Нет TELEGRAM_BOT_TOKEN в ENV");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Health-check
app.get("/health", (_, res) => res.send("ok"));

// FTD webhook
app.get("/ftd-hook", async (req, res) => {
  const { token, subid, payout, status, currency } = req.query;

  // DEBUG лог
  console.log(`[FTD-HOOK] token=${token}, subid=${subid}, payout=${payout}, status=${status}, currency=${currency}`);

  // Проверка токена
  if (token !== WEBHOOK_TOKEN) {
    console.log("❌ Bad token");
    return res.status(403).send("Bad token");
  }

  const allowed = ["confirmed", "approved", "sale", "success"];
  const st = (status || "").toLowerCase();

  if (!allowed.includes(st)) {
    console.log(`⚠️ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  const text = `✅ FTD\nSubID: ${subid}\nPayout: ${payout} ${currency}\nStatus: ${status}`;

  try {
    await bot.telegram.sendMessage(CHAT_ID, text);
    console.log("📩 Отправлено в Telegram");
    return res.json({ ok: true });
  } catch (e) {
    console.error("⚠️ Ошибка Telegram:", e.response || e);
    return res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
