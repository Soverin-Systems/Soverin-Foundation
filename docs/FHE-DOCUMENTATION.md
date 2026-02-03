# JSONFlow Phase 3: FHE (Fully Homomorphic Encryption) Adapter

## Overview

The FHE Adapter enables privacy-preserving computation on encrypted data using the Paillier cryptosystem. This allows JSONFlow workflows to perform computations on sensitive data without ever decrypting it, ensuring complete data privacy.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [API Reference](#api-reference)
4. [Use Cases](#use-cases)
5. [JSONFlow Integration](#jsonflow-integration)
6. [Security Best Practices](#security-best-practices)
7. [Performance Considerations](#performance-considerations)
8. [Advanced Topics](#advanced-topics)

---

## Quick Start

### Basic Encryption/Decryption

```javascript
const { FHEAdapter } = require('./fhe-adapter');

const adapter = new FHEAdapter();

// Generate key pair
const keys = adapter.generateKeys(512);

// Encrypt data
const encrypted = adapter.encrypt(42, keys.publicKey);

// Decrypt data
const decrypted = adapter.decrypt(encrypted.ciphertext, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(decrypted.plaintext); // 42
```

### Homomorphic Addition

```javascript
// Encrypt two numbers
const enc1 = adapter.encrypt(10, keys.publicKey);
const enc2 = adapter.encrypt(20, keys.publicKey);

// Add encrypted numbers (without decrypting!)
const sum = adapter.compute('add', 
  [enc1.ciphertext, enc2.ciphertext], 
  keys.publicKey
);

// Decrypt result
const result = adapter.decrypt(sum.result, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(result.plaintext); // 30
```

---

## Core Concepts

### What is Fully Homomorphic Encryption?

FHE allows computation on encrypted data without decryption. The result, when decrypted, matches the result of performing the same operation on unencrypted data.

**Mathematical Property:**
```
Encrypt(a) ⊕ Encrypt(b) = Encrypt(a + b)
```

Where ⊕ is a homomorphic operation.

### Paillier Cryptosystem

This implementation uses the Paillier cryptosystem, which supports:

- **Additive Homomorphism**: Sum encrypted values
- **Scalar Multiplication**: Multiply encrypted values by constants
- **Probabilistic Encryption**: Same plaintext produces different ciphertexts

**Supported Operations:**
- ✅ Addition of encrypted values
- ✅ Multiplication by scalar
- ✅ Weighted sums
- ❌ Multiplication of encrypted values (not supported by Paillier)

### Key Components

```
┌─────────────────────────────────────────────────┐
│  FHE Workflow                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Key Generation                              │
│     ├─ Public Key (for encryption)              │
│     └─ Private Key (for decryption)             │
│                                                 │
│  2. Encryption                                  │
│     ├─ Plaintext → Ciphertext                   │
│     └─ Uses Public Key only                     │
│                                                 │
│  3. Computation                                 │
│     ├─ Operations on Ciphertext                 │
│     ├─ No decryption needed                     │
│     └─ Generates zero-knowledge proof           │
│                                                 │
│  4. Decryption                                  │
│     ├─ Ciphertext → Plaintext                   │
│     └─ Requires Private Key                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## API Reference

### FHEAdapter Class

#### Constructor

```javascript
const adapter = new FHEAdapter(options);
```

**Options:**
- `mockMode` (boolean): Enable mock mode for testing (default: false)

#### Methods

##### `generateKeys(bitLength)`

Generate a new FHE key pair.

```javascript
const keys = adapter.generateKeys(512);
```

**Parameters:**
- `bitLength` (number): Key size in bits (default: 512, recommended: 1024-2048)

**Returns:**
```javascript
{
  publicKey: {
    n: string,      // Modulus
    g: string,      // Generator
    nSquared: string,
    type: 'paillier'
  },
  privateKey: {
    lambda: string, // λ value
    mu: string,     // μ value
    type: 'paillier'
  }
}
```

##### `encrypt(data, publicKey)`

Encrypt data for homomorphic computation.

```javascript
const encrypted = adapter.encrypt(value, publicKey);
```

**Parameters:**
- `data`: Number, array of numbers, or object with numeric values
- `publicKey`: Public key object

**Returns:**
```javascript
{
  ciphertext: string | string[],
  metadata: {
    algorithm: 'paillier',
    timestamp: number,
    count: number
  }
}
```

##### `compute(operation, encryptedData, publicKey, params)`

Perform computation on encrypted data.

```javascript
const result = adapter.compute('add', ciphertexts, publicKey);
```

**Parameters:**
- `operation` (string): Operation type
- `encryptedData`: Encrypted data (string or array)
- `publicKey`: Public key object
- `params` (object): Additional parameters

**Supported Operations:**

| Operation | Description | Parameters | Example |
|-----------|-------------|------------|---------|
| `add` | Add two encrypted values | - | `compute('add', [c1, c2], pk)` |
| `sum` | Sum array of encrypted values | - | `compute('sum', [c1, c2, c3], pk)` |
| `multiply` | Multiply by scalar | `scalar` | `compute('multiply', c, pk, {scalar: 5})` |
| `weighted_sum` | Weighted sum | `weights` | `compute('weighted_sum', cs, pk, {weights: [0.3, 0.7]})` |
| `average` | Compute average | - | `compute('average', cs, pk)` |

**Returns:**
```javascript
{
  result: string,
  proof: {
    proof: string,
    data: object,
    algorithm: string
  },
  metadata: {
    operation: string,
    timestamp: number,
    verified: boolean
  }
}
```

##### `decrypt(encryptedResult, privateKey)`

Decrypt computation results.

```javascript
const decrypted = adapter.decrypt(ciphertext, privateKey);
```

**Parameters:**
- `encryptedResult`: Ciphertext or computation result
- `privateKey`: Private key object (must include `publicKey` property)

**Returns:**
```javascript
{
  plaintext: number | number[],
  metadata: {
    algorithm: 'paillier',
    timestamp: number
  }
}
```

##### `verifyProof(proof, operation, inputs, output, publicKey)`

Verify zero-knowledge proof of computation.

```javascript
const verification = adapter.verifyProof(proof, 'sum', inputs, output, pk);
```

**Returns:**
```javascript
{
  valid: boolean,
  message: string,
  details: {
    operation: string,
    timestamp: number,
    algorithm: string
  }
}
```

##### `createComputationWorkflow(name, operations)`

Create a reusable computation workflow.

```javascript
const workflow = adapter.createComputationWorkflow('analytics', [
  { type: 'encrypt' },
  { type: 'compute', operation: 'sum' },
  { type: 'decrypt' }
]);

const result = await workflow.execute(data, keys);
```

---

## Use Cases

### 1. Privacy-Preserving Analytics

Calculate aggregate statistics without revealing individual data points.

```javascript
const adapter = new FHEAdapter();
const keys = adapter.generateKeys(1024);

// Each user encrypts their data
const revenues = [1000000, 1500000, 800000];
const encryptedRevenues = revenues.map(r => 
  adapter.encrypt(r, keys.publicKey).ciphertext
);

// Compute total without decrypting individual values
const encryptedTotal = adapter.compute('sum', encryptedRevenues, keys.publicKey);

// Only authorized party decrypts the aggregate
const total = adapter.decrypt(encryptedTotal.result, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(`Total: ${total.plaintext}`);
// Individual revenues remain private!
```

### 2. Secure Voting

Count votes without revealing individual choices.

```javascript
// Votes: 1 = Yes, 0 = No
const votes = [1, 1, 0, 1, 1, 0, 1];

// Encrypt each vote
const encryptedVotes = votes.map(v => 
  adapter.encrypt(v, keys.publicKey).ciphertext
);

// Count without decrypting individual votes
const encryptedCount = adapter.compute('sum', encryptedVotes, keys.publicKey);

// Decrypt only the final tally
const yesCount = adapter.decrypt(encryptedCount.result, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(`Yes votes: ${yesCount.plaintext}`);
```

### 3. Medical Data Aggregation

Compute patient statistics while maintaining HIPAA compliance.

```javascript
const bloodSugarLevels = [95, 110, 88, 120, 105];

// Encrypt patient data
const encrypted = bloodSugarLevels.map(level =>
  adapter.encrypt(level, keys.publicKey).ciphertext
);

// Compute average on encrypted data
const encryptedAvg = adapter.compute('average', encrypted, keys.publicKey);

// Decrypt only the aggregate result
const average = adapter.decrypt(encryptedAvg.result, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(`Average: ${average.plaintext.toFixed(1)} mg/dL`);
// Individual patient data never exposed!
```

### 4. Financial Data Analysis

Analyze sensitive financial data without exposure.

```javascript
// Portfolio values (private)
const portfolios = [250000, 500000, 1000000, 750000];
const weights = [0.25, 0.25, 0.25, 0.25];

// Encrypt all values
const encryptedPortfolios = portfolios.map(p =>
  adapter.encrypt(p, keys.publicKey).ciphertext
);

// Compute weighted average
const result = adapter.compute(
  'weighted_sum',
  encryptedPortfolios,
  keys.publicKey,
  { weights }
);

// Decrypt final result
const weightedAvg = adapter.decrypt(result.result, {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

console.log(`Weighted average: $${weightedAvg.plaintext}`);
```

---

## JSONFlow Integration

### Step Types

#### `fhe_encrypt`

Encrypt data for homomorphic computation.

```json
{
  "type": "fhe_encrypt",
  "data": "$sensitive_data",
  "publicKey": "vault://fhe/public",
  "output": "encrypted_data"
}
```

#### `fhe_compute`

Perform computation on encrypted data.

```json
{
  "type": "fhe_compute",
  "operation": "sum",
  "data": "$encrypted_data",
  "publicKey": "vault://fhe/public",
  "params": {},
  "output": "encrypted_result"
}
```

#### `fhe_decrypt`

Decrypt computation results.

```json
{
  "type": "fhe_decrypt",
  "data": "$encrypted_result",
  "privateKey": "vault://fhe/private",
  "output": "final_result"
}
```

### Complete Workflow Example

```json
{
  "workflow": "privacy-preserving-analytics",
  "steps": [
    {
      "type": "fhe_encrypt",
      "data": "$user_revenues",
      "publicKey": "vault://fhe/public",
      "output": "encrypted_revenues"
    },
    {
      "type": "fhe_compute",
      "operation": "sum",
      "data": "$encrypted_revenues",
      "publicKey": "vault://fhe/public",
      "output": "encrypted_total"
    },
    {
      "type": "fhe_compute",
      "operation": "multiply",
      "data": "$encrypted_total",
      "publicKey": "vault://fhe/public",
      "params": { "scalar": 0.15 },
      "output": "encrypted_tax"
    },
    {
      "type": "fhe_decrypt",
      "data": "$encrypted_tax",
      "privateKey": "vault://fhe/private",
      "output": "total_tax"
    }
  ]
}
```

### Integration with Vault

Store FHE keys securely in vault:

```javascript
// Generate and store keys
const keys = adapter.generateKeys(1024);
await vault.set('vault://fhe/public', keys.publicKey);
await vault.set('vault://fhe/private', {
  ...keys.privateKey,
  publicKey: keys.publicKey
});

// Use in workflow
const encrypted = await executeFHEEncrypt(
  { data: values, publicKey: 'vault://fhe/public' },
  context,
  adapter
);
```

---

## Security Best Practices

### 1. Key Management

✅ **DO:**
- Store private keys in vault with encryption
- Use key versioning for rotation
- Generate keys with at least 1024 bits for production
- Never log or expose private keys

❌ **DON'T:**
- Hardcode keys in workflows
- Share private keys across users
- Store keys in plaintext
- Reuse keys across different contexts

### 2. Data Handling

✅ **DO:**
- Validate input data before encryption
- Use appropriate data ranges (avoid very large numbers)
- Include metadata with encrypted data
- Generate proofs for critical operations

❌ **DON'T:**
- Encrypt non-numeric data directly
- Perform operations on untrusted ciphertexts
- Ignore proof verification results
- Mix data from different encryption contexts

### 3. Computation Security

✅ **DO:**
- Verify proofs for sensitive computations
- Use mock mode for testing only
- Monitor computation performance
- Implement rate limiting for operations

❌ **DON'T:**
- Skip proof verification in production
- Allow unlimited computation requests
- Decrypt intermediate results unnecessarily
- Expose computation details to unauthorized users

### 4. Privacy Guarantees

**What FHE Protects:**
- ✅ Individual data values remain private
- ✅ Intermediate computation results stay encrypted
- ✅ Only aggregate results are revealed

**What FHE Doesn't Protect:**
- ❌ Number of data points (visible from array length)
- ❌ Timing information (computation time may leak info)
- ❌ Metadata about operations performed

---

## Performance Considerations

### Key Size vs. Performance

| Key Size | Security | Encryption Speed | Computation Speed | Recommended For |
|----------|----------|------------------|-------------------|-----------------|
| 512 bits | Low | Fast | Fast | Testing only |
| 1024 bits | Medium | Moderate | Moderate | Development |
| 2048 bits | High | Slow | Slow | Production |
| 4096 bits | Very High | Very Slow | Very Slow | High security |

### Operation Complexity

| Operation | Time Complexity | Example (100 values) |
|-----------|----------------|----------------------|
| Encrypt | O(1) | ~5-10ms per value |
| Decrypt | O(1) | ~5-10ms |
| Add/Sum | O(n) | ~50ms |
| Multiply (scalar) | O(1) | ~10ms |
| Weighted Sum | O(n) | ~100ms |

### Optimization Tips

1. **Batch Operations**: Encrypt multiple values together
2. **Cache Keys**: Reuse key objects to avoid repeated parsing
3. **Minimize Decryption**: Decrypt only final results
4. **Use Appropriate Key Size**: Balance security and performance
5. **Parallel Processing**: Encrypt independent values concurrently

---

## Advanced Topics

### Custom Cryptographic Schemes

Extend the adapter with different FHE schemes:

```javascript
class CustomFHEAdapter extends FHEAdapter {
  encrypt(data, publicKey) {
    // Implement custom encryption scheme
    // e.g., BGV, BFV, or CKKS
  }
  
  compute(operation, data, publicKey, params) {
    // Implement custom homomorphic operations
  }
}
```

### Multi-Party Computation

Combine FHE with secure multi-party computation:

```javascript
// Party 1 encrypts their data
const enc1 = party1Adapter.encrypt(data1, sharedPublicKey);

// Party 2 encrypts their data
const enc2 = party2Adapter.encrypt(data2, sharedPublicKey);

// Combine encrypted results
const combined = adapter.compute('add', [enc1, enc2], sharedPublicKey);

// Threshold decryption (requires multiple parties)
const result = thresholdDecrypt(combined, [party1Key, party2Key]);
```

### Zero-Knowledge Proofs

Generate advanced proofs:

```javascript
const proof = adapter.generateProof('sum', inputs, output, publicKey);

// Verify without revealing computation details
const isValid = adapter.verifyProof(proof, 'sum', inputs, output, publicKey);
```

### Cross-Chain Integration

Use FHE with blockchain:

```javascript
// Encrypt data
const encrypted = adapter.encrypt(sensitiveData, publicKey);

// Store on IPFS
const ipfsHash = await ipfs.add(encrypted.ciphertext);

// Mint NFT with encrypted reference
await blockchain.mintNFT({
  metadata: {
    dataHash: ipfsHash,
    proof: encrypted.metadata
  }
});
```

---

## Troubleshooting

### Common Issues

**Issue: "Modular inverse does not exist"**
- **Cause**: Invalid key or corrupted ciphertext
- **Solution**: Regenerate keys, verify data integrity

**Issue: Decryption returns wrong value**
- **Cause**: Mismatched keys or incorrect operation
- **Solution**: Ensure public/private key pair match, check operation types

**Issue: Performance is slow**
- **Cause**: Large key size or many operations
- **Solution**: Use smaller keys for testing, optimize batch operations

**Issue: "Failed to generate prime number"**
- **Cause**: Insufficient randomness or attempts
- **Solution**: Increase max attempts, check system entropy

---

## Examples

See `fhe-examples.js` for complete working examples:

1. Basic encryption/decryption
2. Homomorphic addition
3. Weighted sum computation
4. Privacy-preserving analytics
5. Secure voting system
6. Medical data aggregation
7. Multi-step computation workflow
8. Zero-knowledge proof verification
9. JSONFlow integration

Run examples:
```bash
node fhe-examples.js
```

---

## References

- [Paillier Cryptosystem](https://en.wikipedia.org/wiki/Paillier_cryptosystem)
- [Homomorphic Encryption](https://en.wikipedia.org/wiki/Homomorphic_encryption)
- [Zero-Knowledge Proofs](https://en.wikipedia.org/wiki/Zero-knowledge_proof)

---

## License

Part of JSONFlow Phase 3 - Crypto & Wallet Adapter

---

**Next Steps:**
- Integrate with vault manager for key storage
- Combine with blockchain adapter for on-chain proofs
- Add to JSONFlow workflow engine

**Related Documentation:**
- `PHASE3-VAULT.md` - Vault pointer system
- `PHASE3-BLOCKCHAIN.md` - Blockchain integration
- `PHASE3-README.md` - Complete Phase 3 overview
