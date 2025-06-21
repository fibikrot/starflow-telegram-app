const { Web3 } = require('web3');
const crypto = require('crypto');

class Web3Service {
  constructor() {
    this.web3 = null;
    this.contracts = {};
    // Не инициализируем в конструкторе, чтобы избежать ошибок
  }

  async init() {
    try {
      // Проверяем, есть ли URL провайдера
      const rpcUrl = process.env.WEB3_PROVIDER_URL;
      if (!rpcUrl || rpcUrl.includes('your-project-id')) {
        console.log('⚠️ Web3 провайдер не настроен, Web3 функции отключены');
        return;
      }

      // Initialize Web3 with provider (новый синтаксис для Web3 v4)
      this.web3 = new Web3(rpcUrl);
      
      // Test connection
      await this.web3.eth.getBlockNumber();
      
      // Initialize smart contracts
      await this.initContracts();
      
      console.log('✅ Web3 сервис инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации Web3:', error.message);
      // Continue without Web3 for demo purposes
      this.web3 = null;
    }
  }

  async initContracts() {
    try {
      // USDT Contract (Ethereum mainnet)
      if (process.env.USDT_CONTRACT_ADDRESS && process.env.USDT_CONTRACT_ABI) {
        this.contracts.USDT = new this.web3.eth.Contract(
          JSON.parse(process.env.USDT_CONTRACT_ABI),
          process.env.USDT_CONTRACT_ADDRESS
        );
      }

      // Custom token contract (if any)
      if (process.env.STAR_TOKEN_CONTRACT_ADDRESS && process.env.STAR_TOKEN_CONTRACT_ABI) {
        this.contracts.STAR = new this.web3.eth.Contract(
          JSON.parse(process.env.STAR_TOKEN_CONTRACT_ABI),
          process.env.STAR_TOKEN_CONTRACT_ADDRESS
        );
      }
    } catch (error) {
      console.error('Failed to initialize contracts:', error);
    }
  }

  /**
   * Validate if address is a valid Ethereum address
   */
  isValidAddress(address) {
    if (!address) return false;
    
    // Check if it's a valid Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return false;
    }
    
    // Additional validation using Web3 if available
    if (this.web3) {
      return this.web3.utils.isAddress(address);
    }
    
    return true;
  }

  /**
   * Get ETH balance for address
   */
  async getETHBalance(address) {
    try {
      if (!this.web3 || !this.isValidAddress(address)) {
        return '0';
      }
      
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting ETH balance:', error);
      return '0';
    }
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(address, tokenContract) {
    try {
      if (!this.web3 || !this.isValidAddress(address) || !tokenContract) {
        return '0';
      }
      
      const balance = await tokenContract.methods.balanceOf(address).call();
      const decimals = await tokenContract.methods.decimals().call();
      
      return (balance / Math.pow(10, decimals)).toString();
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }

  /**
   * Get USDT balance
   */
  async getUSDTBalance(address) {
    return this.getTokenBalance(address, this.contracts.USDT);
  }

  /**
   * Send ETH transaction
   */
  async sendETH(fromAddress, toAddress, amount, privateKey) {
    try {
      if (!this.web3) {
        throw new Error('Web3 not initialized');
      }
      
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasLimit = 21000;
      const nonce = await this.web3.eth.getTransactionCount(fromAddress);
      
      const transaction = {
        from: fromAddress,
        to: toAddress,
        value: this.web3.utils.toWei(amount.toString(), 'ether'),
        gas: gasLimit,
        gasPrice: gasPrice,
        nonce: nonce
      };
      
      const signedTx = await this.web3.eth.accounts.signTransaction(transaction, privateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed
      };
    } catch (error) {
      console.error('Error sending ETH:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send ERC-20 token transaction
   */
  async sendToken(fromAddress, toAddress, amount, tokenContract, privateKey) {
    try {
      if (!this.web3 || !tokenContract) {
        throw new Error('Web3 or token contract not initialized');
      }
      
      const decimals = await tokenContract.methods.decimals().call();
      const tokenAmount = (amount * Math.pow(10, decimals)).toString();
      
      const gasPrice = await this.web3.eth.getGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(fromAddress);
      
      const transaction = tokenContract.methods.transfer(toAddress, tokenAmount);
      const gasLimit = await transaction.estimateGas({ from: fromAddress });
      
      const txData = {
        from: fromAddress,
        to: tokenContract.options.address,
        data: transaction.encodeABI(),
        gas: gasLimit,
        gasPrice: gasPrice,
        nonce: nonce
      };
      
      const signedTx = await this.web3.eth.accounts.signTransaction(txData, privateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed
      };
    } catch (error) {
      console.error('Error sending token:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send USDT transaction
   */
  async sendUSDT(fromAddress, toAddress, amount, privateKey) {
    return this.sendToken(fromAddress, toAddress, amount, this.contracts.USDT, privateKey);
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(transaction) {
    try {
      if (!this.web3) {
        throw new Error('Web3 not initialized');
      }
      
      const gasLimit = await this.web3.eth.estimateGas(transaction);
      const gasPrice = await this.web3.eth.getGasPrice();
      
      return {
        gasLimit,
        gasPrice,
        estimatedCost: this.web3.utils.fromWei((gasLimit * gasPrice).toString(), 'ether')
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      return null;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice() {
    try {
      if (!this.web3) return null;
      
      const gasPrice = await this.web3.eth.getGasPrice();
      return {
        wei: gasPrice,
        gwei: this.web3.utils.fromWei(gasPrice, 'gwei'),
        eth: this.web3.utils.fromWei(gasPrice, 'ether')
      };
    } catch (error) {
      console.error('Error getting gas price:', error);
      return null;
    }
  }

  /**
   * Verify signature
   */
  verifySignature(message, signature, address) {
    try {
      if (!this.web3) return false;
      
      const recoveredAddress = this.web3.eth.accounts.recover(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Generate mock transaction hash for demo
   */
  generateMockTxHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Convert Wei to Ether
   */
  weiToEther(wei) {
    if (!this.web3) return '0';
    return this.web3.utils.fromWei(wei.toString(), 'ether');
  }

  /**
   * Convert Ether to Wei
   */
  etherToWei(ether) {
    if (!this.web3) return '0';
    return this.web3.utils.toWei(ether.toString(), 'ether');
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash) {
    try {
      if (!this.web3) return null;
      
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      console.error('Error getting transaction receipt:', error);
      return null;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txHash) {
    try {
      if (!this.web3) return null;
      
      const transaction = await this.web3.eth.getTransaction(txHash);
      return transaction;
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber() {
    try {
      if (!this.web3) return 0;
      
      const blockNumber = await this.web3.eth.getBlockNumber();
      return blockNumber;
    } catch (error) {
      console.error('Error getting block number:', error);
      return 0;
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(txHash, requiredConfirmations = 1) {
    try {
      const receipt = await this.getTransactionReceipt(txHash);
      if (!receipt) return false;
      
      const currentBlock = await this.getCurrentBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      
      return confirmations >= requiredConfirmations;
    } catch (error) {
      console.error('Error checking transaction confirmation:', error);
      return false;
    }
  }

  /**
   * Generate new wallet
   */
  generateWallet() {
    try {
      if (!this.web3) return null;
      
      const account = this.web3.eth.accounts.create();
      return {
        address: account.address,
        privateKey: account.privateKey
      };
    } catch (error) {
      console.error('Error generating wallet:', error);
      return null;
    }
  }

  /**
   * Create payment request
   */
  createPaymentRequest(amount, currency, recipient, memo = '') {
    return {
      id: crypto.randomUUID(),
      amount,
      currency,
      recipient,
      memo,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  /**
   * Validate payment request
   */
  validatePaymentRequest(request) {
    if (!request) return false;
    
    return (
      request.amount > 0 &&
      request.currency &&
      this.isValidAddress(request.recipient) &&
      new Date() < new Date(request.expiresAt)
    );
  }

  /**
   * Mock blockchain transaction processing
   */
  async processTransaction(transactionData) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate success/failure (90% success rate)
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        txHash: this.generateMockTxHash(),
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        gasUsed: Math.floor(Math.random() * 50000) + 21000,
        confirmations: 1
      };
    } else {
      return {
        success: false,
        error: 'Transaction failed: Insufficient gas or network error'
      };
    }
  }
}

module.exports = new Web3Service(); 