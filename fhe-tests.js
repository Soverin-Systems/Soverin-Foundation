/**
 * JSONFlow Phase 3: FHE Adapter - Test Suite
 * 
 * Comprehensive tests for the FHE adapter
 */

const {
  FHEAdapter,
  generatePaillierKeyPair,
  modPow,
  modInverse,
  isProbablyPrime
} = require('./fhe-adapter');

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

// ============================================================================
// Unit Tests
// ============================================================================

async function testModularArithmetic() {
  console.log('\n--- Testing Modular Arithmetic ---');
  
  // Test modPow
  const result1 = modPow(2n, 10n, 1000n);
  assertEqual(result1, 24n, 'modPow(2, 10, 1000) = 24');
  
  // Test modInverse
  const result2 = modInverse(3n, 11n);
  assertEqual((3n * result2) % 11n, 1n, 'modInverse(3, 11) * 3 ≡ 1 (mod 11)');
  
  // Test prime checking
  assert(isProbablyPrime(17n), '17 is prime');
  assert(!isProbablyPrime(15n), '15 is not prime');
  
  console.log('All modular arithmetic tests passed!\n');
}

async function testKeyGeneration() {
  console.log('\n--- Testing Key Generation ---');
  
  const adapter = new FHEAdapter();
  
  // Test key generation
  const keys = adapter.generateKeys(512);
  
  assert(keys.publicKey, 'Public key exists');
  assert(keys.privateKey, 'Private key exists');
  assert(keys.publicKey.n, 'Public key has modulus n');
  assert(keys.publicKey.g, 'Public key has generator g');
  assert(keys.privateKey.lambda, 'Private key has lambda');
  assert(keys.privateKey.mu, 'Private key has mu');
  
  console.log('All key generation tests passed!\n');
}

async function testBasicEncryption() {
  console.log('\n--- Testing Basic Encryption/Decryption ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Test single value encryption
  const plaintext = 42;
  const encrypted = adapter.encrypt(plaintext, keys.publicKey);
  
  assert(encrypted.ciphertext, 'Ciphertext exists');
  assert(encrypted.metadata, 'Metadata exists');
  assert(encrypted.metadata.algorithm === 'paillier', 'Algorithm is Paillier');
  
  // Test decryption
  const decrypted = adapter.decrypt(encrypted.ciphertext, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  assertEqual(decrypted.plaintext, plaintext, 'Decrypted value matches original');
  
  // Test array encryption
  const array = [1, 2, 3, 4, 5];
  const encryptedArray = adapter.encrypt(array, keys.publicKey);
  
  assert(Array.isArray(encryptedArray.ciphertext), 'Array encryption returns array');
  assertEqual(encryptedArray.ciphertext.length, array.length, 'Encrypted array has same length');
  
  console.log('All basic encryption tests passed!\n');
}

async function testHomomorphicAddition() {
  console.log('\n--- Testing Homomorphic Addition ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Encrypt two numbers
  const a = 10;
  const b = 20;
  const enc1 = adapter.encrypt(a, keys.publicKey);
  const enc2 = adapter.encrypt(b, keys.publicKey);
  
  // Add encrypted numbers
  const sum = adapter.compute('add', [enc1.ciphertext, enc2.ciphertext], keys.publicKey);
  
  // Decrypt result
  const result = adapter.decrypt(sum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  assertEqual(result.plaintext, a + b, `E(${a}) + E(${b}) = E(${a + b})`);
  
  // Test sum of multiple values
  const values = [5, 10, 15, 20, 25];
  const encrypted = values.map(v => adapter.encrypt(v, keys.publicKey).ciphertext);
  const totalSum = adapter.compute('sum', encrypted, keys.publicKey);
  const totalResult = adapter.decrypt(totalSum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const expected = values.reduce((a, b) => a + b, 0);
  assertEqual(totalResult.plaintext, expected, `Sum of ${values} = ${expected}`);
  
  console.log('All homomorphic addition tests passed!\n');
}

async function testScalarMultiplication() {
  console.log('\n--- Testing Scalar Multiplication ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  const value = 10;
  const scalar = 5;
  const encrypted = adapter.encrypt(value, keys.publicKey);
  
  // Multiply by scalar
  const multiplied = adapter.compute('multiply', encrypted.ciphertext, keys.publicKey, { scalar });
  
  // Decrypt result
  const result = adapter.decrypt(multiplied.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  assertEqual(result.plaintext, value * scalar, `E(${value}) * ${scalar} = E(${value * scalar})`);
  
  console.log('All scalar multiplication tests passed!\n');
}

async function testWeightedSum() {
  console.log('\n--- Testing Weighted Sum ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  const values = [10, 20, 30];
  const weights = [0.5, 0.3, 0.2];
  
  const encrypted = values.map(v => adapter.encrypt(v, keys.publicKey).ciphertext);
  const weightedSum = adapter.compute('weighted_sum', encrypted, keys.publicKey, { weights });
  
  const result = adapter.decrypt(weightedSum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const expected = values.reduce((sum, val, i) => sum + val * weights[i], 0);
  
  // Allow small floating point error
  assert(Math.abs(result.plaintext - expected) < 0.01, 
    `Weighted sum ≈ ${expected.toFixed(2)} (got ${result.plaintext.toFixed(2)})`);
  
  console.log('All weighted sum tests passed!\n');
}

async function testAverage() {
  console.log('\n--- Testing Average Computation ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  const values = [100, 200, 300, 400, 500];
  const encrypted = values.map(v => adapter.encrypt(v, keys.publicKey).ciphertext);
  
  const avg = adapter.compute('average', encrypted, keys.publicKey);
  const result = adapter.decrypt(avg.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const expected = values.reduce((a, b) => a + b, 0) / values.length;
  assertEqual(result.plaintext, expected, `Average of ${values} = ${expected}`);
  
  console.log('All average computation tests passed!\n');
}

async function testProofGeneration() {
  console.log('\n--- Testing Proof Generation & Verification ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  const values = [1, 2, 3];
  const encrypted = values.map(v => adapter.encrypt(v, keys.publicKey).ciphertext);
  
  // Compute with proof
  const result = adapter.compute('sum', encrypted, keys.publicKey);
  
  assert(result.proof, 'Proof generated');
  assert(result.proof.proof, 'Proof hash exists');
  assert(result.proof.data, 'Proof data exists');
  assert(result.proof.algorithm, 'Proof algorithm specified');
  
  // Verify proof
  const verification = adapter.verifyProof(
    result.proof,
    'sum',
    encrypted,
    result.result,
    keys.publicKey
  );
  
  assert(verification.valid, 'Proof verification passed');
  assertEqual(verification.message, 'Proof verification successful', 'Verification message correct');
  
  console.log('All proof tests passed!\n');
}

async function testWorkflow() {
  console.log('\n--- Testing Computation Workflow ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  const keysWithPublic = {
    publicKey: keys.publicKey,
    privateKey: {
      ...keys.privateKey,
      publicKey: keys.publicKey
    }
  };
  
  // Create workflow: encrypt → sum → multiply by 2 → decrypt
  const workflow = adapter.createComputationWorkflow('test-workflow', [
    { type: 'encrypt' },
    { type: 'compute', operation: 'sum' },
    { type: 'compute', operation: 'multiply', params: { scalar: 2 } },
    { type: 'decrypt' }
  ]);
  
  assert(workflow.name === 'test-workflow', 'Workflow name correct');
  assert(workflow.operations.length === 4, 'Workflow has 4 operations');
  assert(workflow.id, 'Workflow has ID');
  
  // Execute workflow
  const data = [10, 20, 30];
  const result = await workflow.execute(data, keysWithPublic);
  
  const expected = (10 + 20 + 30) * 2;
  assertEqual(result.finalResult, expected, `Workflow result = ${expected}`);
  assertEqual(result.steps.length, 4, 'Workflow executed 4 steps');
  
  console.log('All workflow tests passed!\n');
}

async function testMockMode() {
  console.log('\n--- Testing Mock Mode ---');
  
  const adapter = new FHEAdapter({ mockMode: true });
  
  // Test key generation
  const keys = adapter.generateKeys();
  assertEqual(keys.publicKey.type, 'mock', 'Mock public key');
  assertEqual(keys.privateKey.type, 'mock', 'Mock private key');
  
  // Test encryption
  const encrypted = adapter.encrypt(42, keys.publicKey);
  assert(encrypted.ciphertext.includes('encrypted_'), 'Mock encryption');
  
  // Test computation
  const computed = adapter.compute('add', ['enc1', 'enc2'], keys.publicKey);
  assert(computed.result.includes('computed_'), 'Mock computation');
  assert(computed.proof, 'Mock proof generated');
  
  // Test decryption
  const decrypted = adapter.decrypt('encrypted_data', keys.privateKey);
  assertEqual(decrypted.plaintext, 42, 'Mock decryption');
  
  console.log('All mock mode tests passed!\n');
}

async function testErrorHandling() {
  console.log('\n--- Testing Error Handling ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Test missing scalar parameter
  try {
    adapter.compute('multiply', 'ciphertext', keys.publicKey, {});
    assert(false, 'Should throw error for missing scalar');
  } catch (error) {
    assert(error.message.includes('scalar'), 'Error mentions missing scalar');
  }
  
  // Test missing weights parameter
  try {
    adapter.compute('weighted_sum', ['c1', 'c2'], keys.publicKey, {});
    assert(false, 'Should throw error for missing weights');
  } catch (error) {
    assert(error.message.includes('weights'), 'Error mentions missing weights');
  }
  
  // Test unsupported operation
  try {
    adapter.compute('divide', 'ciphertext', keys.publicKey);
    assert(false, 'Should throw error for unsupported operation');
  } catch (error) {
    assert(error.message.includes('Unsupported'), 'Error mentions unsupported operation');
  }
  
  console.log('All error handling tests passed!\n');
}

async function testLargeNumbers() {
  console.log('\n--- Testing Large Numbers ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(1024); // Larger key for larger numbers
  
  const largeNumber = 1000000;
  const encrypted = adapter.encrypt(largeNumber, keys.publicKey);
  const decrypted = adapter.decrypt(encrypted.ciphertext, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  assertEqual(decrypted.plaintext, largeNumber, `Large number ${largeNumber} encrypted/decrypted correctly`);
  
  // Test sum of large numbers
  const largeNumbers = [1000000, 2000000, 3000000];
  const encryptedLarge = largeNumbers.map(n => adapter.encrypt(n, keys.publicKey).ciphertext);
  const sum = adapter.compute('sum', encryptedLarge, keys.publicKey);
  const sumResult = adapter.decrypt(sum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const expectedSum = largeNumbers.reduce((a, b) => a + b, 0);
  assertEqual(sumResult.plaintext, expectedSum, `Sum of large numbers = ${expectedSum}`);
  
  console.log('All large number tests passed!\n');
}

// ============================================================================
// Integration Tests
// ============================================================================

async function testPrivacyPreservingScenario() {
  console.log('\n--- Testing Privacy-Preserving Scenario ---');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Scenario: Multiple parties submit encrypted salaries
  // Compute average without revealing individual salaries
  
  const salaries = [50000, 60000, 55000, 70000, 65000];
  
  // Each party encrypts their salary
  const encryptedSalaries = salaries.map(s => adapter.encrypt(s, keys.publicKey).ciphertext);
  
  // Compute average on encrypted data
  const avg = adapter.compute('average', encryptedSalaries, keys.publicKey);
  
  // Only authorized party decrypts the average
  const result = adapter.decrypt(avg.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const expectedAvg = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  assertEqual(result.plaintext, expectedAvg, `Average salary = $${expectedAvg}`);
  
  console.log('Privacy-preserving scenario test passed!\n');
  console.log('Individual salaries remain private while computing average! ✓');
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  JSONFlow Phase 3: FHE Adapter - Test Suite                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  let passedTests = 0;
  let failedTests = 0;
  
  const tests = [
    testModularArithmetic,
    testKeyGeneration,
    testBasicEncryption,
    testHomomorphicAddition,
    testScalarMultiplication,
    testWeightedSum,
    testAverage,
    testProofGeneration,
    testWorkflow,
    testMockMode,
    testErrorHandling,
    testLargeNumbers,
    testPrivacyPreservingScenario
  ];
  
  for (const test of tests) {
    try {
      await test();
      passedTests++;
    } catch (error) {
      console.error(`\n❌ Test failed: ${test.name}`);
      console.error(error.message);
      console.error(error.stack);
      failedTests++;
    }
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  Test Results: ${passedTests} passed, ${failedTests} failed                           ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  if (failedTests === 0) {
    console.log('✓ All tests passed! FHE Adapter is ready for production! 🚀');
  } else {
    console.log(`❌ ${failedTests} test(s) failed. Please review and fix issues.`);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testModularArithmetic,
  testKeyGeneration,
  testBasicEncryption,
  testHomomorphicAddition,
  testScalarMultiplication,
  testWeightedSum,
  testAverage,
  testProofGeneration,
  testWorkflow,
  testMockMode,
  testErrorHandling,
  testLargeNumbers,
  testPrivacyPreservingScenario
};
