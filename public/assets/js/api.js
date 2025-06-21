// StarFlow API Service
class APIService {
    constructor() {
        this.baseURL = CONFIG.API.BASE_URL;
        this.timeout = CONFIG.API.TIMEOUT;
        this.retryAttempts = CONFIG.API.RETRY_ATTEMPTS;
        this.retryDelay = CONFIG.API.RETRY_DELAY;
        
        // Request interceptor for auth token
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Add auth token to requests
        this.getAuthHeaders = () => {
            const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);
            return token ? { 'Authorization': `Bearer ${token}` } : {};
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
                ...options.headers
            },
            timeout: this.timeout
        };

        const requestOptions = { ...defaultOptions, ...options };

        if (requestOptions.body && typeof requestOptions.body === 'object') {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }

        let lastError;
        
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                
                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    
                    if (response.status === 401) {
                        this.handleUnauthorized();
                        throw new APIError(errorData.error || 'Unauthorized', 401, errorData.code);
                    }
                    
                    throw new APIError(
                        errorData.error || `HTTP ${response.status}`,
                        response.status,
                        errorData.code
                    );
                }

                return await response.json();
            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    lastError = new APIError(CONFIG.ERRORS.TIMEOUT, 408, 'TIMEOUT');
                } else if (!navigator.onLine) {
                    lastError = new APIError(CONFIG.ERRORS.NETWORK, 0, 'NETWORK_ERROR');
                }

                if (attempt < this.retryAttempts - 1) {
                    await this.delay(this.retryDelay * (attempt + 1));
                }
            }
        }

        throw lastError;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleUnauthorized() {
        localStorage.removeItem(CONFIG.STORAGE.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE.USER);
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }

    // Authentication methods
    async login(credentials) {
        return this.request(CONFIG.API.ENDPOINTS.LOGIN, {
            method: 'POST',
            body: credentials
        });
    }

    async register(userData) {
        return this.request(CONFIG.API.ENDPOINTS.REGISTER, {
            method: 'POST',
            body: userData
        });
    }

    async getMe() {
        return this.request(CONFIG.API.ENDPOINTS.ME);
    }

    async updateProfile(profileData) {
        return this.request(CONFIG.API.ENDPOINTS.PROFILE, {
            method: 'PUT',
            body: profileData
        });
    }

    async changePassword(passwordData) {
        return this.request(CONFIG.API.ENDPOINTS.CHANGE_PASSWORD, {
            method: 'POST',
            body: passwordData
        });
    }

    async refreshToken() {
        return this.request(CONFIG.API.ENDPOINTS.REFRESH, {
            method: 'POST'
        });
    }

    // Stars methods
    async getBalance() {
        return this.request(CONFIG.API.ENDPOINTS.BALANCE);
    }

    async getHistory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`${CONFIG.API.ENDPOINTS.HISTORY}?${queryString}`);
    }

    async transferStars(transferData) {
        return this.request(CONFIG.API.ENDPOINTS.TRANSFER, {
            method: 'POST',
            body: transferData
        });
    }

    async sendGift(giftData) {
        return this.request(CONFIG.API.ENDPOINTS.GIFT, {
            method: 'POST',
            body: giftData
        });
    }

    async getStarsStats(period = '30d') {
        return this.request(`${CONFIG.API.ENDPOINTS.STARS_STATS}?period=${period}`);
    }

    // Games methods
    async startClickerGame() {
        return this.request(CONFIG.API.ENDPOINTS.GAMES_START, {
            method: 'POST'
        });
    }

    async registerClick(clickData) {
        return this.request(CONFIG.API.ENDPOINTS.GAMES_CLICK, {
            method: 'POST',
            body: clickData
        });
    }

    async endClickerGame(sessionData) {
        return this.request(CONFIG.API.ENDPOINTS.GAMES_END, {
            method: 'POST',
            body: sessionData
        });
    }

    async claimDailyBonus() {
        return this.request(CONFIG.API.ENDPOINTS.DAILY_BONUS, {
            method: 'POST'
        });
    }

    async getLeaderboard(type = 'stars', limit = 100) {
        return this.request(`${CONFIG.API.ENDPOINTS.LEADERBOARD}?type=${type}&limit=${limit}`);
    }

    async getAchievements() {
        return this.request(CONFIG.API.ENDPOINTS.ACHIEVEMENTS);
    }

    // Telegram methods
    async getTelegramStatus() {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_STATUS);
    }

    async sendTelegramVerification() {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_SEND_VERIFICATION, {
            method: 'POST'
        });
    }

    async verifyTelegramLink(verificationData) {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_VERIFY_LINK, {
            method: 'POST',
            body: verificationData
        });
    }

    async unlinkTelegram() {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_UNLINK, {
            method: 'POST'
        });
    }

    async testTelegramNotification() {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_TEST, {
            method: 'POST'
        });
    }

    async getTelegramBotInfo() {
        return this.request(CONFIG.API.ENDPOINTS.TELEGRAM_BOT_INFO);
    }

    // Web3 methods
    async connectWallet(walletData) {
        return this.request(CONFIG.API.ENDPOINTS.CONNECT_WALLET, {
            method: 'POST',
            body: walletData
        });
    }

    async disconnectWallet() {
        return this.request(CONFIG.API.ENDPOINTS.DISCONNECT_WALLET, {
            method: 'POST'
        });
    }

    async getExchangeRates() {
        return this.request(CONFIG.API.ENDPOINTS.EXCHANGE_RATES);
    }

    async exchangeStars(exchangeData) {
        return this.request(CONFIG.API.ENDPOINTS.EXCHANGE, {
            method: 'POST',
            body: exchangeData
        });
    }

    async getExchangeHistory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`${CONFIG.API.ENDPOINTS.EXCHANGE_HISTORY}?${queryString}`);
    }

    async getWalletInfo() {
        return this.request(CONFIG.API.ENDPOINTS.WALLET_INFO);
    }

    // User stats
    async getUserStats(period = '30d') {
        return this.request(`${CONFIG.API.ENDPOINTS.STATS}?period=${period}`);
    }
}

// Custom API Error class
class APIError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
    }
}

// Create global API instance
window.API = new APIService();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIService, APIError };
} 