// StarFlow Application Configuration
const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: window.location.origin,
        ENDPOINTS: {
            // Authentication
            LOGIN: '/api/auth/login',
            REGISTER: '/api/auth/register',
            ME: '/api/auth/me',
            REFRESH: '/api/auth/refresh-token',
            LOGOUT: '/api/auth/logout',
            
            // User Profile
            PROFILE: '/api/auth/profile',
            CHANGE_PASSWORD: '/api/auth/change-password',
            STATS: '/api/auth/stats',
            
            // Stars & Wallet
            BALANCE: '/api/stars/balance',
            HISTORY: '/api/stars/history',
            TRANSFER: '/api/stars/transfer',
            GIFT: '/api/stars/gift',
            STARS_STATS: '/api/stars/stats',
            
            // Games
            GAMES_START: '/api/games/clicker/start',
            GAMES_CLICK: '/api/games/clicker/click',
            GAMES_END: '/api/games/clicker/end',
            DAILY_BONUS: '/api/games/daily-bonus',
            LEADERBOARD: '/api/games/leaderboard',
            ACHIEVEMENTS: '/api/games/achievements',
            
            // Web3 & Exchange
            CONNECT_WALLET: '/api/web3/connect-wallet',
            DISCONNECT_WALLET: '/api/web3/disconnect-wallet',
            EXCHANGE_RATES: '/api/web3/exchange-rates',
            EXCHANGE: '/api/web3/exchange',
            EXCHANGE_HISTORY: '/api/web3/exchange-history',
            WALLET_INFO: '/api/web3/wallet-info',
            
            // Telegram
            TELEGRAM_STATUS: '/api/telegram/status',
            TELEGRAM_SEND_VERIFICATION: '/api/telegram/send-verification',
            TELEGRAM_VERIFY_LINK: '/api/telegram/verify-link',
            TELEGRAM_UNLINK: '/api/telegram/unlink',
            TELEGRAM_TEST: '/api/telegram/test-notification',
            TELEGRAM_BOT_INFO: '/api/telegram/bot-info',
            
            // Admin (if user has admin role)
            ADMIN_DASHBOARD: '/api/admin/dashboard',
            ADMIN_USERS: '/api/admin/users',
            ADMIN_TRANSACTIONS: '/api/admin/transactions',
            ADMIN_ANALYTICS: '/api/admin/analytics',
            ADMIN_BROADCAST: '/api/admin/broadcast'
        },
        TIMEOUT: 30000, // 30 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000 // 1 second
    },

    // Application Settings
    APP: {
        NAME: 'StarFlow',
        VERSION: '1.0.0',
        DESCRIPTION: 'Web3 Экосистема с Внутренней Валютой',
        AUTHOR: 'StarFlow Team',
        
        // Features
        FEATURES: {
            GAMES: true,
            WEB3: true,
            TELEGRAM: true,
            REFERRALS: true,
            ADMIN: false // Will be set based on user role
        },
        
        // UI Settings
        THEME: {
            PRIMARY_COLOR: '#6366f1',
            SECONDARY_COLOR: '#8b5cf6',
            ACCENT_COLOR: '#fbbf24',
            SUCCESS_COLOR: '#10b981',
            ERROR_COLOR: '#ef4444',
            WARNING_COLOR: '#f59e0b'
        },
        
        // Animation Settings
        ANIMATIONS: {
            DURATION: 300,
            EASING: 'ease-in-out',
            DISABLED: false
        },
        
        // Notification Settings
        NOTIFICATIONS: {
            POSITION: 'top-right',
            DURATION: 5000,
            MAX_NOTIFICATIONS: 5
        }
    },

    // Game Configuration
    GAMES: {
        CLICKER: {
            MAX_CLICKS_PER_SECOND: 20,
            SESSION_DURATION: 30000, // 30 seconds
            BASE_REWARD: 1,
            COMBO_MULTIPLIER: 1.5,
            PERFECT_CLICK_BONUS: 2
        },
        
        DAILY_BONUS: {
            BASE_AMOUNT: 50,
            STREAK_MULTIPLIER: 1.1,
            MAX_STREAK_BONUS: 5
        },
        
        ACHIEVEMENTS: {
            REFRESH_INTERVAL: 60000 // 1 minute
        }
    },

    // Web3 Configuration
    WEB3: {
        SUPPORTED_NETWORKS: {
            1: 'Ethereum Mainnet',
            56: 'Binance Smart Chain',
            137: 'Polygon',
            43114: 'Avalanche'
        },
        
        SUPPORTED_WALLETS: [
            'MetaMask',
            'WalletConnect',
            'Coinbase Wallet',
            'Trust Wallet'
        ],
        
        EXCHANGE: {
            MIN_STARS: 100,
            SUPPORTED_CURRENCIES: ['ETH', 'BTC', 'USDT', 'BNB', 'MATIC'],
            RATES_REFRESH_INTERVAL: 30000 // 30 seconds
        },
        
        TRANSACTION: {
            CONFIRMATION_BLOCKS: 3,
            TIMEOUT: 300000 // 5 minutes
        }
    },

    // Telegram Configuration
    TELEGRAM: {
        BOT_USERNAME: 'StarFlowBot',
        VERIFICATION_CODE_LENGTH: 6,
        VERIFICATION_TIMEOUT: 600000, // 10 minutes
        
        NOTIFICATIONS: {
            STARS_RECEIVED: true,
            TRANSFERS: true,
            EXCHANGES: true,
            DAILY_REMINDERS: true,
            ACHIEVEMENTS: true
        }
    },

    // Referral System
    REFERRAL: {
        BONUS_AMOUNT: 100,
        REFERRAL_BONUS: 50,
        COMMISSION_RATE: 0.05, // 5%
        CODE_LENGTH: 8
    },

    // Local Storage Keys
    STORAGE: {
        TOKEN: 'starflow_token',
        USER: 'starflow_user',
        SETTINGS: 'starflow_settings',
        THEME: 'starflow_theme',
        LANGUAGE: 'starflow_language',
        GAME_STATE: 'starflow_game_state',
        NOTIFICATIONS: 'starflow_notifications'
    },

    // Socket.IO Configuration
    SOCKET: {
        ENABLED: true,
        RECONNECTION: true,
        RECONNECTION_ATTEMPTS: 5,
        RECONNECTION_DELAY: 1000,
        TIMEOUT: 20000,
        
        EVENTS: {
            CONNECT: 'connect',
            DISCONNECT: 'disconnect',
            STARS_RECEIVED: 'stars_received',
            TRANSFER_RECEIVED: 'transfer_received',
            EXCHANGE_UPDATE: 'exchange_update',
            ACHIEVEMENT_EARNED: 'achievement_earned',
            LEADERBOARD_UPDATE: 'leaderboard_update',
            SYSTEM_NOTIFICATION: 'system_notification'
        }
    },

    // Validation Rules
    VALIDATION: {
        USERNAME: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 20,
            PATTERN: /^[a-zA-Z0-9_]+$/
        },
        
        PASSWORD: {
            MIN_LENGTH: 6,
            MAX_LENGTH: 100,
            REQUIRE_UPPERCASE: false,
            REQUIRE_LOWERCASE: false,
            REQUIRE_NUMBERS: false,
            REQUIRE_SYMBOLS: false
        },
        
        EMAIL: {
            PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        
        TRANSFER: {
            MIN_AMOUNT: 1,
            MAX_AMOUNT: 10000,
            MAX_MESSAGE_LENGTH: 100
        },
        
        REFERRAL_CODE: {
            LENGTH: 8,
            PATTERN: /^[A-Z0-9]+$/
        }
    },

    // Error Messages
    ERRORS: {
        NETWORK: 'Ошибка сети. Проверьте подключение к интернету.',
        TIMEOUT: 'Время ожидания истекло. Попробуйте еще раз.',
        UNAUTHORIZED: 'Необходимо войти в систему.',
        FORBIDDEN: 'Недостаточно прав для выполнения действия.',
        NOT_FOUND: 'Запрашиваемый ресурс не найден.',
        VALIDATION: 'Проверьте правильность введенных данных.',
        SERVER: 'Внутренняя ошибка сервера. Попробуйте позже.',
        UNKNOWN: 'Произошла неизвестная ошибка.'
    },

    // Success Messages
    SUCCESS: {
        LOGIN: 'Вход выполнен успешно!',
        REGISTER: 'Регистрация завершена успешно!',
        PROFILE_UPDATED: 'Профиль обновлен!',
        PASSWORD_CHANGED: 'Пароль изменен!',
        TRANSFER_SENT: 'Перевод отправлен!',
        DAILY_BONUS_CLAIMED: 'Ежедневный бонус получен!',
        WALLET_CONNECTED: 'Кошелек подключен!',
        TELEGRAM_LINKED: 'Telegram привязан!',
        SETTINGS_SAVED: 'Настройки сохранены!'
    },

    // Development Settings
    DEV: {
        DEBUG: false,
        MOCK_API: false,
        CONSOLE_LOGS: true,
        PERFORMANCE_MONITORING: false
    },

    // Feature Flags
    FEATURE_FLAGS: {
        BETA_FEATURES: false,
        NEW_GAMES: true,
        ADVANCED_ANALYTICS: false,
        MOBILE_APP_PROMO: false
    },

    // Limits and Quotas
    LIMITS: {
        MAX_TRANSACTIONS_PER_DAY: 100,
        MAX_TRANSFERS_PER_HOUR: 10,
        MAX_GAME_SESSIONS_PER_HOUR: 20,
        MAX_REFERRALS_PER_DAY: 5
    },

    // URLs and Links
    LINKS: {
        WEBSITE: 'https://starflow.app',
        SUPPORT: 'https://support.starflow.app',
        DOCUMENTATION: 'https://docs.starflow.app',
        TELEGRAM: 'https://t.me/StarFlowBot',
        TWITTER: 'https://twitter.com/StarFlowApp',
        DISCORD: 'https://discord.gg/starflow',
        GITHUB: 'https://github.com/starflow-app'
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    CONFIG.DEV.DEBUG = true;
    CONFIG.DEV.CONSOLE_LOGS = true;
    CONFIG.API.TIMEOUT = 10000;
}

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);

// Export for use in other modules
window.CONFIG = CONFIG; 