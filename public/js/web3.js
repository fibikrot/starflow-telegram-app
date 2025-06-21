class Web3Manager {
    constructor() {
        this.userAddress = null;
        this.isConnected = false;
        this.web3 = null;
        this.initializeWeb3();
    }

    async initializeWeb3() {
        try {
            // Проверяем наличие Web3 провайдера
            if (typeof window.ethereum !== 'undefined') {
                this.web3 = new Web3(window.ethereum);
                console.log('Web3 провайдер найден');
                
                // Проверяем, был ли кошелек уже подключен
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.userAddress = accounts[0];
                    this.isConnected = true;
                    this.updateUI();
                }
            } else {
                console.log('Web3 провайдер не найден');
                this.showWeb3Status('Для использования Web3 функций установите MetaMask');
            }
        } catch (error) {
            console.error('Ошибка инициализации Web3:', error);
        }
    }

    async connectWallet() {
        try {
            if (!window.ethereum) {
                this.showWeb3Status('Установите MetaMask для подключения кошелька');
                return false;
            }

            // Запрашиваем подключение к кошельку
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });

            if (accounts.length > 0) {
                this.userAddress = accounts[0];
                this.isConnected = true;
                
                // Переключаемся на Polygon Mumbai Testnet
                await this.switchToPolygon();
                
                this.updateUI();
                this.showWeb3Status(`Кошелек подключен: ${this.formatAddress(this.userAddress)}`);
                
                // Загружаем данные пользователя
                await this.loadUserData();
                
                return true;
            }
        } catch (error) {
            console.error('Ошибка подключения кошелька:', error);
            this.showWeb3Status('Ошибка подключения кошелька');
            return false;
        }
    }

    async switchToPolygon() {
        try {
            // Polygon Mumbai Testnet
            const polygonChainId = '0x13881';
            
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: polygonChainId }],
            });
        } catch (switchError) {
            // Если сеть не добавлена, добавляем её
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x13881',
                            chainName: 'Polygon Mumbai Testnet',
                            nativeCurrency: {
                                name: 'MATIC',
                                symbol: 'MATIC',
                                decimals: 18
                            },
                            rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
                            blockExplorerUrls: ['https://mumbai.polygonscan.com/']
                        }]
                    });
                } catch (addError) {
                    console.error('Ошибка добавления сети:', addError);
                }
            }
        }
    }

    async loadUserData() {
        if (!this.isConnected) return;

        try {
            // Загружаем баланс токенов
            await this.loadTokenBalance();
            
            // Загружаем NFT пользователя
            await this.loadUserNFTs();
            
            // Проверяем доступные NFT для минта
            await this.checkAvailableNFTs();
            
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
    }

    async loadTokenBalance() {
        try {
            const response = await fetch(`/api/web3/token/balance/${this.userAddress}`);
            const data = await response.json();
            
            if (data.success) {
                this.updateTokenBalance(data.balance);
            }
        } catch (error) {
            console.error('Ошибка загрузки баланса токенов:', error);
        }
    }

    async loadUserNFTs() {
        try {
            const response = await fetch(`/api/web3/nft/user/${this.userAddress}`);
            const data = await response.json();
            
            if (data.success) {
                this.updateNFTCollection(data.nfts, data.balance);
            }
        } catch (error) {
            console.error('Ошибка загрузки NFT:', error);
        }
    }

    async checkAvailableNFTs() {
        try {
            const gameData = JSON.parse(localStorage.getItem('starFlowGame')) || {};
            const totalClicks = gameData.totalClicks || 0;
            
            const response = await fetch('/api/web3/nft/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    totalClicks: totalClicks,
                    userAddress: this.userAddress
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.canMint) {
                this.showNFTMintNotification(data.nftType, data.requirement);
            }
        } catch (error) {
            console.error('Ошибка проверки доступных NFT:', error);
        }
    }

    async mintNFT() {
        if (!this.isConnected) {
            this.showWeb3Status('Сначала подключите кошелек');
            return;
        }

        try {
            const gameData = JSON.parse(localStorage.getItem('starFlowGame')) || {};
            const totalClicks = gameData.totalClicks || 0;
            
            const response = await fetch('/api/web3/nft/mint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userAddress: this.userAddress,
                    totalClicks: totalClicks
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showWeb3Status(`NFT успешно получен: ${data.nftType.name}!`);
                await this.loadUserNFTs();
            } else {
                this.showWeb3Status(data.message || 'Ошибка получения NFT');
            }
        } catch (error) {
            console.error('Ошибка минта NFT:', error);
            this.showWeb3Status('Ошибка получения NFT');
        }
    }

    async claimTokenReward() {
        if (!this.isConnected) {
            this.showWeb3Status('Сначала подключите кошелек');
            return;
        }

        try {
            const gameData = JSON.parse(localStorage.getItem('starFlowGame')) || {};
            const stars = gameData.stars || 0;
            const totalClicks = gameData.totalClicks || 0;
            
            if (stars < 100) {
                this.showWeb3Status('Минимум 100 звезд для получения токенов');
                return;
            }
            
            const response = await fetch('/api/web3/token/reward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userAddress: this.userAddress,
                    stars: stars,
                    totalClicks: totalClicks
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showWeb3Status(data.message);
                await this.loadTokenBalance();
                
                // Обнуляем звезды после обмена
                gameData.stars = 0;
                localStorage.setItem('starFlowGame', JSON.stringify(gameData));
                updateStarsDisplay();
            }
        } catch (error) {
            console.error('Ошибка получения токенов:', error);
            this.showWeb3Status('Ошибка получения токенов');
        }
    }

    async loadWeb3Stats() {
        try {
            const response = await fetch('/api/web3/stats');
            const data = await response.json();
            
            if (data.success) {
                this.updateWeb3Stats(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки Web3 статистики:', error);
        }
    }

    updateUI() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const walletInfo = document.getElementById('walletInfo');
        const web3Section = document.getElementById('web3Section');
        
        if (this.isConnected) {
            if (connectBtn) connectBtn.style.display = 'none';
            if (walletInfo) {
                walletInfo.style.display = 'block';
                walletInfo.innerHTML = `
                    <div class="wallet-connected">
                        <span>🔗 ${this.formatAddress(this.userAddress)}</span>
                        <button onclick="web3Manager.disconnectWallet()" class="disconnect-btn">Отключить</button>
                    </div>
                `;
            }
            if (web3Section) web3Section.style.display = 'block';
        } else {
            if (connectBtn) connectBtn.style.display = 'block';
            if (walletInfo) walletInfo.style.display = 'none';
            if (web3Section) web3Section.style.display = 'none';
        }
    }

    updateTokenBalance(balance) {
        const balanceElement = document.getElementById('tokenBalance');
        if (balanceElement) {
            balanceElement.textContent = `${parseFloat(balance).toFixed(2)} STAR`;
        }
    }

    updateNFTCollection(nfts, balance) {
        const nftElement = document.getElementById('nftCollection');
        if (nftElement) {
            nftElement.innerHTML = `
                <h4>Коллекция NFT (${balance})</h4>
                <div class="nft-grid">
                    ${nfts.map(nft => `
                        <div class="nft-item">
                            <div class="nft-image">${nft.image}</div>
                            <div class="nft-name">${nft.name}</div>
                            <div class="nft-rarity">${nft.rarity}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    updateWeb3Stats(stats) {
        const statsElement = document.getElementById('web3Stats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div class="web3-stats">
                    <h4>Web3 Статистика</h4>
                    <div class="stat-item">
                        <span>Токен:</span>
                        <span>${stats.token.name} (${stats.token.symbol})</span>
                    </div>
                    <div class="stat-item">
                        <span>Цена STAR:</span>
                        <span>$${stats.token.price}</span>
                    </div>
                    <div class="stat-item">
                        <span>NFT коллекция:</span>
                        <span>${stats.nft.name}</span>
                    </div>
                    <div class="stat-item">
                        <span>Всего NFT:</span>
                        <span>${stats.nft.stats.totalMinted}</span>
                    </div>
                    <div class="stat-item">
                        <span>Сеть:</span>
                        <span>${stats.network}</span>
                    </div>
                </div>
            `;
        }
    }

    showNFTMintNotification(nftType, requirement) {
        const notification = document.createElement('div');
        notification.className = 'nft-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>🎉 Новый NFT доступен!</h4>
                <p>Вы можете получить: <strong>${nftType.name}</strong></p>
                <p>Редкость: ${nftType.rarity}</p>
                <button onclick="web3Manager.mintNFT()" class="mint-btn">Получить NFT</button>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">✕</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Автоматически скрываем уведомление через 10 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    showWeb3Status(message) {
        const statusElement = document.getElementById('web3Status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.display = 'block';
            
            // Скрываем сообщение через 5 секунд
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    disconnectWallet() {
        this.userAddress = null;
        this.isConnected = false;
        this.updateUI();
        this.showWeb3Status('Кошелек отключен');
    }
}

// Инициализируем Web3 менеджер
const web3Manager = new Web3Manager();

// Загружаем Web3 статистику при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    web3Manager.loadWeb3Stats();
});

// Слушаем изменения аккаунта в MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            web3Manager.disconnectWallet();
        } else {
            web3Manager.userAddress = accounts[0];
            web3Manager.isConnected = true;
            web3Manager.updateUI();
            web3Manager.loadUserData();
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        // Перезагружаем страницу при смене сети
        window.location.reload();
    });
} 