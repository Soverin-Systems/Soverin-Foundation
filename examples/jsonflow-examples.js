/**
 * JSONFlow Engine - Test Suite & Examples
 * Demonstrates the engine's capabilities with practical examples
 */

// Import the engine (works in both Node.js and browser)
let JSONFlow;
if (typeof require !== 'undefined') {
  JSONFlow = require('./jsonflow-engine.js');
} else {
  JSONFlow = window.JSONFlow;
}

// ============================================================================
// EXAMPLE 1: Simple Linear Workflow
// ============================================================================

async function exampleLinearWorkflow() {
  console.log('\n========================================');
  console.log('EXAMPLE 1: Linear Workflow');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'simple_pipeline',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        type: 'mock_compute',
        params: {
          input: 'Hello World',
          delay_ms: 100
        }
      },
      {
        id: 'step2',
        type: 'mock_compute',
        params: {
          input: 'Second step',
          delay_ms: 50
        },
        parent_step_ids: ['step1']
      },
      {
        id: 'step3',
        type: 'mock_compute',
        params: {
          input: 'Final step',
          delay_ms: 75
        },
        parent_step_ids: ['step2']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('Steps Executed:', result.steps.length);
  console.log('Total Duration:', result.execution_metadata.duration_ms + 'ms');
  console.log('Merkle Root:', result.merkle_root);
  
  console.log('\nStep Details:');
  result.steps.forEach(step => {
    console.log(`  - ${step.step_id}: ${step.status} (${step.latency_ms}ms)`);
  });

  console.log('\nEngine Stats:');
  console.log(JSON.stringify(engine.getStats(), null, 2));

  return result;
}

// ============================================================================
// EXAMPLE 2: Parallel Execution (Diamond Pattern)
// ============================================================================

async function exampleParallelWorkflow() {
  console.log('\n========================================');
  console.log('EXAMPLE 2: Parallel Workflow (Diamond)');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'parallel_pipeline',
    version: '1.0.0',
    steps: [
      {
        id: 'start',
        type: 'mock_compute',
        params: {
          input: 'Starting point',
          delay_ms: 50
        }
      },
      {
        id: 'branch_a',
        type: 'mock_compute',
        params: {
          input: 'Branch A',
          delay_ms: 100
        },
        parent_step_ids: ['start']
      },
      {
        id: 'branch_b',
        type: 'mock_compute',
        params: {
          input: 'Branch B',
          delay_ms: 150
        },
        parent_step_ids: ['start']
      },
      {
        id: 'merge',
        type: 'mock_compute',
        params: {
          input: 'Merging results',
          delay_ms: 50
        },
        parent_step_ids: ['branch_a', 'branch_b']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('Execution Order Demonstrates Parallelism:');
  result.steps.forEach(step => {
    console.log(`  - ${step.step_id}: ${step.status} (${step.latency_ms}ms)`);
  });

  return result;
}

// ============================================================================
// EXAMPLE 3: Data Transformation Pipeline
// ============================================================================

async function exampleTransformWorkflow() {
  console.log('\n========================================');
  console.log('EXAMPLE 3: Data Transformation Pipeline');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'data_transform',
    version: '1.0.0',
    steps: [
      {
        id: 'generate_data',
        type: 'mock_compute',
        params: {
          input: 'Generate sample data',
          delay_ms: 50
        }
      },
      {
        id: 'transform_map',
        type: 'transform_map',
        params: {
          input: [
            { id: 1, name: 'Alice', value: 100 },
            { id: 2, name: 'Bob', value: 200 },
            { id: 3, name: 'Charlie', value: 150 }
          ]
        },
        parent_step_ids: ['generate_data']
      },
      {
        id: 'filter_high_value',
        type: 'transform_filter',
        params: {
          input: '$transform_map.result',
          key: 'value',
          value: 150
        },
        parent_step_ids: ['transform_map']
      },
      {
        id: 'aggregate',
        type: 'transform_reduce',
        params: {
          input: '$transform_map.result',
          operation: 'sum',
          key: 'value'
        },
        parent_step_ids: ['transform_map']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('\nTransformation Results:');
  
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`\n${receipt.step_id}:`);
      console.log(JSON.stringify(receipt.output, null, 2));
    }
  });

  return result;
}

// ============================================================================
// EXAMPLE 4: Error Handling
// ============================================================================

async function exampleErrorHandling() {
  console.log('\n========================================');
  console.log('EXAMPLE 4: Error Handling');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'error_handling',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        type: 'mock_compute',
        params: {
          input: 'This will succeed',
          delay_ms: 50
        }
      },
      {
        id: 'step2',
        type: 'invalid_step_type',  // This will fail
        params: {
          input: 'This will fail'
        },
        parent_step_ids: ['step1']
      },
      {
        id: 'step3',
        type: 'mock_compute',
        params: {
          input: 'This should not execute',
          delay_ms: 50
        },
        parent_step_ids: ['step2']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('Failed at Step:', result.failed_step || 'N/A');
  
  if (result.error) {
    console.log('Error Details:');
    console.log('  Code:', result.error.code);
    console.log('  Message:', result.error.message);
  }

  console.log('\nSteps Executed Before Failure:');
  result.steps.forEach(step => {
    console.log(`  - ${step.step_id}: ${step.status}`);
  });

  return result;
}

// ============================================================================
// EXAMPLE 5: Resource Requirements
// ============================================================================

async function exampleResourceRequirements() {
  console.log('\n========================================');
  console.log('EXAMPLE 5: Resource Requirements');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'resource_aware',
    version: '1.0.0',
    steps: [
      {
        id: 'lightweight',
        type: 'mock_compute',
        params: {
          input: 'Lightweight task',
          delay_ms: 50
        },
        resource_requirements: {
          ram_mb: 512,
          gpu: false,
          timeout_ms: 5000
        }
      },
      {
        id: 'intensive',
        type: 'mock_compute',
        params: {
          input: 'Intensive task',
          delay_ms: 200
        },
        resource_requirements: {
          ram_mb: 4096,
          gpu: true,
          timeout_ms: 10000
        },
        parent_step_ids: ['lightweight']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('\nResource-Aware Execution:');
  
  result.receipts.forEach(receipt => {
    console.log(`\n${receipt.step_id}:`);
    console.log('  Status:', receipt.status);
    console.log('  Latency:', receipt.execution_metadata.latency_ms + 'ms');
  });

  return result;
}

// ============================================================================
// EXAMPLE 6: Merkle Proof Verification
// ============================================================================

async function exampleMerkleProofVerification() {
  console.log('\n========================================');
  console.log('EXAMPLE 6: Merkle Proof Verification');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'audit_trail',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        type: 'mock_compute',
        params: { input: 'First', delay_ms: 50 }
      },
      {
        id: 'step2',
        type: 'mock_compute',
        params: { input: 'Second', delay_ms: 50 },
        parent_step_ids: ['step1']
      },
      {
        id: 'step3',
        type: 'mock_compute',
        params: { input: 'Third', delay_ms: 50 },
        parent_step_ids: ['step2']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Merkle Root:', result.merkle_root);
  console.log('\nVerifying Each Step:');

  for (const receipt of result.receipts) {
    const isValid = await engine.receiptStore.verifyReceipt(receipt.step_id);
    console.log(`  ${receipt.step_id}: ${isValid ? '✓ Verified' : '✗ Invalid'}`);
  }

  return result;
}

// ============================================================================
// EXAMPLE 7: Custom Adapter
// ============================================================================

class MathAdapter extends JSONFlow.Adapter {
  getManifest() {
    return {
      adapter_id: 'math',
      version: '1.0.0',
      step_types: [
        { type: 'math_add', deterministic: true },
        { type: 'math_multiply', deterministic: true },
        { type: 'math_power', deterministic: true }
      ]
    };
  }

  validate(step) {
    if (!['math_add', 'math_multiply', 'math_power'].includes(step.type)) {
      return { valid: false, error: 'Unknown step type' };
    }
    if (!step.params.a || !step.params.b) {
      return { valid: false, error: 'Missing required params: a, b' };
    }
    return { valid: true };
  }

  async execute(step, context) {
    const startTime = Date.now();
    const { a, b } = step.params;
    
    let result;
    switch (step.type) {
      case 'math_add':
        result = a + b;
        break;
      case 'math_multiply':
        result = a * b;
        break;
      case 'math_power':
        result = Math.pow(a, b);
        break;
    }

    return {
      step_id: step.id,
      status: 'success',
      output: { result },
      execution_metadata: {
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        adapter_version: this.getManifest().version
      }
    };
  }

  async healthCheck() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}

async function exampleCustomAdapter() {
  console.log('\n========================================');
  console.log('EXAMPLE 7: Custom Math Adapter');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new MathAdapter());

  const workflow = {
    workflow: 'math_operations',
    version: '1.0.0',
    steps: [
      {
        id: 'add',
        type: 'math_add',
        params: { a: 10, b: 5 }
      },
      {
        id: 'multiply',
        type: 'math_multiply',
        params: { a: 3, b: 4 }
      },
      {
        id: 'power',
        type: 'math_power',
        params: { a: 2, b: 8 }
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Workflow Status:', result.status);
  console.log('\nMath Results:');
  
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`  ${receipt.step_id}: ${receipt.output.result}`);
    }
  });

  return result;
}

// ============================================================================
// EXAMPLE 8: Workflow Replay (Deterministic Execution)
// ============================================================================

async function exampleReplay() {
  console.log('\n========================================');
  console.log('EXAMPLE 8: Workflow Replay');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();

  const workflow = {
    workflow: 'replay_demo',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        type: 'mock_compute',
        params: { input: 'Original execution', delay_ms: 50 }
      },
      {
        id: 'step2',
        type: 'mock_compute',
        params: { input: 'Dependent step', delay_ms: 50 },
        parent_step_ids: ['step1']
      }
    ]
  };

  console.log('Executing original workflow...');
  const result = await engine.execute(workflow);
  
  console.log('Original Execution - Merkle Root:', result.merkle_root);
  
  console.log('\nReplaying from receipts...');
  const replayResult = await engine.replay(result.receipts);
  
  console.log('Replay Status:', replayResult.status);
  console.log('Replay Merkle Root:', replayResult.merkle_root);
  
  console.log('\nVerification Results:');
  replayResult.verified.forEach(v => {
    console.log(`  ${v.step_id}: ${v.verified ? '✓ Verified' : '✗ Failed'}`);
  });

  return { original: result, replay: replayResult };
}

// ============================================================================
// EXAMPLE 9: Health Checks
// ============================================================================

async function exampleHealthChecks() {
  console.log('\n========================================');
  console.log('EXAMPLE 9: Adapter Health Checks');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new MathAdapter());

  const health = await engine.healthCheck();
  
  console.log('Adapter Health Status:');
  for (const [adapterId, status] of Object.entries(health)) {
    console.log(`\n${adapterId}:`);
    console.log('  Status:', status.status);
    if (status.timestamp) {
      console.log('  Timestamp:', status.timestamp);
    }
    if (status.error) {
      console.log('  Error:', status.error);
    }
  }

  return health;
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         JSONFlow Engine - Comprehensive Examples          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await exampleLinearWorkflow();
    await exampleParallelWorkflow();
    await exampleTransformWorkflow();
    await exampleErrorHandling();
    await exampleResourceRequirements();
    await exampleMerkleProofVerification();
    await exampleCustomAdapter();
    await exampleReplay();
    await exampleHealthChecks();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              All Examples Completed Successfully!         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error(error.stack);
  }
}

// ============================================================================
// EXPORTS & AUTO-RUN
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exampleLinearWorkflow,
    exampleParallelWorkflow,
    exampleTransformWorkflow,
    exampleErrorHandling,
    exampleResourceRequirements,
    exampleMerkleProofVerification,
    exampleCustomAdapter,
    exampleReplay,
    exampleHealthChecks,
    runAllExamples,
    MathAdapter
  };

  // Auto-run if executed directly
  if (require.main === module) {
    runAllExamples();
  }
} else if (typeof window !== 'undefined') {
  window.JSONFlowExamples = {
    exampleLinearWorkflow,
    exampleParallelWorkflow,
    exampleTransformWorkflow,
    exampleErrorHandling,
    exampleResourceRequirements,
    exampleMerkleProofVerification,
    exampleCustomAdapter,
    exampleReplay,
    exampleHealthChecks,
    runAllExamples,
    MathAdapter
  };
}
