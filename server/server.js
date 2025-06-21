#!/usr/bin/env node

/**
 * StarFlow Server Entry Point
 * Основная точка входа для запуска StarFlow приложения
 */

const StarFlowApp = require('./app');

// Handle uncaught exceptions early
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    console.error('Завершение работы...');
    process.exit(1);
});

// Handle unhandled promise rejections early
process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Promise Rejection:', err);
    console.error('Завершение работы...');
    process.exit(1);
});

async function startServer() {
    try {
        console.log('🌟 Запуск StarFlow сервера...');
        console.log(`📅 Время запуска: ${new Date().toISOString()}`);
        console.log(`🔧 Среда: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📦 Node.js версия: ${process.version}`);
        
        // Create and start the application
        const app = new StarFlowApp();
        const port = process.env.PORT || 3000;
        
        await app.start(port);
        
        console.log('🎉 StarFlow сервер успешно запущен!');
        
        // Log important information
        if (process.env.NODE_ENV === 'development') {
            console.log('\n📋 Информация для разработки:');
            console.log(`   🌐 Веб-интерфейс: http://localhost:${port}`);
            console.log(`   📡 API: http://localhost:${port}/api`);
            console.log(`   🏥 Health check: http://localhost:${port}/health`);
            
            if (process.env.TELEGRAM_BOT_TOKEN) {
                const botUsername = process.env.TELEGRAM_BOT_USERNAME;
                if (botUsername) {
                    console.log(`   📱 Telegram WebApp: https://t.me/${botUsername}?startapp`);
                }
            }
            
            console.log('\n🔧 Переменные окружения:');
            console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Установлена' : '❌ Не установлена'}`);
            console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Установлена' : '❌ Не установлена'}`);
            console.log(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлена' : '❌ Не установлена'}`);
            console.log(`   WEB3_PROVIDER_URL: ${process.env.WEB3_PROVIDER_URL ? '✅ Установлена' : '❌ Не установлена'}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

// Start the server
startServer(); 