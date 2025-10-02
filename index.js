app.get("/ftd-hook", async (req, res) => {
  const token = req.query.token;
  const subid = req.query.subid || "-";
  const status = (req.query.status || "").toLowerCase();
  const curr = (req.query.currency || "usd").toUpperCase();

  // ✅ Универсальный парсинг payout под разные ПП
  const payout =
    req.query.payout ||
    req.query.revenue ||
    req.query.sum ||
    "0";

  // проверка токена
  if (token !== process.env.WEBHOOK_TOKEN) {
    console.log("❌ Bad token");
    return res.status(403).send("Bad token");
  }

  // проверка статуса
  const allowed = ["confirmed", "approved", "sale", "success"];
  if (!allowed.includes(status)) {
    console.log(`⏩ Skip by status: ${status}`);
    return res.json({ ok: true, ignored: "status" });
  }

  // форматируем сообщение
  const text = `✅ FTD
SubID: ${subid}
Payout: ${payout} ${curr}
Status: ${status}`;

  try {
    await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, text);
    console.log("📩 Sent to Telegram:", text);
    return res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("⚠️ Telegram send error:", err.message);
    return res.status(500).send("Telegram send error");
  }
});
