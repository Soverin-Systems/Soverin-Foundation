/**
 * JSONFlow Phase 3: Blockchain Adapter
 * 
 * Multi-chain blockchain integration for transactions, NFTs, and smart contracts
 * 
 * Supported chains:
 * - Ethereum (ETH)
 * - Starknet (STARK)
 * - Polygon (MATIC)
 * - Arbitrum
 * - Optimism
 * - Base
 * 
 * Features:
 * - Token transfers
 * - NFT minting with metadata
 * - Smart contract calls
 * - Cross-chain messaging
 * - Gas estimation
 * - Transaction signing
 * - Mock mode for testing
 * 
 * @module blockchain-adapter
 */

const { sha256, keccak256 } = require('./crypto-adapter');

// ============================================================================
// Chain Configurations
// ============================================================================

const CHAIN_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    gasUnit: 'gwei'
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    gasUnit: 'gwei'
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    gasUnit: 'gwei'
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    gasUnit: 'gwei'
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    gasUnit: 'gwei'
  },
  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    gasUnit: 'gwei'
  },
  starknet: {
    chainId: 'SN_MAIN',
    name: 'Starknet',
    symbol: 'STRK',
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
    explorerUrl: 'https://starkscan.co',
    gasUnit: 'fri'
  }
};

// ============================================================================
// Transaction Builder
// ============================================================================

class Transaction {
  constructor(type, params) {
    this.type = type;
    this.params = params;
    this.id = this.generateId();
    this.status = 'pending';
    this.hash = null;
    this.timestamp = Date.now();
  }
  
  generateId() {
    return sha256(`${this.type}:${JSON.stringify(this.params)}:${Date.now()}`).substring(0, 16);
  }
  
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      params: this.params,
      status: this.status,
      hash: this.hash,
      timestamp: this.timestamp
    };
  }
}

// ============================================================================
// Blockchain Adapter
// ============================================================================

class BlockchainAdapter {
  constructor(options = {}) {
    this.mockMode = options.mockMode || false;
    this.defaultChain = options.defaultChain || 'ethereum';
    this.chains = { ...CHAIN_CONFIGS, ...options.chains };
    this.transactions = new Map();
    this.nonces = new Map();
  }
  
  /**
   * Get chain configuration
   */
  getChain(chainName) {
    const chain = this.chains[chainName.toLowerCase()];
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }
    return chain;
  }
  
  /**
   * Transfer tokens
   */
  async transfer(params) {
    const {
      chain = this.defaultChain,
      from,
      to,
      amount,
      token = null, // null for native token
      privateKey
    } = params;
    
    if (this.mockMode) {
      return this.mockTransaction('transfer', params);
    }
    
    const chainConfig = this.getChain(chain);
    
    // Build transaction
    const tx = new Transaction('transfer', {
      chain,
      from,
      to,
      amount,
      token,
      chainId: chainConfig.chainId
    });
    
    // Estimate gas
    const gasEstimate = await this.estimateGas(tx);
    tx.params.gasLimit = gasEstimate.gasLimit;
    tx.params.gasPrice = gasEstimate.gasPrice;
    
    // Sign transaction
    const signedTx = await this.signTransaction(tx, privateKey);
    
    // Submit transaction (mock)
    tx.hash = this.generateTxHash(signedTx);
    tx.status = 'submitted';
    
    this.transactions.set(tx.id, tx);
    
    return {
      transactionId: tx.id,
      hash: tx.hash,
      chain,
      from,
      to,
      amount,
      status: 'submitted',
      explorer: `${chainConfig.explorerUrl}/tx/${tx.hash}`
    };
  }
  
  /**
   * Mint NFT
   */
  async mintNFT(params) {
    const {
      chain = this.defaultChain,
      contract,
      to,
      tokenId = null,
      metadata,
      privateKey
    } = params;
    
    if (this.mockMode) {
      return this.mockTransaction('mint_nft', params);
    }
    
    const chainConfig = this.getChain(chain);
    
    // Upload metadata to IPFS (mock)
    const metadataUri = await this.uploadMetadata(metadata);
    
    // Build transaction
    const tx = new Transaction('mint_nft', {
      chain,
      contract,
      to,
      tokenId: tokenId || this.generateTokenId(),
      metadataUri,
      chainId: chainConfig.chainId
    });
    
    // Estimate gas
    const gasEstimate = await this.estimateGas(tx);
    tx.params.gasLimit = gasEstimate.gasLimit;
    tx.params.gasPrice = gasEstimate.gasPrice;
    
    // Sign transaction
    const signedTx = await this.signTransaction(tx, privateKey);
    
    // Submit transaction
    tx.hash = this.generateTxHash(signedTx);
    tx.status = 'submitted';
    
    this.transactions.set(tx.id, tx);
    
    return {
      transactionId: tx.id,
      hash: tx.hash,
      chain,
      contract,
      to,
      tokenId: tx.params.tokenId,
      metadataUri,
      status: 'submitted',
      explorer: `${chainConfig.explorerUrl}/tx/${tx.hash}`,
      nftUrl: `${chainConfig.explorerUrl}/nft/${contract}/${tx.params.tokenId}`
    };
  }
  
  /**
   * Call smart contract
   */
  async callContract(params) {
    const {
      chain = this.defaultChain,
      contract,
      method,
      args = [],
      value = 0,
      privateKey
    } = params;
    
    if (this.mockMode) {
      return this.mockTransaction('call_contract', params);
    }
    
    const chainConfig = this.getChain(chain);
    
    // Build transaction
    const tx = new Transaction('call_contract', {
      chain,
      contract,
      method,
      args,
      value,
      chainId: chainConfig.chainId
    });
    
    // Estimate gas
    const gasEstimate = await this.estimateGas(tx);
    tx.params.gasLimit = gasEstimate.gasLimit;
    tx.params.gasPrice = gasEstimate.gasPrice;
    
    // Sign transaction
    const signedTx = await this.signTransaction(tx, privateKey);
    
    // Submit transaction
    tx.hash = this.generateTxHash(signedTx);
    tx.status = 'submitted';
    
    this.transactions.set(tx.id, tx);
    
    return {
      transactionId: tx.id,
      hash: tx.hash,
      chain,
      contract,
      method,
      status: 'submitted',
      explorer: `${chainConfig.explorerUrl}/tx/${tx.hash}`
    };
  }
  
  /**
   * Cross-chain execution
   */
  async crossChainExec(params) {
    const {
      sourceChain,
      targetChain,
      bridge,
      action,
      amount,
      recipient,
      privateKey
    } = params;
    
    if (this.mockMode) {
      return this.mockTransaction('cross_chain', params);
    }
    
    const sourceConfig = this.getChain(sourceChain);
    const targetConfig = this.getChain(targetChain);
    
    // Build source transaction (lock/burn)
    const sourceTx = new Transaction('cross_chain_source', {
      chain: sourceChain,
      targetChain,
      bridge,
      action,
      amount,
      recipient,
      chainId: sourceConfig.chainId
    });
    
    // Estimate gas for source
    const sourceGas = await this.estimateGas(sourceTx);
    sourceTx.params.gasLimit = sourceGas.gasLimit;
    sourceTx.params.gasPrice = sourceGas.gasPrice;
    
    // Sign and submit source transaction
    const signedSourceTx = await this.signTransaction(sourceTx, privateKey);
    sourceTx.hash = this.generateTxHash(signedSourceTx);
    sourceTx.status = 'submitted';
    
    // Build target transaction (mint/unlock)
    const targetTx = new Transaction('cross_chain_target', {
      chain: targetChain,
      sourceChain,
      bridge,
      action,
      amount,
      recipient,
      sourceTxHash: sourceTx.hash,
      chainId: targetConfig.chainId
    });
    
    // Store transactions
    this.transactions.set(sourceTx.id, sourceTx);
    this.transactions.set(targetTx.id, targetTx);
    
    return {
      sourceTransaction: {
        id: sourceTx.id,
        hash: sourceTx.hash,
        chain: sourceChain,
        status: 'submitted',
        explorer: `${sourceConfig.explorerUrl}/tx/${sourceTx.hash}`
      },
      targetTransaction: {
        id: targetTx.id,
        chain: targetChain,
        status: 'pending',
        estimatedTime: '5-15 minutes'
      },
      bridge,
      amount,
      recipient
    };
  }
  
  /**
   * Estimate gas for transaction
   */
  async estimateGas(tx) {
    if (this.mockMode) {
      return {
        gasLimit: 21000,
        gasPrice: 30,
        totalCost: '0.00063 ETH'
      };
    }
    
    // Simplified gas estimation
    const baseGas = {
      transfer: 21000,
      mint_nft: 150000,
      call_contract: 100000,
      cross_chain_source: 200000,
      cross_chain_target: 150000
    };
    
    const gasLimit = baseGas[tx.type] || 100000;
    const gasPrice = 30; // 30 gwei
    
    return {
      gasLimit,
      gasPrice,
      totalCost: this.calculateGasCost(gasLimit, gasPrice)
    };
  }
  
  /**
   * Calculate gas cost
   */
  calculateGasCost(gasLimit, gasPrice) {
    const costInGwei = gasLimit * gasPrice;
    const costInEth = costInGwei / 1e9;
    return `${costInEth.toFixed(6)} ETH`;
  }
  
  /**
   * Sign transaction
   */
  async signTransaction(tx, privateKey) {
    // Simplified signing - in production use proper signing
    const txData = JSON.stringify(tx.params);
    const signature = sha256(txData + privateKey);
    
    return {
      ...tx.params,
      signature,
      nonce: this.getNonce(tx.params.from || 'default')
    };
  }
  
  /**
   * Get and increment nonce
   */
  getNonce(address) {
    const current = this.nonces.get(address) || 0;
    this.nonces.set(address, current + 1);
    return current;
  }
  
  /**
   * Generate transaction hash
   */
  generateTxHash(signedTx) {
    return '0x' + keccak256(JSON.stringify(signedTx)).substring(0, 64);
  }
  
  /**
   * Generate token ID for NFT
   */
  generateTokenId() {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }
  
  /**
   * Upload metadata to IPFS (mock)
   */
  async uploadMetadata(metadata) {
    if (this.mockMode) {
      return `ipfs://mock_${sha256(JSON.stringify(metadata)).substring(0, 16)}`;
    }
    
    // Mock IPFS upload
    const hash = sha256(JSON.stringify(metadata));
    return `ipfs://Qm${hash.substring(0, 44)}`;
  }
  
  /**
   * Get transaction status
   */
  async getTransaction(txId) {
    const tx = this.transactions.get(txId);
    if (!tx) {
      return null;
    }
    
    // Simulate confirmation after some time
    if (tx.status === 'submitted' && Date.now() - tx.timestamp > 10000) {
      tx.status = 'confirmed';
    }
    
    return tx.toJSON();
  }
  
  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txId, timeout = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const tx = await this.getTransaction(txId);
      
      if (!tx) {
        throw new Error(`Transaction ${txId} not found`);
      }
      
      if (tx.status === 'confirmed') {
        return tx;
      }
      
      if (tx.status === 'failed') {
        throw new Error(`Transaction ${txId} failed`);
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Transaction ${txId} confirmation timeout`);
  }
  
  /**
   * Get balance
   */
  async getBalance(address, chain = this.defaultChain, token = null) {
    if (this.mockMode) {
      return {
        address,
        chain,
        token,
        balance: '1.5',
        symbol: token || this.getChain(chain).symbol
      };
    }
    
    // Mock balance check
    return {
      address,
      chain,
      token,
      balance: '0.0',
      symbol: token || this.getChain(chain).symbol
    };
  }
  
  /**
   * Get network info
   */
  async getNetworkInfo(chain = this.defaultChain) {
    const chainConfig = this.getChain(chain);
    
    return {
      chain: chainConfig.name,
      chainId: chainConfig.chainId,
      symbol: chainConfig.symbol,
      rpcUrl: chainConfig.rpcUrl,
      explorerUrl: chainConfig.explorerUrl,
      blockNumber: this.mockMode ? 12345678 : null,
      gasPrice: this.mockMode ? '30 gwei' : null
    };
  }
  
  /**
   * Mock transaction (for testing)
   */
  mockTransaction(type, params) {
    const tx = new Transaction(type, params);
    tx.hash = '0x' + sha256(JSON.stringify(params)).substring(0, 64);
    tx.status = 'confirmed';
    
    this.transactions.set(tx.id, tx);
    
    return {
      transactionId: tx.id,
      hash: tx.hash,
      status: 'confirmed',
      ...params
    };
  }
  
  /**
   * Create multi-sig wallet
   */
  async createMultiSig(params) {
    const {
      chain = this.defaultChain,
      owners,
      threshold,
      privateKey
    } = params;
    
    if (this.mockMode) {
      return {
        address: '0x' + sha256(JSON.stringify(owners)).substring(0, 40),
        owners,
        threshold,
        chain
      };
    }
    
    const chainConfig = this.getChain(chain);
    
    // Deploy multi-sig contract
    const tx = new Transaction('create_multisig', {
      chain,
      owners,
      threshold,
      chainId: chainConfig.chainId
    });
    
    const gasEstimate = await this.estimateGas(tx);
    tx.params.gasLimit = gasEstimate.gasLimit;
    tx.params.gasPrice = gasEstimate.gasPrice;
    
    const signedTx = await this.signTransaction(tx, privateKey);
    tx.hash = this.generateTxHash(signedTx);
    tx.status = 'submitted';
    
    this.transactions.set(tx.id, tx);
    
    const walletAddress = '0x' + sha256(tx.hash).substring(0, 40);
    
    return {
      transactionId: tx.id,
      hash: tx.hash,
      address: walletAddress,
      owners,
      threshold,
      chain,
      status: 'submitted',
      explorer: `${chainConfig.explorerUrl}/tx/${tx.hash}`
    };
  }
  
  /**
   * Get transaction history
   */
  async getTransactionHistory(address, chain = this.defaultChain, limit = 10) {
    const txs = Array.from(this.transactions.values())
      .filter(tx => 
        tx.params.chain === chain &&
        (tx.params.from === address || tx.params.to === address)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return txs.map(tx => tx.toJSON());
  }
}

// ============================================================================
// JSONFlow Integration
// ============================================================================

/**
 * Execute chain transfer step
 */
async function executeChainTransfer(step, context, adapter) {
  const { chain, from, to, amount, token, privateKey } = step;
  
  // Resolve values from context
  const resolvedFrom = typeof from === 'string' && from.startsWith('$')
    ? context.variables[from.substring(1)]
    : from;
  
  const resolvedTo = typeof to === 'string' && to.startsWith('$')
    ? context.variables[to.substring(1)]
    : to;
  
  const resolvedKey = typeof privateKey === 'string' && privateKey.startsWith('vault://')
    ? await context.vault.get(privateKey)
    : privateKey;
  
  const result = await adapter.transfer({
    chain,
    from: resolvedFrom,
    to: resolvedTo,
    amount,
    token,
    privateKey: resolvedKey
  });
  
  return result;
}

/**
 * Execute chain mint NFT step
 */
async function executeChainMint(step, context, adapter) {
  const { chain, contract, to, tokenId, metadata, privateKey } = step;
  
  // Resolve values from context
  const resolvedTo = typeof to === 'string' && to.startsWith('$')
    ? context.variables[to.substring(1)]
    : to;
  
  const resolvedMetadata = typeof metadata === 'string' && metadata.startsWith('$')
    ? context.variables[metadata.substring(1)]
    : metadata;
  
  const resolvedKey = typeof privateKey === 'string' && privateKey.startsWith('vault://')
    ? await context.vault.get(privateKey)
    : privateKey;
  
  const result = await adapter.mintNFT({
    chain,
    contract,
    to: resolvedTo,
    tokenId,
    metadata: resolvedMetadata,
    privateKey: resolvedKey
  });
  
  return result;
}

/**
 * Execute chain call step
 */
async function executeChainCall(step, context, adapter) {
  const { chain, contract, method, args, value, privateKey } = step;
  
  // Resolve values from context
  const resolvedArgs = args?.map(arg =>
    typeof arg === 'string' && arg.startsWith('$')
      ? context.variables[arg.substring(1)]
      : arg
  );
  
  const resolvedKey = typeof privateKey === 'string' && privateKey.startsWith('vault://')
    ? await context.vault.get(privateKey)
    : privateKey;
  
  const result = await adapter.callContract({
    chain,
    contract,
    method,
    args: resolvedArgs,
    value,
    privateKey: resolvedKey
  });
  
  return result;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  BlockchainAdapter,
  Transaction,
  CHAIN_CONFIGS,
  executeChainTransfer,
  executeChainMint,
  executeChainCall
};
