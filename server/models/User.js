const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic user info
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Telegram integration
  telegramId: {
    type: String,
    unique: true,
    sparse: true
  },
  telegramUsername: {
    type: String,
    sparse: true
  },
  
  // Profile info
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Stars balance and economy
  starsBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalStarsEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  totalStarsSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Game statistics
  gameStats: {
    clickerClicks: {
      type: Number,
      default: 0
    },
    clickerHighScore: {
      type: Number,
      default: 0
    },
    dailyBonusStreak: {
      type: Number,
      default: 0
    },
    lastDailyBonus: {
      type: Date,
      default: null
    },
    gamesPlayed: {
      type: Number,
      default: 0
    },
    totalGameTime: {
      type: Number,
      default: 0 // in seconds
    }
  },
  
  // Referral system
  referralCode: {
    type: String,
    unique: true,
    required: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referrals: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    earnedStars: {
      type: Number,
      default: 0
    }
  }],
  referralEarnings: {
    type: Number,
    default: 0
  },
  
  // Web3 integration
  walletAddress: {
    type: String,
    sparse: true,
    lowercase: true
  },
  walletType: {
    type: String,
    enum: ['metamask', 'walletconnect', 'coinbase', 'trust'],
    default: null
  },
  
  // Achievements and levels
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  achievements: [{
    type: {
      type: String,
      required: true
    },
    unlockedAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0
    }
  }],
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  
  // Security and preferences
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'ru',
      enum: ['ru', 'en', 'es', 'fr', 'de']
    },
    theme: {
      type: String,
      default: 'dark',
      enum: ['light', 'dark', 'auto']
    },
    privacy: {
      showProfile: {
        type: Boolean,
        default: true
      },
      showStats: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Admin fields
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  bannedUntil: {
    type: Date,
    default: null
  },
  banReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ telegramId: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ starsBalance: -1 });

// Virtual for total referrals count
userSchema.virtual('totalReferrals').get(function() {
  return this.referrals.length;
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username;
});

// Virtual for next level experience required
userSchema.virtual('nextLevelExp').get(function() {
  return this.level * 1000; // 1000 exp per level
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate referral code
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = this.generateReferralCode();
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate referral code
userSchema.methods.generateReferralCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Method to add stars
userSchema.methods.addStars = function(amount, reason = 'game') {
  this.starsBalance += amount;
  this.totalStarsEarned += amount;
  
  // Add experience
  this.experience += Math.floor(amount / 10);
  
  // Check for level up
  while (this.experience >= this.nextLevelExp) {
    this.experience -= this.nextLevelExp;
    this.level += 1;
  }
  
  return this.save();
};

// Method to spend stars
userSchema.methods.spendStars = function(amount) {
  if (this.starsBalance < amount) {
    throw new Error('Недостаточно звезд');
  }
  
  this.starsBalance -= amount;
  this.totalStarsSpent += amount;
  
  return this.save();
};

// Method to check if user can claim daily bonus
userSchema.methods.canClaimDailyBonus = function() {
  if (!this.gameStats.lastDailyBonus) return true;
  
  const now = new Date();
  const lastBonus = new Date(this.gameStats.lastDailyBonus);
  const diffTime = Math.abs(now - lastBonus);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 1;
};

// Method to claim daily bonus
userSchema.methods.claimDailyBonus = function() {
  if (!this.canClaimDailyBonus()) {
    throw new Error('Ежедневный бонус уже получен');
  }
  
  const now = new Date();
  const lastBonus = this.gameStats.lastDailyBonus ? new Date(this.gameStats.lastDailyBonus) : null;
  
  // Check if streak continues (claimed yesterday)
  if (lastBonus) {
    const diffTime = Math.abs(now - lastBonus);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      this.gameStats.dailyBonusStreak += 1;
    } else {
      this.gameStats.dailyBonusStreak = 1;
    }
  } else {
    this.gameStats.dailyBonusStreak = 1;
  }
  
  this.gameStats.lastDailyBonus = now;
  
  // Calculate bonus amount (base + streak bonus)
  const baseBonus = parseInt(process.env.DAILY_BONUS_AMOUNT) || 50;
  const streakBonus = Math.min(this.gameStats.dailyBonusStreak * 10, 200); // Max 200 bonus
  const totalBonus = baseBonus + streakBonus;
  
  this.addStars(totalBonus, 'daily_bonus');
  
  return totalBonus;
};

// Static method to find by referral code
userSchema.statics.findByReferralCode = function(code) {
  return this.findOne({ referralCode: code });
};

// Static method to get leaderboard
userSchema.statics.getLeaderboard = function(limit = 100) {
  return this.find({ isActive: true })
    .sort({ starsBalance: -1 })
    .limit(limit)
    .select('username firstName lastName avatar starsBalance level')
    .lean();
};

module.exports = mongoose.model('User', userSchema); 