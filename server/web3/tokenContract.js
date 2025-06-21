const { Web3 } = require('web3');
require('dotenv').config();

class StarFlowToken {
    constructor() {
        // Используем Polygon Mumbai Testnet для быстрых и дешевых транзакций
        this.web3 = new Web3(process.env.WEB3_PROVIDER_URL || 'https://rpc-mumbai.maticvigil.com/');
        this.contractAddress = process.env.TOKEN_CONTRACT_ADDRESS || '0x...'; // Будет заполнено после деплоя
        this.privateKey = process.env.WALLET_PRIVATE_KEY;
        
        // ABI для ERC-20 токена StarFlow (STAR)
        this.contractABI = [
            {
                "inputs": [],
                "name": "name",
                "outputs": [{"internalType": "string", "name": "", "type": "string"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "symbol",
                "outputs": [{"internalType": "string", "name": "", "type": "string"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"}
                ],
                "name": "transfer",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"}
                ],
                "name": "mint",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];

        if (this.contractAddress !== '0x...') {
            this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
        }
    }

    // Получить баланс токенов пользователя
    async getBalance(userAddress) {
        try {
            if (!this.contract) return '0';
            
            const balance = await this.contract.methods.balanceOf(userAddress).call();
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            return '0';
        }
    }

    // Минт токенов пользователю (за игровые достижения)
    async mintTokens(userAddress, amount) {
        try {
            if (!this.contract || !this.privateKey) {
                throw new Error('Контракт или приватный ключ не настроены');
            }

            const account = this.web3.eth.accounts.privateKeyToAccount(this.privateKey);
            this.web3.eth.accounts.wallet.add(account);

            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            
            const gasEstimate = await this.contract.methods.mint(userAddress, amountWei).estimateGas({
                from: account.address
            });

            const tx = await this.contract.methods.mint(userAddress, amountWei).send({
                from: account.address,
                gas: gasEstimate,
                gasPrice: await this.web3.eth.getGasPrice()
            });

            return {
                success: true,
                txHash: tx.transactionHash,
                amount: amount
            };
        } catch (error) {
            console.error('Ошибка минта токенов:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Перевод токенов между пользователями
    async transferTokens(fromPrivateKey, toAddress, amount) {
        try {
            if (!this.contract) {
                throw new Error('Контракт не настроен');
            }

            const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
            this.web3.eth.accounts.wallet.add(fromAccount);

            const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');
            
            const gasEstimate = await this.contract.methods.transfer(toAddress, amountWei).estimateGas({
                from: fromAccount.address
            });

            const tx = await this.contract.methods.transfer(toAddress, amountWei).send({
                from: fromAccount.address,
                gas: gasEstimate,
                gasPrice: await this.web3.eth.getGasPrice()
            });

            return {
                success: true,
                txHash: tx.transactionHash,
                amount: amount
            };
        } catch (error) {
            console.error('Ошибка перевода токенов:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Получить информацию о токене
    async getTokenInfo() {
        try {
            if (!this.contract) {
                return {
                    name: 'StarFlow Token',
                    symbol: 'STAR',
                    totalSupply: '0',
                    network: 'Polygon Mumbai Testnet'
                };
            }

            const [name, symbol, totalSupply] = await Promise.all([
                this.contract.methods.name().call(),
                this.contract.methods.symbol().call(),
                this.contract.methods.totalSupply().call()
            ]);

            return {
                name,
                symbol,
                totalSupply: this.web3.utils.fromWei(totalSupply, 'ether'),
                network: 'Polygon Mumbai Testnet',
                contractAddress: this.contractAddress
            };
        } catch (error) {
            console.error('Ошибка получения информации о токене:', error);
            return {
                name: 'StarFlow Token',
                symbol: 'STAR',
                totalSupply: '0',
                network: 'Polygon Mumbai Testnet',
                error: error.message
            };
        }
    }

    // Создать кошелек для пользователя
    createWallet() {
        try {
            const account = this.web3.eth.accounts.create();
            return {
                address: account.address,
                privateKey: account.privateKey
            };
        } catch (error) {
            console.error('Ошибка создания кошелька:', error);
            return null;
        }
    }

    // Получить курс STAR к USD (мок функция)
    async getStarPrice() {
        // В реальности здесь будет API биржи или оракула
        return {
            price: 0.01, // $0.01 за 1 STAR
            change24h: '+5.2%',
            marketCap: '1,000,000',
            volume24h: '50,000'
        };
    }
}

module.exports = StarFlowToken; 