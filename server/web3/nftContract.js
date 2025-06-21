const { Web3 } = require('web3');
require('dotenv').config();

class StarFlowNFT {
    constructor() {
        this.web3 = new Web3(process.env.WEB3_PROVIDER_URL || 'https://rpc-mumbai.maticvigil.com/');
        this.contractAddress = process.env.NFT_CONTRACT_ADDRESS || '0x...';
        this.privateKey = process.env.WALLET_PRIVATE_KEY;
        
        // ABI для ERC-721 NFT контракта StarFlow Stars
        this.contractABI = [
            {
                "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
                "name": "ownerOf",
                "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
                "name": "tokenURI",
                "outputs": [{"internalType": "string", "name": "", "type": "string"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "string", "name": "uri", "type": "string"}
                ],
                "name": "mint",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        if (this.contractAddress !== '0x...') {
            this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
        }

        // Типы NFT звезд
        this.starTypes = {
            BRONZE: {
                name: 'Bronze Star',
                rarity: 'Common',
                requirement: 100,
                image: '🥉⭐',
                description: 'A bronze star for dedicated clickers'
            },
            SILVER: {
                name: 'Silver Star',
                rarity: 'Rare',
                requirement: 1000,
                image: '🥈⭐',
                description: 'A silver star for skilled players'
            },
            GOLD: {
                name: 'Gold Star',
                rarity: 'Epic',
                requirement: 10000,
                image: '🥇⭐',
                description: 'A golden star for elite clickers'
            },
            DIAMOND: {
                name: 'Diamond Star',
                rarity: 'Legendary',
                requirement: 100000,
                image: '💎⭐',
                description: 'A legendary diamond star for masters'
            },
            COSMIC: {
                name: 'Cosmic Star',
                rarity: 'Mythic',
                requirement: 1000000,
                image: '🌌⭐',
                description: 'A mythic cosmic star for legends'
            }
        };
    }

    // Получить баланс NFT пользователя
    async getNFTBalance(userAddress) {
        try {
            if (!this.contract) return '0';
            
            const balance = await this.contract.methods.balanceOf(userAddress).call();
            return balance.toString();
        } catch (error) {
            console.error('Ошибка получения баланса NFT:', error);
            return '0';
        }
    }

    // Получить NFT пользователя
    async getUserNFTs(userAddress) {
        try {
            if (!this.contract) return [];
            
            const balance = await this.contract.methods.balanceOf(userAddress).call();
            const nfts = [];
            
            // В реальном контракте нужен метод tokenOfOwnerByIndex
            // Пока возвращаем мок данные
            for (let i = 0; i < Math.min(balance, 10); i++) {
                nfts.push({
                    tokenId: i + 1,
                    name: this.starTypes.BRONZE.name,
                    image: this.starTypes.BRONZE.image,
                    rarity: this.starTypes.BRONZE.rarity,
                    description: this.starTypes.BRONZE.description
                });
            }
            
            return nfts;
        } catch (error) {
            console.error('Ошибка получения NFT:', error);
            return [];
        }
    }

    // Минт NFT за достижения
    async mintAchievementNFT(userAddress, totalClicks) {
        try {
            // Определяем тип звезды по количеству кликов
            let starType = null;
            
            if (totalClicks >= this.starTypes.COSMIC.requirement) {
                starType = this.starTypes.COSMIC;
            } else if (totalClicks >= this.starTypes.DIAMOND.requirement) {
                starType = this.starTypes.DIAMOND;
            } else if (totalClicks >= this.starTypes.GOLD.requirement) {
                starType = this.starTypes.GOLD;
            } else if (totalClicks >= this.starTypes.SILVER.requirement) {
                starType = this.starTypes.SILVER;
            } else if (totalClicks >= this.starTypes.BRONZE.requirement) {
                starType = this.starTypes.BRONZE;
            }

            if (!starType) {
                return {
                    success: false,
                    message: 'Недостаточно кликов для получения NFT'
                };
            }

            // Создаем метаданные NFT
            const metadata = {
                name: starType.name,
                description: starType.description,
                image: starType.image,
                attributes: [
                    {
                        trait_type: 'Rarity',
                        value: starType.rarity
                    },
                    {
                        trait_type: 'Clicks Required',
                        value: starType.requirement
                    },
                    {
                        trait_type: 'Achievement Date',
                        value: new Date().toISOString()
                    }
                ]
            };

            // В реальности здесь будет минт через смарт-контракт
            // Пока возвращаем успешный результат
            return {
                success: true,
                tokenId: Math.floor(Math.random() * 10000) + 1,
                starType: starType.name,
                rarity: starType.rarity,
                metadata: metadata,
                message: `Поздравляем! Вы получили ${starType.name}!`
            };

        } catch (error) {
            console.error('Ошибка минта NFT:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Получить информацию о коллекции
    async getCollectionInfo() {
        try {
            return {
                name: 'StarFlow Stars',
                symbol: 'STARS',
                description: 'Коллекционные звезды за достижения в StarFlow',
                totalSupply: '1000', // Мок данные
                floorPrice: '0.01 MATIC',
                volume24h: '5.2 MATIC',
                owners: '234',
                network: 'Polygon Mumbai',
                contractAddress: this.contractAddress
            };
        } catch (error) {
            console.error('Ошибка получения информации о коллекции:', error);
            return null;
        }
    }

    // Получить рыночную стоимость NFT
    async getNFTPrice(rarity) {
        const prices = {
            'Common': 0.01,    // MATIC
            'Rare': 0.05,
            'Epic': 0.1,
            'Legendary': 0.5,
            'Mythic': 1.0
        };

        return prices[rarity] || 0.01;
    }

    // Проверить, может ли пользователь получить новый NFT
    canMintNFT(totalClicks, userNFTs) {
        const userRarities = userNFTs.map(nft => nft.rarity);
        
        for (const [key, starType] of Object.entries(this.starTypes)) {
            if (totalClicks >= starType.requirement && !userRarities.includes(starType.rarity)) {
                return {
                    canMint: true,
                    starType: starType,
                    message: `Вы можете получить ${starType.name}!`
                };
            }
        }

        return {
            canMint: false,
            message: 'Продолжайте кликать для получения новых NFT!'
        };
    }

    // Получить статистику NFT
    async getNFTStats() {
        return {
            totalMinted: 1000,
            totalOwners: 234,
            averagePrice: '0.05 MATIC',
            topSale: '1.5 MATIC',
            rarityDistribution: {
                'Common': 60,    // %
                'Rare': 25,
                'Epic': 10,
                'Legendary': 4,
                'Mythic': 1
            }
        };
    }
}

module.exports = StarFlowNFT; 