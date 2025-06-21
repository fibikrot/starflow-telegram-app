const express = require('express');
const { asyncHandler, CustomError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Web3Service = require('../services/web3Service');
const axios = require('axios');
const StarFlowToken = require('../web3/tokenContract');
const StarFlowNFT = require('../web3/nftContract');

const router = express.Router();

// Инициализируем контракты
const tokenContract = new StarFlowToken();
const nftContract = new StarFlowNFT();

// @route   POST /api/web3/connect-wallet
// @desc    Connect user's Web3 wallet
// @access  Private
router.post('/connect-wallet', asyncHandler(async (req, res) => {
  const { walletAddress, walletType, signature } = req.body;
  
  if (!walletAddress || !walletType) {
    throw new CustomError('Адрес кошелька и тип обязательны', 400, 'MISSING_WALLET_DATA');
  }
  
  // Validate wallet address format
  if (!Web3Service.isValidAddress(walletAddress)) {
    throw new CustomError('Неверный формат адреса кошелька', 400, 'INVALID_WALLET_ADDRESS');
  }
  
  // Check if wallet is already connected to another user
  const existingUser = await User.findOne({ 
    walletAddress: walletAddress.toLowerCase() 
  });
  
  if (existingUser && existingUser._id.toString() !== req.userId.toString()) {
    throw new CustomError('Этот кошелек уже привязан к другому аккаунту', 400, 'WALLET_ALREADY_CONNECTED');
  }
  
  // Update user's wallet info
  const user = await User.findById(req.userId);
  user.walletAddress = walletAddress.toLowerCase();
  user.walletType = walletType;
  await user.save();
  
  // Give wallet connection bonus
  if (!existingUser) {
    const walletBonus = 100;
    await user.addStars(walletBonus, 'wallet_connect');
    
    await Transaction.createTransaction({
      userId: user._id,
      type: 'earn_admin',
      amount: walletBonus,
      description: 'Бонус за подключение Web3 кошелька',
      metadata: {
        walletAddress: walletAddress.toLowerCase(),
        walletType,
        adminReason: 'wallet_connect_bonus'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  res.json({
    message: 'Кошелек успешно подключен',
    walletAddress: walletAddress.toLowerCase(),
    walletType,
    bonus: existingUser ? 0 : 100
  });
}));

// @route   POST /api/web3/disconnect-wallet
// @desc    Disconnect user's Web3 wallet
// @access  Private
router.post('/disconnect-wallet', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  
  if (!user.walletAddress) {
    throw new CustomError('Кошелек не подключен', 400, 'WALLET_NOT_CONNECTED');
  }
  
  user.walletAddress = undefined;
  user.walletType = undefined;
  await user.save();
  
  res.json({
    message: 'Кошелек отключен'
  });
}));

// @route   GET /api/web3/exchange-rates
// @desc    Get current exchange rates
// @access  Private
router.get('/exchange-rates', asyncHandler(async (req, res) => {
  try {
    // Get rates from CoinGecko or other price API
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'ethereum,tether,bitcoin,the-open-network',
        vs_currencies: 'usd'
      }
    });
    
    const prices = response.data;
    
    // Calculate stars to crypto rates
    const baseStarsToUSD = parseFloat(process.env.EXCHANGE_RATE_STARS_TO_USDT) || 0.01;
    
    const rates = {
      USDT: {
        price: 1, // USDT is pegged to USD
        starsPerToken: Math.floor(1 / baseStarsToUSD),
        minWithdrawal: 100,
        fee: 0.02 // 2%
      },
      ETH: {
        price: prices.ethereum?.usd || 2000,
        starsPerToken: Math.floor(prices.ethereum?.usd / baseStarsToUSD),
        minWithdrawal: 1000,
        fee: 0.03 // 3%
      },
      BTC: {
        price: prices.bitcoin?.usd || 40000,
        starsPerToken: Math.floor(prices.bitcoin?.usd / baseStarsToUSD),
        minWithdrawal: 5000,
        fee: 0.03 // 3%
      },
      TON: {
        price: prices['the-open-network']?.usd || 2,
        starsPerToken: Math.floor((prices['the-open-network']?.usd || 2) / baseStarsToUSD),
        minWithdrawal: 50,
        fee: 0.015 // 1.5%
      }
    };
    
    res.json({
      rates,
      baseStarsToUSD,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    
    // Fallback rates if API fails
    const fallbackRates = {
      USDT: {
        price: 1,
        starsPerToken: 100,
        minWithdrawal: 100,
        fee: 0.02
      },
      ETH: {
        price: 2000,
        starsPerToken: 200000,
        minWithdrawal: 1000,
        fee: 0.03
      },
      BTC: {
        price: 40000,
        starsPerToken: 4000000,
        minWithdrawal: 5000,
        fee: 0.03
      },
      TON: {
        price: 2,
        starsPerToken: 200,
        minWithdrawal: 50,
        fee: 0.015
      }
    };
    
    res.json({
      rates: fallbackRates,
      baseStarsToUSD: 0.01,
      lastUpdated: new Date().toISOString(),
      fallback: true
    });
  }
}));

// @route   POST /api/web3/exchange
// @desc    Exchange stars for cryptocurrency
// @access  Private
router.post('/exchange', asyncHandler(async (req, res) => {
  const { currency, starsAmount } = req.body;
  
  if (!currency || !starsAmount) {
    throw new CustomError('Валюта и количество звезд обязательны', 400, 'MISSING_EXCHANGE_DATA');
  }
  
  if (starsAmount <= 0) {
    throw new CustomError('Количество звезд должно быть положительным', 400, 'INVALID_STARS_AMOUNT');
  }
  
  const user = await User.findById(req.userId);
  
  if (!user.walletAddress) {
    throw new CustomError('Необходимо подключить кошелек', 400, 'WALLET_NOT_CONNECTED');
  }
  
  if (user.starsBalance < starsAmount) {
    throw new CustomError('Недостаточно звезд', 400, 'INSUFFICIENT_STARS');
  }
  
  // Get current exchange rates
  const ratesResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/web3/exchange-rates`);
  const { rates } = ratesResponse.data;
  
  const currencyRate = rates[currency];
  if (!currencyRate) {
    throw new CustomError('Неподдерживаемая валюта', 400, 'UNSUPPORTED_CURRENCY');
  }
  
  if (starsAmount < currencyRate.minWithdrawal) {
    throw new CustomError(`Минимальная сумма для обмена: ${currencyRate.minWithdrawal} звезд`, 400, 'AMOUNT_TOO_SMALL');
  }
  
  // Calculate crypto amount and fee
  const cryptoAmount = starsAmount / currencyRate.starsPerToken;
  const fee = Math.floor(starsAmount * currencyRate.fee);
  const totalDeduction = starsAmount + fee;
  
  if (user.starsBalance < totalDeduction) {
    throw new CustomError(`Недостаточно звезд с учетом комиссии (${fee} звезд)`, 400, 'INSUFFICIENT_STARS_WITH_FEE');
  }
  
  // Create pending transaction
  const exchangeTransaction = await Transaction.create({
    user: user._id,
    type: 'spend_exchange',
    amount: -starsAmount,
    balanceAfter: user.starsBalance - totalDeduction,
    description: `Обмен ${starsAmount} звезд на ${cryptoAmount.toFixed(8)} ${currency}`,
    metadata: {
      exchangeRate: currencyRate.starsPerToken,
      cryptoAmount,
      cryptoCurrency: currency,
      walletAddress: user.walletAddress,
      fee
    },
    status: 'pending',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Create fee transaction
  const feeTransaction = await Transaction.create({
    user: user._id,
    type: 'spend_admin',
    amount: -fee,
    balanceAfter: user.starsBalance - totalDeduction,
    description: `Комиссия за обмен на ${currency}`,
    metadata: {
      adminReason: 'exchange_fee',
      originalExchangeAmount: starsAmount,
      exchangeCurrency: currency
    },
    status: 'pending',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Update user balance temporarily (will be reverted if transaction fails)
  user.starsBalance -= totalDeduction;
  user.totalStarsSpent += totalDeduction;
  await user.save();
  
  // In a real implementation, you would:
  // 1. Send the crypto transaction to the blockchain
  // 2. Wait for confirmation
  // 3. Update transaction status accordingly
  
  // For demo purposes, we'll simulate success after a delay
  setTimeout(async () => {
    try {
      // Simulate blockchain transaction
      const txHash = Web3Service.generateMockTxHash();
      
      exchangeTransaction.status = 'completed';
      exchangeTransaction.metadata.txHash = txHash;
      await exchangeTransaction.save();
      
      feeTransaction.status = 'completed';
      await feeTransaction.save();
      
      // Send real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${user._id}`).emit('exchange-completed', {
          transactionId: exchangeTransaction._id,
          currency,
          amount: cryptoAmount,
          txHash,
          status: 'completed'
        });
      }
    } catch (error) {
      // Revert transaction on failure
      exchangeTransaction.status = 'failed';
      await exchangeTransaction.save();
      
      feeTransaction.status = 'failed';
      await feeTransaction.save();
      
      // Refund user
      user.starsBalance += totalDeduction;
      user.totalStarsSpent -= totalDeduction;
      await user.save();
      
      // Send failure notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${user._id}`).emit('exchange-failed', {
          transactionId: exchangeTransaction._id,
          error: 'Ошибка обработки транзакции'
        });
      }
    }
  }, 5000); // 5 second delay for demo
  
  res.json({
    message: 'Запрос на обмен создан',
    transactionId: exchangeTransaction._id,
    starsAmount,
    cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
    currency,
    fee,
    walletAddress: user.walletAddress,
    status: 'pending',
    estimatedTime: '1-5 минут'
  });
}));

// @route   GET /api/web3/exchange-history
// @desc    Get user's exchange history
// @access  Private
router.get('/exchange-history', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const exchanges = await Transaction.find({
    user: req.userId,
    type: 'spend_exchange'
  })
  .sort({ createdAt: -1 })
  .limit(parseInt(limit))
  .skip(skip)
  .lean();
  
  const totalCount = await Transaction.countDocuments({
    user: req.userId,
    type: 'spend_exchange'
  });
  
  const formattedExchanges = exchanges.map(exchange => ({
    id: exchange._id,
    starsAmount: Math.abs(exchange.amount),
    cryptoAmount: exchange.metadata.cryptoAmount,
    currency: exchange.metadata.cryptoCurrency,
    exchangeRate: exchange.metadata.exchangeRate,
    txHash: exchange.metadata.txHash,
    status: exchange.status,
    createdAt: exchange.createdAt,
    fee: exchange.metadata.fee || 0
  }));
  
  res.json({
    exchanges: formattedExchanges,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalCount,
      hasNext: skip + formattedExchanges.length < totalCount,
      hasPrev: parseInt(page) > 1
    }
  });
}));

// @route   GET /api/web3/transaction/:txId
// @desc    Get exchange transaction details
// @access  Private
router.get('/transaction/:txId', asyncHandler(async (req, res) => {
  const { txId } = req.params;
  
  const transaction = await Transaction.findOne({
    _id: txId,
    user: req.userId,
    type: 'spend_exchange'
  });
  
  if (!transaction) {
    throw new CustomError('Транзакция не найдена', 404, 'TRANSACTION_NOT_FOUND');
  }
  
  res.json({
    id: transaction._id,
    starsAmount: Math.abs(transaction.amount),
    cryptoAmount: transaction.metadata.cryptoAmount,
    currency: transaction.metadata.cryptoCurrency,
    exchangeRate: transaction.metadata.exchangeRate,
    txHash: transaction.metadata.txHash,
    walletAddress: transaction.metadata.walletAddress,
    status: transaction.status,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    fee: transaction.metadata.fee || 0,
    description: transaction.description
  });
}));

// @route   GET /api/web3/wallet-info
// @desc    Get user's wallet information
// @access  Private
router.get('/wallet-info', asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('walletAddress walletType');
  
  if (!user.walletAddress) {
    return res.json({
      connected: false,
      walletAddress: null,
      walletType: null
    });
  }
  
  // Get wallet balance (in a real app, you'd query the blockchain)
  const mockBalance = {
    ETH: '0.0',
    USDT: '0.0',
    BTC: '0.0',
    TON: '0.0'
  };
  
  res.json({
    connected: true,
    walletAddress: user.walletAddress,
    walletType: user.walletType,
    balances: mockBalance,
    lastSync: new Date().toISOString()
  });
}));

// @route   POST /api/web3/estimate-gas
// @desc    Estimate gas fees for transaction
// @access  Private
router.post('/estimate-gas', asyncHandler(async (req, res) => {
  const { currency, amount } = req.body;
  
  if (!currency) {
    throw new CustomError('Валюта обязательна', 400, 'MISSING_CURRENCY');
  }
  
  // Mock gas estimation (in a real app, you'd query the blockchain)
  const gasEstimates = {
    ETH: {
      gasLimit: 21000,
      gasPrice: '20000000000', // 20 gwei
      estimatedFee: 0.0042, // ETH
      estimatedFeeUSD: 8.4
    },
    USDT: {
      gasLimit: 65000,
      gasPrice: '20000000000',
      estimatedFee: 0.013, // ETH
      estimatedFeeUSD: 26
    },
    BTC: {
      bytesSize: 250,
      satPerByte: 10,
      estimatedFee: 0.0000025, // BTC
      estimatedFeeUSD: 0.1
    },
    TON: {
      gasLimit: 10000,
      gasPrice: '1000000000', // 1 nanoTON
      estimatedFee: 0.01, // TON
      estimatedFeeUSD: 0.02
    }
  };
  
  const estimate = gasEstimates[currency];
  if (!estimate) {
    throw new CustomError('Неподдерживаемая валюта', 400, 'UNSUPPORTED_CURRENCY');
  }
  
  res.json({
    currency,
    ...estimate,
    timestamp: new Date().toISOString()
  });
}));

// Получить информацию о токене STAR
router.get('/token/info', async (req, res) => {
    try {
        const tokenInfo = await tokenContract.getTokenInfo();
        const price = await tokenContract.getStarPrice();
        
        res.json({
            success: true,
            token: tokenInfo,
            price: price
        });
    } catch (error) {
        console.error('Ошибка получения информации о токене:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить баланс токенов пользователя
router.get('/token/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const balance = await tokenContract.getBalance(address);
        
        res.json({
            success: true,
            address: address,
            balance: balance,
            symbol: 'STAR'
        });
    } catch (error) {
        console.error('Ошибка получения баланса:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создать новый кошелек
router.post('/wallet/create', async (req, res) => {
    try {
        const wallet = tokenContract.createWallet();
        
        if (!wallet) {
            throw new Error('Не удалось создать кошелек');
        }
        
        res.json({
            success: true,
            address: wallet.address,
            // Приватный ключ НЕ отправляем в продакшене!
            privateKey: process.env.NODE_ENV === 'development' ? wallet.privateKey : 'hidden',
            message: 'Кошелек успешно создан'
        });
    } catch (error) {
        console.error('Ошибка создания кошелька:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить информацию о NFT коллекции
router.get('/nft/collection', async (req, res) => {
    try {
        const collectionInfo = await nftContract.getCollectionInfo();
        const stats = await nftContract.getNFTStats();
        
        res.json({
            success: true,
            collection: collectionInfo,
            stats: stats
        });
    } catch (error) {
        console.error('Ошибка получения информации о коллекции:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить NFT пользователя
router.get('/nft/user/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const nfts = await nftContract.getUserNFTs(address);
        const balance = await nftContract.getNFTBalance(address);
        
        res.json({
            success: true,
            address: address,
            balance: balance,
            nfts: nfts
        });
    } catch (error) {
        console.error('Ошибка получения NFT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Минт NFT за достижение
router.post('/nft/mint', async (req, res) => {
    try {
        const { userAddress, totalClicks } = req.body;
        
        if (!userAddress || !totalClicks) {
            return res.status(400).json({
                success: false,
                error: 'Требуются userAddress и totalClicks'
            });
        }
        
        const result = await nftContract.mintAchievementNFT(userAddress, totalClicks);
        
        res.json(result);
    } catch (error) {
        console.error('Ошибка минта NFT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Проверить возможность получения NFT
router.post('/nft/check', async (req, res) => {
    try {
        const { totalClicks, userAddress } = req.body;
        
        if (!totalClicks) {
            return res.status(400).json({
                success: false,
                error: 'Требуется totalClicks'
            });
        }
        
        const userNFTs = userAddress ? await nftContract.getUserNFTs(userAddress) : [];
        const canMint = nftContract.canMintNFT(totalClicks, userNFTs);
        
        res.json({
            success: true,
            ...canMint
        });
    } catch (error) {
        console.error('Ошибка проверки NFT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить типы звезд и требования
router.get('/nft/star-types', async (req, res) => {
    try {
        res.json({
            success: true,
            starTypes: nftContract.starTypes
        });
    } catch (error) {
        console.error('Ошибка получения типов звезд:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить цену NFT по редкости
router.get('/nft/price/:rarity', async (req, res) => {
    try {
        const { rarity } = req.params;
        const price = await nftContract.getNFTPrice(rarity);
        
        res.json({
            success: true,
            rarity: rarity,
            price: price,
            currency: 'MATIC'
        });
    } catch (error) {
        console.error('Ошибка получения цены NFT:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Награда токенами за игровые достижения
router.post('/token/reward', async (req, res) => {
    try {
        const { userAddress, stars, totalClicks } = req.body;
        
        if (!userAddress || !stars) {
            return res.status(400).json({
                success: false,
                error: 'Требуются userAddress и stars'
            });
        }
        
        // Конвертируем звезды в токены (1 звезда = 0.1 STAR токена)
        const tokensToMint = stars * 0.1;
        
        // В реальности здесь будет минт через смарт-контракт
        // Пока возвращаем мок результат
        const result = {
            success: true,
            userAddress: userAddress,
            starsEarned: stars,
            tokensEarned: tokensToMint,
            totalClicks: totalClicks,
            message: `Вы заработали ${tokensToMint} STAR токенов!`
        };
        
        res.json(result);
    } catch (error) {
        console.error('Ошибка награждения токенами:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить общую статистику Web3
router.get('/stats', async (req, res) => {
    try {
        const tokenInfo = await tokenContract.getTokenInfo();
        const tokenPrice = await tokenContract.getStarPrice();
        const collectionInfo = await nftContract.getCollectionInfo();
        const nftStats = await nftContract.getNFTStats();
        
        res.json({
            success: true,
            token: {
                ...tokenInfo,
                price: tokenPrice
            },
            nft: {
                ...collectionInfo,
                stats: nftStats
            },
            network: 'Polygon Mumbai Testnet'
        });
    } catch (error) {
        console.error('Ошибка получения статистики Web3:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 