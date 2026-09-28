// Облачная синхронизация и push-уведомления требуют серверной части
// (Vercel Functions + Upstash Redis + VAPID-ключи, см. .env.example).
// Без неё приложение работает в демо-режиме: сразу открывается с примерами,
// данные хранятся только в браузере. Включить: VITE_SYNC_ENABLED=true.
export const SYNC_ENABLED = import.meta.env.VITE_SYNC_ENABLED === 'true';
