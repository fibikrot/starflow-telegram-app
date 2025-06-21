const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Transaction details
  type: {
    type: String,
    required: true,
    enum: [
      'earn_game',      // Заработок в играх
      'earn_referral',  // Реферальный бонус
      'earn_daily',     // Ежедневный бонус
      'earn_task',      // Выполнение заданий
      'earn_admin',     // Начисление админом
      'spend_shop',     // Покупка в магазине
      'spend_exchange', // Обмен на крипту
      'spend_transfer', // Перевод другому пользователю
      'spend_admin'     // Списание админом
    ]
  },
  
  // Amount (positive for earning, negative for spending)
  amount: {
    type: Number,
    required: true
  },
  
  // Balance after transaction
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Transaction description
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Additional metadata
  metadata: {
    // For game transactions
    gameType: {
      type: String,
      enum: ['clicker', 'quiz', 'puzzle', 'daily_bonus']
    },
    gameSession: {
      type: String
    },
    
    // For referral transactions
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // For exchange transactions
    exchangeRate: {
      type: Number
    },
    cryptoAmount: {
      type: Number
    },
    cryptoCurrency: {
      type: String,
      enum: ['USDT', 'ETH', 'BTC', 'TON']
    },
    txHash: {
      type: String
    },
    
    // For shop transactions
    itemId: {
      type: String
    },
    itemName: {
      type: String
    },
    
    // For admin transactions
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminReason: {
      type: String
    }
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  
  // For pending transactions
  expiresAt: {
    type: Date,
    default: null
  },
  
  // IP address for security
  ipAddress: {
    type: String,
    required: true
  },
  
  // User agent for security
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'metadata.txHash': 1 });
transactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for transaction direction
transactionSchema.virtual('direction').get(function() {
  return this.amount > 0 ? 'in' : 'out';
});

// Virtual for absolute amount
transactionSchema.virtual('absoluteAmount').get(function() {
  return Math.abs(this.amount);
});

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    type = null,
    startDate = null,
    endDate = null
  } = options;
  
  const query = { user: userId };
  
  if (type) {
    query.type = type;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('metadata.referredUser', 'username firstName lastName')
    .populate('metadata.adminId', 'username firstName lastName')
    .lean();
};

// Static method to get user transaction stats
transactionSchema.statics.getUserStats = function(userId, period = '30d') {
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
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }
  
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalEarned: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0]
          }
        },
        totalSpent: {
          $sum: {
            $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0]
          }
        },
        transactionCount: { $sum: 1 },
        gameEarnings: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$amount', 0] }, { $eq: ['$type', 'earn_game'] }] },
              '$amount',
              0
            ]
          }
        },
        referralEarnings: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$amount', 0] }, { $eq: ['$type', 'earn_referral'] }] },
              '$amount',
              0
            ]
          }
        },
        dailyBonusEarnings: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$amount', 0] }, { $eq: ['$type', 'earn_daily'] }] },
              '$amount',
              0
            ]
          }
        }
      }
    }
  ]);
};

// Static method to create transaction
transactionSchema.statics.createTransaction = async function(data) {
  const {
    userId,
    type,
    amount,
    description,
    metadata = {},
    ipAddress,
    userAgent
  } = data;
  
  // Get user's current balance
  const User = require('./User');
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('Пользователь не найден');
  }
  
  // Check if user has enough balance for spending
  if (amount < 0 && user.starsBalance < Math.abs(amount)) {
    throw new Error('Недостаточно звезд для выполнения операции');
  }
  
  // Calculate balance after transaction
  const balanceAfter = user.starsBalance + amount;
  
  // Create transaction
  const transaction = new this({
    user: userId,
    type,
    amount,
    balanceAfter,
    description,
    metadata,
    ipAddress,
    userAgent
  });
  
  // Save transaction and update user balance
  await transaction.save();
  
  // Update user balance
  if (amount > 0) {
    await user.addStars(amount, type);
  } else {
    await user.spendStars(Math.abs(amount));
  }
  
  return transaction;
};

// Static method to get platform statistics
transactionSchema.statics.getPlatformStats = function(period = '30d') {
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
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema); 