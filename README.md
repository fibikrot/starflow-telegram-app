# StarFlow - Telegram Mini App

Упрощенная версия приложения StarFlow для тестирования и деплоя.

## Быстрый запуск

### Локально
```bash
npm install
npm start
```

Приложение будет доступно по адресу: http://localhost:3000

### Тестирование
- Health check: http://localhost:3000/health
- API тест: http://localhost:3000/api/test
- Telegram auth: http://localhost:3000/api/auth/telegram

## Деплой

### Vercel (Рекомендуется)
1. Создайте аккаунт на [vercel.com](https://vercel.com)
2. Подключите ваш GitHub репозиторий
3. Vercel автоматически обнаружит настройки из `vercel.json`
4. Деплой произойдет автоматически

### Railway
1. Создайте аккаунт на [railway.app](https://railway.app)
2. Подключите GitHub репозиторий
3. Railway автоматически деплоит Node.js приложения

### Render
1. Создайте аккаунт на [render.com](https://render.com)
2. Создайте новый Web Service
3. Подключите GitHub репозиторий
4. Используйте команду: `npm start`

## Структура проекта

```
starflow/
├── server/
│   ├── server.js          # Основной сервер
│   ├── app.js            # Express приложение
│   └── middleware/       # Middleware
├── public/               # Статические файлы
├── package.json          # Зависимости
├── vercel.json          # Конфигурация Vercel
└── README.md            # Документация
```

## API Endpoints

- `GET /` - Главная страница
- `GET /health` - Проверка здоровья сервера
- `GET /api/test` - Тестовый API endpoint
- `POST /api/auth/telegram` - Авторизация через Telegram

## Переменные окружения

Создайте файл `.env` (опционально):
```
PORT=3000
NODE_ENV=development
```

## Поддержка

Если у вас есть вопросы, создайте issue в репозитории. 