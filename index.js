// index.js
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 8080;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// health-check
app.get("/health", (_, res) => res.send("ok"));

// FTD webhook от Keitaro
app.get("/ftd-hook", async (req, res) => {
  const { token, subid, payout, status, currency } = req.query;

  if (token !== process.env.WEBHOOK_TOKEN) {
    return res.status(403).send("Bad token");
  }

  const allowed = ["confirmed", "approved", "sale", "success"];
  const st = (status || "").toLowerCase();
  if (!allowed.includes(st)) {
    console.log(`❌ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  const text = `✅ FTD\nSubID: ${subid}\nPayout: ${payout} ${currency}\nStatus: ${status}`;

  try {
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, text);
    console.log("📩 Sent to Telegram");
    return res.json({ ok: true });
  } catch (e) {
    console.error("⚠️ Telegram send error:", e?.response ?? e);
    return res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

// ВАЖНО: НЕ вызываем bot.launch()
// bot.launch();

console.log("ENV TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING");
