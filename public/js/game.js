// Обновляем функцию сохранения игры
function saveGame() {
    const gameData = {
        stars: stars,
        totalClicks: totalClicks,
        clicksPerSecond: clicksPerSecond,
        achievements: achievements,
        lastSave: Date.now()
    };
    
    localStorage.setItem('starFlowGame', JSON.stringify(gameData));
    
    // Проверяем Web3 интеграцию после сохранения
    if (window.web3Manager && web3Manager.isConnected) {
        web3Manager.checkAvailableNFTs();
    }
}

// Обновляем функцию проверки достижений
function checkAchievements() {
    let newAchievements = 0;
    
    gameAchievements.forEach((achievement, index) => {
        if (!achievements[index] && achievement.condition()) {
            achievements[index] = true;
            newAchievements++;
            
            // Показываем уведомление о достижении
            showAchievementNotification(achievement);
            
            // Проверяем возможность получения NFT при новом достижении
            if (window.web3Manager && web3Manager.isConnected) {
                setTimeout(() => {
                    web3Manager.checkAvailableNFTs();
                }, 1000);
            }
        }
    });
    
    if (newAchievements > 0) {
        updateAchievementsDisplay();
        saveGame();
    }
}

// Добавляем функцию уведомления о достижении
function showAchievementNotification(achievement) {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h4>🎉 Достижение разблокировано!</h4>
            <div class="achievement-info">
                <span class="achievement-icon">${achievement.icon}</span>
                <div>
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.description}</div>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(45deg, #4CAF50, #45a049);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        max-width: 350px;
        animation: slideDown 0.5s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически скрываем уведомление
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.5s ease-out';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 500);
    }, 3000);
}

// Обновляем функцию clickStar для интеграции с Web3
function clickStar() {
    stars++;
    totalClicks++;
    
    // Обновляем отображение
    updateStarsDisplay();
    updateStats();
    
    // Создаем визуальные эффекты
    createFloatingText('+1', '#ffd700');
    createParticles();
    
    // Проверяем достижения
    checkAchievements();
    
    // Сохраняем игру каждые 10 кликов
    if (totalClicks % 10 === 0) {
        saveGame();
    }
    
    // Обновляем CPS
    updateClicksPerSecond();
    
    // Проверяем Web3 возможности каждые 50 кликов
    if (totalClicks % 50 === 0 && window.web3Manager && web3Manager.isConnected) {
        web3Manager.checkAvailableNFTs();
    }
}

// Добавляем функцию для обновления отображения звезд (нужна для Web3)
function updateStarsDisplay() {
    document.getElementById('starsCount').textContent = stars.toLocaleString();
}

// Добавляем CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
    
    .achievement-notification .notification-content {
        text-align: center;
    }
    
    .achievement-info {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
    }
    
    .achievement-name {
        font-weight: bold;
        font-size: 1.1em;
    }
    
    .achievement-desc {
        font-size: 0.9em;
        opacity: 0.9;
    }
`;
document.head.appendChild(style); 