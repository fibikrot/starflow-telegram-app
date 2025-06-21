# 🌟 StarFlow - Telegram Mini App

Telegram Mini App для заработка звезд, игр и управления криптовалютами.

## 🚀 Быстрый запуск

### Локальная разработка

```bash
# Клонировать репозиторий
git clone <your-repo-url>
cd starflow

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактируйте .env файл

# Запустить в режиме разработки
npm run dev
```

## 🌐 Бесплатное развертывание

### 1. Railway (Рекомендуется)

1. **Создайте аккаунт** на [Railway.app](https://railway.app)
2. **Подключите GitHub** репозиторий
3. **Добавьте переменные окружения:**
   ```
   TELEGRAM_BOT_TOKEN=7637068885:AAHUnq0htwtwnLGCW00YBjUKIq6RxX9lVvM
   TELEGRAM_BOT_USERNAME=star_web3_bot
   JWT_SECRET=your-random-secret-key-here
   DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/starflow
   ```
4. **Развернуть:** Railway автоматически развернет ваше приложение

### 2. Render.com

1. **Создайте аккаунт** на [Render.com](https://render.com)
2. **Создайте новый Web Service** из GitHub
3. **Настройки:**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Добавьте переменные окружения** (как выше)

### 3. Heroku

```bash
# Установить Heroku CLI
npm install -g heroku

# Логин в Heroku
heroku login

# Создать приложение
heroku create your-starflow-app

# Добавить переменные окружения
heroku config:set TELEGRAM_BOT_TOKEN=7637068885:AAHUnq0htwtwnLGCW00YBjUKIq6RxX9lVvM
heroku config:set TELEGRAM_BOT_USERNAME=star_web3_bot
heroku config:set JWT_SECRET=your-random-secret-key

# Развернуть
git push heroku main
```

## 🗄️ Бесплатная база данных

### MongoDB Atlas (Рекомендуется)

1. **Создайте аккаунт** на [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Создайте бесплатный кластер** (M0 Sandbox)
3. **Получите строку подключения:**
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/starflow
   ```
4. **Добавьте в переменные окружения** как `DATABASE_URL`

## 🤖 Настройка Telegram Bot

### 1. Создание Web App через BotFather

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newapp`
3. Выберите бота: `@star_web3_bot`
4. Введите данные:
   - **Название:** StarFlow
   - **Описание:** Earn stars, play games, and manage crypto!
   - **URL:** `https://your-app-url.railway.app` (замените на ваш URL)

### 2. Установка команд бота

```bash
# После развертывания выполните:
node scripts/setBotCommands.js
```

### 3. Установка webhook

```bash
# Установить webhook для продакшена
node scripts/setWebhook.js https://your-app-url.railway.app

# Проверить статус
node scripts/setWebhook.js info
```

## 📱 Использование

После развертывания ваш бот будет доступен:

- **Telegram бот:** https://t.me/star_web3_bot
- **Web App:** https://t.me/star_web3_bot?startapp
- **Веб-интерфейс:** https://your-app-url.railway.app

## 🔧 Переменные окружения

### Обязательные

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_BOT_USERNAME=your-bot-username
JWT_SECRET=your-jwt-secret
DATABASE_URL=your-mongodb-url
```

### Опциональные

```env
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/your-key
COINGECKO_API_KEY=your-api-key
BASE_CLICK_REWARD=1
DAILY_BONUS_AMOUNT=100
REFERRAL_PERCENTAGE=10
```

## 🎮 Функции

- ⭐ **Система звезд** - внутренняя валюта
- 🎯 **Кликер-игра** - зарабатывайте звезды кликами
- 🎁 **Ежедневные бонусы** - получайте награды каждый день
- 👥 **Реферальная система** - приглашайте друзей
- 💰 **Кошелек** - управляйте балансом
- 🔄 **Переводы** - отправляйте звезды друзьям
- 🌐 **Web3 интеграция** - обмен на криптовалюты
- 📊 **Статистика** - отслеживайте прогресс

## 🛠️ Разработка

### Структура проекта

```
starflow/
├── public/              # Фронтенд файлы
│   ├── assets/         # CSS, JS, изображения
│   └── index.html      # Главная страница
├── server/             # Бэкенд
│   ├── models/         # Модели данных
│   ├── routes/         # API маршруты
│   ├── services/       # Сервисы (Telegram, Web3)
│   ├── middleware/     # Middleware
│   └── config/         # Конфигурация
└── scripts/            # Утилиты
```

### Команды

```bash
npm run dev          # Разработка
npm start           # Продакшен
npm test            # Тесты
npm run lint        # Линтинг
npm run build       # Сборка
```

## 📄 Лицензия

MIT License

## 🤝 Поддержка

Если у вас есть вопросы:
1. Создайте [Issue](https://github.com/your-repo/issues)
2. Напишите в Telegram: [@star_web3_bot](https://t.me/star_web3_bot) 