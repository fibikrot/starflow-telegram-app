#!/usr/bin/env node

/**
 * Запуск Telegram бота StarFlow
 */

require('dotenv').config();
const StarFlowBot = require('./bot');

async function startBot() {
    console.log('🚀 Запуск StarFlow Telegram бота...');
    console.log('📅 Время запуска:', new Date().toISOString());
    
    const bot = new StarFlowBot();
    
    // Обработка сигналов завершения
    process.on('SIGINT', () => {
        console.log('\n🛑 Получен сигнал SIGINT, останавливаем бота...');
        bot.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Получен сигнал SIGTERM, останавливаем бота...');
        bot.stop();
        process.exit(0);
    });

    // Обработка необработанных ошибок
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Необработанная ошибка Promise:', reason);
    });

    process.on('uncaughtException', (error) => {
        console.error('❌ Необработанная ошибка:', error);
        bot.stop();
        process.exit(1);
    });

    try {
        // Запускаем бота
        bot.init();
        
        console.log('✅ Бот успешно запущен и готов к работе!');
        console.log('💡 Для остановки нажмите Ctrl+C');
        console.log('🔗 Ссылка на бота: https://t.me/star_web3_bot');
        
    } catch (error) {
        console.error('❌ Ошибка запуска бота:', error);
        process.exit(1);
    }
}

// Запускаем бота только если файл запущен напрямую
if (require.main === module) {
    startBot();
}

module.exports = { startBot }; 