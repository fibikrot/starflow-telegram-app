const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.botUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.verificationRequests = new Map(); // In production, use Redis
    this.init();
  }

  async init() {
    if (this.botToken) {
      try {
        // Set webhook if TELEGRAM_WEBHOOK_URL is provided
        if (process.env.TELEGRAM_WEBHOOK_URL) {
          await this.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
        }
        
        // Set bot commands
        await this.setBotCommands();
        
        console.log('Telegram service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Telegram service:', error);
      }
    } else {
      console.warn('Telegram bot token not provided, service will not be available');
    }
  }

  async setWebhook(url) {
    try {
      const response = await axios.post(`${this.botUrl}/setWebhook`, {
        url: `${url}/api/telegram/webhook`,
        allowed_updates: ['message', 'callback_query']
      });
      
      if (response.data.ok) {
        console.log('Telegram webhook set successfully');
      } else {
        console.error('Failed to set Telegram webhook:', response.data);
      }
    } catch (error) {
      console.error('Error setting Telegram webhook:', error);
    }
  }

  async setBotCommands() {
    const commands = [
      { command: 'start', description: 'Начать работу с ботом' },
      { command: 'link', description: 'Привязать аккаунт к StarFlow' },
      { command: 'balance', description: 'Проверить баланс звезд' },
      { command: 'stats', description: 'Посмотреть статистику' },
      { command: 'referral', description: 'Реферальная программа' },
      { command: 'help', description: 'Помощь и поддержка' }
    ];

    try {
      await axios.post(`${this.botUrl}/setMyCommands`, {
        commands
      });
      console.log('Bot commands set successfully');
    } catch (error) {
      console.error('Error setting bot commands:', error);
    }
  }

  async sendMessage(chatId, text, options = {}) {
    if (!this.botToken) {
      console.warn('Telegram bot token not available');
      return false;
    }

    try {
      const response = await axios.post(`${this.botUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      return response.data.ok;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return false;
    }
  }

  async handleUpdate(update) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;
    const user = message.from;

    if (!text) return;

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, user);
    } else {
      // Handle verification codes
      await this.handleVerificationCode(chatId, text, user);
    }
  }

  async handleCommand(chatId, command, user) {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        await this.handleStartCommand(chatId, user);
        break;
      case '/link':
        await this.handleLinkCommand(chatId, user);
        break;
      case '/balance':
        await this.handleBalanceCommand(chatId, user);
        break;
      case '/stats':
        await this.handleStatsCommand(chatId, user);
        break;
      case '/referral':
        await this.handleReferralCommand(chatId, user);
        break;
      case '/help':
        await this.handleHelpCommand(chatId, user);
        break;
      default:
        await this.sendMessage(chatId, 
          '❓ Неизвестная команда. Используйте /help для просмотра доступных команд.'
        );
    }
  }

  async handleStartCommand(chatId, user) {
    const existingUser = await User.findOne({ telegramId: chatId });
    
    if (existingUser) {
      await this.sendMessage(chatId,
        `👋 Добро пожаловать обратно, ${user.first_name}!\n\n` +
        `🌟 Ваш баланс: ${existingUser.starsBalance} звезд\n` +
        `📊 Уровень: ${existingUser.level}\n\n` +
        `Используйте /help для просмотра доступных команд.`
      );
    } else {
      await this.sendMessage(chatId,
        `🚀 Добро пожаловать в StarFlow!\n\n` +
        `Это Telegram бот для платформы StarFlow - инновационной Web3 экосистемы с внутренней валютой "звезды".\n\n` +
        `🔗 Чтобы привязать ваш аккаунт:\n` +
        `1. Зарегистрируйтесь на платформе StarFlow\n` +
        `2. В настройках профиля выберите "Привязать Telegram"\n` +
        `3. Введите полученный код в этом чате\n\n` +
        `💡 После привязки вы получите:\n` +
        `• Уведомления о поступлении звезд\n` +
        `• Напоминания о ежедневных бонусах\n` +
        `• Статистику и достижения\n` +
        `• Быстрый доступ к функциям платформы\n\n` +
        `Используйте /help для получения помощи.`
      );
    }
  }

  async handleLinkCommand(chatId, user) {
    const existingUser = await User.findOne({ telegramId: chatId });
    
    if (existingUser) {
      await this.sendMessage(chatId,
        `✅ Ваш аккаунт уже привязан к StarFlow!\n\n` +
        `👤 Пользователь: ${existingUser.username}\n` +
        `🌟 Баланс: ${existingUser.starsBalance} звезд\n` +
        `📊 Уровень: ${existingUser.level}`
      );
    } else {
      await this.sendMessage(chatId,
        `🔗 Для привязки аккаунта:\n\n` +
        `1. Войдите в свой аккаунт на StarFlow\n` +
        `2. Перейдите в настройки профиля\n` +
        `3. Нажмите "Привязать Telegram"\n` +
        `4. Скопируйте и отправьте сюда код подтверждения\n\n` +
        `❓ Нет аккаунта? Зарегистрируйтесь на нашем сайте!`
      );
    }
  }

  async handleBalanceCommand(chatId, user) {
    const existingUser = await User.findOne({ telegramId: chatId });
    
    if (!existingUser) {
      await this.sendMessage(chatId,
        `❌ Аккаунт не привязан.\n\n` +
        `Используйте /link для привязки аккаунта к StarFlow.`
      );
      return;
    }

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      user: existingUser._id
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    let transactionText = '';
    if (recentTransactions.length > 0) {
      transactionText = '\n\n📝 Последние операции:\n';
      recentTransactions.forEach(tx => {
        const date = tx.createdAt.toLocaleDateString('ru-RU');
        const amount = tx.amount > 0 ? `+${tx.amount}` : tx.amount;
        transactionText += `• ${date}: ${amount} ⭐\n`;
      });
    }

    await this.sendMessage(chatId,
      `💰 Ваш баланс\n\n` +
      `🌟 Текущий баланс: ${existingUser.starsBalance} звезд\n` +
      `📈 Всего заработано: ${existingUser.totalStarsEarned} звезд\n` +
      `📉 Всего потрачено: ${existingUser.totalStarsSpent} звезд\n` +
      `📊 Уровень: ${existingUser.level}\n` +
      `🎯 Опыт: ${existingUser.experience}/${existingUser.nextLevelExp}` +
      transactionText
    );
  }

  async handleStatsCommand(chatId, user) {
    const existingUser = await User.findOne({ telegramId: chatId });
    
    if (!existingUser) {
      await this.sendMessage(chatId,
        `❌ Аккаунт не привязан.\n\n` +
        `Используйте /link для привязки аккаунта к StarFlow.`
      );
      return;
    }

    // Calculate stats
    const totalReferrals = existingUser.referrals ? existingUser.referrals.length : 0;
    const gameStats = existingUser.gameStats || {};
    const registrationDate = existingUser.createdAt.toLocaleDateString('ru-RU');
    const daysSinceRegistration = Math.floor((Date.now() - existingUser.createdAt) / (1000 * 60 * 60 * 24));

    await this.sendMessage(chatId,
      `📊 Ваша статистика\n\n` +
      `👤 Пользователь: ${existingUser.username}\n` +
      `📅 Регистрация: ${registrationDate} (${daysSinceRegistration} дней назад)\n` +
      `📊 Уровень: ${existingUser.level}\n` +
      `🎯 Опыт: ${existingUser.experience}\n\n` +
      `💰 Финансы:\n` +
      `• Баланс: ${existingUser.starsBalance} ⭐\n` +
      `• Заработано: ${existingUser.totalStarsEarned} ⭐\n` +
      `• Потрачено: ${existingUser.totalStarsSpent} ⭐\n\n` +
      `🎮 Игры:\n` +
      `• Лучший счет в кликере: ${gameStats.bestClickerScore || 0}\n` +
      `• Игр сыграно: ${gameStats.gamesPlayed || 0}\n` +
      `• Звезд заработано в играх: ${gameStats.totalStarsEarned || 0}\n\n` +
      `👥 Рефералы: ${totalReferrals}\n` +
      `🔥 Серия ежедневных бонусов: ${existingUser.dailyStreak || 0}`
    );
  }

  async handleReferralCommand(chatId, user) {
    const existingUser = await User.findOne({ telegramId: chatId });
    
    if (!existingUser) {
      await this.sendMessage(chatId,
        `❌ Аккаунт не привязан.\n\n` +
        `Используйте /link для привязки аккаунта к StarFlow.`
      );
      return;
    }

    const totalReferrals = existingUser.referrals ? existingUser.referrals.length : 0;
    const referralEarnings = existingUser.referralEarnings || 0;
    const referralCode = existingUser.referralCode;

    await this.sendMessage(chatId,
      `👥 Реферальная программа\n\n` +
      `🔗 Ваш реферальный код: <code>${referralCode}</code>\n` +
      `📊 Приглашено друзей: ${totalReferrals}\n` +
      `💰 Заработано с рефералов: ${referralEarnings} ⭐\n\n` +
      `🎁 Бонусы:\n` +
      `• За каждого друга: 100 ⭐\n` +
      `• Друг получает: 50 ⭐\n` +
      `• % с заработка друзей: 5%\n\n` +
      `📢 Поделитесь кодом с друзьями и зарабатывайте больше звезд!`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📤 Поделиться кодом',
              switch_inline_query: `Присоединяйся к StarFlow и получи 50 звезд! Используй мой код: ${referralCode}`
            }
          ]]
        }
      }
    );
  }

  async handleHelpCommand(chatId, user) {
    await this.sendMessage(chatId,
      `🆘 Справка по командам\n\n` +
      `🤖 Доступные команды:\n` +
      `/start - Начать работу с ботом\n` +
      `/link - Привязать аккаунт к StarFlow\n` +
      `/balance - Проверить баланс звезд\n` +
      `/stats - Посмотреть статистику\n` +
      `/referral - Реферальная программа\n` +
      `/help - Эта справка\n\n` +
      `💡 Возможности бота:\n` +
      `• Уведомления о поступлении звезд\n` +
      `• Напоминания о ежедневных бонусах\n` +
      `• Статистика и достижения\n` +
      `• Информация о рефералах\n` +
      `• Быстрый доступ к балансу\n\n` +
      `❓ Нужна помощь? Обратитесь в поддержку через веб-приложение.`
    );
  }

  async handleVerificationCode(chatId, code, user) {
    // Check if code is a verification code
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return; // Not a verification code format
    }

    const verification = this.verificationRequests.get(code);
    
    if (!verification) {
      await this.sendMessage(chatId,
        `❌ Неверный или истекший код подтверждения.\n\n` +
        `Получите новый код в настройках профиля на StarFlow.`
      );
      return;
    }

    // Check if code is expired (10 minutes)
    if (Date.now() - verification.createdAt > 10 * 60 * 1000) {
      this.verificationRequests.delete(code);
      await this.sendMessage(chatId,
        `⏰ Код подтверждения истек.\n\n` +
        `Получите новый код в настройках профиля на StarFlow.`
      );
      return;
    }

    // Update verification with Telegram user info
    verification.telegramId = chatId;
    verification.username = user.username;
    verification.firstName = user.first_name;
    verification.lastName = user.last_name;
    verification.verified = true;

    await this.sendMessage(chatId,
      `✅ Код подтверждения принят!\n\n` +
      `Теперь завершите привязку аккаунта в веб-приложении StarFlow.\n\n` +
      `После завершения привязки вы получите бонус и начнете получать уведомления.`
    );
  }

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Handle different callback queries
    // This can be extended for inline keyboards
    
    // Answer callback query to remove loading state
    await axios.post(`${this.botUrl}/answerCallbackQuery`, {
      callback_query_id: callbackQuery.id
    });
  }

  generateVerificationCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  async createVerificationRequest(userId, code) {
    this.verificationRequests.set(code, {
      userId,
      code,
      createdAt: Date.now(),
      verified: false
    });

    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      this.verificationRequests.delete(code);
    }, 10 * 60 * 1000);
  }

  async getPendingVerification(code) {
    const verification = this.verificationRequests.get(code);
    return verification && verification.verified ? verification : null;
  }

  async removeVerification(code) {
    this.verificationRequests.delete(code);
  }

  async getBotInfo() {
    if (!this.botToken) return null;

    try {
      const response = await axios.get(`${this.botUrl}/getMe`);
      return response.data.result;
    } catch (error) {
      console.error('Error getting bot info:', error);
      return null;
    }
  }

  // Notification methods
  async sendStarsReceivedNotification(telegramId, amount, source) {
    const sourceEmojis = {
      game: '🎮',
      referral: '👥',
      daily: '📅',
      transfer: '💸',
      admin: '🎁'
    };

    const emoji = sourceEmojis[source] || '⭐';
    
    await this.sendMessage(telegramId,
      `${emoji} Вы получили звезды!\n\n` +
      `💰 Сумма: +${amount} ⭐\n` +
      `📝 Источник: ${this.getSourceName(source)}\n\n` +
      `Используйте /balance для просмотра текущего баланса.`
    );
  }

  async sendTransferNotification(telegramId, amount, from, message = '') {
    await this.sendMessage(telegramId,
      `💸 Перевод получен!\n\n` +
      `💰 Сумма: +${amount} ⭐\n` +
      `👤 От: ${from}\n` +
      (message ? `💬 Сообщение: ${message}\n` : '') +
      `\nИспользуйте /balance для просмотра баланса.`
    );
  }

  async sendExchangeNotification(telegramId, starsAmount, cryptoAmount, currency, status) {
    const statusEmojis = {
      completed: '✅',
      failed: '❌',
      pending: '⏳'
    };

    const emoji = statusEmojis[status] || '📊';
    
    await this.sendMessage(telegramId,
      `${emoji} Обмен ${status === 'completed' ? 'завершен' : status === 'failed' ? 'не удался' : 'в обработке'}\n\n` +
      `⭐ Звезды: ${starsAmount}\n` +
      `💎 Получено: ${cryptoAmount} ${currency}\n\n` +
      (status === 'completed' ? 'Средства отправлены на ваш кошелек!' : 
       status === 'failed' ? 'Звезды возвращены на ваш баланс.' : 
       'Ожидайте завершения транзакции.')
    );
  }

  async sendDailyReminderNotification(telegramId, username) {
    await this.sendMessage(telegramId,
      `🌅 Доброе утро, ${username}!\n\n` +
      `⭐ Не забудьте забрать ежедневный бонус в StarFlow!\n` +
      `🔥 Поддерживайте серию для получения больших бонусов.\n\n` +
      `🎮 Также можете поиграть в мини-игры и заработать дополнительные звезды!`
    );
  }

  getSourceName(source) {
    const sourceNames = {
      game: 'Игры',
      referral: 'Реферальная программа',
      daily: 'Ежедневный бонус',
      transfer: 'Перевод от пользователя',
      admin: 'Административный бонус',
      task: 'Выполнение задания'
    };

    return sourceNames[source] || 'Неизвестно';
  }
}

module.exports = new TelegramService(); 