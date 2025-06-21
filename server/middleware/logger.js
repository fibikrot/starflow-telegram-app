const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  const requestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.userId || 'anonymous',
    body: req.method === 'POST' || req.method === 'PUT' ? 
      JSON.stringify(req.body).substring(0, 1000) : undefined // Limit body size
  };
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const responseLog = {
      ...requestLog,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(data).length
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      const methodColor = '\x1b[36m';
      const resetColor = '\x1b[0m';
      
      console.log(
        `${methodColor}${req.method}${resetColor} ` +
        `${req.url} ` +
        `${statusColor}${res.statusCode}${resetColor} ` +
        `${duration}ms`
      );
    }
    
    // Log to file
    const logEntry = JSON.stringify(responseLog) + '\n';
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFile(logFile, logEntry, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

// Log levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Custom logger functions
const logError = (message, error, context = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.ERROR,
    message,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  };
  
  console.error('ERROR:', logEntry);
  
  const logFile = path.join(logsDir, 'errors.log');
  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) console.error('Error writing to error log:', err);
  });
};

const logInfo = (message, context = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.INFO,
    message,
    context
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('INFO:', message, context);
  }
  
  const logFile = path.join(logsDir, 'info.log');
  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) console.error('Error writing to info log:', err);
  });
};

const logWarn = (message, context = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.WARN,
    message,
    context
  };
  
  console.warn('WARN:', message, context);
  
  const logFile = path.join(logsDir, 'warnings.log');
  fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) console.error('Error writing to warning log:', err);
  });
};

const logDebug = (message, context = {}) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: LOG_LEVELS.DEBUG,
    message,
    context
  };
  
  console.debug('DEBUG:', message, context);
};

// Log rotation (clean old logs)
const cleanOldLogs = () => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();
  
  fs.readdir(logsDir, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting old log file:', err);
          });
        }
      });
    });
  });
};

// Clean old logs daily
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
  logger,
  logError,
  logInfo,
  logWarn,
  logDebug,
  LOG_LEVELS
}; 