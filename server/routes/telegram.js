const express = require('express');
const crypto = require('crypto');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TelegramService = require('../services/telegramService');

const router = express.Router();

// @route   POST /api/telegram/webhook
// @desc    Handle Telegram bot webhook updates
// @access  Public (but verified with bot token)
router.post('/webhook', asyncHandler(async (req, res) => {
  const update = req.body;

  // Verify webhook authenticity if secret token is set
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      throw new CustomError('Unauthorized webhook request', 401, 'INVALID_WEBHOOK_SECRET');
    }
  }

  // Process the update
  try {
    await TelegramService.handleUpdate(update);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error processing Telegram update:', error);
    res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
}));

// @route   POST /api/telegram/send-verification
// @desc    Generate and send verification code for Telegram linking
// @access  Private
router.post('/send-verification', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  if (user.telegramId) {
    throw new CustomError('Telegram уже привязан к аккаунту', 400, 'TELEGRAM_ALREADY_LINKED');
  }

  // Generate verification code
  const verificationCode = TelegramService.generateVerificationCode();
  
  // Store verification request
  await TelegramService.createVerificationRequest(userId, verificationCode);

  res.json({
    message: 'Код подтверждения сгенерирован',
    verificationCode,
    instructions: [
      'Откройте Telegram бот @StarFlowBot',
      'Отправьте команду /start если еще не сделали этого',
      'Отправьте код подтверждения в чат с ботом',
      'Вернитесь сюда и нажмите "Проверить привязку"'
    ]
  });
}));

// @route   POST /api/telegram/verify-link
// @desc    Complete Telegram account linking
// @access  Private
router.post('/verify-link', authMiddleware, asyncHandler(async (req, res) => {
  const { verificationCode } = req.body;
  const userId = req.userId;

  if (!verificationCode) {
    throw new CustomError('Код подтверждения обязателен', 400, 'MISSING_VERIFICATION_CODE');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  if (user.telegramId) {
    throw new CustomError('Telegram уже привязан к аккаунту', 400, 'TELEGRAM_ALREADY_LINKED');
  }

  // Check verification
  const verification = await TelegramService.getPendingVerification(verificationCode);
  
  if (!verification) {
    throw new CustomError('Неверный или истекший код подтверждения', 400, 'INVALID_VERIFICATION_CODE');
  }

  // Update user with Telegram info
  user.telegramId = verification.telegramId;
  user.telegramUsername = verification.username;
  user.telegramFirstName = verification.firstName;
  user.telegramLastName = verification.lastName;
  user.telegramLinkedAt = new Date();

  // Award linking bonus
  const linkingBonus = 100;
  user.starsBalance += linkingBonus;
  user.totalStarsEarned += linkingBonus;

  await user.save();

  // Create transaction for bonus
  const Transaction = require('../models/Transaction');
  await Transaction.createTransaction({
    userId: user._id,
    type: 'earn_telegram_link',
    amount: linkingBonus,
    description: 'Бонус за привязку Telegram аккаунта',
    metadata: {
      telegramId: verification.telegramId,
      telegramUsername: verification.username
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Clean up verification
  await TelegramService.removeVerification(verificationCode);

  // Send welcome message
  await TelegramService.sendMessage(
    verification.telegramId,
    `🎉 Аккаунт успешно привязан!\n\n` +
    `✅ Ваш StarFlow аккаунт теперь связан с Telegram\n` +
    `🎁 Вы получили ${linkingBonus} звезд за привязку!\n\n` +
    `Теперь вы будете получать уведомления о:\n` +
    `• Поступлении звезд\n` +
    `• Ежедневных бонусах\n` +
    `• Переводах и обменах\n` +
    `• Достижениях и наградах\n\n` +
    `Используйте /help для просмотра всех команд.`
  );

  res.json({
    message: 'Telegram успешно привязан',
    bonus: linkingBonus,
    telegramInfo: {
      username: verification.username,
      firstName: verification.firstName,
      lastName: verification.lastName
    }
  });
}));

// @route   POST /api/telegram/unlink
// @desc    Unlink Telegram account
// @access  Private
router.post('/unlink', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  if (!user.telegramId) {
    throw new CustomError('Telegram не привязан к аккаунту', 400, 'TELEGRAM_NOT_LINKED');
  }

  const telegramId = user.telegramId;

  // Clear Telegram info
  user.telegramId = null;
  user.telegramUsername = null;
  user.telegramFirstName = null;
  user.telegramLastName = null;
  user.telegramLinkedAt = null;

  await user.save();

  // Send goodbye message
  await TelegramService.sendMessage(
    telegramId,
    `👋 Аккаунт отвязан от StarFlow\n\n` +
    `Ваш Telegram больше не связан с аккаунтом StarFlow.\n` +
    `Вы не будете получать уведомления.\n\n` +
    `Чтобы снова привязать аккаунт, используйте функцию привязки в веб-приложении.`
  );

  res.json({
    message: 'Telegram успешно отвязан'
  });
}));

// @route   GET /api/telegram/status
// @desc    Get Telegram linking status
// @access  Private
router.get('/status', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await User.findById(userId).select('telegramId telegramUsername telegramFirstName telegramLastName telegramLinkedAt');

  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  const isLinked = !!user.telegramId;

  res.json({
    isLinked,
    telegramInfo: isLinked ? {
      username: user.telegramUsername,
      firstName: user.telegramFirstName,
      lastName: user.telegramLastName,
      linkedAt: user.telegramLinkedAt
    } : null
  });
}));

// @route   POST /api/telegram/test-notification
// @desc    Send test notification to user's Telegram
// @access  Private
router.post('/test-notification', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  if (!user.telegramId) {
    throw new CustomError('Telegram не привязан к аккаунту', 400, 'TELEGRAM_NOT_LINKED');
  }

  const testMessage = 
    `🧪 Тестовое уведомление\n\n` +
    `Это тестовое сообщение для проверки уведомлений StarFlow.\n\n` +
    `✅ Уведомления работают корректно!\n` +
    `📱 Вы будете получать уведомления о всех важных событиях.`;

  const sent = await TelegramService.sendMessage(user.telegramId, testMessage);

  if (sent) {
    res.json({
      message: 'Тестовое уведомление отправлено',
      success: true
    });
  } else {
    throw new CustomError('Не удалось отправить уведомление', 500, 'NOTIFICATION_FAILED');
  }
}));

// @route   GET /api/telegram/bot-info
// @desc    Get Telegram bot information
// @access  Public
router.get('/bot-info', asyncHandler(async (req, res) => {
  const botInfo = await TelegramService.getBotInfo();
  
  if (!botInfo) {
    throw new CustomError('Telegram бот недоступен', 503, 'BOT_UNAVAILABLE');
  }

  res.json({
    botInfo: {
      username: botInfo.username,
      firstName: botInfo.first_name,
      canJoinGroups: botInfo.can_join_groups,
      canReadAllGroupMessages: botInfo.can_read_all_group_messages,
      supportsInlineQueries: botInfo.supports_inline_queries
    },
    botUrl: `https://t.me/${botInfo.username}`
  });
}));

// @route   POST /api/telegram/set-webhook
// @desc    Set or update Telegram webhook (Admin only)
// @access  Private (Admin)
router.post('/set-webhook', authMiddleware, asyncHandler(async (req, res) => {
  const { webhookUrl, secretToken } = req.body;

  // Check if user is admin
  const user = await User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    throw new CustomError('Доступ запрещен', 403, 'ACCESS_DENIED');
  }

  if (!webhookUrl) {
    throw new CustomError('URL webhook обязателен', 400, 'MISSING_WEBHOOK_URL');
  }

  try {
    await TelegramService.setWebhook(webhookUrl, secretToken);
    
    res.json({
      message: 'Webhook установлен успешно',
      webhookUrl
    });
  } catch (error) {
    console.error('Error setting webhook:', error);
    throw new CustomError('Не удалось установить webhook', 500, 'WEBHOOK_SETUP_FAILED');
  }
}));

// @route   DELETE /api/telegram/webhook
// @desc    Remove Telegram webhook (Admin only)
// @access  Private (Admin)
router.delete('/webhook', authMiddleware, asyncHandler(async (req, res) => {
  // Check if user is admin
  const user = await User.findById(req.userId);
  if (!user || user.role !== 'admin') {
    throw new CustomError('Доступ запрещен', 403, 'ACCESS_DENIED');
  }

  try {
    const axios = require('axios');
    const botUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    
    await axios.post(`${botUrl}/deleteWebhook`);
    
    res.json({
      message: 'Webhook удален успешно'
    });
  } catch (error) {
    console.error('Error removing webhook:', error);
    throw new CustomError('Не удалось удалить webhook', 500, 'WEBHOOK_REMOVAL_FAILED');
  }
}));

// @route   POST /api/telegram/send-notification
// @desc    Send custom notification to user's Telegram
// @access  Private
router.post('/send-notification', asyncHandler(async (req, res) => {
  const { message, type = 'info' } = req.body;
  
  if (!message) {
    throw new CustomError('Сообщение обязательно', 400, 'MISSING_MESSAGE');
  }
  
  const user = await User.findById(req.userId).select('telegramId');
  
  if (!user.telegramId) {
    throw new CustomError('Telegram аккаунт не привязан', 400, 'TELEGRAM_NOT_LINKED');
  }
  
  // Add emoji based on type
  const typeEmojis = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    star: '⭐'
  };
  
  const emoji = typeEmojis[type] || typeEmojis.info;
  const formattedMessage = `${emoji} ${message}`;
  
  const sent = await TelegramService.sendMessage(user.telegramId, formattedMessage);
  
  res.json({
    message: 'Уведомление отправлено',
    sent
  });
}));

// @route   GET /api/telegram/notifications/settings
// @desc    Get user's notification settings
// @access  Private
router.get('/notifications/settings', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('notificationSettings');
  
  const defaultSettings = {
    starsReceived: true,
    transfersReceived: true,
    exchangeCompleted: true,
    dailyReminder: true,
    achievements: true,
    promotions: true
  };
  
  res.json({
    settings: user.notificationSettings || defaultSettings
  });
}));

// @route   PUT /api/telegram/notifications/settings
// @desc    Update user's notification settings
// @access  Private
router.put('/notifications/settings', asyncHandler(async (req, res) => {
  const { settings } = req.body;
  
  if (!settings || typeof settings !== 'object') {
    throw new CustomError('Настройки уведомлений обязательны', 400, 'MISSING_SETTINGS');
  }
  
  const user = await User.findById(req.userId);
  user.notificationSettings = {
    ...user.notificationSettings,
    ...settings
  };
  await user.save();
  
  res.json({
    message: 'Настройки уведомлений обновлены',
    settings: user.notificationSettings
  });
}));

// @route   POST /api/telegram/broadcast
// @desc    Send broadcast message to all linked users (Admin only)
// @access  Private (Admin)
router.post('/broadcast', asyncHandler(async (req, res) => {
  const { message, targetGroup = 'all' } = req.body;
  
  if (!message) {
    throw new CustomError('Сообщение обязательно', 400, 'MISSING_MESSAGE');
  }
  
  // Check if user is admin (you might want to add admin middleware)
  const user = await User.findById(req.userId);
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw new CustomError('Доступ запрещен', 403, 'ACCESS_DENIED');
  }
  
  // Get target users
  let query = { telegramId: { $exists: true, $ne: null } };
  
  switch (targetGroup) {
    case 'active':
      query.isActive = true;
      query.lastLogin = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }; // Active in last 7 days
      break;
    case 'vip':
      query.level = { $gte: 10 };
      break;
    case 'new':
      query.createdAt = { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }; // Registered in last 3 days
      break;
    default:
      // 'all' - no additional filters
      break;
  }
  
  const users = await User.find(query).select('telegramId telegramUsername');
  
  let sentCount = 0;
  let failedCount = 0;
  
  // Send messages in batches to avoid rate limiting
  const batchSize = 30; // Telegram allows 30 messages per second
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const promises = batch.map(async (user) => {
      try {
        await TelegramService.sendMessage(user.telegramId, `📢 ${message}`);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send message to ${user.telegramId}:`, error);
        failedCount++;
      }
    });
    
    await Promise.all(promises);
    
    // Wait 1 second between batches
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  res.json({
    message: 'Рассылка завершена',
    targetGroup,
    totalUsers: users.length,
    sentCount,
    failedCount
  });
}));

module.exports = router; 