const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.userId || 'anonymous',
    timestamp: new Date().toISOString()
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = {};
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
    
    return res.status(400).json({
      error: 'Ошибка валидации данных',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    let message = 'Дублирование данных';
    if (field === 'email') {
      message = 'Пользователь с таким email уже существует';
    } else if (field === 'username') {
      message = 'Пользователь с таким именем уже существует';
    } else if (field === 'telegramId') {
      message = 'Telegram аккаунт уже привязан к другому пользователю';
    }
    
    return res.status(400).json({
      error: message,
      code: 'DUPLICATE_ERROR',
      field,
      value
    });
  }
  
  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Неверный формат данных',
      code: 'CAST_ERROR',
      field: err.path,
      value: err.value
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Недействительный токен',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Токен истек',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // Rate limit error
  if (err.statusCode === 429) {
    return res.status(429).json({
      error: 'Слишком много запросов',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter
    });
  }
  
  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Файл слишком большой',
      code: 'FILE_TOO_LARGE',
      maxSize: err.limit
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Слишком много файлов',
      code: 'TOO_MANY_FILES',
      maxCount: err.limit
    });
  }
  
  // Web3 errors
  if (err.message && err.message.includes('insufficient funds')) {
    return res.status(400).json({
      error: 'Недостаточно средств для выполнения транзакции',
      code: 'INSUFFICIENT_FUNDS'
    });
  }
  
  if (err.message && err.message.includes('transaction failed')) {
    return res.status(400).json({
      error: 'Транзакция не удалась',
      code: 'TRANSACTION_FAILED'
    });
  }
  
  // Custom application errors
  if (err.isCustomError) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      code: err.code || 'CUSTOM_ERROR',
      details: err.details
    });
  }
  
  // Default server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Внутренняя ошибка сервера' 
    : err.message;
  
  res.status(statusCode).json({
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

// Custom error class
class CustomError extends Error {
  constructor(message, statusCode = 400, code = 'CUSTOM_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isCustomError = true;
  }
}

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  CustomError,
  asyncHandler
}; 