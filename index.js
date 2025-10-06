// index.js (CommonJS)
const express = require("express");
const { Telegraf } = require("telegraf");

// --- ENV с поддержкой старых/новых названий ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_TOKEN || process.env.WEBHOOK_SECRET;
const ALLOWED_USER_IDS =
  process.env.TELEGRAM_CHAT_ID ||
  process.env.ADMIN_CHAT_ID ||
  process.env.ALLOWED_USER_IDS ||
  "";

// Список чатов для уведомлений
const CHAT_IDS = ALLOWED_USER_IDS.split(",").map(s => s.trim()).filter(Boolean);

// Базовые проверки ENV
if (!BOT_TOKEN || !WEBHOOK_SECRET) {
  console.error(
    "ENV error: TELEGRAM_BOT_TOKEN (или BOT_TOKEN) и WEBHOOK_TOKEN (или WEBHOOK_SECRET) обязательны"
  );
  process.exit(1);
}

// --- Telegram bot ---
const bot = new Telegraf(BOT_TOKEN);
bot.command("ping", async (ctx) => ctx.reply("pong ✅"));

// --- Web server ---
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (_req, res) => res.send("OK"));

/**
 * Webhook для FTD
 * Пример: /ftd-hook?token=...&payout=24&status=sale&currency=usd&source=pinup&geo=AZ
 *
 * Поддержка альтернатив:
 * - payout: payout | payment | revenue
 * - status: status
 * - currency: currency
 * - source: source (опционально, например pinup / glory)
 * - geo: geo | country | cc | country_code | (fallback: sub_id2)
 */
app.get("/ftd-hook", async (req, res) => {
  try {
    const { token } = req.query;
    if (token !== WEBHOOK_SECRET) {
      return res.status(403).json({ ok: false, error: "Bad token" });
    }

    const payoutRaw =
      req.query.payout ||
      req.query.payment ||
      req.query.revenue ||
      "0";

    // GEO: сначала ищем явный параметр, иначе пробуем подхватить из sub_id2
    let geo =
      req.query.geo ||
      req.query.country ||
      req.query.cc ||
      req.query.country_code ||
      req.query.sub_id2 || // fallback, если GEO кладёшь во 2-й саб
      "";

    geo = geo.toString().toUpperCase() || "N/A";

    const status = (req.query.status || "").toLowerCase();
    const currency = (req.query.currency || "usd").toUpperCase();
    const sourceRaw = (req.query.source || "").toLowerCase();

    // Нормализуем название партнёрки
    let partner = "Unknown";
    if (sourceRaw.includes("pinup")) partner = "Pin-Up Partners";
    else if (sourceRaw.includes("glory")) partner = "GloryCasino";
    else if (sourceRaw) {
      // Просто капитализуем, если что-то пришло
      partner = sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1);
    }

    // Разрешённые статусы
    const ALLOWED = ["confirmed", "approved", "sale", "success"];
    if (!ALLOWED.includes(status)) {
      return res.json({ ok: true, ignored: "status" });
    }

    const payout = Number(payoutRaw) || 0;

    // --- Новый формат сообщения ---
    const text =
`✅ FTD
🌍 GEO: ${geo}
🎰 Партнёрка: ${partner}
💵 Депозит: ${payout} ${currency}
📌 Статус: ${status}`;

    await Promise.all(CHAT_IDS.map((id) => bot.telegram.sendMessage(id, text)));

    return res.json({ ok: true });
  } catch (e) {
    console.error("HOOK ERROR:", e);
    return res.status(500).json({ ok: false, error: "server" });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  try {
    await bot.launch();
    console.log("🤖 Bot launched");
  } catch (e) {
    console.error("BOT LAUNCH ERROR:", e.message);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
