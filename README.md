# FTD Pusher Bot (Keitaro → Telegram)

Минимальный Node.js сервис: принимает постбеки (GET/POST, form-urlencoded/JSON) от Keitaro/ПП и шлёт уведомление о FTD в Telegram.

## 1) Быстрый старт локально

```bash
npm i
cp .env.example .env
# Заполни TELEGRAM_TOKEN, ADMIN_CHAT_ID, POSTBACK_SECRET
npm start
