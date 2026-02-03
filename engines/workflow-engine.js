// Unified Address Dispatch Engine
// Executes JSONFlow workflows with cryptographic signing, storage, and multi-transport routing

class WorkflowEngine {
  constructor() {
    this.vault = new VaultService();
    this.ipfs = new IPFSService();
    this.crypto = new CryptoService();
    this.transports = new TransportRouter();
    this.eventBus = new EventBus();
  }

  async execute(workflow, inputs) {
    const context = {
      inputs,
      steps: {},
      outputs: {}
    };

    for (const step of workflow.steps) {
      try {
        const result = await this.executeStep(step, context);
        context.steps[step.id] = { output: result };
      } catch (error) {
        throw new Error(`Step ${step.id} failed: ${error.message}`);
      }
    }

    return context;
  }

  async executeStep(step, context) {
    const config = this.interpolate(step.config, context);

    switch (step.type) {
      case 'vault_get':
        return await this.vault.get(config.pointer);
      
      case 'crypto_sign':
        return await this.crypto.sign(config.key, config.payload);
      
      case 'ipfs_add':
        return await this.ipfs.add(config.content);
      
      case 'json_compose':
        return config.message;
      
      case 'event_emit':
        return await this.eventBus.emit(config.channel, config.payload);
      
      case 'transport_router':
        return await this.transports.route(config);
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  interpolate(config, context) {
    const json = JSON.stringify(config);
    const interpolated = json.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      return this.resolvePath(path.trim(), context);
    });
    return JSON.parse(interpolated);
  }

  resolvePath(path, context) {
    const parts = path.split('.');
    let value = context;
    
    for (const part of parts) {
      if (part === 'now') return Date.now();
      value = value?.[part];
    }
    
    return value;
  }
}

// Vault Service - Secure key storage
class VaultService {
  constructor() {
    this.storage = new Map();
  }

  async get(pointer) {
    // Parse vault:// URI
    const path = pointer.replace('vault://', '');
    
    // In production, this would use:
    // - Hardware Security Module (HSM)
    // - Encrypted local storage with passphrase
    // - Keychain/Credential Manager integration
    
    const stored = localStorage.getItem(`vault:${path}`);
    if (!stored) {
      throw new Error(`Vault key not found: ${pointer}`);
    }
    
    return JSON.parse(stored);
  }

  async set(path, value) {
    localStorage.setItem(`vault:${path}`, JSON.stringify(value));
  }

  async delete(path) {
    localStorage.removeItem(`vault:${path}`);
  }
}

// IPFS Service - Content-addressed storage
class IPFSService {
  constructor() {
    this.gateway = 'https://ipfs.io';
    // In production, use local IPFS node or Pinata/Web3.Storage
  }

  async add(content) {
    // Simulate IPFS upload
    // In production, use js-ipfs or ipfs-http-client
    
    const cid = this.generateCID(content);
    
    // Store locally for demo
    localStorage.setItem(`ipfs:${cid}`, content);
    
    return {
      cid,
      size: content.length,
      url: `${this.gateway}/ipfs/${cid}`
    };
  }

  async get(cid) {
    // Check local storage first
    const local = localStorage.getItem(`ipfs:${cid}`);
    if (local) return local;
    
    // Fetch from gateway
    const response = await fetch(`${this.gateway}/ipfs/${cid}`);
    return await response.text();
  }

  generateCID(content) {
    // Simplified CID generation
    // In production, use proper multihash
    const hash = Array.from(content)
      .reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
      .toString(36);
    
    return `Qm${hash.padStart(44, '0').substring(0, 44)}`;
  }
}

// Crypto Service - Signing and verification
class CryptoService {
  async sign(key, payload) {
    const message = JSON.stringify(payload);
    
    if (typeof key === 'string') {
      // Legacy key format - convert to CryptoKey
      key = await this.importKey(key);
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key.privateKey,
      data
    );
    
    return {
      signature: this.arrayBufferToBase64(signature),
      payload,
      algorithm: 'ECDSA-SHA256'
    };
  }

  async verify(publicKey, signature, payload) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const sig = this.base64ToArrayBuffer(signature);
    
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sig,
      data
    );
  }

  async generateKeypair() {
    const keypair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    
    return keypair;
  }

  async importKey(privateKeyString) {
    // Simplified - in production, properly import PKCS8/JWK
    const keypair = await this.generateKeypair();
    return keypair;
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Event Bus - Pub/sub for identity channels
class EventBus {
  constructor() {
    this.channels = new Map();
  }

  async emit(channel, payload) {
    // Parse identity:// URI
    const [, address, inbox] = channel.match(/identity:\/\/([^/]+)\/(.+)/) || [];
    
    if (!address) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    
    const event = {
      channel,
      address,
      inbox,
      payload,
      timestamp: Date.now(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Store in local event log
    const log = this.getEventLog(address);
    log.push(event);
    localStorage.setItem(`events:${address}`, JSON.stringify(log));
    
    // Trigger subscribers
    const subscribers = this.channels.get(channel) || [];
    subscribers.forEach(callback => callback(event));
    
    return event;
  }

  subscribe(channel, callback) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
    }
    this.channels.get(channel).push(callback);
    
    return () => this.unsubscribe(channel, callback);
  }

  unsubscribe(channel, callback) {
    const subscribers = this.channels.get(channel) || [];
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  }

  getEventLog(address) {
    const stored = localStorage.getItem(`events:${address}`);
    return stored ? JSON.parse(stored) : [];
  }
}

// Transport Router - Multi-transport fallback
class TransportRouter {
  constructor() {
    this.adapters = {
      webrtc: new WebRTCAdapter(),
      sms_gateway: new SMSGatewayAdapter(),
      smtp_gateway: new SMTPGatewayAdapter(),
      app: new AppAdapter()
    };
  }

  async route(config) {
    const { recipient, payload, fallback_order } = config;
    
    const results = {
      recipient,
      attempts: [],
      delivered: false,
      final_transport: null
    };
    
    for (const transport of fallback_order) {
      const adapter = this.adapters[transport];
      
      if (!adapter) {
        results.attempts.push({
          transport,
          status: 'adapter_not_found',
          error: `No adapter for ${transport}`
        });
        continue;
      }
      
      try {
        const result = await adapter.send(recipient, payload);
        
        results.attempts.push({
          transport,
          status: 'success',
          result
        });
        
        results.delivered = true;
        results.final_transport = transport;
        break;
      } catch (error) {
        results.attempts.push({
          transport,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    if (!results.delivered) {
      throw new Error(`All transports failed for ${recipient}`);
    }
    
    return results;
  }
}

// Transport Adapters
class WebRTCAdapter {
  async send(recipient, payload) {
    // WebRTC peer-to-peer delivery
    // In production, use WebRTC data channels
    return {
      method: 'webrtc',
      peer_connection: true,
      latency_ms: 50,
      delivered_at: Date.now()
    };
  }
}

class SMSGatewayAdapter {
  async send(recipient, payload) {
    // Route through SMS gateway (Twilio, Vonage, etc.)
    // Check if recipient has SMS bridge attached
    
    const smsConfig = this.getRecipientSMSConfig(recipient);
    
    if (!smsConfig) {
      throw new Error('Recipient has no SMS bridge attached');
    }
    
    // Simulate Twilio API call
    const message = {
      from: '+1-555-SOVEREIGN',
      to: smsConfig.number,
      body: payload.text || JSON.stringify(payload)
    };
    
    return {
      method: 'sms',
      gateway: 'twilio',
      message_sid: `SM${Math.random().toString(36).substr(2, 32)}`,
      delivered_at: Date.now()
    };
  }

  getRecipientSMSConfig(recipient) {
    // Look up recipient's attached phone number
    const config = localStorage.getItem(`transport:sms:${recipient}`);
    return config ? JSON.parse(config) : null;
  }
}

class SMTPGatewayAdapter {
  async send(recipient, payload) {
    // Route through SMTP gateway
    const emailConfig = this.getRecipientEmailConfig(recipient);
    
    if (!emailConfig) {
      throw new Error('Recipient has no email bridge attached');
    }
    
    const email = {
      from: 'noreply@sovereign.identity',
      to: emailConfig.address,
      subject: payload.email_subject || 'Message from Sovereign Network',
      body: payload.text || JSON.stringify(payload, null, 2)
    };
    
    return {
      method: 'smtp',
      message_id: `<${Math.random().toString(36).substr(2, 32)}@sovereign.identity>`,
      delivered_at: Date.now()
    };
  }

  getRecipientEmailConfig(recipient) {
    const config = localStorage.getItem(`transport:email:${recipient}`);
    return config ? JSON.parse(config) : null;
  }
}

class AppAdapter {
  async send(recipient, payload) {
    // Direct app delivery (always available)
    const inbox = this.getInbox(recipient);
    
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient,
      payload,
      delivered_at: Date.now(),
      read: false
    };
    
    inbox.push(message);
    localStorage.setItem(`inbox:${recipient}`, JSON.stringify(inbox));
    
    return {
      method: 'app',
      message_id: message.id,
      delivered_at: message.delivered_at
    };
  }

  getInbox(recipient) {
    const stored = localStorage.getItem(`inbox:${recipient}`);
    return stored ? JSON.parse(stored) : [];
  }
}

// Export the unified dispatch function
export async function unifiedAddressDispatch(inputs) {
  const workflow = {
    function: "unified_address_dispatch",
    description: "Route all communications from a single sovereign identity to multiple transports",
    steps: [
      {
        id: "load_signing_key",
        type: "vault_get",
        config: {
          pointer: "vault://identity/signing-key"
        }
      },
      {
        id: "sign_intent",
        type: "crypto_sign",
        config: {
          key: "{{steps.load_signing_key.output}}",
          payload: {
            from: "{{inputs.sender_address}}",
            to: "{{inputs.recipient_address}}",
            capabilities: ["text", "email", "video"],
            timestamp: "now"
          }
        }
      },
      {
        id: "store_video",
        type: "ipfs_add",
        config: {
          content: "{{inputs.video_blob}}"
        }
      },
      {
        id: "compose_message",
        type: "json_compose",
        config: {
          message: {
            text: "{{inputs.text}}",
            email_subject: "{{inputs.email_subject}}",
            video_cid: "{{steps.store_video.output.cid}}",
            from: "{{inputs.sender_address}}",
            to: "{{inputs.recipient_address}}"
          }
        }
      },
      {
        id: "emit_pulse",
        type: "event_emit",
        config: {
          channel: "identity://{{inputs.recipient_address}}/inbox",
          payload: {
            signature: "{{steps.sign_intent.output.signature}}",
            body: "{{steps.compose_message.output}}"
          }
        }
      },
      {
        id: "route_transports",
        type: "transport_router",
        config: {
          recipient: "{{inputs.recipient_address}}",
          payload: "{{steps.compose_message.output}}",
          fallback_order: ["webrtc", "sms_gateway", "smtp_gateway", "app"]
        }
      }
    ]
  };

  const engine = new WorkflowEngine();
  return await engine.execute(workflow, inputs);
}

// Helper function to set up initial vault
export async function initializeVault(sovereignAddress, keypair) {
  const vault = new VaultService();
  await vault.set('identity/signing-key', keypair);
  await vault.set('identity/address', sovereignAddress);
  
  return {
    address: sovereignAddress,
    vault_initialized: true
  };
}

// Helper to attach transport
export async function attachTransport(sovereignAddress, transportType, config) {
  const key = `transport:${transportType}:${sovereignAddress}`;
  localStorage.setItem(key, JSON.stringify(config));
  
  return {
    address: sovereignAddress,
    transport: transportType,
    config,
    attached_at: Date.now()
  };
}

// Helper to detach transport
export async function detachTransport(sovereignAddress, transportType) {
  const key = `transport:${transportType}:${sovereignAddress}`;
  localStorage.removeItem(key);
  
  return {
    address: sovereignAddress,
    transport: transportType,
    detached_at: Date.now()
  };
}

export {
  WorkflowEngine,
  VaultService,
  IPFSService,
  CryptoService,
  EventBus,
  TransportRouter
};
