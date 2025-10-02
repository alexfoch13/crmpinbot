// ==== Minimal FTD Pusher (Keitaro-friendly) ====
// ENV: TELEGRAM_TOKEN, ADMIN_CHAT_ID, POSTBACK_SECRET (optional), PORT (optional)
const express = require('express');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) throw new Error('TELEGRAM_TOKEN is required');
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const POSTBACK_SECRET = process.env.POSTBACK_SECRET || '';

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(express.urlencoded({ extended: true }));

// Health & root
app.get('/', (_, res) => res.status(200).send('FTD Pusher OK'));
app.get('/health', (_, res) => res.status(200).send('OK'));

// --- Simple in-memory dedup (15 min) ---
const seen = new Map();
const DEDUP_WINDOW_MS = 15 * 60 * 1000;

function normalizeFields(qs) {
  const subid = qs.subid || qs.sub_id1 || qs.clickid || qs.sub1 || qs.sub || '';
  const payoutRaw = qs.payout || qs.revenue || qs.amount || '0';
  const statusRaw = String(qs.status || qs.event || qs.type || '').toLowerCase();
  const currency = String(qs.currency || qs.cur || 'usd').toUpperCase();

  const payout = parseFloat(String(payoutRaw).replace(',', '.')) || 0;

  return {
    subid, payout, statusRaw, currency,
    raw: qs
  };
}

function isFtdStatus(s) {
  // расширенный список: подкинем сюда то, что реально шлёт партнёрка/Keitaro
  return ['ftd','sale','approved','confirm','confirmed','success','deposit','paid'].some(x => s.includes(x));
}

function shouldNotify({ subid, payout, statusRaw }) {
  if (!subid) return false;
  if (!(payout > 0)) return false;
  if (!isFtdStatus(statusRaw)) return false;
  return true;
}

function dedupKey({ subid, payout, statusRaw }) {
  return `${subid}|${payout}|${statusRaw}`;
}

function putSeen(key) {
  const now = Date.now();
  seen.set(key, now);
  for (const [k, ts] of seen.entries()) if (now - ts > DEDUP_WINDOW_MS) seen.delete(k);
}

async function notifyTelegram(text) {
  const ids = ADMIN_CHAT_ID.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return;
  await Promise.allSettled(
    ids.map(id => bot.telegram.sendMessage(id, text, { disable_web_page_preview: true }))
  );
}

app.all('/ftd-hook', async (req, res) => {
  try {
    const source = req.method === 'GET'
      ? { ...req.query }
      : (req.is('application/json') ? req.body : { ...req.body, ...req.query });

    console.log('[FTD-HOOK] method=%s headers=%j payload=%j', req.method, req.headers, source);

    // --- Optional: shared-secret check (рекомендуется) ---
    if (POSTBACK_SECRET) {
      const token = String(source.token || '');
      if (token !== POSTBACK_SECRET) {
        console.warn('[FTD-HOOK] invalid token');
        // Отвечаем OK, чтобы партнёрка/Keitaro не ретраили бесконечно
        return res.status(200).send('OK');
      }
    }

    // Нормализация основных полей
    const data = normalizeFields(source);

    // Доп. метаданные от Keitaro (произвольные, не обязательные)
    const meta = {
      campaign_id: source.camp || source.campaign_id || '',
      offer_id: source.offer || source.offer_id || '',
      affiliate_id: source.aff || source.aff_id || source.affiliate_network_id || '',
      clickid: source.clickid || ''
    };

    // Решение: отправлять ли уведомление
    if (shouldNotify(data)) {
      const key = dedupKey(data);
      if (!seen.has(key)) {
        putSeen(key);

        const msg =
`💰 FTD получен
• SubID: ${data.subid}
• Статус: ${data.statusRaw}
• Сумма: ${data.payout} ${data.currency}
• Кампания: ${meta.campaign_id || '—'}  Оффер: ${meta.offer_id || '—'}  Партнёрка: ${meta.affiliate_id || '—'}
• ClickID: ${meta.clickid || '—'}
• Время: ${new Date().toISOString()}

Raw: ${JSON.stringify(data.raw)}`;

        await notifyTelegram(msg);
      } else {
        console.log('[FTD-HOOK] duplicate suppressed:', data.subid);
      }
    } else {
      console.log('[FTD-HOOK] skipped (not FTD or invalid):', data);
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('[FTD-HOOK] error', e);
    // Всегда 200, чтобы не плодить ретраи
    res.status(200).send('OK');
  }
});

// HTTP + Telegram polling
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('FTD Pusher listening on', PORT));
bot.launch().then(() => console.log('Telegram bot launched'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
