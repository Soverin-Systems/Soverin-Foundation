/**
 * JSONFlow Phase 4: WebAssembly Adapter
 * 
 * Executes WASM modules as deterministic workflow steps.
 * Provides sandboxed execution with resource limits.
 */

const crypto = require('crypto');
const fs = require('fs');

class WASMAdapter {
  constructor(config = {}) {
    this.moduleCacheSize = config.module_cache_size || 100;
    this.memoryLimitMb = config.memory_limit_mb || 1024;
    
    // Cache compiled modules
    this.moduleCache = new Map();
    this.cacheKeys = [];
    
    // Memory management
    this.activeInstances = new Map();
  }
  
  getManifest() {
    return {
      adapter_id: 'wasm',
      version: '1.0.0',
      step_types: [
        {
          type: 'wasm_execute',
          params_schema: {
            module: 'string',
            function: 'string',
            args: 'object',
            memory_pages: 'integer'
          },
          deterministic: true
        },
        {
          type: 'wasm_load',
          params_schema: {
            module: 'string',
            imports: 'object'
          },
          deterministic: true
        },
        {
          type: 'wasm_streaming',
          params_schema: {
            module: 'string',
            function: 'string',
            input_stream: 'array'
          },
          deterministic: true
        }
      ]
    };
  }
  
  validate(step) {
    if (!['wasm_execute', 'wasm_load', 'wasm_streaming'].includes(step.type)) {
      return { valid: false, error: 'Unknown WASM step type' };
    }
    
    if (!step.params.module) {
      return { valid: false, error: 'Missing required param: module' };
    }
    
    if (step.type === 'wasm_execute' && !step.params.function) {
      return { valid: false, error: 'Missing required param: function' };
    }
    
    // Validate memory requirements
    if (step.params.memory_pages) {
      const memoryMb = (step.params.memory_pages * 64) / 1024;
      if (memoryMb > this.memoryLimitMb) {
        return { 
          valid: false, 
          error: `Memory requirement ${memoryMb}MB exceeds limit ${this.memoryLimitMb}MB` 
        };
      }
    }
    
    return { valid: true };
  }
  
  async execute(step, context) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (step.type) {
        case 'wasm_execute':
          result = await this._executeFunction(step);
          break;
        case 'wasm_load':
          result = await this._loadModule(step);
          break;
        case 'wasm_streaming':
          result = await this._streamingExecution(step);
          break;
        default:
          throw new Error(`Unsupported WASM step type: ${step.type}`);
      }
      
      return {
        step_id: step.id,
        status: 'success',
        output: result,
        execution_metadata: {
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          adapter_version: this.getManifest().version,
          module: step.params.module
        }
      };
    } catch (error) {
      return {
        step_id: step.id,
        status: 'failed',
        error: error.message,
        execution_metadata: {
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime
        }
      };
    }
  }
  
  async _executeFunction(step) {
    const modulePath = step.params.module;
    const functionName = step.params.function;
    const args = step.params.args || {};
    const memoryPages = step.params.memory_pages || 1;
    
    // Load or get cached module
    const wasmModule = await this._getModule(modulePath);
    
    // Create memory
    const memory = new WebAssembly.Memory({ initial: memoryPages });
    
    // Create imports object
    const imports = {
      env: {
        memory,
        // Standard library functions
        abort: () => { throw new Error('WASM aborted'); },
        log: (msg) => console.log('[WASM]', msg),
        ...this._createStdImports()
      }
    };
    
    // Instantiate module
    const instance = new WebAssembly.Instance(wasmModule, imports);
    
    // Track instance
    const instanceId = crypto.randomBytes(8).toString('hex');
    this.activeInstances.set(instanceId, { instance, memory });
    
    try {
      // Call function
      const fn = instance.exports[functionName];
      
      if (!fn) {
        throw new Error(`Function ${functionName} not found in module`);
      }
      
      // Convert args to WASM-compatible format
      const wasmArgs = this._prepareArgs(args, memory, instance);
      
      // Execute
      const result = fn(...wasmArgs);
      
      // Convert result back to JavaScript
      const jsResult = this._convertResult(result, memory);
      
      return {
        result: jsResult,
        memory_used_bytes: memory.buffer.byteLength,
        function: functionName
      };
    } finally {
      // Cleanup
      this.activeInstances.delete(instanceId);
    }
  }
  
  async _loadModule(step) {
    const modulePath = step.params.module;
    
    const wasmModule = await this._getModule(modulePath);
    
    // Get module info
    const exports = WebAssembly.Module.exports(wasmModule);
    const imports = WebAssembly.Module.imports(wasmModule);
    
    return {
      module_path: modulePath,
      loaded: true,
      exports: exports.map(e => ({ name: e.name, kind: e.kind })),
      imports: imports.map(i => ({ module: i.module, name: i.name, kind: i.kind }))
    };
  }
  
  async _streamingExecution(step) {
    const modulePath = step.params.module;
    const functionName = step.params.function;
    const inputStream = step.params.input_stream || [];
    
    const results = [];
    
    // Process each input through the WASM function
    for (const input of inputStream) {
      const tempStep = {
        ...step,
        params: {
          ...step.params,
          args: { data: input }
        }
      };
      
      const result = await this._executeFunction(tempStep);
      results.push(result.result);
    }
    
    return {
      results,
      processed_count: inputStream.length
    };
  }
  
  async _getModule(modulePath) {
    // Check cache
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath);
    }
    
    // Load WASM binary
    // In a real implementation, this would load from file system or network
    const wasmBinary = await this._loadWASMBinary(modulePath);
    
    // Compile module
    const wasmModule = await WebAssembly.compile(wasmBinary);
    
    // Cache module
    this._cacheModule(modulePath, wasmModule);
    
    return wasmModule;
  }
  
  async _loadWASMBinary(modulePath) {
    // Mock implementation - in reality, would load actual WASM file
    // For demonstration, we'll create a simple WASM module
    
    if (modulePath.includes('crypto_hash')) {
      return this._createSHA256Module();
    } else if (modulePath.includes('image_processor')) {
      return this._createImageProcessorModule();
    } else if (modulePath.includes('ml_training')) {
      return this._createMLModule();
    }
    
    // Default: minimal module
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // Magic number
      0x01, 0x00, 0x00, 0x00  // Version
    ]);
  }
  
  _createSHA256Module() {
    // This would be actual compiled WASM
    // For now, return mock binary
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
    ]);
  }
  
  _createImageProcessorModule() {
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
    ]);
  }
  
  _createMLModule() {
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
    ]);
  }
  
  _cacheModule(key, module) {
    // Implement LRU cache
    if (this.moduleCache.size >= this.moduleCacheSize) {
      const oldestKey = this.cacheKeys.shift();
      this.moduleCache.delete(oldestKey);
    }
    
    this.moduleCache.set(key, module);
    this.cacheKeys.push(key);
  }
  
  _createStdImports() {
    // Standard library functions available to WASM
    return {
      Math_random: Math.random,
      Date_now: Date.now,
      console_log: console.log
    };
  }
  
  _prepareArgs(args, memory, instance) {
    // Convert JavaScript objects to WASM-compatible types
    const wasmArgs = [];
    
    Object.values(args).forEach(arg => {
      if (typeof arg === 'number') {
        wasmArgs.push(arg);
      } else if (typeof arg === 'string') {
        // Write string to memory and pass pointer
        const ptr = this._writeStringToMemory(arg, memory, instance);
        wasmArgs.push(ptr);
      } else if (typeof arg === 'object') {
        // Serialize and write to memory
        const json = JSON.stringify(arg);
        const ptr = this._writeStringToMemory(json, memory, instance);
        wasmArgs.push(ptr);
      }
    });
    
    return wasmArgs;
  }
  
  _writeStringToMemory(str, memory, instance) {
    // Allocate memory (if malloc is available)
    const len = str.length;
    let ptr = 0;
    
    if (instance.exports.malloc) {
      ptr = instance.exports.malloc(len + 1);
    }
    
    // Write string to memory
    const buffer = new Uint8Array(memory.buffer);
    for (let i = 0; i < len; i++) {
      buffer[ptr + i] = str.charCodeAt(i);
    }
    buffer[ptr + len] = 0; // Null terminator
    
    return ptr;
  }
  
  _convertResult(result, memory) {
    // Convert WASM result to JavaScript
    if (typeof result === 'number') {
      // Check if it's a pointer to string or object
      if (result > 0 && result < memory.buffer.byteLength) {
        // Try to read as string
        try {
          return this._readStringFromMemory(result, memory);
        } catch (e) {
          return result;
        }
      }
      return result;
    }
    
    return result;
  }
  
  _readStringFromMemory(ptr, memory) {
    const buffer = new Uint8Array(memory.buffer);
    let str = '';
    let i = ptr;
    
    while (buffer[i] !== 0 && i < buffer.length) {
      str += String.fromCharCode(buffer[i]);
      i++;
    }
    
    return str;
  }
  
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache_size: this.moduleCache.size,
      active_instances: this.activeInstances.size,
      memory_limit_mb: this.memoryLimitMb
    };
  }
  
  // Utility: Validate WASM module
  static async validate(modulePath) {
    try {
      const binary = fs.readFileSync(modulePath);
      await WebAssembly.validate(binary);
      return true;
    } catch (error) {
      console.error('WASM validation failed:', error.message);
      return false;
    }
  }
}

// WASM Module Builder
class WASMModuleBuilder {
  constructor() {
    this.functions = [];
    this.imports = [];
    this.exports = [];
  }
  
  addFunction(name, params, body) {
    this.functions.push({ name, params, body });
    return this;
  }
  
  addImport(module, name, type) {
    this.imports.push({ module, name, type });
    return this;
  }
  
  addExport(name, index) {
    this.exports.push({ name, index });
    return this;
  }
  
  build() {
    // This would generate actual WASM binary
    // For now, return minimal module
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // Magic
      0x01, 0x00, 0x00, 0x00  // Version
    ]);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WASMAdapter, WASMModuleBuilder };
}

if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.WASMAdapter = WASMAdapter;
  window.JSONFlow.WASMModuleBuilder = WASMModuleBuilder;
}
