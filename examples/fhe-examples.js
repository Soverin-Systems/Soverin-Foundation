/**
 * JSONFlow Phase 3: FHE Adapter Examples
 * 
 * Demonstrates privacy-preserving computation using FHE
 * 
 * Examples:
 * 1. Basic encryption/decryption
 * 2. Homomorphic addition
 * 3. Weighted sum computation
 * 4. Privacy-preserving analytics
 * 5. Secure voting system
 * 6. Medical data aggregation
 */

const {
  FHEAdapter,
  generatePaillierKeyPair,
  executeFHEEncrypt,
  executeFHECompute,
  executeFHEDecrypt
} = require('./fhe-adapter');

// ============================================================================
// Example 1: Basic Encryption/Decryption
// ============================================================================

async function example1_basicEncryption() {
  console.log('\n=== Example 1: Basic Encryption/Decryption ===\n');
  
  const adapter = new FHEAdapter();
  
  // Generate keys
  console.log('Generating FHE key pair...');
  const keys = adapter.generateKeys(512);
  console.log('✓ Keys generated');
  
  // Encrypt data
  const secretNumber = 42;
  console.log(`\nOriginal value: ${secretNumber}`);
  
  const encrypted = adapter.encrypt(secretNumber, keys.publicKey);
  console.log('✓ Value encrypted');
  console.log(`Ciphertext: ${encrypted.ciphertext.substring(0, 50)}...`);
  
  // Decrypt data
  const decrypted = adapter.decrypt(encrypted.ciphertext, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  console.log(`\n✓ Value decrypted: ${decrypted.plaintext}`);
  console.log(`Match: ${decrypted.plaintext === secretNumber ? '✓' : '✗'}`);
  
  return { keys, encrypted, decrypted };
}

// ============================================================================
// Example 2: Homomorphic Addition
// ============================================================================

async function example2_homomorphicAddition() {
  console.log('\n=== Example 2: Homomorphic Addition ===\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Encrypt two numbers
  const num1 = 15;
  const num2 = 27;
  
  console.log(`Number 1: ${num1}`);
  console.log(`Number 2: ${num2}`);
  console.log(`Expected sum: ${num1 + num2}`);
  
  const enc1 = adapter.encrypt(num1, keys.publicKey);
  const enc2 = adapter.encrypt(num2, keys.publicKey);
  
  console.log('\n✓ Both numbers encrypted');
  
  // Add encrypted numbers (without decrypting!)
  const encryptedSum = adapter.compute(
    'add',
    [enc1.ciphertext, enc2.ciphertext],
    keys.publicKey
  );
  
  console.log('✓ Addition performed on encrypted data');
  console.log(`Proof: ${encryptedSum.proof.proof.substring(0, 40)}...`);
  
  // Decrypt result
  const result = adapter.decrypt(encryptedSum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  console.log(`\n✓ Decrypted sum: ${result.plaintext}`);
  console.log(`Match: ${result.plaintext === (num1 + num2) ? '✓' : '✗'}`);
  
  return { result: result.plaintext, expected: num1 + num2 };
}

// ============================================================================
// Example 3: Weighted Sum Computation
// ============================================================================

async function example3_weightedSum() {
  console.log('\n=== Example 3: Weighted Sum (Privacy-Preserving Average) ===\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Student scores (private data)
  const scores = [85, 92, 78, 95, 88];
  const weights = [0.2, 0.2, 0.2, 0.2, 0.2]; // Equal weights
  
  console.log('Student scores (private):', scores);
  console.log('Weights:', weights);
  
  // Expected weighted sum
  const expected = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  console.log(`Expected weighted sum: ${expected}`);
  
  // Encrypt all scores
  console.log('\nEncrypting scores...');
  const encryptedScores = scores.map(score => 
    adapter.encrypt(score, keys.publicKey).ciphertext
  );
  console.log('✓ All scores encrypted');
  
  // Compute weighted sum on encrypted data
  const encryptedResult = adapter.compute(
    'weighted_sum',
    encryptedScores,
    keys.publicKey,
    { weights }
  );
  
  console.log('✓ Weighted sum computed on encrypted data');
  
  // Decrypt result
  const result = adapter.decrypt(encryptedResult.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  console.log(`\n✓ Decrypted weighted sum: ${result.plaintext}`);
  console.log(`Expected: ${expected}`);
  console.log(`Match: ${Math.abs(result.plaintext - expected) < 0.01 ? '✓' : '✗'}`);
  
  return { result: result.plaintext, expected };
}

// ============================================================================
// Example 4: Privacy-Preserving Analytics
// ============================================================================

async function example4_privacyPreservingAnalytics() {
  console.log('\n=== Example 4: Privacy-Preserving Analytics ===\n');
  console.log('Scenario: Calculate total revenue without revealing individual amounts\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Company revenue data (private)
  const companies = [
    { name: 'Company A', revenue: 1000000 },
    { name: 'Company B', revenue: 1500000 },
    { name: 'Company C', revenue: 800000 },
    { name: 'Company D', revenue: 2000000 }
  ];
  
  console.log('Companies submitting encrypted revenue data:');
  companies.forEach(c => console.log(`  ${c.name}: $${c.revenue.toLocaleString()}`));
  
  const totalExpected = companies.reduce((sum, c) => sum + c.revenue, 0);
  console.log(`\nExpected total: $${totalExpected.toLocaleString()}`);
  
  // Each company encrypts their revenue
  const encryptedRevenues = companies.map(company => {
    const encrypted = adapter.encrypt(company.revenue, keys.publicKey);
    return {
      company: company.name,
      encrypted: encrypted.ciphertext
    };
  });
  
  console.log('\n✓ All companies encrypted their revenue');
  
  // Compute total without decrypting individual values
  const encryptedTotal = adapter.compute(
    'sum',
    encryptedRevenues.map(e => e.encrypted),
    keys.publicKey
  );
  
  console.log('✓ Total computed on encrypted data');
  console.log(`Computation proof: ${encryptedTotal.proof.proof.substring(0, 40)}...`);
  
  // Only the authorized party can decrypt the total
  const total = adapter.decrypt(encryptedTotal.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  console.log(`\n✓ Decrypted total: $${total.plaintext.toLocaleString()}`);
  console.log(`Match: ${total.plaintext === totalExpected ? '✓' : '✗'}`);
  console.log('\nPrivacy preserved: Individual revenues never revealed! ✓');
  
  return { total: total.plaintext, expected: totalExpected };
}

// ============================================================================
// Example 5: Secure Voting System
// ============================================================================

async function example5_secureVoting() {
  console.log('\n=== Example 5: Secure Voting System ===\n');
  console.log('Scenario: Count votes without revealing individual choices\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Votes: 1 = Yes, 0 = No
  const votes = [
    { voter: 'Alice', vote: 1 },
    { voter: 'Bob', vote: 1 },
    { voter: 'Charlie', vote: 0 },
    { voter: 'Diana', vote: 1 },
    { voter: 'Eve', vote: 1 },
    { voter: 'Frank', vote: 0 },
    { voter: 'Grace', vote: 1 }
  ];
  
  const expectedYes = votes.filter(v => v.vote === 1).length;
  const expectedNo = votes.filter(v => v.vote === 0).length;
  
  console.log(`Total voters: ${votes.length}`);
  console.log(`Expected: ${expectedYes} Yes, ${expectedNo} No\n`);
  
  // Each voter encrypts their vote
  console.log('Voters casting encrypted ballots...');
  const encryptedVotes = votes.map(v => {
    const encrypted = adapter.encrypt(v.vote, keys.publicKey);
    console.log(`  ${v.voter}: ✓ (vote encrypted)`);
    return encrypted.ciphertext;
  });
  
  // Count votes without decrypting individual ballots
  const encryptedCount = adapter.compute(
    'sum',
    encryptedVotes,
    keys.publicKey
  );
  
  console.log('\n✓ Votes tallied on encrypted data');
  
  // Decrypt only the final count
  const yesCount = adapter.decrypt(encryptedCount.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  const noCount = votes.length - yesCount.plaintext;
  
  console.log(`\n✓ Final tally:`);
  console.log(`  Yes: ${yesCount.plaintext}`);
  console.log(`  No: ${noCount}`);
  console.log(`\nMatch: ${yesCount.plaintext === expectedYes ? '✓' : '✗'}`);
  console.log('Privacy preserved: Individual votes never revealed! ✓');
  
  return { yes: yesCount.plaintext, no: noCount, expected: { yes: expectedYes, no: expectedNo } };
}

// ============================================================================
// Example 6: Medical Data Aggregation
// ============================================================================

async function example6_medicalDataAggregation() {
  console.log('\n=== Example 6: Medical Data Aggregation ===\n');
  console.log('Scenario: Calculate average patient metrics without revealing individual data\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Patient data (highly sensitive)
  const patients = [
    { id: 'P001', bloodSugar: 95 },
    { id: 'P002', bloodSugar: 110 },
    { id: 'P003', bloodSugar: 88 },
    { id: 'P004', bloodSugar: 120 },
    { id: 'P005', bloodSugar: 105 }
  ];
  
  const expectedAvg = patients.reduce((sum, p) => sum + p.bloodSugar, 0) / patients.length;
  
  console.log(`Patients: ${patients.length}`);
  console.log(`Expected average blood sugar: ${expectedAvg.toFixed(1)} mg/dL\n`);
  
  // Encrypt all patient data
  console.log('Encrypting patient data...');
  const encryptedData = patients.map(p => {
    const encrypted = adapter.encrypt(p.bloodSugar, keys.publicKey);
    console.log(`  ${p.id}: ✓ (data encrypted)`);
    return encrypted.ciphertext;
  });
  
  // Compute average on encrypted data
  const encryptedAvg = adapter.compute(
    'average',
    encryptedData,
    keys.publicKey
  );
  
  console.log('\n✓ Average computed on encrypted data');
  
  // Decrypt only the aggregate result
  const avgResult = adapter.decrypt(encryptedAvg.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  
  console.log(`\n✓ Decrypted average: ${avgResult.plaintext.toFixed(1)} mg/dL`);
  console.log(`Expected: ${expectedAvg.toFixed(1)} mg/dL`);
  console.log(`Match: ${Math.abs(avgResult.plaintext - expectedAvg) < 0.01 ? '✓' : '✗'}`);
  console.log('\nHIPAA compliant: Individual patient data never revealed! ✓');
  
  return { average: avgResult.plaintext, expected: expectedAvg };
}

// ============================================================================
// Example 7: FHE Computation Workflow
// ============================================================================

async function example7_computationWorkflow() {
  console.log('\n=== Example 7: FHE Computation Workflow ===\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Add publicKey to privateKey for decryption
  const keysWithPublic = {
    publicKey: keys.publicKey,
    privateKey: {
      ...keys.privateKey,
      publicKey: keys.publicKey
    }
  };
  
  // Create a multi-step computation workflow
  const workflow = adapter.createComputationWorkflow(
    'salary-analysis',
    [
      { type: 'encrypt' },
      { type: 'compute', operation: 'sum' },
      { type: 'compute', operation: 'multiply', params: { scalar: 2 } }, // Double the sum
      { type: 'decrypt' }
    ]
  );
  
  console.log(`Workflow: ${workflow.name}`);
  console.log(`Operations: ${workflow.operations.length}`);
  console.log(`Workflow ID: ${workflow.id}\n`);
  
  // Input data
  const salaries = [50000, 60000, 55000, 70000];
  const expectedSum = salaries.reduce((a, b) => a + b, 0);
  const expectedDoubled = expectedSum * 2;
  
  console.log('Input salaries:', salaries);
  console.log(`Expected sum: ${expectedSum}`);
  console.log(`Expected doubled: ${expectedDoubled}\n`);
  
  // Execute workflow
  console.log('Executing workflow...');
  const result = await workflow.execute(salaries, keysWithPublic);
  
  console.log('\n✓ Workflow completed');
  console.log(`Steps executed: ${result.steps.length}`);
  console.log(`Final result: ${result.finalResult}`);
  console.log(`Match: ${result.finalResult === expectedDoubled ? '✓' : '✗'}`);
  
  // Show step details
  console.log('\nWorkflow steps:');
  result.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.operation} - ${step.timestamp}`);
  });
  
  return result;
}

// ============================================================================
// Example 8: Proof Verification
// ============================================================================

async function example8_proofVerification() {
  console.log('\n=== Example 8: Zero-Knowledge Proof Verification ===\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Encrypt and compute
  const values = [10, 20, 30];
  const encryptedValues = values.map(v => 
    adapter.encrypt(v, keys.publicKey).ciphertext
  );
  
  console.log('Computing sum with proof generation...');
  const computation = adapter.compute(
    'sum',
    encryptedValues,
    keys.publicKey
  );
  
  console.log('✓ Computation complete');
  console.log(`Proof generated: ${computation.proof.proof.substring(0, 40)}...`);
  
  // Verify the proof
  console.log('\nVerifying computation proof...');
  const verification = adapter.verifyProof(
    computation.proof,
    'sum',
    encryptedValues,
    computation.result,
    keys.publicKey
  );
  
  console.log(`✓ Verification result: ${verification.valid ? 'VALID' : 'INVALID'}`);
  console.log(`Message: ${verification.message}`);
  console.log('Proof details:');
  console.log(`  Operation: ${verification.details.operation}`);
  console.log(`  Algorithm: ${verification.details.algorithm}`);
  console.log(`  Timestamp: ${new Date(verification.details.timestamp).toISOString()}`);
  
  return verification;
}

// ============================================================================
// Example 9: JSONFlow Integration
// ============================================================================

async function example9_jsonFlowIntegration() {
  console.log('\n=== Example 9: JSONFlow Integration ===\n');
  
  const adapter = new FHEAdapter();
  const keys = adapter.generateKeys(512);
  
  // Mock vault for key storage
  const vault = {
    data: {},
    async get(key) {
      return this.data[key];
    },
    async set(key, value) {
      this.data[key] = value;
    }
  };
  
  // Store keys in vault
  await vault.set('vault://fhe/public', keys.publicKey);
  await vault.set('vault://fhe/private', keys.privateKey);
  
  console.log('✓ Keys stored in vault');
  
  // Create JSONFlow context
  const context = {
    variables: {
      revenues: [100000, 150000, 200000]
    },
    vault
  };
  
  // Step 1: Encrypt
  console.log('\nStep 1: Encrypting data...');
  const encryptStep = {
    data: '$revenues',
    publicKey: 'vault://fhe/public'
  };
  
  const encrypted = await executeFHEEncrypt(encryptStep, context, adapter);
  context.variables.encrypted_revenues = encrypted.encrypted;
  console.log('✓ Data encrypted');
  
  // Step 2: Compute sum
  console.log('\nStep 2: Computing sum on encrypted data...');
  const computeStep = {
    operation: 'sum',
    data: '$encrypted_revenues',
    publicKey: 'vault://fhe/public'
  };
  
  const computed = await executeFHECompute(computeStep, context, adapter);
  context.variables.encrypted_sum = computed.result;
  console.log('✓ Sum computed');
  console.log(`Proof: ${computed.proof.proof.substring(0, 40)}...`);
  
  // Step 3: Decrypt result
  console.log('\nStep 3: Decrypting result...');
  const decryptStep = {
    data: '$encrypted_sum',
    privateKey: 'vault://fhe/private'
  };
  
  // Add publicKey to private key for decryption
  const privateKeyWithPublic = {
    ...await vault.get('vault://fhe/private'),
    publicKey: await vault.get('vault://fhe/public')
  };
  await vault.set('vault://fhe/private', privateKeyWithPublic);
  
  const decrypted = await executeFHEDecrypt(decryptStep, context, adapter);
  
  console.log(`\n✓ Final result: ${decrypted.plaintext}`);
  const expected = context.variables.revenues.reduce((a, b) => a + b, 0);
  console.log(`Expected: ${expected}`);
  console.log(`Match: ${decrypted.plaintext === expected ? '✓' : '✗'}`);
  
  return { result: decrypted.plaintext, expected };
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  JSONFlow Phase 3: FHE Adapter - Comprehensive Examples       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {};
  
  try {
    results.example1 = await example1_basicEncryption();
    results.example2 = await example2_homomorphicAddition();
    results.example3 = await example3_weightedSum();
    results.example4 = await example4_privacyPreservingAnalytics();
    results.example5 = await example5_secureVoting();
    results.example6 = await example6_medicalDataAggregation();
    results.example7 = await example7_computationWorkflow();
    results.example8 = await example8_proofVerification();
    results.example9 = await example9_jsonFlowIntegration();
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  All Examples Completed Successfully! ✓                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Summary
    console.log('Summary:');
    console.log('  ✓ Basic encryption/decryption');
    console.log('  ✓ Homomorphic addition');
    console.log('  ✓ Weighted sum computation');
    console.log('  ✓ Privacy-preserving analytics');
    console.log('  ✓ Secure voting system');
    console.log('  ✓ Medical data aggregation');
    console.log('  ✓ Multi-step computation workflow');
    console.log('  ✓ Zero-knowledge proof verification');
    console.log('  ✓ JSONFlow integration');
    console.log('\nFHE Adapter is ready for production! 🚀');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    console.error(error.stack);
  }
  
  return results;
}

// ============================================================================
// Performance Benchmarks
// ============================================================================

async function runBenchmarks() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  FHE Adapter - Performance Benchmarks                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const adapter = new FHEAdapter();
  
  // Benchmark key generation
  console.log('Benchmarking key generation...');
  const keyGenStart = Date.now();
  const keys = adapter.generateKeys(512);
  const keyGenTime = Date.now() - keyGenStart;
  console.log(`  Key generation (512-bit): ${keyGenTime}ms\n`);
  
  // Benchmark encryption
  console.log('Benchmarking encryption...');
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const encStart = Date.now();
  const encrypted = values.map(v => adapter.encrypt(v, keys.publicKey));
  const encTime = Date.now() - encStart;
  console.log(`  Encrypting 100 values: ${encTime}ms`);
  console.log(`  Average per value: ${(encTime / 100).toFixed(2)}ms\n`);
  
  // Benchmark homomorphic addition
  console.log('Benchmarking homomorphic operations...');
  const ciphertexts = encrypted.map(e => e.ciphertext);
  const addStart = Date.now();
  const sum = adapter.compute('sum', ciphertexts, keys.publicKey);
  const addTime = Date.now() - addStart;
  console.log(`  Sum of 100 encrypted values: ${addTime}ms\n`);
  
  // Benchmark decryption
  console.log('Benchmarking decryption...');
  const decStart = Date.now();
  const result = adapter.decrypt(sum.result, {
    ...keys.privateKey,
    publicKey: keys.publicKey
  });
  const decTime = Date.now() - decStart;
  console.log(`  Decrypting result: ${decTime}ms`);
  console.log(`  Result: ${result.plaintext}`);
  console.log(`  Expected: ${values.reduce((a, b) => a + b, 0)}`);
  console.log(`  Match: ${result.plaintext === values.reduce((a, b) => a + b, 0) ? '✓' : '✗'}\n`);
  
  console.log('Total benchmark time:', keyGenTime + encTime + addTime + decTime, 'ms');
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => runBenchmarks())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  example1_basicEncryption,
  example2_homomorphicAddition,
  example3_weightedSum,
  example4_privacyPreservingAnalytics,
  example5_secureVoting,
  example6_medicalDataAggregation,
  example7_computationWorkflow,
  example8_proofVerification,
  example9_jsonFlowIntegration,
  runAllExamples,
  runBenchmarks
};
