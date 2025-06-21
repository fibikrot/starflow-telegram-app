const express = require('express');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// @route   GET /api/stars/balance
// @desc    Get user's stars balance
// @access  Private
router.get('/balance', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('starsBalance totalStarsEarned totalStarsSpent level experience');
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }
  
  res.json({
    balance: user.starsBalance,
    totalEarned: user.totalStarsEarned,
    totalSpent: user.totalStarsSpent,
    level: user.level,
    experience: user.experience,
    nextLevelExp: user.nextLevelExp
  });
}));

// @route   GET /api/stars/history
// @desc    Get user's transaction history
// @access  Private
router.get('/history', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    type = null, 
    startDate = null, 
    endDate = null 
  } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const options = {
    limit: parseInt(limit),
    skip,
    type,
    startDate,
    endDate
  };
  
  const transactions = await Transaction.getUserHistory(req.userId, options);
  
  // Get total count for pagination
  const query = { user: req.userId };
  if (type) query.type = type;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const totalCount = await Transaction.countDocuments(query);
  const totalPages = Math.ceil(totalCount / parseInt(limit));
  
  res.json({
    transactions,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalCount,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    },
    filters: {
      type,
      startDate,
      endDate
    }
  });
}));

// @route   POST /api/stars/transfer
// @desc    Transfer stars to another user
// @access  Private
router.post('/transfer', asyncHandler(async (req, res) => {
  const { recipientUsername, amount, message = '' } = req.body;
  
  if (!recipientUsername || !amount) {
    throw new CustomError('Получатель и сумма обязательны', 400, 'MISSING_TRANSFER_DATA');
  }
  
  if (amount <= 0) {
    throw new CustomError('Сумма должна быть положительной', 400, 'INVALID_AMOUNT');
  }
  
  if (amount < 10) {
    throw new CustomError('Минимальная сумма перевода: 10 звезд', 400, 'AMOUNT_TOO_SMALL');
  }
  
  // Find sender and recipient
  const sender = await User.findById(req.userId);
  const recipient = await User.findOne({ 
    username: recipientUsername.toLowerCase() 
  });
  
  if (!recipient) {
    throw new CustomError('Получатель не найден', 404, 'RECIPIENT_NOT_FOUND');
  }
  
  if (sender._id.toString() === recipient._id.toString()) {
    throw new CustomError('Нельзя переводить звезды самому себе', 400, 'SELF_TRANSFER');
  }
  
  if (!recipient.isActive) {
    throw new CustomError('Аккаунт получателя деактивирован', 400, 'RECIPIENT_INACTIVE');
  }
  
  // Check sender's balance
  if (sender.starsBalance < amount) {
    throw new CustomError('Недостаточно звезд для перевода', 400, 'INSUFFICIENT_BALANCE');
  }
  
  // Calculate fee (2% minimum 1 star)
  const fee = Math.max(1, Math.floor(amount * 0.02));
  const totalDeduction = amount + fee;
  
  if (sender.starsBalance < totalDeduction) {
    throw new CustomError(`Недостаточно звезд для перевода с комиссией (${fee} звезд)`, 400, 'INSUFFICIENT_BALANCE_WITH_FEE');
  }
  
  // Create transactions
  const transferDescription = `Перевод ${amount} звезд пользователю ${recipient.username}`;
  const receiveDescription = `Получен перевод ${amount} звезд от ${sender.username}`;
  const feeDescription = `Комиссия за перевод ${amount} звезд`;
  
  // Deduct from sender
  await Transaction.createTransaction({
    userId: sender._id,
    type: 'spend_transfer',
    amount: -amount,
    description: transferDescription + (message ? ` (${message})` : ''),
    metadata: {
      recipientId: recipient._id,
      recipientUsername: recipient.username,
      transferMessage: message
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Deduct fee from sender
  await Transaction.createTransaction({
    userId: sender._id,
    type: 'spend_admin',
    amount: -fee,
    description: feeDescription,
    metadata: {
      adminReason: 'transfer_fee',
      originalTransferAmount: amount,
      recipientId: recipient._id
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Add to recipient
  await Transaction.createTransaction({
    userId: recipient._id,
    type: 'earn_admin',
    amount: amount,
    description: receiveDescription + (message ? ` (${message})` : ''),
    metadata: {
      senderId: sender._id,
      senderUsername: sender.username,
      transferMessage: message,
      adminReason: 'transfer_receive'
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Send real-time notification if recipient is online
  const io = req.app.get('io');
  if (io) {
    io.to(`user-${recipient._id}`).emit('stars-received', {
      amount,
      from: sender.username,
      message,
      newBalance: recipient.starsBalance
    });
  }
  
  res.json({
    message: 'Перевод выполнен успешно',
    transferred: amount,
    fee,
    recipient: recipient.username,
    newBalance: sender.starsBalance
  });
}));

// @route   GET /api/stars/stats
// @desc    Get detailed stars statistics
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Get transaction stats
  const transactionStats = await Transaction.getUserStats(req.userId, period);
  
  // Get daily earnings for chart
  const startDate = new Date();
  let days = 30;
  
  switch (period) {
    case '7d':
      days = 7;
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      days = 90;
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
  }
  
  const dailyStats = await Transaction.aggregate([
    {
      $match: {
        user: req.userId,
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        earned: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
          }
        },
        spent: {
          $sum: {
            $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0]
          }
        },
        transactions: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);
  
  // Format daily stats for frontend
  const chartData = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const dayStats = dailyStats.find(stat => 
      stat._id.year === date.getFullYear() &&
      stat._id.month === date.getMonth() + 1 &&
      stat._id.day === date.getDate()
    );
    
    chartData.push({
      date: date.toISOString().split('T')[0],
      earned: dayStats ? dayStats.earned : 0,
      spent: dayStats ? dayStats.spent : 0,
      transactions: dayStats ? dayStats.transactions : 0
    });
  }
  
  // Get top earning sources
  const topSources = await Transaction.aggregate([
    {
      $match: {
        user: req.userId,
        amount: { $gt: 0 },
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        totalEarned: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalEarned: -1 }
    },
    {
      $limit: 5
    }
  ]);
  
  // Map transaction types to friendly names
  const typeNames = {
    earn_game: 'Игры',
    earn_referral: 'Рефералы',
    earn_daily: 'Ежедневные бонусы',
    earn_task: 'Задания',
    earn_admin: 'Бонусы'
  };
  
  const formattedTopSources = topSources.map(source => ({
    type: source._id,
    name: typeNames[source._id] || source._id,
    totalEarned: source.totalEarned,
    count: source.count
  }));
  
  res.json({
    summary: transactionStats[0] || {
      totalEarned: 0,
      totalSpent: 0,
      transactionCount: 0,
      gameEarnings: 0,
      referralEarnings: 0,
      dailyBonusEarnings: 0
    },
    chartData,
    topSources: formattedTopSources,
    period
  });
}));

// @route   GET /api/stars/leaderboard/earnings
// @desc    Get earnings leaderboard
// @access  Private
router.get('/leaderboard/earnings', asyncHandler(async (req, res) => {
  const { period = '30d', limit = 100 } = req.query;
  
  const startDate = new Date();
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'all':
      startDate.setFullYear(2000); // Far in the past
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }
  
  const leaderboard = await Transaction.aggregate([
    {
      $match: {
        amount: { $gt: 0 },
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$user',
        totalEarned: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $match: {
        'user.isActive': true
      }
    },
    {
      $project: {
        username: '$user.username',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        avatar: '$user.avatar',
        level: '$user.level',
        totalEarned: 1,
        transactionCount: 1
      }
    },
    {
      $sort: { totalEarned: -1 }
    },
    {
      $limit: parseInt(limit)
    }
  ]);
  
  // Find current user's position
  let userPosition = null;
  const currentUser = leaderboard.find(user => 
    user._id.toString() === req.userId.toString()
  );
  
  if (currentUser) {
    userPosition = leaderboard.indexOf(currentUser) + 1;
  }
  
  res.json({
    leaderboard,
    userPosition,
    period,
    total: leaderboard.length
  });
}));

// @route   POST /api/stars/gift
// @desc    Send a gift (special transfer with animation)
// @access  Private
router.post('/gift', asyncHandler(async (req, res) => {
  const { recipientUsername, giftType, message = '' } = req.body;
  
  if (!recipientUsername || !giftType) {
    throw new CustomError('Получатель и тип подарка обязательны', 400, 'MISSING_GIFT_DATA');
  }
  
  // Define gift types and their costs
  const giftTypes = {
    star: { cost: 10, name: '⭐ Звезда', animation: 'star' },
    heart: { cost: 25, name: '❤️ Сердце', animation: 'heart' },
    diamond: { cost: 50, name: '💎 Алмаз', animation: 'diamond' },
    crown: { cost: 100, name: '👑 Корона', animation: 'crown' },
    rocket: { cost: 200, name: '🚀 Ракета', animation: 'rocket' }
  };
  
  const gift = giftTypes[giftType];
  if (!gift) {
    throw new CustomError('Неверный тип подарка', 400, 'INVALID_GIFT_TYPE');
  }
  
  // Find sender and recipient
  const sender = await User.findById(req.userId);
  const recipient = await User.findOne({ 
    username: recipientUsername.toLowerCase() 
  });
  
  if (!recipient) {
    throw new CustomError('Получатель не найден', 404, 'RECIPIENT_NOT_FOUND');
  }
  
  if (sender._id.toString() === recipient._id.toString()) {
    throw new CustomError('Нельзя дарить подарки самому себе', 400, 'SELF_GIFT');
  }
  
  if (!recipient.isActive) {
    throw new CustomError('Аккаунт получателя деактивирован', 400, 'RECIPIENT_INACTIVE');
  }
  
  // Check sender's balance
  if (sender.starsBalance < gift.cost) {
    throw new CustomError('Недостаточно звезд для подарка', 400, 'INSUFFICIENT_BALANCE');
  }
  
  // Create transactions
  const giftDescription = `Подарок ${gift.name} пользователю ${recipient.username}`;
  const receiveDescription = `Получен подарок ${gift.name} от ${sender.username}`;
  
  // Deduct from sender
  await Transaction.createTransaction({
    userId: sender._id,
    type: 'spend_admin',
    amount: -gift.cost,
    description: giftDescription + (message ? ` (${message})` : ''),
    metadata: {
      recipientId: recipient._id,
      recipientUsername: recipient.username,
      giftType,
      giftName: gift.name,
      giftMessage: message,
      adminReason: 'gift_send'
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Send real-time notification with animation
  const io = req.app.get('io');
  if (io) {
    io.to(`user-${recipient._id}`).emit('gift-received', {
      gift: gift.name,
      giftType,
      animation: gift.animation,
      from: sender.username,
      message,
      cost: gift.cost
    });
  }
  
  res.json({
    message: 'Подарок отправлен',
    gift: gift.name,
    cost: gift.cost,
    recipient: recipient.username,
    newBalance: sender.starsBalance
  });
}));

module.exports = router; 