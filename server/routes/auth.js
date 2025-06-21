const express = require('express');
const jwt = require('jsonwebtoken');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password, referralCode } = req.body;
  
  // Validation
  if (!username || !email || !password) {
    throw new CustomError('Все поля обязательны для заполнения', 400, 'MISSING_FIELDS');
  }
  
  if (password.length < 6) {
    throw new CustomError('Пароль должен содержать минимум 6 символов', 400, 'WEAK_PASSWORD');
  }
  
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });
  
  if (existingUser) {
    if (existingUser.email === email) {
      throw new CustomError('Пользователь с таким email уже существует', 400, 'EMAIL_EXISTS');
    } else {
      throw new CustomError('Пользователь с таким именем уже существует', 400, 'USERNAME_EXISTS');
    }
  }
  
  // Create user
  const userData = {
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    password
  };
  
  // Handle referral
  let referrer = null;
  if (referralCode) {
    referrer = await User.findByReferralCode(referralCode.toUpperCase());
    if (referrer) {
      userData.referredBy = referrer._id;
    }
  }
  
  const user = new User(userData);
  await user.save();
  
  // Handle referral bonus
  if (referrer) {
    const referralBonus = Math.floor(
      (parseInt(process.env.REFERRAL_BONUS_PERCENT) || 10) * 10
    ); // 10% = 100 stars
    
    // Add referral to referrer
    referrer.referrals.push({
      user: user._id,
      joinedAt: new Date(),
      earnedStars: 0
    });
    
    // Give bonus to referrer
    await referrer.addStars(referralBonus, 'referral');
    referrer.referralEarnings += referralBonus;
    await referrer.save();
    
    // Create transaction for referrer
    await Transaction.createTransaction({
      userId: referrer._id,
      type: 'earn_referral',
      amount: referralBonus,
      description: `Реферальный бонус за приглашение ${user.username}`,
      metadata: {
        referredUser: user._id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  // Give welcome bonus to new user
  const welcomeBonus = 100;
  await user.addStars(welcomeBonus, 'welcome');
  
  // Create welcome transaction
  await Transaction.createTransaction({
    userId: user._id,
    type: 'earn_admin',
    amount: welcomeBonus,
    description: 'Приветственный бонус за регистрацию',
    metadata: {
      adminReason: 'welcome_bonus'
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Generate token
  const token = generateToken(user._id);
  
  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;
  
  res.status(201).json({
    message: 'Регистрация успешна',
    token,
    user: userResponse,
    welcomeBonus
  });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
  const { login, password } = req.body;
  
  if (!login || !password) {
    throw new CustomError('Email/имя пользователя и пароль обязательны', 400, 'MISSING_CREDENTIALS');
  }
  
  // Find user by email or username
  const user = await User.findOne({
    $or: [
      { email: login.toLowerCase() },
      { username: login.toLowerCase() }
    ]
  });
  
  if (!user) {
    throw new CustomError('Неверные учетные данные', 401, 'INVALID_CREDENTIALS');
  }
  
  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new CustomError('Неверные учетные данные', 401, 'INVALID_CREDENTIALS');
  }
  
  // Check if account is active
  if (!user.isActive) {
    throw new CustomError('Аккаунт деактивирован', 401, 'ACCOUNT_DEACTIVATED');
  }
  
  // Check if account is banned
  if (user.bannedUntil && new Date() < user.bannedUntil) {
    throw new CustomError('Аккаунт заблокирован', 403, 'ACCOUNT_BANNED', {
      bannedUntil: user.bannedUntil,
      banReason: user.banReason
    });
  }
  
  // Update login stats
  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save();
  
  // Generate token
  const token = generateToken(user._id);
  
  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;
  
  res.json({
    message: 'Вход выполнен успешно',
    token,
    user: userResponse
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId)
    .select('-password')
    .populate('referrals.user', 'username firstName lastName avatar starsBalance');
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }
  
  res.json({
    user
  });
}));

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { firstName, lastName, avatar, settings } = req.body;
  
  const user = await User.findById(req.userId);
  
  if (!user) {
    throw new CustomError('Пользователь не найден', 404, 'USER_NOT_FOUND');
  }
  
  // Update fields
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (avatar !== undefined) user.avatar = avatar;
  if (settings !== undefined) {
    user.settings = { ...user.settings, ...settings };
  }
  
  await user.save();
  
  // Remove password from response
  const userResponse = user.toObject();
  delete userResponse.password;
  
  res.json({
    message: 'Профиль обновлен',
    user: userResponse
  });
}));

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new CustomError('Текущий и новый пароль обязательны', 400, 'MISSING_PASSWORDS');
  }
  
  if (newPassword.length < 6) {
    throw new CustomError('Новый пароль должен содержать минимум 6 символов', 400, 'WEAK_PASSWORD');
  }
  
  const user = await User.findById(req.userId);
  
  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new CustomError('Неверный текущий пароль', 401, 'INVALID_CURRENT_PASSWORD');
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  res.json({
    message: 'Пароль успешно изменен'
  });
}));

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', authMiddleware, asyncHandler(async (req, res) => {
  const token = generateToken(req.userId);
  
  res.json({
    message: 'Токен обновлен',
    token
  });
}));

// @route   POST /api/auth/link-telegram
// @desc    Link Telegram account
// @access  Private
router.post('/link-telegram', authMiddleware, asyncHandler(async (req, res) => {
  const { telegramId, telegramUsername } = req.body;
  
  if (!telegramId) {
    throw new CustomError('Telegram ID обязателен', 400, 'MISSING_TELEGRAM_ID');
  }
  
  // Check if telegram account is already linked
  const existingUser = await User.findOne({ telegramId });
  if (existingUser && existingUser._id.toString() !== req.userId.toString()) {
    throw new CustomError('Этот Telegram аккаунт уже привязан к другому пользователю', 400, 'TELEGRAM_ALREADY_LINKED');
  }
  
  const user = await User.findById(req.userId);
  user.telegramId = telegramId;
  user.telegramUsername = telegramUsername;
  await user.save();
  
  // Give telegram bonus
  const telegramBonus = 50;
  await user.addStars(telegramBonus, 'telegram_link');
  
  await Transaction.createTransaction({
    userId: user._id,
    type: 'earn_admin',
    amount: telegramBonus,
    description: 'Бонус за привязку Telegram аккаунта',
    metadata: {
      adminReason: 'telegram_link_bonus'
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.json({
    message: 'Telegram аккаунт успешно привязан',
    bonus: telegramBonus
  });
}));

// @route   POST /api/auth/unlink-telegram
// @desc    Unlink Telegram account
// @access  Private
router.post('/unlink-telegram', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  
  if (!user.telegramId) {
    throw new CustomError('Telegram аккаунт не привязан', 400, 'TELEGRAM_NOT_LINKED');
  }
  
  user.telegramId = undefined;
  user.telegramUsername = undefined;
  await user.save();
  
  res.json({
    message: 'Telegram аккаунт отвязан'
  });
}));

// @route   GET /api/auth/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Get transaction stats
  const transactionStats = await Transaction.getUserStats(req.userId, period);
  
  // Get user's current stats
  const user = await User.findById(req.userId).select('gameStats totalReferrals level experience');
  
  res.json({
    transactionStats: transactionStats[0] || {
      totalEarned: 0,
      totalSpent: 0,
      transactionCount: 0,
      gameEarnings: 0,
      referralEarnings: 0,
      dailyBonusEarnings: 0
    },
    gameStats: user.gameStats,
    level: user.level,
    experience: user.experience,
    totalReferrals: user.totalReferrals,
    period
  });
}));

// @route   GET /api/auth/test
// @desc    Test auth endpoint
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth route работает!',
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/auth/telegram
// @desc    Authenticate with Telegram
// @access  Public
router.post('/telegram', (req, res) => {
  const { initData } = req.body;
  
  // Простая проверка для демо
  if (!initData) {
    return res.status(400).json({
      success: false,
      message: 'Telegram данные не предоставлены'
    });
  }

  // В реальном приложении здесь была бы проверка подписи Telegram
  res.json({
    success: true,
    message: 'Telegram аутентификация успешна',
    user: {
      id: 'demo_user',
      username: 'demo_user',
      stars: 100
    }
  });
});

module.exports = router; 