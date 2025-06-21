#!/usr/bin/env node

/**
 * Скрипт для установки команд Telegram бота
 */

require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7637068885:AAHUnq0htwtwnLGCW00YBjUKIq6RxX9lVvM';

const commands = [
    {
        command: 'start',
        description: '�� Запустить StarFlow и начать зарабатывать звезды!'
    },
    {
        command: 'play',
        description: '🎮 Открыть игру-кликер'
    },
    {
        command: 'balance',
        description: '💰 Проверить баланс звезд'
    },
    {
        command: 'daily',
        description: '🎁 Получить ежедневный бонус'
    },
    {
        command: 'referral',
        description: '👥 Реферальная программа'
    },
    {
        command: 'wallet',
        description: '💳 Управление кошельком'
    },
    {
        command: 'stats',
        description: '📊 Статистика и достижения'
    },
    {
        command: 'help',
        description: '❓ Помощь и инструкции'
    }
];

async function setBotCommands() {
    try {
        console.log('🤖 Установка команд бота...');
        
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
            commands: commands
        });

        if (response.data.ok) {
            console.log('✅ Команды бота успешно установлены!');
            console.log('📋 Установленные команды:');
            commands.forEach(cmd => {
                console.log(`   /${cmd.command} - ${cmd.description}`);
            });
        } else {
            console.error('❌ Ошибка при установке команд:', response.data);
        }

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

// Также установим описание бота
async function setBotDescription() {
    try {
        const description = '🌟 StarFlow - зарабатывайте звезды, играйте в игры и управляйте криптовалютами!\n\n💫 Кликайте, получайте ежедневные бонусы, приглашайте друзей и обменивайте звезды на реальные деньги!';
        
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
            description: description
        });

        if (response.data.ok) {
            console.log('✅ Описание бота установлено!');
        }
    } catch (error) {
        console.error('❌ Ошибка при установке описания:', error.message);
    }
}

// Установим короткое описание
async function setBotShortDescription() {
    try {
        const shortDescription = '🌟 Зарабатывайте звезды, играйте и управляйте криптовалютами!';
        
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
            short_description: shortDescription
        });

        if (response.data.ok) {
            console.log('✅ Короткое описание бота установлено!');
        }
    } catch (error) {
        console.error('❌ Ошибка при установке короткого описания:', error.message);
    }
}

async function main() {
    console.log('🤖 Настройка Telegram бота...\n');
    
    await setBotCommands();
    await setBotDescription();
    await setBotShortDescription();
    
    console.log('\n🎉 Настройка завершена!');
    console.log('💡 Теперь ваш бот готов к работе!');
}

if (require.main === module) {
    main();
}

module.exports = { setBotCommands, setBotDescription, setBotShortDescription }; 