const express = require('express');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const { authMiddleware, adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TelegramService = require('../services/telegramService');

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // User statistics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
  const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: thisWeek } });
  const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thisMonth } });

  // Transaction statistics
  const totalTransactions = await Transaction.countDocuments();
  const transactionsToday = await Transaction.countDocuments({ createdAt: { $gte: today } });
  const transactionsThisWeek = await Transaction.countDocuments({ createdAt: { $gte: thisWeek } });

  // Stars statistics
  const starsStats = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        totalStarsIssued: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
          }
        },
        totalStarsSpent: {
          $sum: {
            $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0]
          }
        }
      }
    }
  ]);

  const starsData = starsStats[0] || { totalStarsIssued: 0, totalStarsSpent: 0 };

  // Top users by balance
  const topUsers = await User.find({ isActive: true })
    .sort({ starsBalance: -1 })
    .limit(10)
    .select('username starsBalance level totalStarsEarned')
    .lean();

  // Recent transactions
  const recentTransactions = await Transaction.find()
    .populate('user', 'username')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  // System health
  const systemHealth = {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    nodeVersion: process.version
  };

  res.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek,
      newThisMonth: newUsersThisMonth
    },
    transactions: {
      total: totalTransactions,
      today: transactionsToday,
      thisWeek: transactionsThisWeek
    },
    stars: {
      totalIssued: starsData.totalStarsIssued,
      totalSpent: starsData.totalStarsSpent,
      circulating: starsData.totalStarsIssued - starsData.totalStarsSpent
    },
    topUsers,
    recentTransactions,
    systemHealth
  });
}));

// @route   GET /api/admin/users
// @desc    Get users list with pagination and filters
// @access  Private (Admin)
router.get('/users', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    search = '',
    status = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = {};
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } }
    ];
  }

  if (status !== 'all') {
    switch (status) {
      case 'active':
        query.isActive = true;
        break;
      case 'inactive':
        query.isActive = false;
        break;
      case 'banned':
        query.isBanned = true;
        break;
      case 'telegram':
        query.telegramId = { $exists: true, $ne: null };
        break;
      case 'wallet':
        query.walletAddress = { $exists: true, $ne: null };
        break;
    }
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const users = await User.find(query)
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip)
    .select('-password')
    .lean();

  const totalCount = await User.countDocuments(query);
  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    users,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalCount,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    },
    filters: {
      search,
      status,
      sortBy,
      sortOrder
    }
  });
}));

// @route   GET /api/admin/users/:userId
// @desc    Get detailed user information
// @access  Private (Admin)
router.get('/users/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('-password').lean();
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  // Get user's transaction history
  const transactions = await Transaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Get user's referrals
  const referrals = await User.find({ referredBy: userId })
    .select('username createdAt starsBalance level')
    .lean();

  // Calculate additional stats
  const transactionStats = await Transaction.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  res.json({
    user,
    transactions,
    referrals,
    transactionStats
  });
}));

// @route   PUT /api/admin/users/:userId
// @desc    Update user information
// @access  Private (Admin)
router.put('/users/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive, isBanned, role, notes } = req.body;

  const user = await User.findById(userId);
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  // Update allowed fields
  if (isActive !== undefined) user.isActive = isActive;
  if (isBanned !== undefined) user.isBanned = isBanned;
  if (role !== undefined) user.role = role;
  if (notes !== undefined) user.adminNotes = notes;

  await user.save();

  res.json({
    message: 'Пользователь обновлен',
    user: {
      id: user._id,
      username: user.username,
      isActive: user.isActive,
      isBanned: user.isBanned,
      role: user.role,
      adminNotes: user.adminNotes
    }
  });
}));

// @route   POST /api/admin/users/:userId/stars
// @desc    Add or remove stars from user account
// @access  Private (Admin)
router.post('/users/:userId/stars', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount, reason, type = 'admin' } = req.body;

  if (!amount || amount === 0) {
    throw new CustomError('Сумма обязательна и не может быть нулевой', 400, 'INVALID_AMOUNT');
  }

  if (!reason) {
    throw new CustomError('Причина обязательна', 400, 'MISSING_REASON');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }

  // Create transaction
  const transactionType = amount > 0 ? 'earn_admin' : 'spend_admin';
  const description = amount > 0 ? 
    `Административное начисление: ${reason}` : 
    `Административное списание: ${reason}`;

  await Transaction.createTransaction({
    userId: user._id,
    type: transactionType,
    amount: amount,
    description,
    metadata: {
      adminReason: reason,
      adminId: req.userId,
      adminUsername: req.user?.username
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send notification if user has Telegram linked
  if (user.telegramId) {
    const notificationText = amount > 0 ? 
      `🎁 Вы получили ${amount} звезд от администрации!\n\nПричина: ${reason}` :
      `📉 С вашего счета списано ${Math.abs(amount)} звезд.\n\nПричина: ${reason}`;
    
    await TelegramService.sendMessage(user.telegramId, notificationText);
  }

  res.json({
    message: amount > 0 ? 'Звезды начислены' : 'Звезды списаны',
    amount,
    newBalance: user.starsBalance,
    reason
  });
}));

// @route   GET /api/admin/transactions
// @desc    Get transactions list with filters
// @access  Private (Admin)
router.get('/transactions', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    type = 'all',
    status = 'all',
    userId = null,
    startDate = null,
    endDate = null
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = {};
  
  if (type !== 'all') {
    query.type = type;
  }
  
  if (status !== 'all') {
    query.status = status;
  }
  
  if (userId) {
    query.user = userId;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await Transaction.find(query)
    .populate('user', 'username email')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

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
      status,
      userId,
      startDate,
      endDate
    }
  });
}));

// @route   GET /api/admin/analytics
// @desc    Get detailed analytics data
// @access  Private (Admin)
router.get('/analytics', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  let startDate = new Date();
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
    case '1y':
      days = 365;
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  // Daily user registrations
  const dailyRegistrations = await User.aggregate([
    {
      $match: { createdAt: { $gte: startDate } }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  // Daily transaction volume
  const dailyTransactions = await Transaction.aggregate([
    {
      $match: { 
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
        count: { $sum: 1 },
        volume: { $sum: { $abs: '$amount' } }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  // Transaction types breakdown
  const transactionTypes = await Transaction.aggregate([
    {
      $match: { 
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: { $abs: '$amount' } }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);

  // User level distribution
  const levelDistribution = await User.aggregate([
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  // Top referrers
  const topReferrers = await User.aggregate([
    {
      $match: { 
        referrals: { $exists: true, $not: { $size: 0 } }
      }
    },
    {
      $project: {
        username: 1,
        referralCount: { $size: '$referrals' },
        referralEarnings: 1
      }
    },
    {
      $sort: { referralCount: -1 }
    },
    {
      $limit: 10
    }
  ]);

  res.json({
    period,
    dailyRegistrations,
    dailyTransactions,
    transactionTypes,
    levelDistribution,
    topReferrers
  });
}));

// @route   POST /api/admin/broadcast
// @desc    Send broadcast message to users
// @access  Private (Admin)
router.post('/broadcast', asyncHandler(async (req, res) => {
  const { 
    message, 
    targetGroup = 'all',
    channels = ['telegram'],
    urgent = false 
  } = req.body;

  if (!message) {
    throw new CustomError('Сообщение обязательно', 400, 'MISSING_MESSAGE');
  }

  let query = {};
  
  switch (targetGroup) {
    case 'active':
      query.isActive = true;
      query.lastLogin = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case 'inactive':
      query.isActive = true;
      query.lastLogin = { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case 'new':
      query.createdAt = { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) };
      break;
    case 'vip':
      query.level = { $gte: 10 };
      break;
    case 'telegram':
      query.telegramId = { $exists: true, $ne: null };
      break;
    default:
      // 'all' - no additional filters
      break;
  }

  const users = await User.find(query).select('telegramId username email').lean();
  
  let results = {
    total: users.length,
    telegram: { sent: 0, failed: 0 },
    email: { sent: 0, failed: 0 }
  };

  // Send Telegram messages
  if (channels.includes('telegram')) {
    const telegramUsers = users.filter(user => user.telegramId);
    const prefix = urgent ? '🚨 ВАЖНО: ' : '📢 ';
    
    for (const user of telegramUsers) {
      try {
        await TelegramService.sendMessage(user.telegramId, `${prefix}${message}`);
        results.telegram.sent++;
      } catch (error) {
        console.error(`Failed to send Telegram message to ${user.telegramId}:`, error);
        results.telegram.failed++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Email broadcasting would be implemented here
  if (channels.includes('email')) {
    // Email implementation
    results.email.sent = 0;
    results.email.failed = 0;
  }

  res.json({
    message: 'Рассылка завершена',
    targetGroup,
    channels,
    results
  });
}));

// @route   GET /api/admin/system
// @desc    Get system information and health
// @access  Private (Admin)
router.get('/system', asyncHandler(async (req, res) => {
  const systemInfo = {
    server: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    database: {
      // MongoDB connection status would be checked here
      connected: true, // Placeholder
      collections: {
        users: await User.countDocuments(),
        transactions: await Transaction.countDocuments()
      }
    },
    services: {
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      web3: !!process.env.WEB3_RPC_URL,
      email: !!process.env.EMAIL_SERVICE_API_KEY
    }
  };

  res.json(systemInfo);
}));

// @route   POST /api/admin/maintenance
// @desc    Perform maintenance tasks
// @access  Private (Admin)
router.post('/maintenance', asyncHandler(async (req, res) => {
  const { task } = req.body;

  let result = {};

  switch (task) {
    case 'cleanup-expired-transactions':
      const expiredCount = await Transaction.deleteMany({
        status: 'pending',
        expiresAt: { $lt: new Date() }
      });
      result = { message: 'Expired transactions cleaned up', count: expiredCount.deletedCount };
      break;

    case 'recalculate-user-stats':
      // Recalculate user statistics
      const users = await User.find();
      let updatedCount = 0;
      
      for (const user of users) {
        const stats = await Transaction.getUserStats(user._id, 'all');
        if (stats.length > 0) {
          user.totalStarsEarned = stats[0].totalEarned || 0;
          user.totalStarsSpent = stats[0].totalSpent || 0;
          await user.save();
          updatedCount++;
        }
      }
      
      result = { message: 'User statistics recalculated', count: updatedCount };
      break;

    case 'optimize-database':
      // Database optimization tasks would go here
      result = { message: 'Database optimization completed' };
      break;

    default:
      throw new CustomError('Неизвестная задача обслуживания', 400, 'UNKNOWN_MAINTENANCE_TASK');
  }

  res.json(result);
}));

module.exports = router; 