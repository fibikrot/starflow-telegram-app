const express = require('express');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Game session storage (in production, use Redis)
const gameSessions = new Map();

// @route   POST /api/games/clicker/start
// @desc    Start clicker game session
// @access  Private
router.post('/clicker/start', asyncHandler(async (req, res) => {
  const sessionId = uuidv4();
  const startTime = Date.now();
  
  // Create game session
  gameSessions.set(sessionId, {
    userId: req.userId.toString(),
    startTime,
    clicks: 0,
    score: 0,
    isActive: true,
    lastClickTime: startTime
  });
  
  // Clean up session after 5 minutes
  setTimeout(() => {
    if (gameSessions.has(sessionId)) {
      gameSessions.delete(sessionId);
    }
  }, 5 * 60 * 1000);
  
  res.json({
    message: 'Игровая сессия начата',
    sessionId,
    startTime
  });
}));

// @route   POST /api/games/clicker/click
// @desc    Register click in clicker game
// @access  Private
router.post('/clicker/click', asyncHandler(async (req, res) => {
  const { sessionId, clickTime } = req.body;
  
  if (!sessionId) {
    throw new CustomError('ID сессии обязателен', 400, 'MISSING_SESSION_ID');
  }
  
  const session = gameSessions.get(sessionId);
  
  if (!session) {
    throw new CustomError('Игровая сессия не найдена или истекла', 404, 'SESSION_NOT_FOUND');
  }
  
  if (session.userId !== req.userId.toString()) {
    throw new CustomError('Нет доступа к этой сессии', 403, 'SESSION_ACCESS_DENIED');
  }
  
  if (!session.isActive) {
    throw new CustomError('Игровая сессия завершена', 400, 'SESSION_ENDED');
  }
  
  const now = Date.now();
  const timeSinceStart = now - session.startTime;
  const timeSinceLastClick = now - session.lastClickTime;
  
  // Anti-cheat: check click timing
  if (timeSinceLastClick < 50) { // Minimum 50ms between clicks
    throw new CustomError('Слишком быстрые клики', 400, 'CLICKS_TOO_FAST');
  }
  
  if (timeSinceStart > 5 * 60 * 1000) { // Max 5 minutes per session
    session.isActive = false;
    throw new CustomError('Время игры истекло', 400, 'GAME_TIME_EXPIRED');
  }
  
  // Calculate click reward (1-5 stars per click)
  const baseReward = Math.floor(Math.random() * 5) + 1;
  let clickReward = baseReward;
  
  // Bonus for combo clicks (consecutive clicks within 2 seconds)
  if (timeSinceLastClick < 2000) {
    session.combo = (session.combo || 0) + 1;
    if (session.combo > 5) {
      clickReward = Math.floor(clickReward * 1.5); // 50% bonus for combo
    }
  } else {
    session.combo = 0;
  }
  
  // Update session
  session.clicks += 1;
  session.score += clickReward;
  session.lastClickTime = now;
  
  res.json({
    message: 'Клик засчитан',
    reward: clickReward,
    totalScore: session.score,
    clicks: session.clicks,
    combo: session.combo || 0,
    timeRemaining: Math.max(0, 5 * 60 * 1000 - timeSinceStart)
  });
}));

// @route   POST /api/games/clicker/end
// @desc    End clicker game session and claim rewards
// @access  Private
router.post('/clicker/end', asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    throw new CustomError('ID сессии обязателен', 400, 'MISSING_SESSION_ID');
  }
  
  const session = gameSessions.get(sessionId);
  
  if (!session) {
    throw new CustomError('Игровая сессия не найдена', 404, 'SESSION_NOT_FOUND');
  }
  
  if (session.userId !== req.userId.toString()) {
    throw new CustomError('Нет доступа к этой сессии', 403, 'SESSION_ACCESS_DENIED');
  }
  
  // Mark session as ended
  session.isActive = false;
  
  // Get user and update stats
  const user = await User.findById(req.userId);
  
  // Anti-cheat: validate score
  const maxPossibleScore = session.clicks * 10; // Max 10 stars per click
  if (session.score > maxPossibleScore) {
    throw new CustomError('Обнаружена попытка мошенничества', 400, 'CHEATING_DETECTED');
  }
  
  // Update user game stats
  user.gameStats.clickerClicks += session.clicks;
  user.gameStats.gamesPlayed += 1;
  user.gameStats.totalGameTime += Math.floor((Date.now() - session.startTime) / 1000);
  
  if (session.score > user.gameStats.clickerHighScore) {
    user.gameStats.clickerHighScore = session.score;
  }
  
  // Award stars
  if (session.score > 0) {
    await user.addStars(session.score, 'clicker');
    
    // Create transaction
    await Transaction.createTransaction({
      userId: user._id,
      type: 'earn_game',
      amount: session.score,
      description: `Заработано в игре Кликер: ${session.clicks} кликов`,
      metadata: {
        gameType: 'clicker',
        gameSession: sessionId,
        clicks: session.clicks,
        gameTime: Math.floor((Date.now() - session.startTime) / 1000)
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  await user.save();
  
  // Clean up session
  gameSessions.delete(sessionId);
  
  // Check for achievements
  const achievements = [];
  
  if (user.gameStats.clickerClicks >= 1000 && !user.achievements.find(a => a.type === 'clicker_1000')) {
    achievements.push('clicker_1000');
    user.achievements.push({
      type: 'clicker_1000',
      unlockedAt: new Date()
    });
  }
  
  if (session.score >= 100 && !user.achievements.find(a => a.type === 'clicker_score_100')) {
    achievements.push('clicker_score_100');
    user.achievements.push({
      type: 'clicker_score_100',
      unlockedAt: new Date()
    });
  }
  
  if (achievements.length > 0) {
    await user.save();
  }
  
  res.json({
    message: 'Игра завершена',
    finalScore: session.score,
    totalClicks: session.clicks,
    starsEarned: session.score,
    newBalance: user.starsBalance,
    achievements,
    gameStats: user.gameStats
  });
}));

// @route   POST /api/games/daily-bonus
// @desc    Claim daily bonus
// @access  Private
router.post('/daily-bonus', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  
  if (!user.canClaimDailyBonus()) {
    const nextClaimTime = new Date(user.gameStats.lastDailyBonus);
    nextClaimTime.setDate(nextClaimTime.getDate() + 1);
    
    throw new CustomError('Ежедневный бонус уже получен', 400, 'DAILY_BONUS_ALREADY_CLAIMED', {
      nextClaimTime,
      hoursRemaining: Math.ceil((nextClaimTime - new Date()) / (1000 * 60 * 60))
    });
  }
  
  const bonusAmount = user.claimDailyBonus();
  
  // Create transaction
  await Transaction.createTransaction({
    userId: user._id,
    type: 'earn_daily',
    amount: bonusAmount,
    description: `Ежедневный бонус (серия: ${user.gameStats.dailyBonusStreak} дней)`,
    metadata: {
      gameType: 'daily_bonus',
      streak: user.gameStats.dailyBonusStreak
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Check for streak achievements
  const achievements = [];
  
  if (user.gameStats.dailyBonusStreak >= 7 && !user.achievements.find(a => a.type === 'daily_streak_7')) {
    achievements.push('daily_streak_7');
    user.achievements.push({
      type: 'daily_streak_7',
      unlockedAt: new Date()
    });
    await user.save();
  }
  
  if (user.gameStats.dailyBonusStreak >= 30 && !user.achievements.find(a => a.type === 'daily_streak_30')) {
    achievements.push('daily_streak_30');
    user.achievements.push({
      type: 'daily_streak_30',
      unlockedAt: new Date()
    });
    await user.save();
  }
  
  res.json({
    message: 'Ежедневный бонус получен',
    bonusAmount,
    streak: user.gameStats.dailyBonusStreak,
    newBalance: user.starsBalance,
    nextClaimTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    achievements
  });
}));

// @route   GET /api/games/leaderboard
// @desc    Get game leaderboard
// @access  Private
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const { type = 'stars', limit = 100 } = req.query;
  
  let sortField;
  let leaderboardData;
  
  switch (type) {
    case 'stars':
      leaderboardData = await User.getLeaderboard(parseInt(limit));
      break;
      
    case 'clicker':
      leaderboardData = await User.find({ isActive: true })
        .sort({ 'gameStats.clickerHighScore': -1 })
        .limit(parseInt(limit))
        .select('username firstName lastName avatar gameStats.clickerHighScore level')
        .lean();
      break;
      
    case 'level':
      leaderboardData = await User.find({ isActive: true })
        .sort({ level: -1, experience: -1 })
        .limit(parseInt(limit))
        .select('username firstName lastName avatar level experience')
        .lean();
      break;
      
    case 'referrals':
      leaderboardData = await User.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            username: 1,
            firstName: 1,
            lastName: 1,
            avatar: 1,
            referralCount: { $size: '$referrals' },
            referralEarnings: 1
          }
        },
        { $sort: { referralCount: -1, referralEarnings: -1 } },
        { $limit: parseInt(limit) }
      ]);
      break;
      
    default:
      throw new CustomError('Неверный тип рейтинга', 400, 'INVALID_LEADERBOARD_TYPE');
  }
  
  // Find current user's position
  let userPosition = null;
  const currentUser = leaderboardData.find(user => 
    user._id && user._id.toString() === req.userId.toString()
  );
  
  if (currentUser) {
    userPosition = leaderboardData.indexOf(currentUser) + 1;
  }
  
  res.json({
    leaderboard: leaderboardData,
    userPosition,
    type,
    total: leaderboardData.length
  });
}));

// @route   GET /api/games/achievements
// @desc    Get user achievements
// @access  Private
router.get('/achievements', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('achievements');
  
  // Define all available achievements
  const allAchievements = {
    clicker_1000: {
      name: '1000 кликов',
      description: 'Сделайте 1000 кликов в игре',
      icon: '🖱️',
      reward: 100
    },
    clicker_score_100: {
      name: 'Мастер кликер',
      description: 'Наберите 100 очков за одну игру',
      icon: '🏆',
      reward: 50
    },
    daily_streak_7: {
      name: 'Неделя подряд',
      description: 'Получайте ежедневный бонус 7 дней подряд',
      icon: '📅',
      reward: 200
    },
    daily_streak_30: {
      name: 'Месяц подряд',
      description: 'Получайте ежедневный бонус 30 дней подряд',
      icon: '🗓️',
      reward: 1000
    },
    first_referral: {
      name: 'Первый друг',
      description: 'Пригласите первого друга',
      icon: '👥',
      reward: 100
    },
    referral_master: {
      name: 'Мастер приглашений',
      description: 'Пригласите 10 друзей',
      icon: '🌟',
      reward: 500
    },
    stars_1000: {
      name: 'Коллекционер звезд',
      description: 'Накопите 1000 звезд',
      icon: '⭐',
      reward: 100
    },
    level_10: {
      name: 'Уровень 10',
      description: 'Достигните 10 уровня',
      icon: '🎯',
      reward: 300
    }
  };
  
  // Map user achievements with details
  const userAchievements = user.achievements.map(achievement => ({
    ...achievement.toObject(),
    ...allAchievements[achievement.type]
  }));
  
  // Find locked achievements
  const unlockedTypes = user.achievements.map(a => a.type);
  const lockedAchievements = Object.keys(allAchievements)
    .filter(type => !unlockedTypes.includes(type))
    .map(type => ({
      type,
      ...allAchievements[type],
      locked: true
    }));
  
  res.json({
    unlocked: userAchievements,
    locked: lockedAchievements,
    totalUnlocked: userAchievements.length,
    totalAvailable: Object.keys(allAchievements).length
  });
}));

// @route   GET /api/games/session/:sessionId
// @desc    Get game session info
// @access  Private
router.get('/session/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  
  const session = gameSessions.get(sessionId);
  
  if (!session) {
    throw new CustomError('Игровая сессия не найдена', 404, 'SESSION_NOT_FOUND');
  }
  
  if (session.userId !== req.userId.toString()) {
    throw new CustomError('Нет доступа к этой сессии', 403, 'SESSION_ACCESS_DENIED');
  }
  
  const timeRemaining = Math.max(0, 5 * 60 * 1000 - (Date.now() - session.startTime));
  
  res.json({
    sessionId,
    isActive: session.isActive && timeRemaining > 0,
    clicks: session.clicks,
    score: session.score,
    combo: session.combo || 0,
    timeRemaining,
    startTime: session.startTime
  });
}));

module.exports = router; 