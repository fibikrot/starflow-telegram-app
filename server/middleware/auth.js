const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Токен доступа не предоставлен',
        code: 'NO_TOKEN'
      });
    }
    
    // Check if token starts with Bearer
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Неверный формат токена',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    // Extract token
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Аккаунт деактивирован',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    // Check if user is banned
    if (user.bannedUntil && new Date() < user.bannedUntil) {
      return res.status(403).json({
        error: 'Аккаунт заблокирован',
        code: 'ACCOUNT_BANNED',
        bannedUntil: user.bannedUntil,
        banReason: user.banReason
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Add user to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Недействительный токен',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Токен истек',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(500).json({
      error: 'Ошибка аутентификации',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }
    
    next();
  } catch (error) {
    // Ignore auth errors in optional auth
    next();
  }
};

// Admin middleware
const adminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Требуется авторизация',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        error: 'Недостаточно прав доступа',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      error: 'Ошибка проверки прав доступа',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

// Super admin middleware
const superAdminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Требуется авторизация',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Требуются права администратора',
        code: 'ADMIN_REQUIRED'
      });
    }
    
    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({
      error: 'Ошибка проверки прав администратора',
      code: 'SUPER_ADMIN_AUTH_ERROR'
    });
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
  adminAuth,
  superAdminAuth
}; 