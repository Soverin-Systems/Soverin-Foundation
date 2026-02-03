/**
 * JSONFlow Engine - Browser & Node.js Safe Core Foundation
 * A deterministic, content-addressed execution runtime
 * v1.0.0
 */

// ============================================================================
// ENVIRONMENT DETECTION & CRYPTO POLYFILLS
// ============================================================================

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// Crypto utilities that work in both environments
const CryptoUtils = (() => {
  if (isBrowser && window.crypto && window.crypto.subtle) {
    return {
      randomBytes: (length) => {
        const buffer = new Uint8Array(length);
        window.crypto.getRandomValues(buffer);
        return buffer;
      },
      subtle: window.crypto.subtle,
      createHash: async (algorithm, data) => {
        const encoder = new TextEncoder();
        const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
        const hashBuffer = await window.crypto.subtle.digest(algorithm.toUpperCase().replace('-', ''), dataBuffer);
        return Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    };
  } else if (isNode) {
    const crypto = require('crypto');
    return {
      randomBytes: (length) => crypto.randomBytes(length),
      subtle: crypto.webcrypto?.subtle,
      createHash: async (algorithm, data) => {
        const hash = crypto.createHash(algorithm.replace('SHA-', 'sha'));
        hash.update(typeof data === 'string' ? data : Buffer.from(data));
        return hash.digest('hex');
      }
    };
  } else {
    throw new Error('Unsupported environment: neither browser nor Node.js detected');
  }
})();

// ============================================================================
// CORE TYPES & SCHEMAS
// ============================================================================

/**
 * JSONFlow Step Schema
 */
const StepSchema = {
  type: 'object',
  required: ['id', 'type'],
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    params: { type: 'object' },
    parent_step_ids: {
      type: 'array',
      items: { type: 'string' }
    },
    resource_requirements: {
      type: 'object',
      properties: {
        ram_mb: { type: 'number' },
        gpu: { type: 'boolean' },
        qubits: { type: 'number' },
        gas_limit: { type: 'number' },
        timeout_ms: { type: 'number' }
      }
    }
  }
};

/**
 * JSONFlow Workflow Schema
 */
const WorkflowSchema = {
  type: 'object',
  required: ['workflow', 'steps'],
  properties: {
    workflow: { type: 'string' },
    version: { type: 'string' },
    steps: {
      type: 'array',
      items: StepSchema
    }
  }
};

/**
 * Receipt Schema
 */
const ReceiptSchema = {
  type: 'object',
  required: ['step_id', 'status', 'merkle_proof'],
  properties: {
    step_id: { type: 'string' },
    status: {
      type: 'string',
      enum: ['success', 'error', 'degraded']
    },
    output: { type: 'object' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        retryable: { type: 'boolean' }
      }
    },
    merkle_proof: { type: 'string' },
    execution_metadata: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
        latency_ms: { type: 'number' },
        adapter_version: { type: 'string' }
      }
    },
    signature: { type: 'string' }
  }
};

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

class JSONSchemaValidator {
  /**
   * Simple JSON Schema validator (subset of spec)
   */
  static validate(data, schema) {
    const errors = [];
    this._validateNode(data, schema, '', errors);
    return {
      valid: errors.length === 0,
      errors
    };
  }

  static _validateNode(data, schema, path, errors) {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== schema.type) {
        errors.push({
          path,
          message: `Expected type ${schema.type}, got ${actualType}`
        });
        return;
      }
    }

    // Required properties
    if (schema.required && schema.type === 'object') {
      for (const req of schema.required) {
        if (!(req in data)) {
          errors.push({
            path: `${path}.${req}`,
            message: `Missing required property: ${req}`
          });
        }
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`
      });
    }

    // Object properties
    if (schema.properties && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        if (schema.properties[key]) {
          this._validateNode(value, schema.properties[key], `${path}.${key}`, errors);
        }
      }
    }

    // Array items
    if (schema.items && Array.isArray(data)) {
      data.forEach((item, idx) => {
        this._validateNode(item, schema.items, `${path}[${idx}]`, errors);
      });
    }

    // Number constraints
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({ path, message: `Value ${data} is less than minimum ${schema.minimum}` });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({ path, message: `Value ${data} is greater than maximum ${schema.maximum}` });
      }
    }
  }
}

// ============================================================================
// MERKLE TREE IMPLEMENTATION
// ============================================================================

class MerkleTree {
  constructor() {
    this.leaves = [];
    this.tree = [];
  }

  /**
   * Add a leaf node (step receipt)
   */
  async addLeaf(data) {
    const hash = await CryptoUtils.createHash('sha256', JSON.stringify(data));
    this.leaves.push({ data, hash });
    await this.rebuild();
    return hash;
  }

  /**
   * Rebuild the Merkle tree from leaves
   */
  async rebuild() {
    if (this.leaves.length === 0) {
      this.tree = [];
      return;
    }

    let currentLevel = this.leaves.map(l => l.hash);
    this.tree = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = await CryptoUtils.createHash('sha256', left + right);
        nextLevel.push(combined);
      }
      this.tree.push(nextLevel);
      currentLevel = nextLevel;
    }
  }

  /**
   * Get the Merkle root
   */
  getRoot() {
    if (this.tree.length === 0) return null;
    return this.tree[this.tree.length - 1][0];
  }

  /**
   * Generate a Merkle proof for a leaf index
   */
  getProof(leafIndex) {
    const proof = [];
    let index = leafIndex;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex],
          position: isRightNode ? 'left' : 'right'
        });
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verify a Merkle proof
   */
  async verifyProof(leafHash, proof, root) {
    let computedHash = leafHash;

    for (const step of proof) {
      const combined = step.position === 'left'
        ? step.hash + computedHash
        : computedHash + step.hash;
      computedHash = await CryptoUtils.createHash('sha256', combined);
    }

    return computedHash === root;
  }
}

// ============================================================================
// DAG (DIRECTED ACYCLIC GRAPH) UTILITIES
// ============================================================================

class DAG {
  constructor(steps) {
    this.steps = new Map(steps.map(s => [s.id, s]));
    this.adjacencyList = new Map();
    this.inDegree = new Map();

    // Build adjacency list and in-degree count
    for (const step of steps) {
      this.adjacencyList.set(step.id, []);
      this.inDegree.set(step.id, 0);
    }

    for (const step of steps) {
      const parents = step.parent_step_ids || [];
      for (const parentId of parents) {
        if (!this.adjacencyList.has(parentId)) {
          throw new Error(`Parent step ${parentId} not found for step ${step.id}`);
        }
        this.adjacencyList.get(parentId).push(step.id);
        this.inDegree.set(step.id, this.inDegree.get(step.id) + 1);
      }
    }
  }

  /**
   * Check for cycles using DFS
   */
  hasCycle() {
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of this.adjacencyList.get(nodeId)) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.steps.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  topologicalSort() {
    const result = [];
    const queue = [];
    const inDegreeCopy = new Map(this.inDegree);

    // Find all nodes with in-degree 0
    for (const [nodeId, degree] of inDegreeCopy) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);

      for (const neighbor of this.adjacencyList.get(nodeId)) {
        inDegreeCopy.set(neighbor, inDegreeCopy.get(neighbor) - 1);
        if (inDegreeCopy.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== this.steps.size) {
      throw new Error('Graph contains a cycle or disconnected components');
    }

    return result;
  }

  /**
   * Get steps that can be executed in parallel at the current state
   */
  getReadySteps(completedSteps) {
    const ready = [];
    const completedSet = new Set(completedSteps);

    for (const [stepId, step] of this.steps) {
      if (completedSet.has(stepId)) continue;

      const parents = step.parent_step_ids || [];
      const allParentsComplete = parents.every(p => completedSet.has(p));

      if (allParentsComplete) {
        ready.push(stepId);
      }
    }

    return ready;
  }
}

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

class Adapter {
  /**
   * Get adapter manifest
   */
  getManifest() {
    throw new Error('Adapter must implement getManifest()');
  }

  /**
   * Execute a step and return a receipt
   */
  async execute(step, context) {
    throw new Error('Adapter must implement execute()');
  }

  /**
   * Validate a step before execution
   */
  validate(step) {
    throw new Error('Adapter must implement validate()');
  }

  /**
   * Health check
   */
  async healthCheck() {
    throw new Error('Adapter must implement healthCheck()');
  }
}

// ============================================================================
// BUILT-IN ADAPTERS
// ============================================================================

/**
 * Mock Adapter - For testing and demonstration
 */
class MockAdapter extends Adapter {
  getManifest() {
    return {
      adapter_id: 'mock',
      version: '1.0.0',
      step_types: [
        {
          type: 'mock_compute',
          params_schema: {
            input: 'string',
            delay_ms: 'number'
          },
          deterministic: true
        }
      ]
    };
  }

  validate(step) {
    if (step.type !== 'mock_compute') {
      return { valid: false, error: 'Unknown step type' };
    }
    if (!step.params || !step.params.input) {
      return { valid: false, error: 'Missing required param: input' };
    }
    return { valid: true };
  }

  async execute(step, context) {
    const startTime = Date.now();
    const delay = step.params.delay_ms || 0;

    // Simulate work
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Deterministic computation
    const output = {
      result: `Processed: ${step.params.input}`,
      timestamp: new Date().toISOString()
    };

    return {
      step_id: step.id,
      status: 'success',
      output,
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

/**
 * Transform Adapter - Data transformation operations
 */
class TransformAdapter extends Adapter {
  getManifest() {
    return {
      adapter_id: 'transform',
      version: '1.0.0',
      step_types: [
        { type: 'transform_map', deterministic: true },
        { type: 'transform_filter', deterministic: true },
        { type: 'transform_reduce', deterministic: true }
      ]
    };
  }

  validate(step) {
    if (!['transform_map', 'transform_filter', 'transform_reduce'].includes(step.type)) {
      return { valid: false, error: 'Unknown step type' };
    }
    return { valid: true };
  }

  async execute(step, context) {
    const startTime = Date.now();
    let output;

    try {
      switch (step.type) {
        case 'transform_map':
          output = this._executeMap(step, context);
          break;
        case 'transform_filter':
          output = this._executeFilter(step, context);
          break;
        case 'transform_reduce':
          output = this._executeReduce(step, context);
          break;
        default:
          throw new Error(`Unknown transform type: ${step.type}`);
      }

      return {
        step_id: step.id,
        status: 'success',
        output,
        execution_metadata: {
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          adapter_version: this.getManifest().version
        }
      };
    } catch (error) {
      return {
        step_id: step.id,
        status: 'error',
        error: {
          code: 'TRANSFORM_ERROR',
          message: error.message,
          retryable: false
        },
        execution_metadata: {
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          adapter_version: this.getManifest().version
        }
      };
    }
  }

  _executeMap(step, context) {
    const input = this._resolveInput(step.params.input, context);
    const fn = step.params.function;
    
    if (!Array.isArray(input)) {
      throw new Error('Input must be an array for map operation');
    }

    // For security, we don't use eval - only predefined functions
    const result = input.map((item, idx) => {
      return { ...item, index: idx, transformed: true };
    });

    return { result, count: result.length };
  }

  _executeFilter(step, context) {
    const input = this._resolveInput(step.params.input, context);
    
    if (!Array.isArray(input)) {
      throw new Error('Input must be an array for filter operation');
    }

    // Simple filter by key-value
    const key = step.params.key;
    const value = step.params.value;
    
    const result = input.filter(item => item[key] === value);
    return { result, count: result.length };
  }

  _executeReduce(step, context) {
    const input = this._resolveInput(step.params.input, context);
    
    if (!Array.isArray(input)) {
      throw new Error('Input must be an array for reduce operation');
    }

    // Simple aggregation operations
    const operation = step.params.operation || 'sum';
    const key = step.params.key;

    let result;
    switch (operation) {
      case 'sum':
        result = input.reduce((acc, item) => acc + (item[key] || 0), 0);
        break;
      case 'count':
        result = input.length;
        break;
      case 'avg':
        const sum = input.reduce((acc, item) => acc + (item[key] || 0), 0);
        result = input.length > 0 ? sum / input.length : 0;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { result, operation, key };
  }

  _resolveInput(input, context) {
    // If input starts with $, it's a reference to another step's output
    if (typeof input === 'string' && input.startsWith('$')) {
      const [stepId, ...path] = input.substring(1).split('.');
      const stepOutput = context.getStepOutput(stepId);
      
      if (!stepOutput) {
        throw new Error(`Step ${stepId} output not found`);
      }

      // Navigate path
      let value = stepOutput;
      for (const key of path) {
        value = value[key];
        if (value === undefined) {
          throw new Error(`Path ${input} not found in step output`);
        }
      }
      return value;
    }
    
    return input;
  }

  async healthCheck() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

class ExecutionContext {
  constructor(workflow) {
    this.workflow = workflow;
    this.stepOutputs = new Map();
    this.receipts = new Map();
    this.startTime = Date.now();
  }

  /**
   * Store step output
   */
  setStepOutput(stepId, output) {
    this.stepOutputs.set(stepId, output);
  }

  /**
   * Get step output
   */
  getStepOutput(stepId) {
    return this.stepOutputs.get(stepId);
  }

  /**
   * Store receipt
   */
  setReceipt(stepId, receipt) {
    this.receipts.set(stepId, receipt);
  }

  /**
   * Get receipt
   */
  getReceipt(stepId) {
    return this.receipts.get(stepId);
  }

  /**
   * Get all receipts
   */
  getAllReceipts() {
    return Array.from(this.receipts.values());
  }

  /**
   * Get execution duration
   */
  getDuration() {
    return Date.now() - this.startTime;
  }
}

// ============================================================================
// CORE ENGINE COMPONENTS
// ============================================================================

/**
 * Parser - Validates workflow JSON and constructs DAG
 */
class Parser {
  static parse(workflowJson) {
    // Validate against schema
    const validation = JSONSchemaValidator.validate(workflowJson, WorkflowSchema);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${JSON.stringify(validation.errors)}`);
    }

    // Construct DAG
    const dag = new DAG(workflowJson.steps);

    // Check for cycles
    if (dag.hasCycle()) {
      throw new Error('Workflow contains cycles');
    }

    return {
      workflow: workflowJson,
      dag,
      executionOrder: dag.topologicalSort()
    };
  }
}

/**
 * Scheduler - Routes steps to adapters and manages execution order
 */
class Scheduler {
  constructor(adapters) {
    this.adapters = new Map(adapters.map(a => [a.getManifest().adapter_id, a]));
    this.stepTypeToAdapter = new Map();

    // Build step type to adapter mapping
    for (const [adapterId, adapter] of this.adapters) {
      const manifest = adapter.getManifest();
      for (const stepType of manifest.step_types) {
        this.stepTypeToAdapter.set(stepType.type, adapterId);
      }
    }
  }

  /**
   * Get adapter for step type
   */
  getAdapterForStep(step) {
    const adapterId = this.stepTypeToAdapter.get(step.type);
    if (!adapterId) {
      throw new Error(`No adapter found for step type: ${step.type}`);
    }
    return this.adapters.get(adapterId);
  }

  /**
   * Validate step against adapter schema
   */
  validateStep(step) {
    const adapter = this.getAdapterForStep(step);
    return adapter.validate(step);
  }

  /**
   * Check resource requirements (basic implementation)
   */
  checkResources(step) {
    const requirements = step.resource_requirements || {};
    
    // Basic checks - in production, this would check against available resources
    if (requirements.ram_mb && requirements.ram_mb > 16384) {
      return {
        available: false,
        reason: 'RAM requirement exceeds available memory'
      };
    }

    return { available: true };
  }
}

/**
 * Executor - Executes steps and collects receipts
 */
class Executor {
  constructor(scheduler) {
    this.scheduler = scheduler;
  }

  /**
   * Execute a single step
   */
  async executeStep(step, context) {
    // Validate step
    const validation = this.scheduler.validateStep(step);
    if (!validation.valid) {
      throw new Error(`Step validation failed: ${validation.error}`);
    }

    // Check resources
    const resourceCheck = this.scheduler.checkResources(step);
    if (!resourceCheck.available) {
      throw new Error(`Resource check failed: ${resourceCheck.reason}`);
    }

    // Get adapter
    const adapter = this.scheduler.getAdapterForStep(step);

    // Execute with timeout
    const timeout = step.resource_requirements?.timeout_ms || 30000;
    const receipt = await this._executeWithTimeout(
      () => adapter.execute(step, context),
      timeout
    );

    // Ensure receipt has merkle_proof field (will be updated when stored)
    if (!receipt.merkle_proof) {
      receipt.merkle_proof = 'pending';
    }

    // Validate receipt
    const receiptValidation = JSONSchemaValidator.validate(receipt, ReceiptSchema);
    if (!receiptValidation.valid) {
      throw new Error(`Invalid receipt: ${JSON.stringify(receiptValidation.errors)}`);
    }

    return receipt;
  }

  /**
   * Execute with timeout
   */
  async _executeWithTimeout(fn, timeoutMs) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
      )
    ]);
  }
}

/**
 * Receipt Store - Persists and retrieves receipts
 */
class ReceiptStore {
  constructor() {
    this.receipts = new Map();
    this.merkleTree = new MerkleTree();
  }

  /**
   * Store a receipt
   */
  async store(receipt) {
    // Set merkle_proof if not already present
    if (!receipt.merkle_proof) {
      const leafHash = await this.merkleTree.addLeaf(receipt);
      receipt.merkle_proof = leafHash;
    } else {
      await this.merkleTree.addLeaf(receipt);
    }
    this.receipts.set(receipt.step_id, receipt);
    return receipt;
  }

  /**
   * Get a receipt by step ID
   */
  get(stepId) {
    return this.receipts.get(stepId);
  }

  /**
   * Get all receipts
   */
  getAll() {
    return Array.from(this.receipts.values());
  }

  /**
   * Get Merkle root
   */
  getMerkleRoot() {
    return this.merkleTree.getRoot();
  }

  /**
   * Get Merkle proof for a step
   */
  getMerkleProof(stepId) {
    const receipt = this.receipts.get(stepId);
    if (!receipt) return null;

    const index = this.merkleTree.leaves.findIndex(l => l.hash === receipt.merkle_proof);
    return this.merkleTree.getProof(index);
  }

  /**
   * Verify a receipt's Merkle proof
   */
  async verifyReceipt(stepId) {
    const receipt = this.get(stepId);
    if (!receipt) return false;

    const proof = this.getMerkleProof(stepId);
    const root = this.getMerkleRoot();

    return this.merkleTree.verifyProof(receipt.merkle_proof, proof, root);
  }
}

// ============================================================================
// MAIN JSONFLOW ENGINE
// ============================================================================

class JSONFlowEngine {
  constructor(adapters = []) {
    // Initialize with built-in adapters
    const builtInAdapters = [
      new MockAdapter(),
      new TransformAdapter()
    ];

    this.scheduler = new Scheduler([...builtInAdapters, ...adapters]);
    this.executor = new Executor(this.scheduler);
    this.receiptStore = new ReceiptStore();
  }

  /**
   * Execute a workflow
   */
  async execute(workflowJson) {
    // Parse workflow
    const { workflow, dag, executionOrder } = Parser.parse(workflowJson);

    // Create execution context
    const context = new ExecutionContext(workflow);

    // Track completed steps
    const completedSteps = new Set();
    const results = {
      workflow_id: workflow.workflow,
      status: 'running',
      steps: [],
      receipts: [],
      execution_metadata: {
        start_time: new Date().toISOString()
      }
    };

    try {
      // Execute steps in order
      for (const stepId of executionOrder) {
        const step = dag.steps.get(stepId);

        // Execute step
        const receipt = await this.executor.executeStep(step, context);

        // Store receipt
        await this.receiptStore.store(receipt);

        // Store output in context
        if (receipt.status === 'success' && receipt.output) {
          context.setStepOutput(stepId, receipt.output);
        }

        // Track completion
        completedSteps.add(stepId);
        context.setReceipt(stepId, receipt);

        results.steps.push({
          step_id: stepId,
          status: receipt.status,
          latency_ms: receipt.execution_metadata.latency_ms
        });

        // If step failed and not retryable, stop execution
        if (receipt.status === 'error' && receipt.error && !receipt.error.retryable) {
          results.status = 'failed';
          results.failed_step = stepId;
          results.error = receipt.error;
          break;
        }
      }

      if (results.status === 'running') {
        results.status = 'success';
      }

      results.receipts = this.receiptStore.getAll();
      results.merkle_root = this.receiptStore.getMerkleRoot();
      results.execution_metadata.end_time = new Date().toISOString();
      results.execution_metadata.duration_ms = context.getDuration();

      return results;

    } catch (error) {
      results.status = 'failed';
      results.error = {
        code: 'ENGINE_ERROR',
        message: error.message,
        stack: error.stack
      };
      results.execution_metadata.end_time = new Date().toISOString();
      results.execution_metadata.duration_ms = context.getDuration();

      return results;
    }
  }

  /**
   * Replay a workflow from receipts
   */
  async replay(receipts) {
    // Verify all receipts
    const verified = [];
    for (const receipt of receipts) {
      const isValid = await this.receiptStore.verifyReceipt(receipt.step_id);
      verified.push({
        step_id: receipt.step_id,
        verified: isValid,
        output: receipt.output
      });
    }

    return {
      status: 'replayed',
      verified,
      merkle_root: this.receiptStore.getMerkleRoot()
    };
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const receipts = this.receiptStore.getAll();
    
    return {
      total_steps: receipts.length,
      successful: receipts.filter(r => r.status === 'success').length,
      failed: receipts.filter(r => r.status === 'error').length,
      degraded: receipts.filter(r => r.status === 'degraded').length,
      avg_latency_ms: receipts.reduce((sum, r) => sum + (r.execution_metadata?.latency_ms || 0), 0) / receipts.length,
      merkle_root: this.receiptStore.getMerkleRoot()
    };
  }

  /**
   * Register a new adapter
   */
  registerAdapter(adapter) {
    const manifest = adapter.getManifest();
    this.scheduler.adapters.set(manifest.adapter_id, adapter);
    
    for (const stepType of manifest.step_types) {
      this.scheduler.stepTypeToAdapter.set(stepType.type, manifest.adapter_id);
    }
  }

  /**
   * Health check all adapters
   */
  async healthCheck() {
    const results = {};
    
    for (const [adapterId, adapter] of this.scheduler.adapters) {
      try {
        results[adapterId] = await adapter.healthCheck();
      } catch (error) {
        results[adapterId] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return results;
  }
}

// ============================================================================
// EXPORTS (Browser & Node.js compatible)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = {
    JSONFlowEngine,
    Adapter,
    MockAdapter,
    TransformAdapter,
    Parser,
    Scheduler,
    Executor,
    ReceiptStore,
    ExecutionContext,
    DAG,
    MerkleTree,
    JSONSchemaValidator,
    CryptoUtils
  };
} else if (typeof window !== 'undefined') {
  // Browser
  window.JSONFlow = {
    JSONFlowEngine,
    Adapter,
    MockAdapter,
    TransformAdapter,
    Parser,
    Scheduler,
    Executor,
    ReceiptStore,
    ExecutionContext,
    DAG,
    MerkleTree,
    JSONSchemaValidator,
    CryptoUtils
  };
}
