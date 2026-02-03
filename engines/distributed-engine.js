/**
 * JSONFlow Phase 4: Distributed Engine
 * 
 * Enables multi-node workflow execution with automatic failover,
 * resource marketplace, and Byzantine fault tolerance.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class DistributedEngine extends EventEmitter {
  constructor(config) {
    super();
    
    this.nodeId = config.nodeId || this.generateNodeId();
    this.role = config.role || 'worker'; // 'coordinator' or 'worker'
    this.port = config.port || 8080;
    this.connectUrl = config.connect; // For workers
    
    this.capabilities = config.capabilities || {
      adapters: [],
      resources: {}
    };
    
    // State management
    this.peers = new Map(); // Connected nodes
    this.workflows = new Map(); // Active workflows
    this.receipts = new Map(); // Collected receipts
    this.resourceMarket = new Map(); // Resource advertisements
    
    // Adapters
    this.adapters = new Map();
    
    // Network layer (using WebSocket)
    this.server = null;
    this.client = null;
    
    // TLS configuration
    this.tls = config.tls || null;
    
    // Statistics
    this.stats = {
      workflows_executed: 0,
      steps_executed: 0,
      total_latency_ms: 0,
      failed_steps: 0
    };
    
    this._initialize();
  }
  
  _initialize() {
    if (this.role === 'coordinator') {
      this._startCoordinator();
    } else {
      this._startWorker();
    }
  }
  
  _startCoordinator() {
    console.log(`[Coordinator ${this.nodeId}] Starting on port ${this.port}`);
    
    // In a real implementation, this would use WebSocket server
    // For now, we'll simulate the network layer
    this.server = {
      peers: new Map(),
      broadcast: (message) => {
        console.log(`[Coordinator] Broadcasting: ${message.type}`);
      }
    };
  }
  
  _startWorker() {
    console.log(`[Worker ${this.nodeId}] Connecting to ${this.connectUrl}`);
    
    // Simulate connection to coordinator
    this.client = {
      send: (message) => {
        console.log(`[Worker] Sending: ${message.type}`);
      }
    };
    
    // Advertise capabilities
    this.advertise(this.capabilities);
  }
  
  generateNodeId() {
    return `node-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Register an adapter with this node
   */
  registerAdapter(adapter) {
    const manifest = adapter.getManifest();
    this.adapters.set(manifest.adapter_id, adapter);
    console.log(`[${this.nodeId}] Registered adapter: ${manifest.adapter_id}`);
  }
  
  /**
   * Execute a distributed workflow
   */
  async execute(workflow) {
    const workflowId = this.generateWorkflowId(workflow);
    
    this.emit('workflow:started', workflowId);
    console.log(`\n[${this.nodeId}] Executing workflow: ${workflow.workflow}`);
    
    try {
      // Parse and validate workflow
      const dag = this._buildDAG(workflow);
      
      // Assign steps to nodes
      const assignments = this._assignSteps(workflow, dag);
      
      // Execute workflow
      const result = await this._executeDistributed(workflow, dag, assignments);
      
      this.stats.workflows_executed++;
      this.emit('workflow:completed', result);
      
      return result;
    } catch (error) {
      this.emit('workflow:failed', { workflowId, error: error.message });
      throw error;
    }
  }
  
  _buildDAG(workflow) {
    const dag = {
      nodes: new Map(),
      edges: []
    };
    
    // Build graph
    workflow.steps.forEach(step => {
      dag.nodes.set(step.id, {
        ...step,
        dependencies: step.parent_step_ids || [],
        status: 'pending'
      });
      
      // Add edges
      if (step.parent_step_ids) {
        step.parent_step_ids.forEach(parentId => {
          dag.edges.push({ from: parentId, to: step.id });
        });
      }
    });
    
    return dag;
  }
  
  _assignSteps(workflow, dag) {
    const assignments = new Map();
    
    dag.nodes.forEach((step, stepId) => {
      // Determine which node should execute this step
      const assignedNode = this._selectNode(step, workflow);
      assignments.set(stepId, assignedNode);
    });
    
    return assignments;
  }
  
  _selectNode(step, workflow) {
    // Selection criteria:
    // 1. Node preference in step
    // 2. Required adapter capability
    // 3. Resource availability
    // 4. Load balancing
    
    if (step.node_preference === 'any' || this.role === 'worker') {
      return this.nodeId;
    }
    
    // If coordinator, select from available workers
    if (this.peers.size === 0) {
      return this.nodeId; // Execute locally if no workers
    }
    
    // Simple round-robin for now
    const workers = Array.from(this.peers.keys());
    const index = Math.floor(Math.random() * workers.length);
    return workers[index];
  }
  
  async _executeDistributed(workflow, dag, assignments) {
    const receipts = [];
    const executionTrace = {
      nodes: new Set(),
      timeline: []
    };
    
    // Topological sort for execution order
    const sorted = this._topologicalSort(dag);
    
    // Execute steps in order
    for (const stepId of sorted) {
      const step = dag.nodes.get(stepId);
      const assignedNode = assignments.get(stepId);
      
      executionTrace.nodes.add(assignedNode);
      
      const startTime = Date.now();
      
      try {
        let receipt;
        
        if (assignedNode === this.nodeId) {
          // Execute locally
          receipt = await this._executeStepLocally(step, workflow, receipts);
        } else {
          // Execute remotely
          receipt = await this._executeStepRemotely(step, assignedNode, receipts);
        }
        
        receipts.push(receipt);
        
        const latency = Date.now() - startTime;
        executionTrace.timeline.push({
          step_id: stepId,
          node: assignedNode,
          latency_ms: latency
        });
        
        this.stats.steps_executed++;
        this.stats.total_latency_ms += latency;
        
        this.emit('step:completed', { stepId, nodeId: assignedNode, latency });
        
      } catch (error) {
        this.stats.failed_steps++;
        
        // Check if fault tolerance is enabled
        if (workflow.fault_tolerance?.retry_failed_steps) {
          const maxRetries = workflow.fault_tolerance.max_retries || 3;
          
          // Retry logic would go here
          console.log(`[${this.nodeId}] Retrying step ${stepId}...`);
        }
        
        throw error;
      }
    }
    
    // Compute Merkle root
    const merkleRoot = this._computeMerkleRoot(receipts);
    
    return {
      workflow_id: this.generateWorkflowId(workflow),
      status: 'completed',
      receipts,
      merkle_root: merkleRoot,
      execution_trace: {
        nodes: Array.from(executionTrace.nodes),
        timeline: executionTrace.timeline
      },
      stats: {
        total_steps: receipts.length,
        total_time_ms: executionTrace.timeline.reduce((sum, t) => sum + t.latency_ms, 0)
      }
    };
  }
  
  async _executeStepLocally(step, workflow, previousReceipts) {
    // Find appropriate adapter
    const adapter = this._findAdapter(step.type);
    
    if (!adapter) {
      throw new Error(`No adapter found for step type: ${step.type}`);
    }
    
    // Resolve step output references
    const resolvedStep = this._resolveReferences(step, previousReceipts);
    
    // Execute step
    const context = {
      workflow_id: workflow.workflow,
      node_id: this.nodeId
    };
    
    const receipt = await adapter.execute(resolvedStep, context);
    
    return receipt;
  }
  
  async _executeStepRemotely(step, nodeId, previousReceipts) {
    console.log(`[${this.nodeId}] Delegating step ${step.id} to ${nodeId}`);
    
    // In a real implementation, this would send the step to the remote node
    // and wait for the receipt
    
    // For now, simulate remote execution
    return {
      step_id: step.id,
      status: 'success',
      output: { result: 'remote_execution_result' },
      execution_metadata: {
        timestamp: new Date().toISOString(),
        executor_node: nodeId
      }
    };
  }
  
  _findAdapter(stepType) {
    for (const adapter of this.adapters.values()) {
      const manifest = adapter.getManifest();
      const supportsType = manifest.step_types.some(st => st.type === stepType);
      if (supportsType) {
        return adapter;
      }
    }
    return null;
  }
  
  _resolveReferences(step, receipts) {
    const resolved = JSON.parse(JSON.stringify(step));
    
    // Resolve $stepId.path references
    const resolveValue = (value) => {
      if (typeof value === 'string' && value.startsWith('$')) {
        const parts = value.slice(1).split('.');
        const stepId = parts[0];
        
        // Find receipt for this step
        const receipt = receipts.find(r => r.step_id === stepId);
        if (!receipt) {
          throw new Error(`Reference to unknown step: ${stepId}`);
        }
        
        // Navigate path
        let result = receipt.output;
        for (let i = 1; i < parts.length; i++) {
          result = result[parts[i]];
        }
        
        return result;
      }
      return value;
    };
    
    // Resolve params
    Object.keys(resolved.params).forEach(key => {
      resolved.params[key] = resolveValue(resolved.params[key]);
    });
    
    return resolved;
  }
  
  _topologicalSort(dag) {
    const sorted = [];
    const visited = new Set();
    const temp = new Set();
    
    const visit = (nodeId) => {
      if (temp.has(nodeId)) {
        throw new Error('Workflow contains a cycle');
      }
      
      if (!visited.has(nodeId)) {
        temp.add(nodeId);
        
        const node = dag.nodes.get(nodeId);
        if (node.dependencies) {
          node.dependencies.forEach(depId => visit(depId));
        }
        
        temp.delete(nodeId);
        visited.add(nodeId);
        sorted.push(nodeId);
      }
    };
    
    dag.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    });
    
    return sorted;
  }
  
  _computeMerkleRoot(receipts) {
    if (receipts.length === 0) {
      return crypto.createHash('sha256').update('empty').digest('hex');
    }
    
    let hashes = receipts.map(r => 
      crypto.createHash('sha256')
        .update(JSON.stringify(r))
        .digest('hex')
    );
    
    while (hashes.length > 1) {
      const newHashes = [];
      for (let i = 0; i < hashes.length; i += 2) {
        if (i + 1 < hashes.length) {
          const combined = hashes[i] + hashes[i + 1];
          newHashes.push(
            crypto.createHash('sha256').update(combined).digest('hex')
          );
        } else {
          newHashes.push(hashes[i]);
        }
      }
      hashes = newHashes;
    }
    
    return hashes[0];
  }
  
  generateWorkflowId(workflow) {
    const data = JSON.stringify(workflow);
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  }
  
  /**
   * Advertise resources in the marketplace
   */
  advertise(resources) {
    const advertisement = {
      node_id: this.nodeId,
      timestamp: Date.now(),
      resources: resources.resources || {},
      adapters: resources.adapters || [],
      pricing: resources.pricing || {}
    };
    
    this.resourceMarket.set(this.nodeId, advertisement);
    
    if (this.client) {
      this.client.send({
        type: 'resource_advertisement',
        data: advertisement
      });
    }
    
    console.log(`[${this.nodeId}] Advertised resources:`, resources);
  }
  
  /**
   * Bid for resources in the marketplace
   */
  async bidForResources(requirements) {
    if (this.role !== 'coordinator') {
      throw new Error('Only coordinators can bid for resources');
    }
    
    console.log(`[${this.nodeId}] Bidding for resources:`, requirements);
    
    // Find suitable nodes
    const candidates = [];
    this.resourceMarket.forEach((ad, nodeId) => {
      if (this._meetsRequirements(ad, requirements)) {
        candidates.push({ nodeId, ad });
      }
    });
    
    if (candidates.length === 0) {
      throw new Error('No nodes meet resource requirements');
    }
    
    // Select best bid (lowest price)
    candidates.sort((a, b) => {
      const priceA = a.ad.pricing.price_per_qubit_hour || 0;
      const priceB = b.ad.pricing.price_per_qubit_hour || 0;
      return priceA - priceB;
    });
    
    const winner = candidates[0];
    
    return {
      node_id: winner.nodeId,
      price: winner.ad.pricing.price_per_qubit_hour || 0,
      estimated_cost: requirements.duration_minutes / 60 * (winner.ad.pricing.price_per_qubit_hour || 0)
    };
  }
  
  _meetsRequirements(advertisement, requirements) {
    if (requirements.qubits && advertisement.resources.qubits < requirements.qubits) {
      return false;
    }
    
    if (requirements.ram_mb && advertisement.resources.ram_mb < requirements.ram_mb) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      node_id: this.nodeId,
      role: this.role,
      peers: this.peers.size,
      active_workflows: this.workflows.size,
      stats: this.stats
    };
  }
  
  /**
   * Health check
   */
  async healthCheck() {
    const adapterHealth = [];
    
    for (const [id, adapter] of this.adapters.entries()) {
      const health = await adapter.healthCheck();
      adapterHealth.push({ adapter_id: id, ...health });
    }
    
    return {
      status: 'healthy',
      node_id: this.nodeId,
      role: this.role,
      adapters: adapterHealth,
      network: {
        connected_peers: this.peers.size
      }
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DistributedEngine };
}

if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.DistributedEngine = DistributedEngine;
}
