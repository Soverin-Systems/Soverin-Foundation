/**
 * JSONFlow IPFS/P2P Adapter
 * Distributed workflow execution via content-addressed pulses
 * Phase 2 - Week 5-8 Implementation
 */

// Import base adapter
let Adapter;
if (typeof require !== 'undefined') {
  const JSONFlow = require('./jsonflow-engine.js');
  Adapter = JSONFlow.Adapter;
} else {
  Adapter = window.JSONFlow.Adapter;
}

// ============================================================================
// IPFS CLIENT (Browser & Node.js Compatible)
// ============================================================================

class IPFSClient {
  constructor(apiUrl = 'http://localhost:5001') {
    this.apiUrl = apiUrl;
    this.gateway = 'http://localhost:8080';
  }

  /**
   * Add content to IPFS
   */
  async add(content) {
    const formData = new FormData();
    
    // Handle different content types
    if (typeof content === 'string') {
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob);
    } else if (content instanceof Blob) {
      formData.append('file', content);
    } else {
      // Assume it's JSON
      const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
      formData.append('file', blob);
    }

    const response = await fetch(`${this.apiUrl}/api/v0/add`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`IPFS API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      cid: result.Hash,
      size: result.Size,
      name: result.Name
    };
  }

  /**
   * Get content from IPFS
   */
  async get(cid) {
    const response = await fetch(`${this.gateway}/ipfs/${cid}`);
    
    if (!response.ok) {
      throw new Error(`IPFS fetch error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  /**
   * Pin content to local node
   */
  async pin(cid) {
    const response = await fetch(`${this.apiUrl}/api/v0/pin/add?arg=${cid}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`IPFS pin error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      cid: result.Pins[0],
      pinned: true
    };
  }

  /**
   * Unpin content
   */
  async unpin(cid) {
    const response = await fetch(`${this.apiUrl}/api/v0/pin/rm?arg=${cid}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`IPFS unpin error: ${response.statusText}`);
    }

    return { cid, unpinned: true };
  }

  /**
   * Publish to pubsub topic
   */
  async pubsubPublish(topic, message) {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    
    const response = await fetch(`${this.apiUrl}/api/v0/pubsub/pub?arg=${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: data
    });

    if (!response.ok) {
      throw new Error(`IPFS pubsub publish error: ${response.statusText}`);
    }

    return { topic, published: true };
  }

  /**
   * Subscribe to pubsub topic
   */
  async pubsubSubscribe(topic, callback) {
    // Note: WebSocket or EventSource would be used in production
    // This is a simplified polling implementation
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${this.apiUrl}/api/v0/pubsub/sub?arg=${encodeURIComponent(topic)}`,
          { method: 'POST' }
        );

        if (response.ok) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
              try {
                const message = JSON.parse(line);
                const data = new TextDecoder().decode(
                  Uint8Array.from(atob(message.data), c => c.charCodeAt(0))
                );
                callback({ topic, data, from: message.from });
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        console.error('Pubsub error:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  /**
   * List pinned content
   */
  async listPins() {
    const response = await fetch(`${this.apiUrl}/api/v0/pin/ls`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`IPFS list pins error: ${response.statusText}`);
    }

    const result = await response.json();
    return Object.keys(result.Keys || {});
  }

  /**
   * Check IPFS daemon status
   */
  async ping() {
    try {
      const response = await fetch(`${this.apiUrl}/api/v0/version`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get node info
   */
  async id() {
    const response = await fetch(`${this.apiUrl}/api/v0/id`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`IPFS id error: ${response.statusText}`);
    }

    return await response.json();
  }
}

// ============================================================================
// MOCK IPFS CLIENT (For when IPFS is not available)
// ============================================================================

class MockIPFSClient {
  constructor() {
    this.storage = new Map();
    this.pins = new Set();
    this.topics = new Map();
    this.peerId = 'QmMock' + Math.random().toString(36).substring(7);
  }

  /**
   * Generate mock CID
   */
  _generateCID(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'bafkreib' + Math.abs(hash).toString(36).padStart(48, '0');
  }

  async add(content) {
    const cid = this._generateCID(content);
    this.storage.set(cid, content);
    
    return {
      cid,
      size: JSON.stringify(content).length,
      name: 'file'
    };
  }

  async get(cid) {
    if (!this.storage.has(cid)) {
      throw new Error(`CID not found: ${cid}`);
    }
    return this.storage.get(cid);
  }

  async pin(cid) {
    if (!this.storage.has(cid)) {
      throw new Error(`Cannot pin non-existent CID: ${cid}`);
    }
    this.pins.add(cid);
    return { cid, pinned: true };
  }

  async unpin(cid) {
    this.pins.delete(cid);
    return { cid, unpinned: true };
  }

  async pubsubPublish(topic, message) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, []);
    }
    
    this.topics.get(topic).push({
      timestamp: Date.now(),
      message,
      from: this.peerId
    });

    return { topic, published: true };
  }

  async pubsubSubscribe(topic, callback) {
    // Mock subscription - just calls callback with existing messages
    if (this.topics.has(topic)) {
      const messages = this.topics.get(topic);
      messages.forEach(msg => {
        setTimeout(() => {
          callback({
            topic,
            data: typeof msg.message === 'string' ? msg.message : JSON.stringify(msg.message),
            from: msg.from
          });
        }, 100);
      });
    }

    return () => {}; // Unsubscribe function
  }

  async listPins() {
    return Array.from(this.pins);
  }

  async ping() {
    return true;
  }

  async id() {
    return {
      ID: this.peerId,
      PublicKey: 'mock-public-key',
      Addresses: ['/ip4/127.0.0.1/tcp/4001'],
      AgentVersion: 'mock-ipfs/0.1.0',
      ProtocolVersion: 'ipfs/0.1.0'
    };
  }
}

// ============================================================================
// IPFS/P2P ADAPTER
// ============================================================================

class IPFSAdapter extends Adapter {
  constructor(apiUrl = 'http://localhost:5001', useMock = false) {
    super();
    this.apiUrl = apiUrl;
    this.useMock = useMock;
    this.client = null;
    this.initialized = false;
    this.subscriptions = new Map();
  }

  /**
   * Initialize IPFS client
   */
  async initialize() {
    if (this.initialized) return;

    if (this.useMock) {
      this.client = new MockIPFSClient();
      this.initialized = true;
      return;
    }

    const realClient = new IPFSClient(this.apiUrl);
    const isAvailable = await realClient.ping();

    if (isAvailable) {
      this.client = realClient;
      console.log('✓ Connected to IPFS at', this.apiUrl);
    } else {
      console.warn('⚠ IPFS not available, using mock client');
      this.client = new MockIPFSClient();
    }

    this.initialized = true;
  }

  getManifest() {
    return {
      adapter_id: 'ipfs_p2p',
      version: '1.0.0',
      step_types: [
        {
          type: 'ipfs_add',
          description: 'Add content to IPFS and return CID',
          params_schema: {
            content: 'any'
          },
          resource_requirements: {
            ram_mb: 512,
            gpu: false
          },
          deterministic: true
        },
        {
          type: 'ipfs_get',
          description: 'Retrieve content from IPFS by CID',
          params_schema: {
            cid: 'string'
          },
          resource_requirements: {
            ram_mb: 512,
            gpu: false
          },
          deterministic: false
        },
        {
          type: 'ipfs_pin',
          description: 'Pin content to local or remote pinning service',
          params_schema: {
            cid: 'string',
            service: 'string'
          },
          resource_requirements: {
            ram_mb: 256,
            gpu: false
          },
          deterministic: false
        },
        {
          type: 'ipfs_unpin',
          description: 'Unpin content from storage',
          params_schema: {
            cid: 'string'
          },
          resource_requirements: {
            ram_mb: 256,
            gpu: false
          },
          deterministic: false
        },
        {
          type: 'ipfs_pubsub_publish',
          description: 'Publish workflow pulse to topic',
          params_schema: {
            topic: 'string',
            message: 'any'
          },
          resource_requirements: {
            ram_mb: 256,
            gpu: false
          },
          deterministic: false
        },
        {
          type: 'ipfs_pubsub_subscribe',
          description: 'Subscribe to workflow namespace',
          params_schema: {
            topic: 'string',
            callback: 'function'
          },
          resource_requirements: {
            ram_mb: 512,
            gpu: false
          },
          deterministic: false
        },
        {
          type: 'ipfs_workflow_pulse',
          description: 'Emit workflow execution as IPFS pulse',
          params_schema: {
            workflow_id: 'string',
            receipts: 'array',
            merkle_root: 'string'
          },
          resource_requirements: {
            ram_mb: 1024,
            gpu: false
          },
          deterministic: true
        }
      ],
      cid: 'Qmipfs_adapter_v100'
    };
  }

  validate(step) {
    const validTypes = [
      'ipfs_add', 'ipfs_get', 'ipfs_pin', 'ipfs_unpin',
      'ipfs_pubsub_publish', 'ipfs_pubsub_subscribe', 'ipfs_workflow_pulse'
    ];

    if (!validTypes.includes(step.type)) {
      return { valid: false, error: `Unknown step type: ${step.type}` };
    }

    if (step.type === 'ipfs_add' && !step.params.content) {
      return { valid: false, error: 'Missing required param: content' };
    }

    if (['ipfs_get', 'ipfs_pin', 'ipfs_unpin'].includes(step.type) && !step.params.cid) {
      return { valid: false, error: 'Missing required param: cid' };
    }

    if (['ipfs_pubsub_publish', 'ipfs_pubsub_subscribe'].includes(step.type) && !step.params.topic) {
      return { valid: false, error: 'Missing required param: topic' };
    }

    if (step.type === 'ipfs_workflow_pulse') {
      if (!step.params.workflow_id || !step.params.receipts || !step.params.merkle_root) {
        return { valid: false, error: 'Missing required params for workflow pulse' };
      }
    }

    return { valid: true };
  }

  async execute(step, context) {
    await this.initialize();

    const startTime = Date.now();

    try {
      let output;

      switch (step.type) {
        case 'ipfs_add':
          output = await this._executeAdd(step);
          break;
        case 'ipfs_get':
          output = await this._executeGet(step);
          break;
        case 'ipfs_pin':
          output = await this._executePin(step);
          break;
        case 'ipfs_unpin':
          output = await this._executeUnpin(step);
          break;
        case 'ipfs_pubsub_publish':
          output = await this._executePubsubPublish(step);
          break;
        case 'ipfs_pubsub_subscribe':
          output = await this._executePubsubSubscribe(step);
          break;
        case 'ipfs_workflow_pulse':
          output = await this._executeWorkflowPulse(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
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
          code: 'IPFS_EXECUTION_ERROR',
          message: error.message,
          retryable: true
        },
        execution_metadata: {
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          adapter_version: this.getManifest().version
        }
      };
    }
  }

  /**
   * Add content to IPFS
   */
  async _executeAdd(step) {
    const { content } = step.params;
    const result = await this.client.add(content);

    return {
      cid: result.cid,
      size: result.size,
      content_type: typeof content,
      ipfs_url: `ipfs://${result.cid}`,
      gateway_url: `${this.client.gateway || 'https://ipfs.io'}/ipfs/${result.cid}`
    };
  }

  /**
   * Get content from IPFS
   */
  async _executeGet(step) {
    const { cid } = step.params;
    const content = await this.client.get(cid);

    return {
      cid,
      content,
      content_type: typeof content,
      retrieved_at: new Date().toISOString()
    };
  }

  /**
   * Pin content
   */
  async _executePin(step) {
    const { cid, service } = step.params;
    
    if (service && service !== 'local') {
      // Remote pinning service integration would go here
      throw new Error('Remote pinning services not yet implemented');
    }

    const result = await this.client.pin(cid);

    return {
      cid: result.cid,
      pinned: result.pinned,
      service: 'local',
      pinned_at: new Date().toISOString()
    };
  }

  /**
   * Unpin content
   */
  async _executeUnpin(step) {
    const { cid } = step.params;
    const result = await this.client.unpin(cid);

    return {
      cid: result.cid,
      unpinned: result.unpinned,
      unpinned_at: new Date().toISOString()
    };
  }

  /**
   * Publish to pubsub
   */
  async _executePubsubPublish(step) {
    const { topic, message } = step.params;
    const result = await this.client.pubsubPublish(topic, message);

    return {
      topic: result.topic,
      published: result.published,
      message_size: JSON.stringify(message).length,
      published_at: new Date().toISOString()
    };
  }

  /**
   * Subscribe to pubsub
   */
  async _executePubsubSubscribe(step) {
    const { topic, callback } = step.params;

    const unsubscribe = await this.client.pubsubSubscribe(topic, (message) => {
      if (callback && typeof callback === 'function') {
        callback(message);
      }
    });

    // Store subscription for cleanup
    this.subscriptions.set(step.id, unsubscribe);

    return {
      topic,
      subscribed: true,
      subscription_id: step.id,
      subscribed_at: new Date().toISOString()
    };
  }

  /**
   * Emit workflow pulse
   */
  async _executeWorkflowPulse(step) {
    const { workflow_id, receipts, merkle_root } = step.params;

    // Construct pulse as IPFS DAG node
    const pulse = {
      workflow_id,
      merkle_root,
      receipts,
      timestamp: new Date().toISOString(),
      protocol_version: '1.0.0'
    };

    // Add pulse to IPFS
    const result = await this.client.add(pulse);

    // Publish to workflow namespace
    const topic = `/jsonflow/${workflow_id}`;
    await this.client.pubsubPublish(topic, {
      type: 'workflow_pulse',
      pulse_cid: result.cid,
      workflow_id,
      merkle_root
    });

    return {
      pulse_cid: result.cid,
      workflow_id,
      merkle_root,
      topic,
      receipts_count: receipts.length,
      ipfs_url: `ipfs://${result.cid}`,
      published_at: new Date().toISOString()
    };
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    for (const [id, unsubscribe] of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions.clear();
  }

  async healthCheck() {
    await this.initialize();

    const isHealthy = await this.client.ping();
    let nodeInfo = null;

    try {
      nodeInfo = await this.client.id();
    } catch (error) {
      // Ignore if we can't get node info
    }

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ipfs_api_url: this.apiUrl,
      using_mock: this.client instanceof MockIPFSClient,
      node_id: nodeInfo?.ID || 'unknown',
      active_subscriptions: this.subscriptions.size
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IPFSAdapter,
    IPFSClient,
    MockIPFSClient
  };
} else if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.IPFSAdapter = IPFSAdapter;
  window.JSONFlow.IPFSClient = IPFSClient;
  window.JSONFlow.MockIPFSClient = MockIPFSClient;
}
