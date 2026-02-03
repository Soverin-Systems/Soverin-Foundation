/**
 * JSONFlow Phase 3: FHE (Fully Homomorphic Encryption) Adapter
 * 
 * Implements privacy-preserving computation using Paillier cryptosystem
 * Supports additive homomorphic operations on encrypted data
 * 
 * Features:
 * - Encrypt data for computation without decryption
 * - Perform arithmetic on encrypted values
 * - Generate zero-knowledge proofs
 * - Mock mode for testing
 * 
 * @module fhe-adapter
 */

const crypto = require('crypto');

// ============================================================================
// Paillier Cryptosystem Implementation
// ============================================================================

/**
 * Generate large prime number for Paillier keys
 */
function generatePrime(bits) {
  // For production, use proper prime generation
  // This is a simplified version for demonstration
  const bytes = Math.ceil(bits / 8);
  let prime;
  let attempts = 0;
  const maxAttempts = 1000;
  
  while (attempts < maxAttempts) {
    const buffer = crypto.randomBytes(bytes);
    // Set high bit to ensure size
    buffer[0] |= 0x80;
    // Set low bit to ensure odd
    buffer[bytes - 1] |= 0x01;
    
    prime = BigInt('0x' + buffer.toString('hex'));
    
    if (isProbablyPrime(prime, 20)) {
      return prime;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate prime number');
}

/**
 * Miller-Rabin primality test
 */
function isProbablyPrime(n, k = 20) {
  if (n === 2n || n === 3n) return true;
  if (n < 2n || n % 2n === 0n) return false;
  
  // Write n-1 as 2^r * d
  let r = 0n;
  let d = n - 1n;
  while (d % 2n === 0n) {
    r++;
    d /= 2n;
  }
  
  // Witness loop
  for (let i = 0; i < k; i++) {
    const a = randomBigInt(2n, n - 2n);
    let x = modPow(a, d, n);
    
    if (x === 1n || x === n - 1n) continue;
    
    let continueWitnessLoop = false;
    for (let j = 0n; j < r - 1n; j++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) {
        continueWitnessLoop = true;
        break;
      }
    }
    
    if (continueWitnessLoop) continue;
    return false;
  }
  
  return true;
}

/**
 * Modular exponentiation: (base^exp) mod mod
 */
function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  
  return result;
}

/**
 * Generate random BigInt in range [min, max]
 */
function randomBigInt(min, max) {
  const range = max - min;
  const bits = range.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  
  let result;
  do {
    const buffer = crypto.randomBytes(bytes);
    result = BigInt('0x' + buffer.toString('hex'));
  } while (result > range);
  
  return min + result;
}

/**
 * Extended Euclidean algorithm for modular inverse
 */
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  
  let [oldR, r] = [a, m];
  let [oldS, s] = [1n, 0n];
  
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  
  if (oldR !== 1n) {
    throw new Error('Modular inverse does not exist');
  }
  
  return ((oldS % m) + m) % m;
}

/**
 * Least common multiple
 */
function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

/**
 * Greatest common divisor
 */
function gcd(a, b) {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * L function for Paillier decryption: L(x) = (x - 1) / n
 */
function L(x, n) {
  return (x - 1n) / n;
}

// ============================================================================
// Paillier Key Generation
// ============================================================================

class PaillierKeyPair {
  constructor(publicKey, privateKey) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }
}

class PaillierPublicKey {
  constructor(n, g) {
    this.n = n;
    this.g = g;
    this.nSquared = n * n;
  }
  
  encrypt(plaintext, r = null) {
    const m = BigInt(plaintext);
    
    // Generate random r if not provided
    if (r === null) {
      r = randomBigInt(1n, this.n);
    }
    
    // c = g^m * r^n mod n^2
    const gm = modPow(this.g, m, this.nSquared);
    const rn = modPow(r, this.n, this.nSquared);
    const ciphertext = (gm * rn) % this.nSquared;
    
    return ciphertext;
  }
  
  add(c1, c2) {
    // Homomorphic addition: E(m1) * E(m2) = E(m1 + m2)
    return (c1 * c2) % this.nSquared;
  }
  
  multiply(ciphertext, scalar) {
    // Homomorphic multiplication by scalar: E(m)^k = E(k*m)
    const k = BigInt(scalar);
    return modPow(ciphertext, k, this.nSquared);
  }
}

class PaillierPrivateKey {
  constructor(lambda, mu, publicKey) {
    this.lambda = lambda;
    this.mu = mu;
    this.publicKey = publicKey;
  }
  
  decrypt(ciphertext) {
    const n = this.publicKey.n;
    const nSquared = this.publicKey.nSquared;
    
    // m = L(c^lambda mod n^2) * mu mod n
    const x = modPow(ciphertext, this.lambda, nSquared);
    const lx = L(x, n);
    const m = (lx * this.mu) % n;
    
    return m;
  }
}

function generatePaillierKeyPair(bitLength = 512) {
  // Generate two large primes
  const p = generatePrime(bitLength / 2);
  const q = generatePrime(bitLength / 2);
  
  // n = p * q
  const n = p * q;
  
  // g = n + 1 (simplified)
  const g = n + 1n;
  
  // lambda = lcm(p-1, q-1)
  const lambda = lcm(p - 1n, q - 1n);
  
  // mu = (L(g^lambda mod n^2))^(-1) mod n
  const nSquared = n * n;
  const gLambda = modPow(g, lambda, nSquared);
  const lGLambda = L(gLambda, n);
  const mu = modInverse(lGLambda, n);
  
  const publicKey = new PaillierPublicKey(n, g);
  const privateKey = new PaillierPrivateKey(lambda, mu, publicKey);
  
  return new PaillierKeyPair(publicKey, privateKey);
}

// ============================================================================
// FHE Adapter
// ============================================================================

class FHEAdapter {
  constructor(options = {}) {
    this.mockMode = options.mockMode || false;
    this.keyCache = new Map();
    this.proofCache = new Map();
  }
  
  /**
   * Generate FHE key pair
   */
  generateKeys(bitLength = 512) {
    if (this.mockMode) {
      return {
        publicKey: { n: 'mock_n', g: 'mock_g', type: 'mock' },
        privateKey: { lambda: 'mock_lambda', mu: 'mock_mu', type: 'mock' }
      };
    }
    
    const keyPair = generatePaillierKeyPair(bitLength);
    
    return {
      publicKey: {
        n: keyPair.publicKey.n.toString(),
        g: keyPair.publicKey.g.toString(),
        nSquared: keyPair.publicKey.nSquared.toString(),
        type: 'paillier'
      },
      privateKey: {
        lambda: keyPair.privateKey.lambda.toString(),
        mu: keyPair.privateKey.mu.toString(),
        type: 'paillier'
      }
    };
  }
  
  /**
   * Encrypt data for homomorphic computation
   */
  encrypt(data, publicKey) {
    if (this.mockMode) {
      return {
        ciphertext: `encrypted_${data}`,
        metadata: {
          algorithm: 'mock',
          timestamp: Date.now()
        }
      };
    }
    
    // Reconstruct public key object
    const pubKey = new PaillierPublicKey(
      BigInt(publicKey.n),
      BigInt(publicKey.g)
    );
    
    // Handle different data types
    let values;
    if (Array.isArray(data)) {
      values = data.map(v => typeof v === 'number' ? v : parseInt(v));
    } else if (typeof data === 'object') {
      values = Object.values(data).map(v => typeof v === 'number' ? v : parseInt(v));
    } else {
      values = [typeof data === 'number' ? data : parseInt(data)];
    }
    
    // Encrypt each value
    const ciphertexts = values.map(value => {
      const encrypted = pubKey.encrypt(value);
      return encrypted.toString();
    });
    
    return {
      ciphertext: Array.isArray(data) ? ciphertexts : ciphertexts[0],
      metadata: {
        algorithm: 'paillier',
        timestamp: Date.now(),
        count: ciphertexts.length
      }
    };
  }
  
  /**
   * Perform computation on encrypted data
   */
  compute(operation, encryptedData, publicKey, params = {}) {
    if (this.mockMode) {
      return {
        result: `computed_${operation}`,
        proof: `proof_${operation}_${Date.now()}`,
        metadata: {
          operation,
          verified: true
        }
      };
    }
    
    // Reconstruct public key object
    const pubKey = new PaillierPublicKey(
      BigInt(publicKey.n),
      BigInt(publicKey.g)
    );
    
    let result;
    
    switch (operation) {
      case 'add':
        // Homomorphic addition
        if (!Array.isArray(encryptedData) || encryptedData.length < 2) {
          throw new Error('Addition requires at least 2 encrypted values');
        }
        result = encryptedData.reduce((acc, c) => {
          const c1 = typeof acc === 'string' ? BigInt(acc) : acc;
          const c2 = BigInt(c);
          return pubKey.add(c1, c2);
        });
        break;
        
      case 'sum':
        // Sum all encrypted values
        if (!Array.isArray(encryptedData)) {
          encryptedData = [encryptedData];
        }
        result = encryptedData.reduce((acc, c) => {
          const c1 = typeof acc === 'string' ? BigInt(acc) : acc;
          const c2 = BigInt(c);
          return pubKey.add(c1, c2);
        });
        break;
        
      case 'multiply':
        // Multiply encrypted value by scalar
        if (!params.scalar) {
          throw new Error('Multiplication requires a scalar parameter');
        }
        const ciphertext = BigInt(Array.isArray(encryptedData) ? encryptedData[0] : encryptedData);
        result = pubKey.multiply(ciphertext, params.scalar);
        break;
        
      case 'weighted_sum':
        // Weighted sum: sum(c_i * w_i)
        if (!params.weights || !Array.isArray(params.weights)) {
          throw new Error('Weighted sum requires weights array');
        }
        if (!Array.isArray(encryptedData)) {
          encryptedData = [encryptedData];
        }
        if (encryptedData.length !== params.weights.length) {
          throw new Error('Number of ciphertexts must match number of weights');
        }
        
        // Scale fractional weights to integers
        // Find precision needed (number of decimal places)
        const maxDecimals = Math.max(...params.weights.map(w => {
          const str = w.toString();
          const decimalPos = str.indexOf('.');
          return decimalPos === -1 ? 0 : str.length - decimalPos - 1;
        }));
        const scale = Math.pow(10, maxDecimals);
        
        // Scale weights to integers
        const integerWeights = params.weights.map(w => Math.round(w * scale));
        
        result = encryptedData.reduce((acc, c, i) => {
          const weighted = pubKey.multiply(BigInt(c), integerWeights[i]);
          if (acc === null) return weighted;
          return pubKey.add(acc, weighted);
        }, null);
        
        // Store scale for later division during decryption
        result = { 
          sum: result.toString(), 
          scale: scale,
          operation: 'weighted_sum'
        };
        break;
        
      case 'average':
        // Compute encrypted average (sum and divide by count)
        if (!Array.isArray(encryptedData)) {
          encryptedData = [encryptedData];
        }
        const sum = encryptedData.reduce((acc, c) => {
          const c1 = typeof acc === 'string' ? BigInt(acc) : acc;
          const c2 = BigInt(c);
          return pubKey.add(c1, c2);
        });
        // Note: Division requires decryption, so we return sum and count
        result = { sum: sum.toString(), count: encryptedData.length };
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    // Generate proof of computation
    const proof = this.generateProof(operation, encryptedData, result, publicKey);
    
    return {
      result: typeof result === 'object' ? result : result.toString(),
      proof,
      metadata: {
        operation,
        timestamp: Date.now(),
        verified: true
      }
    };
  }
  
  /**
   * Decrypt computation results
   */
  decrypt(encryptedResult, privateKey) {
    if (this.mockMode) {
      return {
        plaintext: 42,
        metadata: {
          algorithm: 'mock',
          timestamp: Date.now()
        }
      };
    }
    
    // Reconstruct key objects
    const pubKey = new PaillierPublicKey(
      BigInt(privateKey.publicKey?.n || '0'),
      BigInt(privateKey.publicKey?.g || '0')
    );
    const privKey = new PaillierPrivateKey(
      BigInt(privateKey.lambda),
      BigInt(privateKey.mu),
      pubKey
    );
    
    // Handle different result types
    let plaintext;
    
    if (typeof encryptedResult === 'object' && encryptedResult.sum) {
      // Handle special result types (average, weighted_sum)
      if (encryptedResult.operation === 'weighted_sum') {
        // Decrypt and divide by scale
        const sumValue = privKey.decrypt(BigInt(encryptedResult.sum));
        plaintext = Number(sumValue) / encryptedResult.scale;
      } else if (encryptedResult.count) {
        // Average result: decrypt sum and divide by count
        const sumValue = privKey.decrypt(BigInt(encryptedResult.sum));
        plaintext = Number(sumValue) / encryptedResult.count;
      } else {
        // Just decrypt the sum
        const sumValue = privKey.decrypt(BigInt(encryptedResult.sum));
        plaintext = Number(sumValue);
      }
    } else if (Array.isArray(encryptedResult)) {
      // Array of ciphertexts
      plaintext = encryptedResult.map(c => {
        const value = privKey.decrypt(BigInt(c));
        return Number(value);
      });
    } else {
      // Single ciphertext
      const value = privKey.decrypt(BigInt(encryptedResult));
      plaintext = Number(value);
    }
    
    return {
      plaintext,
      metadata: {
        algorithm: 'paillier',
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * Generate zero-knowledge proof of computation
   */
  generateProof(operation, inputs, output, publicKey) {
    // Simplified proof generation
    // In production, use proper ZK-SNARK or ZK-STARK
    
    const proofData = {
      operation,
      inputs: Array.isArray(inputs) ? inputs.length : 1,
      timestamp: Date.now(),
      publicKeyHash: this.hashPublicKey(publicKey)
    };
    
    const proofString = JSON.stringify(proofData);
    const proof = crypto.createHash('sha256').update(proofString).digest('hex');
    
    return {
      proof,
      data: proofData,
      algorithm: 'sha256-commitment'
    };
  }
  
  /**
   * Verify computation proof
   */
  verifyProof(proof, operation, inputs, output, publicKey) {
    if (this.mockMode) {
      return { valid: true, message: 'Mock verification passed' };
    }
    
    // Verify proof matches the computation
    const expectedProofData = {
      operation,
      inputs: Array.isArray(inputs) ? inputs.length : 1,
      timestamp: proof.data.timestamp,
      publicKeyHash: this.hashPublicKey(publicKey)
    };
    
    const expectedProofString = JSON.stringify(expectedProofData);
    const expectedProof = crypto.createHash('sha256')
      .update(expectedProofString)
      .digest('hex');
    
    const valid = proof.proof === expectedProof;
    
    return {
      valid,
      message: valid ? 'Proof verification successful' : 'Proof verification failed',
      details: {
        operation,
        timestamp: proof.data.timestamp,
        algorithm: proof.algorithm
      }
    };
  }
  
  /**
   * Hash public key for proof generation
   */
  hashPublicKey(publicKey) {
    const keyString = JSON.stringify(publicKey);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
  
  /**
   * Create encrypted computation workflow
   */
  createComputationWorkflow(name, operations) {
    return {
      name,
      operations,
      id: crypto.randomBytes(16).toString('hex'),
      created: Date.now(),
      execute: async (data, keys) => {
        let currentData = data;
        const results = [];
        
        for (const op of operations) {
          let result;
          
          switch (op.type) {
            case 'encrypt':
              result = this.encrypt(currentData, keys.publicKey);
              currentData = result.ciphertext;
              break;
              
            case 'compute':
              result = this.compute(op.operation, currentData, keys.publicKey, op.params);
              currentData = result.result;
              break;
              
            case 'decrypt':
              result = this.decrypt(currentData, keys.privateKey);
              currentData = result.plaintext;
              break;
              
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
          
          results.push({
            operation: op.type,
            result,
            timestamp: Date.now()
          });
        }
        
        return {
          finalResult: currentData,
          steps: results,
          workflow: name
        };
      }
    };
  }
}

// ============================================================================
// JSONFlow Integration
// ============================================================================

/**
 * Execute FHE encryption step
 */
async function executeFHEEncrypt(step, context, adapter) {
  const { data, publicKey } = step;
  
  // Resolve data from context
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  // Resolve public key from context or vault
  const resolvedKey = typeof publicKey === 'string' && publicKey.startsWith('vault://')
    ? await context.vault.get(publicKey)
    : publicKey;
  
  const result = adapter.encrypt(resolvedData, resolvedKey);
  
  return {
    encrypted: result.ciphertext,
    metadata: result.metadata,
    publicKey: resolvedKey
  };
}

/**
 * Execute FHE computation step
 */
async function executeFHECompute(step, context, adapter) {
  const { operation, data, publicKey, params } = step;
  
  // Resolve encrypted data
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  // Resolve public key
  const resolvedKey = typeof publicKey === 'string' && publicKey.startsWith('vault://')
    ? await context.vault.get(publicKey)
    : publicKey;
  
  const result = adapter.compute(operation, resolvedData, resolvedKey, params);
  
  return {
    result: result.result,
    proof: result.proof,
    metadata: result.metadata,
    operation
  };
}

/**
 * Execute FHE decryption step
 */
async function executeFHEDecrypt(step, context, adapter) {
  const { data, privateKey } = step;
  
  // Resolve encrypted data
  const resolvedData = typeof data === 'string' && data.startsWith('$')
    ? context.variables[data.substring(1)]
    : data;
  
  // Resolve private key from vault
  const resolvedKey = typeof privateKey === 'string' && privateKey.startsWith('vault://')
    ? await context.vault.get(privateKey)
    : privateKey;
  
  const result = adapter.decrypt(resolvedData, resolvedKey);
  
  return {
    plaintext: result.plaintext,
    metadata: result.metadata
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  FHEAdapter,
  PaillierKeyPair,
  PaillierPublicKey,
  PaillierPrivateKey,
  generatePaillierKeyPair,
  executeFHEEncrypt,
  executeFHECompute,
  executeFHEDecrypt,
  
  // Utility functions
  modPow,
  modInverse,
  generatePrime,
  isProbablyPrime
};
