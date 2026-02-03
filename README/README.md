# JSONFlow Engine

> A deterministic, content-addressed execution runtime for workflow orchestration

## Overview

JSONFlow is a revolutionary execution engine that treats workflow orchestration as the fundamental computational substrate. Unlike traditional systems that coordinate external services, JSONFlow inverts the architecture: everything becomes a JSONFlow step, and all capabilities are exposed through adapters that produce deterministic, cryptographically signed receipts.

## Key Features

- **🔒 Deterministic Execution**: Given identical inputs, always produces identical outputs
- **🔗 Content-Addressed**: Every workflow and step is identified by its cryptographic hash
- **📝 Cryptographic Receipts**: Every execution produces a Merkle-signed receipt for audit trails
- **🔄 Replay & Audit**: Re-execute workflows from receipts alone for debugging and compliance
- **🌐 Browser & Node.js**: Works seamlessly in both environments without modification
- **🔌 Extensible Adapters**: Easy plugin system for custom capabilities
- **⚡ Parallel Execution**: Automatic parallelization based on DAG dependencies
- **🛡️ Type-Safe**: JSON Schema validation for workflows and receipts

## Architecture Highlights

### Pulse-Bounded Proof of Execution (PB-PoE)

Every step execution is bounded by:
- **Determinism**: Same inputs → same outputs
- **Content-Addressing**: Steps identified by hash(type + params + inputs)
- **Receipt Signing**: Cryptographic proof of execution
- **Merkle Trees**: Tamper-proof execution history

### Core Components

1. **Parser**: Validates workflow JSON and constructs DAG
2. **Scheduler**: Routes steps to adapters, manages execution order
3. **Executor**: Executes steps with timeout enforcement
4. **Receipt Store**: Persists receipts with Merkle proof generation
5. **Adapters**: Bidirectional type systems translating capabilities to steps

## Installation

### Node.js

```bash
# Clone or download the repository
git clone https://github.com/your-org/jsonflow-engine.git
cd jsonflow-engine

# No dependencies required!
node jsonflow-examples.js
```

### Browser

```html
<!-- Include the engine -->
<script src="jsonflow-engine.js"></script>

<script>
  const engine = new JSONFlow.JSONFlowEngine();
  
  const workflow = {
    workflow: 'hello_world',
    steps: [
      {
        id: 'greet',
        type: 'mock_compute',
        params: { input: 'Hello, JSONFlow!' }
      }
    ]
  };
  
  engine.execute(workflow).then(result => {
    console.log('Status:', result.status);
    console.log('Merkle Root:', result.merkle_root);
  });
</script>
```

## Quick Start

### Example 1: Linear Workflow

```javascript
const { JSONFlowEngine } = require('./jsonflow-engine.js');

const engine = new JSONFlowEngine();

const workflow = {
  workflow: 'my_pipeline',
  version: '1.0.0',
  steps: [
    {
      id: 'step1',
      type: 'mock_compute',
      params: { input: 'Process data', delay_ms: 100 }
    },
    {
      id: 'step2',
      type: 'mock_compute',
      params: { input: 'Transform result', delay_ms: 50 },
      parent_step_ids: ['step1']
    }
  ]
};

const result = await engine.execute(workflow);
console.log('Workflow completed:', result.status);
console.log('Merkle root:', result.merkle_root);
```

### Example 2: Parallel Execution (Diamond Pattern)

```javascript
const workflow = {
  workflow: 'parallel_demo',
  steps: [
    { id: 'start', type: 'mock_compute', params: { input: 'Begin' } },
    { 
      id: 'branch_a', 
      type: 'mock_compute', 
      params: { input: 'Path A' },
      parent_step_ids: ['start']
    },
    { 
      id: 'branch_b', 
      type: 'mock_compute', 
      params: { input: 'Path B' },
      parent_step_ids: ['start']
    },
    { 
      id: 'merge', 
      type: 'mock_compute', 
      params: { input: 'Combine results' },
      parent_step_ids: ['branch_a', 'branch_b']
    }
  ]
};

// Engine automatically executes branch_a and branch_b in parallel
const result = await engine.execute(workflow);
```

### Example 3: Data Transformation Pipeline

```javascript
const workflow = {
  workflow: 'data_pipeline',
  steps: [
    {
      id: 'map',
      type: 'transform_map',
      params: {
        input: [
          { id: 1, value: 100 },
          { id: 2, value: 200 }
        ]
      }
    },
    {
      id: 'reduce',
      type: 'transform_reduce',
      params: {
        input: '$map.result',  // Reference previous step output
        operation: 'sum',
        key: 'value'
      },
      parent_step_ids: ['map']
    }
  ]
};

const result = await engine.execute(workflow);
console.log('Sum:', result.receipts[1].output.result); // 300
```

## Creating Custom Adapters

Extend the engine with custom capabilities:

```javascript
const { Adapter } = require('./jsonflow-engine.js');

class MyCustomAdapter extends Adapter {
  getManifest() {
    return {
      adapter_id: 'my_adapter',
      version: '1.0.0',
      step_types: [
        {
          type: 'my_custom_step',
          params_schema: {
            input: 'string',
            config: 'object'
          },
          deterministic: true
        }
      ]
    };
  }

  validate(step) {
    if (step.type !== 'my_custom_step') {
      return { valid: false, error: 'Unknown step type' };
    }
    if (!step.params.input) {
      return { valid: false, error: 'Missing required param: input' };
    }
    return { valid: true };
  }

  async execute(step, context) {
    const startTime = Date.now();
    
    // Your custom logic here
    const result = {
      processed: step.params.input.toUpperCase()
    };

    return {
      step_id: step.id,
      status: 'success',
      output: result,
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

// Register your adapter
const engine = new JSONFlowEngine();
engine.registerAdapter(new MyCustomAdapter());
```

## Workflow Schema

Every workflow must conform to this schema:

```json
{
  "workflow": "unique_workflow_name",
  "version": "1.0.0",
  "steps": [
    {
      "id": "step_identifier",
      "type": "adapter_step_type",
      "params": {
        "key": "value"
      },
      "parent_step_ids": ["dependency1", "dependency2"],
      "resource_requirements": {
        "ram_mb": 2048,
        "gpu": false,
        "timeout_ms": 30000
      }
    }
  ]
}
```

## Receipt Structure

Every executed step produces a receipt:

```json
{
  "step_id": "step_identifier",
  "status": "success",
  "output": {
    "result": "step output data"
  },
  "merkle_proof": "bafk...",
  "execution_metadata": {
    "timestamp": "2026-02-03T10:30:00Z",
    "latency_ms": 234,
    "adapter_version": "adapter@1.0.0"
  },
  "signature": "ed25519:..."
}
```

## Built-in Adapters

### MockAdapter
- `mock_compute`: Simulated computation with configurable delay

### TransformAdapter
- `transform_map`: Map operation on arrays
- `transform_filter`: Filter arrays by key-value
- `transform_reduce`: Reduce arrays (sum, count, avg)

## Advanced Features

### Step Output References

Reference previous step outputs using `$stepId.path.to.value`:

```javascript
{
  id: 'process',
  type: 'transform_filter',
  params: {
    input: '$previous_step.result.data',
    key: 'status',
    value: 'active'
  },
  parent_step_ids: ['previous_step']
}
```

### Resource Requirements

Specify resource constraints for scheduling:

```javascript
{
  id: 'intensive_task',
  type: 'ai_infer',
  params: { model: 'llama3-8b' },
  resource_requirements: {
    ram_mb: 8192,
    gpu: true,
    timeout_ms: 60000,
    qubits: 0
  }
}
```

### Merkle Proof Verification

Verify any step's execution integrity:

```javascript
const engine = new JSONFlowEngine();
const result = await engine.execute(workflow);

// Verify a specific step
const isValid = await engine.receiptStore.verifyReceipt('step1');
console.log('Step verified:', isValid);

// Get Merkle proof
const proof = engine.receiptStore.getMerkleProof('step1');
```

### Workflow Replay

Re-execute workflows from receipts for debugging:

```javascript
const originalResult = await engine.execute(workflow);
const receipts = originalResult.receipts;

// Replay from receipts
const replayResult = await engine.replay(receipts);
console.log('Replay verified:', replayResult.verified);
```

## API Reference

### JSONFlowEngine

#### `new JSONFlowEngine(adapters?)`
Create a new engine instance with optional custom adapters.

#### `execute(workflow): Promise<ExecutionResult>`
Execute a workflow and return results with receipts.

#### `replay(receipts): Promise<ReplayResult>`
Replay workflow from receipts for verification.

#### `registerAdapter(adapter): void`
Register a custom adapter at runtime.

#### `healthCheck(): Promise<HealthStatus>`
Check health status of all registered adapters.

#### `getStats(): Statistics`
Get execution statistics (steps, latency, status).

### Adapter (Base Class)

#### `getManifest(): AdapterManifest`
Return adapter metadata and supported step types.

#### `execute(step, context): Promise<Receipt>`
Execute a step and return a signed receipt.

#### `validate(step): ValidationResult`
Validate a step before execution.

#### `healthCheck(): Promise<HealthStatus>`
Perform health check on the adapter.

## Browser Demo

Open `browser-demo.html` in your browser for an interactive demo with:
- Visual workflow editor
- Real-time execution output
- Merkle root visualization
- Example workflows
- JSON formatting and validation

## Running Tests

```bash
# Run all examples
node jsonflow-examples.js

# Output shows:
# - Linear workflows
# - Parallel execution
# - Data transformations
# - Error handling
# - Resource management
# - Merkle proofs
# - Custom adapters
```

## Performance Characteristics

- **Minimal overhead**: Pure JavaScript with no external dependencies
- **Memory efficient**: Streaming execution, no full workflow in memory
- **Parallel-ready**: DAG scheduler identifies independent steps automatically
- **Cryptographically sound**: Uses native Web Crypto API (browser) or Node.js crypto

## Security Considerations

1. **No `eval()`**: All transformations use predefined functions
2. **Vault pointers**: Sensitive data never exposed in step params
3. **Timeout enforcement**: Every step has configurable timeout
4. **Resource limits**: RAM, GPU, and execution time constraints
5. **Merkle verification**: Tamper-proof execution history

## Roadmap

- [ ] IPFS adapter for distributed pulse propagation
- [ ] AI/Ollama adapter for deterministic inference
- [ ] Wallet/Crypto adapter with FHE support
- [ ] Quantum circuit adapter
- [ ] SolaVia formal verification adapter
- [ ] WebAssembly adapter loading
- [ ] Distributed execution across multiple nodes
- [ ] Real-time workflow visualization

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all examples pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Citation

If you use JSONFlow in research, please cite:

```
JSONFlow: A Deterministic, Content-Addressed Execution Runtime
Technical Specification v1.0, February 2026
```

## Support

- GitHub Issues: [Report bugs or request features]
- Documentation: [Full technical specification]
- Examples: See `jsonflow-examples.js` for comprehensive demos

---

**Built with ❤️ for deterministic, verifiable computation**
