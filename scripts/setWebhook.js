#!/usr/bin/env node

/**
 * Скрипт для установки Telegram Webhook
 * Использование: node scripts/setWebhook.js [URL]
 */

require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7637068885:AAHUnq0htwtwnLGCW00YBjUKIq6RxX9lVvM';
const WEBHOOK_URL = process.argv[2] || process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
    process.exit(1);
}

if (!WEBHOOK_URL) {
    console.error('❌ Укажите URL webhook:');
    console.error('   node scripts/setWebhook.js https://yourdomain.com/webhook/telegram');
    console.error('   или установите WEBHOOK_URL в .env файле');
    process.exit(1);
}

async function setWebhook(url) {
    try {
        const webhookUrl = `${url}/api/telegram/webhook`;
        
        console.log(`🔗 Устанавливаю webhook: ${webhookUrl}`);
        
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query', 'inline_query']
        });

        if (response.data.ok) {
            console.log('✅ Webhook успешно установлен!');
            console.log(`📡 URL: ${webhookUrl}`);
        } else {
            console.error('❌ Ошибка при установке webhook:', response.data);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

async function deleteWebhook() {
    try {
        console.log('🗑️ Удаляю webhook...');
        
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);

        if (response.data.ok) {
            console.log('✅ Webhook успешно удален!');
        } else {
            console.error('❌ Ошибка при удалении webhook:', response.data);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

async function getWebhookInfo() {
    try {
        console.log('ℹ️ Получаю информацию о webhook...');
        
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);

        if (response.data.ok) {
            const info = response.data.result;
            console.log('📋 Информация о webhook:');
            console.log(`  URL: ${info.url || 'Не установлен'}`);
            console.log(`  Статус: ${info.url ? '✅ Активен' : '❌ Не активен'}`);
            console.log(`  Количество обновлений: ${info.pending_update_count}`);
            
            if (info.last_error_date) {
                console.log(`  Последняя ошибка: ${new Date(info.last_error_date * 1000).toLocaleString()}`);
                console.log(`  Сообщение об ошибке: ${info.last_error_message}`);
            }
            
            if (info.allowed_updates) {
                console.log(`  Разрешенные обновления: ${info.allowed_updates.join(', ')}`);
            }
        } else {
            console.error('❌ Ошибка при получении информации:', response.data);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

async function testWebhook(url) {
    try {
        const webhookUrl = `${url}/api/telegram/webhook`;
        
        console.log(`🧪 Тестирую webhook: ${webhookUrl}`);
        
        // Проверяем доступность endpoint
        const testResponse = await axios.get(`${url}/health`);
        
        if (testResponse.status === 200) {
            console.log('✅ Сервер отвечает!');
            await setWebhook(url);
        } else {
            console.log('❌ Сервер не отвечает');
        }
    } catch (error) {
        console.error('❌ Сервер недоступен:', error.message);
    }
}

function printHelp() {
    console.log(`
🤖 Управление Telegram Webhook

Использование:
  node scripts/setWebhook.js <URL>        - Установить webhook
  node scripts/setWebhook.js delete       - Удалить webhook  
  node scripts/setWebhook.js info         - Получить информацию
  node scripts/setWebhook.js test <URL>   - Тестировать и установить

Примеры:
  node scripts/setWebhook.js https://your-app.railway.app
  node scripts/setWebhook.js https://your-app.render.com
  node scripts/setWebhook.js delete
  node scripts/setWebhook.js info
  node scripts/setWebhook.js test https://your-app.railway.app
`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printHelp();
        return;
    }
    
    const command = args[0];
    
    switch (command) {
        case 'delete':
            await deleteWebhook();
            break;
        case 'info':
            await getWebhookInfo();
            break;
        case 'test':
            if (args[1]) {
                await testWebhook(args[1]);
            } else {
                console.log('❌ Укажите URL для тестирования');
            }
            break;
        case 'help':
            printHelp();
            break;
        default:
            if (command.startsWith('http')) {
                await setWebhook(command);
            } else {
                console.log('❌ Неизвестная команда');
                printHelp();
            }
    }
}

if (require.main === module) {
    main();
}

module.exports = { setWebhook, deleteWebhook, getWebhookInfo, testWebhook }; 
main().catch(console.error); 