const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

class StarFlowApp {
    constructor() {
        this.app = express();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            console.log('🚀 Инициализация StarFlow приложения...');
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            this.initialized = true;
            console.log('✅ StarFlow приложение готово к работе');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации приложения:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Compression
        this.app.use(compression());

        // Simple logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });

        // Static files
        this.app.use(express.static(path.join(__dirname, '../public')));

        // Trust proxy for production
        if (process.env.NODE_ENV === 'production') {
            this.app.set('trust proxy', 1);
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                version: '1.0.0'
            });
        });

        // API test route
        this.app.get('/api/test', (req, res) => {
            res.json({
                success: true,
                message: 'StarFlow API работает!',
                timestamp: new Date().toISOString(),
                telegram_bot: process.env.TELEGRAM_BOT_USERNAME || 'star_web3_bot'
            });
        });

        // Telegram webhook route
        this.app.post('/api/telegram/webhook', (req, res) => {
            console.log('Получен webhook от Telegram:', req.body);
            res.sendStatus(200);
        });

        // Simple auth endpoint for demo
        this.app.post('/api/auth/telegram', (req, res) => {
            const { initData } = req.body;
            
            if (!initData) {
                return res.status(400).json({
                    success: false,
                    message: 'Telegram данные не предоставлены'
                });
            }

            res.json({
                success: true,
                message: 'Telegram аутентификация успешна',
                user: {
                    id: 'demo_user',
                    username: 'demo_user',
                    stars: 100
                }
            });
        });

        // Root route - serve HTML file
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint не найден'
            });
        });
    }

    async start(port = process.env.PORT || 3000) {
        try {
            // Initialize the application first
            await this.init();
            
            return new Promise((resolve) => {
                this.app.listen(port, '0.0.0.0', () => {
                    console.log(`🌟 StarFlow сервер запущен на порту ${port}`);
                    console.log(`🌐 URL: http://localhost:${port}`);
                    
                    if (process.env.TELEGRAM_BOT_USERNAME) {
                        console.log(`📱 Telegram Bot: https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`);
                    }
                    
                    resolve();
                });
            });
        } catch (error) {
            console.error('❌ Ошибка запуска сервера:', error);
            throw error;
        }
    }
}

module.exports = StarFlowApp; 