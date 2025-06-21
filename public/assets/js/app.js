// StarFlow Main Application
class StarFlowApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'home';
        this.gameSession = null;
        this.socket = null;
        this.notifications = [];
        
        // Telegram WebApp integration
        this.telegramWebApp = null;
        this.isTelegramWebApp = false;
        
        this.init();
    }

    async init() {
        console.log('🚀 StarFlow инициализация...');
        
        // Initialize Telegram WebApp if available
        this.initTelegramWebApp();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize UI components
        this.initUI();
        
        // Check authentication
        await this.checkAuth();
        
        // Initialize socket connection
        this.initSocket();
        
        // Hide loading screen
        this.hideLoadingScreen();
        
        console.log('✅ StarFlow готов к работе');
    }

    initTelegramWebApp() {
        // Check if running inside Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            this.telegramWebApp = window.Telegram.WebApp;
            this.isTelegramWebApp = true;
            
            // Configure Telegram WebApp
            this.telegramWebApp.ready();
            this.telegramWebApp.expand();
            
            // Set theme colors
            this.telegramWebApp.setHeaderColor(CONFIG.APP.THEME.PRIMARY_COLOR);
            this.telegramWebApp.setBackgroundColor('#1a1a1a');
            
            // Handle Telegram WebApp events
            this.telegramWebApp.onEvent('mainButtonClicked', () => {
                this.handleTelegramMainButton();
            });
            
            this.telegramWebApp.onEvent('backButtonClicked', () => {
                this.handleTelegramBackButton();
            });
            
            // Get user data from Telegram
            const telegramUser = this.telegramWebApp.initDataUnsafe?.user;
            if (telegramUser) {
                this.handleTelegramUser(telegramUser);
            }
            
            console.log('📱 Telegram WebApp инициализирован');
        }
    }

    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.navigateTo(e.target.dataset.page);
            }
        });

        // Auth modal
        document.getElementById('auth-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') {
                this.closeAuthModal();
            }
        });

        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchAuthTab(tab.dataset.tab);
            });
        });

        // Forms
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e.target);
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e.target);
        });

        // Games
        document.getElementById('clicker-button')?.addEventListener('click', () => {
            this.handleClickerClick();
        });

        document.getElementById('daily-bonus-btn')?.addEventListener('click', () => {
            this.claimDailyBonus();
        });

        // User menu
        document.getElementById('user-avatar')?.addEventListener('click', () => {
            this.toggleUserMenu();
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                this.closeUserMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    initUI() {
        // Update UI based on authentication status
        this.updateUI();
        
        // Initialize tooltips and other UI components
        this.initTooltips();
        
        // Set up periodic updates
        setInterval(() => {
            if (this.currentUser) {
                this.updateBalance();
                this.updateDailyBonusTimer();
            }
        }, 30000); // Update every 30 seconds
    }

    async checkAuth() {
        const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);
        
        if (!token) {
            this.handleUnauthenticated();
            return;
        }

        try {
            const response = await API.getMe();
            this.currentUser = response.user;
            this.handleAuthenticated();
        } catch (error) {
            console.error('Auth check failed:', error);
            this.handleUnauthenticated();
        }
    }

    handleAuthenticated() {
        document.body.classList.add('authenticated');
        this.updateUserDisplay();
        this.updateBalance();
        this.loadUserStats();
        
        // Show main button in Telegram if needed
        if (this.isTelegramWebApp) {
            this.updateTelegramMainButton();
        }
    }

    handleUnauthenticated() {
        document.body.classList.remove('authenticated');
        
        // Auto-login from Telegram if possible
        if (this.isTelegramWebApp && this.telegramWebApp.initDataUnsafe?.user) {
            this.attemptTelegramLogin();
        } else {
            this.showAuthModal();
        }
    }

    async attemptTelegramLogin() {
        try {
            const telegramUser = this.telegramWebApp.initDataUnsafe.user;
            const initData = this.telegramWebApp.initData;
            
            // Try to login with Telegram data
            const response = await API.request('/api/auth/telegram-login', {
                method: 'POST',
                body: {
                    initData,
                    telegramUser
                }
            });
            
            if (response.token) {
                localStorage.setItem(CONFIG.STORAGE.TOKEN, response.token);
                localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(response.user));
                this.currentUser = response.user;
                this.handleAuthenticated();
                this.showNotification(CONFIG.SUCCESS.LOGIN, 'success');
            }
        } catch (error) {
            console.error('Telegram login failed:', error);
            this.showAuthModal();
        }
    }

    initSocket() {
        if (!CONFIG.SOCKET.ENABLED || !this.currentUser) return;

        try {
            this.socket = io(CONFIG.API.BASE_URL, {
                auth: {
                    token: localStorage.getItem(CONFIG.STORAGE.TOKEN)
                },
                reconnection: CONFIG.SOCKET.RECONNECTION,
                reconnectionAttempts: CONFIG.SOCKET.RECONNECTION_ATTEMPTS,
                reconnectionDelay: CONFIG.SOCKET.RECONNECTION_DELAY,
                timeout: CONFIG.SOCKET.TIMEOUT
            });

            this.socket.on('connect', () => {
                console.log('🔌 Socket подключен');
                this.socket.emit('join-room', this.currentUser._id);
            });

            this.socket.on('disconnect', () => {
                console.log('❌ Socket отключен');
            });

            // Handle real-time events
            this.socket.on('stars-received', (data) => {
                this.handleStarsReceived(data);
            });

            this.socket.on('transfer-received', (data) => {
                this.handleTransferReceived(data);
            });

            this.socket.on('gift-received', (data) => {
                this.handleGiftReceived(data);
            });

            this.socket.on('achievement-earned', (data) => {
                this.handleAchievementEarned(data);
            });

        } catch (error) {
            console.error('Socket initialization failed:', error);
        }
    }

    // Navigation
    navigateTo(page) {
        if (this.currentPage === page) return;

        // Hide current page
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Show new page
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            this.currentPage = page;
            
            // Update navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            const activeLink = document.querySelector(`[data-page="${page}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
            
            // Load page data
            this.loadPageData(page);
            
            // Update Telegram WebApp
            if (this.isTelegramWebApp) {
                this.updateTelegramWebApp(page);
            }
        }
    }

    async loadPageData(page) {
        switch (page) {
            case 'games':
                await this.loadGamesData();
                break;
            case 'wallet':
                await this.loadWalletData();
                break;
            case 'exchange':
                await this.loadExchangeData();
                break;
            case 'referral':
                await this.loadReferralData();
                break;
            case 'profile':
                await this.loadProfileData();
                break;
        }
    }

    // Authentication
    async handleLogin(form) {
        const formData = new FormData(form);
        const credentials = {
            login: formData.get('login'),
            password: formData.get('password')
        };

        try {
            this.setFormLoading(form, true);
            const response = await API.login(credentials);
            
            localStorage.setItem(CONFIG.STORAGE.TOKEN, response.token);
            localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(response.user));
            
            this.currentUser = response.user;
            this.closeAuthModal();
            this.handleAuthenticated();
            this.showNotification(CONFIG.SUCCESS.LOGIN, 'success');
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setFormLoading(form, false);
        }
    }

    async handleRegister(form) {
        const formData = new FormData(form);
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            referralCode: formData.get('referralCode') || undefined
        };

        // Validation
        if (userData.password !== formData.get('confirmPassword')) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        try {
            this.setFormLoading(form, true);
            const response = await API.register(userData);
            
            localStorage.setItem(CONFIG.STORAGE.TOKEN, response.token);
            localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(response.user));
            
            this.currentUser = response.user;
            this.closeAuthModal();
            this.handleAuthenticated();
            this.showNotification(CONFIG.SUCCESS.REGISTER, 'success');
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.setFormLoading(form, false);
        }
    }

    logout() {
        localStorage.removeItem(CONFIG.STORAGE.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE.USER);
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.currentUser = null;
        this.handleUnauthenticated();
        this.navigateTo('home');
        this.showNotification('Вы вышли из системы', 'info');
    }

    // Games
    async startClickerGame() {
        try {
            const response = await API.startClickerGame();
            this.gameSession = {
                id: response.sessionId,
                startTime: response.startTime,
                clicks: 0,
                score: 0,
                isActive: true
            };
            
            this.updateClickerUI();
            this.startClickerTimer();
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleClickerClick() {
        if (!this.gameSession || !this.gameSession.isActive) {
            await this.startClickerGame();
            return;
        }

        try {
            const clickData = {
                sessionId: this.gameSession.id,
                clickTime: Date.now()
            };
            
            const response = await API.registerClick(clickData);
            
            this.gameSession.clicks = response.clicks;
            this.gameSession.score = response.totalScore;
            
            this.updateClickerUI();
            this.showClickEffect(response.reward);
            
            // Update Telegram haptic feedback
            if (this.isTelegramWebApp) {
                this.telegramWebApp.HapticFeedback.impactOccurred('light');
            }
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async endClickerGame() {
        if (!this.gameSession) return;

        try {
            const response = await API.endClickerGame({
                sessionId: this.gameSession.id
            });
            
            this.gameSession = null;
            this.updateBalance();
            this.showGameResults(response);
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async claimDailyBonus() {
        try {
            const response = await API.claimDailyBonus();
            
            this.updateBalance();
            this.updateDailyBonusUI();
            this.showNotification(`Получен ежедневный бонус: ${response.bonusAmount} звезд!`, 'success');
            
            // Show achievements if any
            if (response.achievements && response.achievements.length > 0) {
                this.showAchievements(response.achievements);
            }
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // Telegram Integration
    handleTelegramUser(telegramUser) {
        console.log('👤 Telegram пользователь:', telegramUser);
        
        // Store Telegram user data for registration
        localStorage.setItem('telegram_user', JSON.stringify(telegramUser));
    }

    updateTelegramMainButton() {
        if (!this.isTelegramWebApp) return;

        switch (this.currentPage) {
            case 'games':
                this.telegramWebApp.MainButton.setText('🎮 Играть');
                this.telegramWebApp.MainButton.show();
                break;
            case 'wallet':
                this.telegramWebApp.MainButton.setText('💸 Перевести');
                this.telegramWebApp.MainButton.show();
                break;
            default:
                this.telegramWebApp.MainButton.hide();
        }
    }

    handleTelegramMainButton() {
        switch (this.currentPage) {
            case 'games':
                this.handleClickerClick();
                break;
            case 'wallet':
                this.showTransferModal();
                break;
        }
    }

    handleTelegramBackButton() {
        if (this.currentPage !== 'home') {
            this.navigateTo('home');
        }
    }

    updateTelegramWebApp(page) {
        if (!this.isTelegramWebApp) return;

        // Show back button for non-home pages
        if (page !== 'home') {
            this.telegramWebApp.BackButton.show();
        } else {
            this.telegramWebApp.BackButton.hide();
        }

        this.updateTelegramMainButton();
    }

    // UI Updates
    updateUserDisplay() {
        if (!this.currentUser) return;

        const elements = {
            'user-name': this.currentUser.fullName || this.currentUser.username,
            'user-level': `Уровень ${this.currentUser.level}`,
            'user-avatar': this.currentUser.avatar || '/assets/images/default-avatar.png'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'user-avatar') {
                    element.src = value;
                } else {
                    element.textContent = value;
                }
            }
        });
    }

    async updateBalance() {
        try {
            const response = await API.getBalance();
            
            const balanceElement = document.getElementById('stars-balance');
            if (balanceElement) {
                balanceElement.textContent = this.formatNumber(response.balance);
            }
            
            // Update current user data
            if (this.currentUser) {
                this.currentUser.starsBalance = response.balance;
                this.currentUser.level = response.level;
                this.currentUser.experience = response.experience;
            }
            
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    }

    // Real-time event handlers
    handleStarsReceived(data) {
        this.updateBalance();
        this.showNotification(`Получено ${data.amount} звезд от ${data.from}`, 'success');
        
        if (this.isTelegramWebApp) {
            this.telegramWebApp.HapticFeedback.notificationOccurred('success');
        }
    }

    handleTransferReceived(data) {
        this.updateBalance();
        this.showNotification(`Перевод: ${data.amount} звезд от ${data.from}`, 'success');
        
        if (data.message) {
            this.showNotification(`Сообщение: ${data.message}`, 'info');
        }
    }

    handleGiftReceived(data) {
        this.showGiftAnimation(data);
        this.showNotification(`Подарок ${data.gift} от ${data.from}!`, 'success');
        
        if (this.isTelegramWebApp) {
            this.telegramWebApp.HapticFeedback.notificationOccurred('success');
        }
    }

    handleAchievementEarned(data) {
        this.showAchievementNotification(data);
        
        if (this.isTelegramWebApp) {
            this.telegramWebApp.HapticFeedback.notificationOccurred('success');
        }
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-title">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-message">${message}</div>
        `;

        const container = document.getElementById('notifications');
        if (container) {
            container.appendChild(notification);
            
            // Show notification
            setTimeout(() => notification.classList.add('show'), 100);
            
            // Auto remove
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, CONFIG.APP.NOTIFICATIONS.DURATION);
            
            // Manual close
            notification.querySelector('.notification-close').onclick = () => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            };
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    // Modal management
    showAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    closeModals() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    setFormLoading(form, loading) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? 'Загрузка...' : submitBtn.dataset.originalText || 'Отправить';
            if (!loading && !submitBtn.dataset.originalText) {
                submitBtn.dataset.originalText = submitBtn.textContent;
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new StarFlowApp();
});

// Handle Telegram WebApp closing
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.socket) {
        window.app.socket.disconnect();
    }
}); 