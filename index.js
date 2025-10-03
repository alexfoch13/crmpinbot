// ====== env ======
// Нужны переменные окружения:
// TELEGRAM_BOT_TOKEN  — токен бота
// ALLOWED_USER_IDS    — кому слать (через запятую), напр. "8442616298,8048147283"
// WEBHOOK_SECRET      — shared secret из постбека, напр. "super_long_random_secret"
// PORT                — порт (по умолчанию 8080)

const express = require("express");
const fetch = require("node-fetch");
const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET;
const PORT = process.env.PORT || 8080;

if (!BOT_TOKEN || !SECRET) {
  console.error("ENV error: TELEGRAM_BOT_TOKEN and WEBHOOK_SECRET are required");
  process.exit(1);
}

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Статусы, на которые реагируем (остальные игнорим, чтобы не спамить)
const ALLOWED_STATUSES = new Set(["sale", "confirmed", "approved", "success"]);

// кому отправлять уведомления
const USER_IDS = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Хелпер: безопасно взять первое непустое значение из списка ключей
function pick(q, keys, fallback = "") {
  for (const k of keys) {
    if (q[k] !== undefined && q[k] !== null && String(q[k]).trim() !== "") {
      return String(q[k]).trim();
    }
  }
  return fallback;
}

// Простой health-check
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Основной хук для FTD
app.get("/ftd-hook", async (req, res) => {
  try {
    // 1) безопасность
    const token = req.query.token;
    if (token !== SECRET) {
      return res.status(403).json({ ok: false, error: "bad token" });
    }

    // 2) собираем поля из разных кейсов
    const subid = pick(req.query, [
      "subid",
      "sub_id",
      "sub",
      "sub1",
      "sub_id1",
      "subId1",
      "clickid",
      "click_id",
    ]);

    // payout/revenue/payment — у сеток бывает по-разному
    const payoutStr = pick(req.query, ["payout", "revenue", "payment"], "0");
    // приводим к числу с 2 знаками — если пусто/мусор, будет 0.00
    const payout = Number(payoutStr.replace(",", "."));
    const payoutFmt = isFinite(payout) ? payout.toFixed(2) : "0.00";

    const status = pick(req.query, ["status"], "").toLowerCase();
    const currency = (pick(req.query, ["currency"], "USD") || "USD").toUpperCase();

    // geo могут передавать как geo/country/cc и т.п.
    const geo = pick(req.query, ["geo", "country", "cc", "country_code"], "-").toUpperCase();

    // источник: руками в постбеке ставим source=pinup/glory (но можно и не ставить)
    const source = pick(req.query, ["source", "src", "network"], "-");

    // 3) фильтр статуса
    if (!ALLOWED_STATUSES.has(status)) {
      return res.json({ ok: true, ignored: "status" });
    }

    // 4) собираем текст
    const lines = [
      "✅ FTD",
      `SubID: ${subid || "-"}`,
      `Payout: ${payoutFmt} ${currency}`,
      `Status: ${status}`,
      `GEO: ${geo || "-"}`,
      `Source: ${source || "-"}`,
    ];
    const text = lines.join("\n");

    // 5) отправляем всем, кто в ALLOWED_USER_IDS
    const sendJobs = USER_IDS.map((id) => bot.telegram.sendMessage(id, text));
    await Promise.allSettled(sendJobs);

    return res.json({ ok: true });
  } catch (err) {
    console.error("ftd-hook error:", err);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});

// Старт сервера и бота (polling)
app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  try {
    await bot.launch();
    console.log("🤖 Bot launched");
  } catch (e) {
    console.error("Bot launch error:", e);
  }
});

// Красиво останавливаем бота (Railway/Heroku и т.п.)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
