// UI Helper Functions and Components
class UIManager {
    constructor() {
        this.modals = new Map();
        this.tooltips = new Map();
        this.animations = new Map();
        this.themes = {
            light: {
                primary: '#007AFF',
                background: '#FFFFFF',
                text: '#000000'
            },
            dark: {
                primary: '#0A84FF',
                background: '#1C1C1E',
                text: '#FFFFFF'
            }
        };
        
        this.init();
    }

    init() {
        this.initModals();
        this.initTooltips();
        this.initAnimations();
        this.setupThemeHandling();
        this.setupResponsiveHandling();
    }

    // Modal Management
    initModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            this.modals.set(modal.id, {
                element: modal,
                isOpen: false,
                callbacks: {
                    onOpen: [],
                    onClose: []
                }
            });
        });
    }

    showModal(modalId, options = {}) {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        modal.element.classList.add('show');
        modal.isOpen = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus management
        if (options.focusElement) {
            setTimeout(() => {
                options.focusElement.focus();
            }, 100);
        }
        
        // Execute callbacks
        modal.callbacks.onOpen.forEach(callback => callback());
        
        // Telegram WebApp integration
        if (window.app?.isTelegramWebApp) {
            window.app.telegramWebApp.HapticFeedback.impactOccurred('light');
        }
    }

    hideModal(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.isOpen) return;

        modal.element.classList.remove('show');
        modal.isOpen = false;
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Execute callbacks
        modal.callbacks.onClose.forEach(callback => callback());
    }

    // Tooltip Management
    initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            this.createTooltip(element);
        });
    }

    createTooltip(element) {
        const tooltipText = element.dataset.tooltip;
        const position = element.dataset.tooltipPosition || 'top';
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${position}`;
        tooltip.textContent = tooltipText;
        tooltip.style.display = 'none';
        
        document.body.appendChild(tooltip);
        
        element.addEventListener('mouseenter', () => {
            this.showTooltip(element, tooltip);
        });
        
        element.addEventListener('mouseleave', () => {
            this.hideTooltip(tooltip);
        });
        
        this.tooltips.set(element, tooltip);
    }

    showTooltip(element, tooltip) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch (tooltip.classList.contains('tooltip-bottom') ? 'bottom' : 
               tooltip.classList.contains('tooltip-left') ? 'left' :
               tooltip.classList.contains('tooltip-right') ? 'right' : 'top') {
            case 'bottom':
                top = rect.bottom + 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 8;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 8;
                break;
            default: // top
                top = rect.top - tooltipRect.height - 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
        }
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.display = 'block';
        
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 10);
    }

    hideTooltip(tooltip) {
        tooltip.classList.remove('show');
        setTimeout(() => {
            tooltip.style.display = 'none';
        }, 200);
    }

    // Animation Management
    initAnimations() {
        this.setupScrollAnimations();
        this.setupCounterAnimations();
        this.setupParticleEffects();
    }

    setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    setupCounterAnimations() {
        const counters = document.querySelectorAll('.counter');
        
        counters.forEach(counter => {
            const target = parseInt(counter.dataset.target);
            const duration = parseInt(counter.dataset.duration) || 2000;
            
            this.animateCounter(counter, 0, target, duration);
        });
    }

    animateCounter(element, start, end, duration) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (end - start) * this.easeOutCubic(progress));
            element.textContent = this.formatNumber(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // Particle Effects
    setupParticleEffects() {
        this.particleContainer = document.createElement('div');
        this.particleContainer.className = 'particle-container';
        document.body.appendChild(this.particleContainer);
    }

    createParticle(x, y, type = 'star') {
        const particle = document.createElement('div');
        particle.className = `particle particle-${type}`;
        
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        this.particleContainer.appendChild(particle);
        
        // Animate particle
        const animation = particle.animate([
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-100px) scale(0.5)', opacity: 0 }
        ], {
            duration: 1000,
            easing: 'ease-out'
        });
        
        animation.onfinish = () => {
            particle.remove();
        };
        
        return particle;
    }

    showClickEffect(x, y, reward = 1) {
        // Create multiple particles for better effect
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const offsetX = x + (Math.random() - 0.5) * 40;
                const offsetY = y + (Math.random() - 0.5) * 40;
                this.createParticle(offsetX, offsetY, 'star');
            }, i * 100);
        }
        
        // Show reward text
        this.showRewardText(x, y, `+${reward}`);
    }

    showRewardText(x, y, text) {
        const rewardElement = document.createElement('div');
        rewardElement.className = 'reward-text';
        rewardElement.textContent = text;
        rewardElement.style.left = `${x}px`;
        rewardElement.style.top = `${y}px`;
        
        document.body.appendChild(rewardElement);
        
        const animation = rewardElement.animate([
            { transform: 'translateY(0) scale(0.8)', opacity: 0 },
            { transform: 'translateY(-50px) scale(1)', opacity: 1 },
            { transform: 'translateY(-100px) scale(1.2)', opacity: 0 }
        ], {
            duration: 1500,
            easing: 'ease-out'
        });
        
        animation.onfinish = () => {
            rewardElement.remove();
        };
    }

    // Theme Management
    setupThemeHandling() {
        // Auto-detect Telegram theme
        if (window.Telegram?.WebApp) {
            const tgTheme = window.Telegram.WebApp.colorScheme;
            this.setTheme(tgTheme === 'dark' ? 'dark' : 'light');
            
            // Listen for theme changes
            window.Telegram.WebApp.onEvent('themeChanged', () => {
                const newTheme = window.Telegram.WebApp.colorScheme;
                this.setTheme(newTheme === 'dark' ? 'dark' : 'light');
            });
        } else {
            // Use system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
    }

    setTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) return;
        
        document.documentElement.setAttribute('data-theme', themeName);
        
        // Update CSS custom properties
        Object.entries(theme).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--theme-${key}`, value);
        });
        
        // Store preference
        localStorage.setItem('preferred-theme', themeName);
    }

    // Responsive Handling
    setupResponsiveHandling() {
        const handleResize = () => {
            // Update Telegram WebApp viewport
            if (window.app?.isTelegramWebApp) {
                window.app.telegramWebApp.expand();
            }
            
            // Update UI components
            this.updateResponsiveComponents();
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    updateResponsiveComponents() {
        // Update modal positions
        this.modals.forEach(modal => {
            if (modal.isOpen) {
                this.repositionModal(modal.element);
            }
        });
        
        // Update tooltip positions
        this.tooltips.forEach((tooltip, element) => {
            if (tooltip.style.display === 'block') {
                this.showTooltip(element, tooltip);
            }
        });
    }

    repositionModal(modal) {
        // Center modal on screen
        const rect = modal.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        if (rect.height > viewportHeight * 0.9) {
            modal.style.height = `${viewportHeight * 0.9}px`;
            modal.style.overflowY = 'auto';
        }
        
        if (rect.width > viewportWidth * 0.9) {
            modal.style.width = `${viewportWidth * 0.9}px`;
        }
    }

    // Loading States
    showLoading(element, text = 'Загрузка...') {
        element.classList.add('loading');
        element.disabled = true;
        
        const originalText = element.textContent;
        element.dataset.originalText = originalText;
        element.textContent = text;
        
        return () => {
            element.classList.remove('loading');
            element.disabled = false;
            element.textContent = originalText;
        };
    }

    // Form Validation
    validateForm(form) {
        const errors = [];
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        
        inputs.forEach(input => {
            if (!input.value.trim()) {
                errors.push(`Поле "${input.placeholder || input.name}" обязательно для заполнения`);
                input.classList.add('error');
            } else {
                input.classList.remove('error');
            }
            
            // Email validation
            if (input.type === 'email' && input.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    errors.push('Введите корректный email адрес');
                    input.classList.add('error');
                }
            }
            
            // Password validation
            if (input.type === 'password' && input.value) {
                if (input.value.length < 6) {
                    errors.push('Пароль должен содержать минимум 6 символов');
                    input.classList.add('error');
                }
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Utility Functions
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    // Clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Скопировано в буфер обмена', 'success');
            
            // Telegram haptic feedback
            if (window.app?.isTelegramWebApp) {
                window.app.telegramWebApp.HapticFeedback.notificationOccurred('success');
            }
            
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showNotification('Не удалось скопировать', 'error');
            return false;
        }
    }

    // Share functionality
    async share(data) {
        if (navigator.share && /Android|iPhone/i.test(navigator.userAgent)) {
            try {
                await navigator.share(data);
                return true;
            } catch (error) {
                console.error('Share failed:', error);
            }
        }
        
        // Fallback to copying link
        if (data.url) {
            return await this.copyToClipboard(data.url);
        }
        
        return false;
    }

    showNotification(message, type = 'info', duration = 3000) {
        if (window.app) {
            window.app.showNotification(message, type);
        }
    }
}

// Initialize UI Manager
window.UI = new UIManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 