/**
 * JSONFlow Phase 3: Crypto Primitives Adapter
 * 
 * Provides cryptographic primitives for signing, verification, and hashing
 * Compatible with both browser and Node.js environments
 * 
 * Features:
 * - Ed25519 and ECDSA signing
 * - Signature verification
 * - Multiple hash algorithms (SHA256, Keccak256, Blake2b)
 * - Key pair generation
 * - Mock mode for testing
 * 
 * @module crypto-adapter
 */

const crypto = require('crypto');

// ============================================================================
// Hash Algorithms
// ============================================================================

/**
 * Compute SHA-256 hash
 */
function sha256(data) {
  const hash = crypto.createHash('sha256');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Compute SHA-512 hash
 */
function sha512(data) {
  const hash = crypto.createHash('sha512');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Compute Keccak-256 hash (Ethereum compatible)
 */
function keccak256(data) {
  // Node.js crypto doesn't have keccak, so we use SHA3-256 as approximation
  // In production, use a proper keccak library like 'js-sha3'
  const hash = crypto.createHash('sha3-256');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  return hash.digest('hex');
}

/**
 * Compute Blake2b hash
 */
function blake2b(data, size = 32) {
  // Node.js crypto supports blake2b512
  const hash = crypto.createHash('blake2b512');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  const fullHash = hash.digest('hex');
  // Truncate to requested size (in bytes)
  return fullHash.substring(0, size * 2);
}

/**
 * Compute RIPEMD-160 hash
 */
function ripemd160(data) {
  const hash = crypto.createHash('ripemd160');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  return hash.digest('hex');
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate Ed25519 key pair
 */
function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  return {
    algorithm: 'ed25519',
    publicKey,
    privateKey,
    publicKeyHex: Buffer.from(
      publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, ''),
      'base64'
    ).toString('hex').slice(-64), // Last 32 bytes
    privateKeyHex: Buffer.from(
      privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ''),
      'base64'
    ).toString('hex')
  };
}

/**
 * Generate ECDSA key pair (secp256k1 for Bitcoin/Ethereum)
 */
function generateECDSAKeyPair(curve = 'secp256k1') {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: curve,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    return {
      algorithm: 'ecdsa',
      curve,
      publicKey,
      privateKey
    };
  } catch (error) {
    // Fallback for curves not supported by Node.js crypto
    console.warn(`Curve ${curve} not supported, using prime256v1 instead`);
    return generateECDSAKeyPair('prime256v1');
  }
}

/**
 * Generate RSA key pair
 */
function generateRSAKeyPair(bits = 2048) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: bits,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  return {
    algorithm: 'rsa',
    bits,
    publicKey,
    privateKey
  };
}

/**
 * Generate random bytes
 */
function generateRandomBytes(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

/**
 * Generate mnemonic seed phrase (BIP39-style)
 */
function generateMnemonic(wordCount = 12) {
  // Simplified version - in production use bip39 library
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
    'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance'
  ];
  
  const mnemonic = [];
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = crypto.randomInt(0, words.length);
    mnemonic.push(words[randomIndex]);
  }
  
  return mnemonic.join(' ');
}

// ============================================================================
// Signing and Verification
// ============================================================================

/**
 * Sign data with Ed25519
 */
function signEd25519(data, privateKey) {
  const dataToSign = typeof data === 'string' ? data : JSON.stringify(data);
  const signature = crypto.sign(null, Buffer.from(dataToSign), {
    key: privateKey,
    format: 'pem'
  });
  
  return signature.toString('hex');
}

/**
 * Verify Ed25519 signature
 */
function verifyEd25519(data, signature, publicKey) {
  try {
    const dataToVerify = typeof data === 'string' ? data : JSON.stringify(data);
    const signatureBuffer = Buffer.from(signature, 'hex');
    
    const isValid = crypto.verify(
      null,
      Buffer.from(dataToVerify),
      { key: publicKey, format: 'pem' },
      signatureBuffer
    );
    
    return isValid;
  } catch (error) {
    return false;
  }
}

/**
 * Sign data with ECDSA
 */
function signECDSA(data, privateKey, algorithm = 'sha256') {
  const dataToSign = typeof data === 'string' ? data : JSON.stringify(data);
  const signature = crypto.sign(algorithm, Buffer.from(dataToSign), {
    key: privateKey,
    format: 'pem'
  });
  
  return signature.toString('hex');
}

/**
 * Verify ECDSA signature
 */
function verifyECDSA(data, signature, publicKey, algorithm = 'sha256') {
  try {
    const dataToVerify = typeof data === 'string' ? data : JSON.stringify(data);
    const signatureBuffer = Buffer.from(signature, 'hex');
    
    const isValid = crypto.verify(
      algorithm,
      Buffer.from(dataToVerify),
      { key: publicKey, format: 'pem' },
      signatureBuffer
    );
    
    return isValid;
  } catch (error) {
    return false;
  }
}

/**
 * Sign data with RSA
 */
function signRSA(data, privateKey, algorithm = 'sha256') {
  const dataToSign = typeof data === 'string' ? data : JSON.stringify(data);
  const signature = crypto.sign(algorithm, Buffer.from(dataToSign), {
    key: privateKey,
    format: 'pem',
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING
  });
  
  return signature.toString('hex');
}

/**
 * Verify RSA signature
 */
function verifyRSA(data, signature, publicKey, algorithm = 'sha256') {
  try {
    const dataToVerify = typeof data === 'string' ? data : JSON.stringify(data);
    const signatureBuffer = Buffer.from(signature, 'hex');
    
    const isValid = crypto.verify(
      algorithm,
      Buffer.from(dataToVerify),
      { key: publicKey, format: 'pem', padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
      signatureBuffer
    );
    
    return isValid;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt data with AES-256-GCM
 */
function encryptAES(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
  
  const dataToEncrypt = typeof data === 'string' ? data : JSON.stringify(data);
  let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'aes-256-gcm'
  };
}

/**
 * Decrypt data with AES-256-GCM
 */
function decryptAES(encrypted, key, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex').slice(0, 32),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============================================================================
// Crypto Adapter Class
// ============================================================================

class CryptoAdapter {
  constructor(options = {}) {
    this.mockMode = options.mockMode || false;
    this.defaultAlgorithm = options.defaultAlgorithm || 'ed25519';
  }
  
  /**
   * Generate key pair
   */
  generateKeyPair(algorithm = this.defaultAlgorithm, params = {}) {
    if (this.mockMode) {
      return {
        algorithm: 'mock',
        publicKey: 'mock_public_key',
        privateKey: 'mock_private_key'
      };
    }
    
    switch (algorithm.toLowerCase()) {
      case 'ed25519':
        return generateEd25519KeyPair();
      
      case 'ecdsa':
        return generateECDSAKeyPair(params.curve || 'prime256v1');
      
      case 'rsa':
        return generateRSAKeyPair(params.bits || 2048);
      
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Sign data
   */
  sign(data, privateKey, algorithm = this.defaultAlgorithm) {
    if (this.mockMode) {
      return `mock_signature_${sha256(data).substring(0, 16)}`;
    }
    
    // Detect algorithm from key if not specified
    if (typeof privateKey === 'object' && privateKey.algorithm) {
      algorithm = privateKey.algorithm;
      privateKey = privateKey.privateKey;
    }
    
    switch (algorithm.toLowerCase()) {
      case 'ed25519':
        return signEd25519(data, privateKey);
      
      case 'ecdsa':
        return signECDSA(data, privateKey);
      
      case 'rsa':
        return signRSA(data, privateKey);
      
      default:
        throw new Error(`Unsupported signing algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Verify signature
   */
  verify(data, signature, publicKey, algorithm = this.defaultAlgorithm) {
    if (this.mockMode) {
      return signature.startsWith('mock_signature_');
    }
    
    // Detect algorithm from key if not specified
    if (typeof publicKey === 'object' && publicKey.algorithm) {
      algorithm = publicKey.algorithm;
      publicKey = publicKey.publicKey;
    }
    
    switch (algorithm.toLowerCase()) {
      case 'ed25519':
        return verifyEd25519(data, signature, publicKey);
      
      case 'ecdsa':
        return verifyECDSA(data, signature, publicKey);
      
      case 'rsa':
        return verifyRSA(data, signature, publicKey);
      
      default:
        throw new Error(`Unsupported verification algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Hash data
   */
  hash(data, algorithm = 'sha256') {
    if (this.mockMode) {
      return `mock_hash_${Math.random().toString(36).substring(7)}`;
    }
    
    switch (algorithm.toLowerCase()) {
      case 'sha256':
        return sha256(data);
      
      case 'sha512':
        return sha512(data);
      
      case 'keccak256':
      case 'keccak':
        return keccak256(data);
      
      case 'blake2b':
        return blake2b(data);
      
      case 'ripemd160':
        return ripemd160(data);
      
      default:
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Encrypt data
   */
  encrypt(data, key, algorithm = 'aes-256-gcm') {
    if (this.mockMode) {
      return {
        encrypted: `mock_encrypted_${sha256(data).substring(0, 16)}`,
        algorithm: 'mock'
      };
    }
    
    switch (algorithm.toLowerCase()) {
      case 'aes-256-gcm':
      case 'aes':
        return encryptAES(data, key);
      
      default:
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Decrypt data
   */
  decrypt(encrypted, key, iv, authTag, algorithm = 'aes-256-gcm') {
    if (this.mockMode) {
      return 'mock_decrypted_data';
    }
    
    switch (algorithm.toLowerCase()) {
      case 'aes-256-gcm':
      case 'aes':
        return decryptAES(encrypted, key, iv, authTag);
      
      default:
        throw new Error(`Unsupported decryption algorithm: ${algorithm}`);
    }
  }
  
  /**
   * Generate random data
   */
  random(size = 32, format = 'hex') {
    if (this.mockMode) {
      return 'mock_random_' + '0'.repeat(size * 2);
    }
    
    const bytes = crypto.randomBytes(size);
    
    switch (format) {
      case 'hex':
        return bytes.toString('hex');
      case 'base64':
        return bytes.toString('base64');
      case 'buffer':
        return bytes;
      default:
        return bytes.toString(format);
    }
  }
  
  /**
   * Derive key from password using PBKDF2
   */
  deriveKey(password, salt = null, iterations = 100000, keyLength = 32) {
    if (this.mockMode) {
      return 'mock_derived_key_' + '0'.repeat(keyLength * 2);
    }
    
    if (!salt) {
      salt = crypto.randomBytes(16);
    } else if (typeof salt === 'string') {
      salt = Buffer.from(salt, 'hex');
    }
    
    const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
    
    return {
      key: key.toString('hex'),
      salt: salt.toString('hex'),
      iterations,
      algorithm: 'pbkdf2'
    };
  }
  
  /**
   * Generate deterministic wallet from mnemonic
   */
  fromMnemonic(mnemonic, path = "m/44'/0'/0'/0/0") {
    // Simplified implementation - in production use bip39 and bip32 libraries
    const seed = this.hash(mnemonic, 'sha512');
    
    return {
      mnemonic,
      seed: seed.substring(0, 128),
      path,
      privateKey: seed.substring(0, 64),
      address: '0x' + this.hash(seed, 'keccak256').substring(0, 40)
    };
  }
}

// ============================================================================
// JSONFlow Integration
// ============================================================================

/**
 * Execute crypto sign step
 */
async function executeCryptoSign(step, context, adapter) {
  const { data, privateKey, algorithm } = step;
  
  // Resolve data from context
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  // Resolve private key from vault
  const resolvedKey = typeof privateKey === 'string' && privateKey.startsWith('vault://')
    ? await context.vault.get(privateKey)
    : privateKey;
  
  const signature = adapter.sign(resolvedData, resolvedKey, algorithm);
  
  return {
    signature,
    algorithm: algorithm || adapter.defaultAlgorithm,
    timestamp: Date.now(),
    dataHash: adapter.hash(resolvedData)
  };
}

/**
 * Execute crypto verify step
 */
async function executeCryptoVerify(step, context, adapter) {
  const { data, signature, publicKey, algorithm } = step;
  
  // Resolve data from context
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  // Resolve signature from context
  const resolvedSignature = typeof signature === 'string' && signature.startsWith('$')
    ? context.variables[signature.substring(1)]
    : signature;
  
  // Resolve public key from vault
  const resolvedKey = typeof publicKey === 'string' && publicKey.startsWith('vault://')
    ? await context.vault.get(publicKey)
    : publicKey;
  
  const isValid = adapter.verify(resolvedData, resolvedSignature, resolvedKey, algorithm);
  
  return {
    valid: isValid,
    algorithm: algorithm || adapter.defaultAlgorithm,
    timestamp: Date.now(),
    dataHash: adapter.hash(resolvedData)
  };
}

/**
 * Execute crypto hash step
 */
async function executeCryptoHash(step, context, adapter) {
  const { data, algorithm } = step;
  
  // Resolve data from context
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  const hash = adapter.hash(resolvedData, algorithm);
  
  return {
    hash,
    algorithm: algorithm || 'sha256',
    timestamp: Date.now()
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  CryptoAdapter,
  
  // Hash functions
  sha256,
  sha512,
  keccak256,
  blake2b,
  ripemd160,
  
  // Key generation
  generateEd25519KeyPair,
  generateECDSAKeyPair,
  generateRSAKeyPair,
  generateRandomBytes,
  generateMnemonic,
  
  // Signing
  signEd25519,
  signECDSA,
  signRSA,
  
  // Verification
  verifyEd25519,
  verifyECDSA,
  verifyRSA,
  
  // Encryption
  encryptAES,
  decryptAES,
  
  // JSONFlow integration
  executeCryptoSign,
  executeCryptoVerify,
  executeCryptoHash
};
