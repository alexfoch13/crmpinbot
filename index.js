// index.js

const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 8080;

// === ENV переменные (Railway) ===
// TELEGRAM_BOT_TOKEN   -> токен из BotFather
// TELEGRAM_CHAT_ID     -> твой chat_id или id канала
// WEBHOOK_TOKEN        -> секрет для защиты вебхука

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// простой health-check
app.get("/health", (req, res) => {
  res.send("ok");
});

// основной webhook для FTD
app.get("/ftd-hook", (req, res) => {
  const { token, subid, payout, status, currency } = req.query;

  // проверка токена
  if (token !== process.env.WEBHOOK_TOKEN) {
    return res.status(403).send("Bad token");
  }

  // список разрешённых статусов
  const allowedStatuses = ["confirmed", "approved", "sale", "success"];
  if (!allowedStatuses.includes((status || "").toLowerCase())) {
    console.log(`❌ Игнорируем статус: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  // формируем текст для уведомления
  const text = `✅ FTD\nSubID: ${subid}\nPayout: ${payout} ${currency}\nStatus: ${status}`;

  // отправляем сообщение в телеграм
  bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, text)
    .then(() => console.log("📩 Уведомление отправлено в Telegram"))
    .catch(err => console.error("⚠️ Ошибка Telegram:", err));

  res.json({ ok: true });
});

// запуск express + бота
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

bot.launch();

console.log("ENV TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING");
