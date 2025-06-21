const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

class StarFlowBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '7637068885:AAHUnq0htwtwnLGCW00YBjUKIq6RxX9lVvM';
        this.webAppUrl = process.env.WEB_APP_URL || 'https://starflow-telegram-app.vercel.app';
        this.bot = null;
        this.isRunning = false;
    }

    init() {
        try {
            this.bot = new TelegramBot(this.token, { polling: true });
            this.setupHandlers();
            this.isRunning = true;
            console.log('🤖 StarFlow бот запущен!');
            console.log('🌐 Web App URL:', this.webAppUrl);
        } catch (error) {
            console.error('❌ Ошибка инициализации бота:', error);
        }
    }

    setupHandlers() {
        // Команда /start
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name || 'Друг';
            
            const welcomeMessage = `🌟 Привет, ${firstName}! Добро пожаловать в StarFlow!

🎮 **Что тебя ждет:**
⭐ Кликай по звездам и зарабатывай очки
🏆 Получай достижения и награды  
🎵 Наслаждайся звуковыми эффектами
💫 Соревнуйся с друзьями

🚀 **Готов начать?** Нажми кнопку ниже!`;

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: '🎮 Играть в StarFlow',
                            web_app: { url: this.webAppUrl }
                        }
                    ],
                    [
                        {
                            text: '📊 Статистика',
                            callback_data: 'stats'
                        },
                        {
                            text: '❓ Помощь',
                            callback_data: 'help'
                        }
                    ]
                ]
            };

            this.bot.sendMessage(chatId, welcomeMessage, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
        });

        // Команда /play
        this.bot.onText(/\/play/, (msg) => {
            const chatId = msg.chat.id;
            
            const playMessage = `🎮 **Время играть!**

🌟 Кликай по звездам и зарабатывай очки!
🏆 Открывай новые достижения!
🎵 Включи звук для лучшего опыта!

🚀 Нажми кнопку ниже, чтобы начать:`;

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: '🌟 Запустить игру',
                            web_app: { url: this.webAppUrl }
                        }
                    ]
                ]
            };

            this.bot.sendMessage(chatId, playMessage, {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            });
        });

        // Обработка callback кнопок
        this.bot.on('callback_query', (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = message.chat.id;

            switch (data) {
                case 'stats':
                    this.sendStats(chatId);
                    break;
                case 'help':
                    this.sendHelp(chatId);
                    break;
                case 'play_game':
                    this.sendPlayMessage(chatId);
                    break;
            }

            // Убираем "часики" с кнопки
            this.bot.answerCallbackQuery(callbackQuery.id);
        });

        // Обработка данных из Web App
        this.bot.on('web_app_data', (msg) => {
            const chatId = msg.chat.id;
            const data = JSON.parse(msg.web_app_data.data);
            
            console.log('Получены данные из Web App:', data);
            
            if (data.action === 'click') {
                const responseMessage = `🌟 Отлично! Ты заработал ${data.stars} звезд!
🎯 Всего кликов: ${data.totalClicks}

Продолжай играть и зарабатывай еще больше! 🚀`;

                this.bot.sendMessage(chatId, responseMessage);
            }
        });

        // Команда /help
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            this.sendHelp(chatId);
        });

        // Обработка ошибок
        this.bot.on('error', (error) => {
            console.error('❌ Ошибка бота:', error);
        });

        this.bot.on('polling_error', (error) => {
            console.error('❌ Ошибка polling:', error);
        });
    }

    sendStats(chatId) {
        const statsMessage = `📊 **Статистика StarFlow**

🎮 **Игровая статистика:**
⭐ Звезды зарабатываются кликами
🏆 Достижения открываются автоматически
🎵 Звуковые эффекты делают игру веселее

🚀 **Как играть:**
1. Нажми кнопку "Играть"
2. Кликай по звезде ⭐
3. Зарабатывай очки и открывай достижения!

💡 **Совет:** Включи звук для лучшего опыта!`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '🎮 Играть сейчас',
                        web_app: { url: this.webAppUrl }
                    }
                ]
            ]
        };

        this.bot.sendMessage(chatId, statsMessage, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }

    sendHelp(chatId) {
        const helpMessage = `❓ **Помощь по StarFlow**

🎮 **Основные команды:**
/start - Начать игру
/play - Открыть игру
/help - Эта справка

🌟 **Как играть:**
1. Нажми кнопку "Играть в StarFlow"
2. Кликай по большой звезде ⭐
3. Зарабатывай очки за каждый клик
4. Открывай достижения:
   • 🌟 Первая звезда (1 клик)
   • 💫 Звездопад (100 звезд)
   • 🚀 Космический клик (1000 кликов)

🎵 **Звуковые эффекты:**
• Включи звук кнопкой 🔊
• Каждый клик издает звук
• Достижения сопровождаются мелодией
• Каждые 50 звезд - особый звук!

💾 **Прогресс сохраняется автоматически!**

🚀 Готов играть? Нажми кнопку ниже!`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '🌟 Начать игру',
                        web_app: { url: this.webAppUrl }
                    }
                ]
            ]
        };

        this.bot.sendMessage(chatId, helpMessage, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }

    sendPlayMessage(chatId) {
        const playMessage = `🎮 **Запуск игры StarFlow!**

🌟 Добро пожаловать в мир звездных кликов!

🎯 **Твоя цель:**
• Кликай по звезде и зарабатывай очки
• Открывай новые достижения
• Бей рекорды по количеству кликов!

🎵 Не забудь включить звук для полного погружения!

🚀 Нажми кнопку ниже, чтобы начать:`;

        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: '⭐ Играть в StarFlow',
                        web_app: { url: this.webAppUrl }
                    }
                ]
            ]
        };

        this.bot.sendMessage(chatId, playMessage, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    }

    stop() {
        if (this.bot && this.isRunning) {
            this.bot.stopPolling();
            this.isRunning = false;
            console.log('🤖 Бот остановлен');
        }
    }
}

module.exports = StarFlowBot; 