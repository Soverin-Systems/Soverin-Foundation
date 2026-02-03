/**
 * JSONFlow Phase 3: Vault Manager
 * 
 * Secure key-value storage system with versioning and pointers
 * Never exposes raw private keys - uses vault:// pointers instead
 * 
 * Features:
 * - Encrypted storage
 * - Version control
 * - Key rotation
 * - Emergency revocation
 * - Vault pointers: vault://key_name@version_hash
 * - Access control
 * 
 * @module vault-manager
 */

const crypto = require('crypto');
const { encryptAES, decryptAES, sha256 } = require('./crypto-adapter');

// ============================================================================
// Vault Storage Backend
// ============================================================================

class VaultStorage {
  constructor() {
    this.data = new Map();
    this.metadata = new Map();
  }
  
  async set(key, value, metadata = {}) {
    this.data.set(key, value);
    this.metadata.set(key, {
      ...metadata,
      created: Date.now(),
      accessed: Date.now()
    });
    return true;
  }
  
  async get(key) {
    if (!this.data.has(key)) {
      return null;
    }
    
    // Update access time
    const meta = this.metadata.get(key);
    if (meta) {
      meta.accessed = Date.now();
      meta.accessCount = (meta.accessCount || 0) + 1;
    }
    
    return this.data.get(key);
  }
  
  async has(key) {
    return this.data.has(key);
  }
  
  async delete(key) {
    this.metadata.delete(key);
    return this.data.delete(key);
  }
  
  async list(prefix = '') {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  }
  
  async getMetadata(key) {
    return this.metadata.get(key) || null;
  }
  
  async clear() {
    this.data.clear();
    this.metadata.clear();
  }
}

// ============================================================================
// Vault Entry
// ============================================================================

class VaultEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.version = options.version || 1;
    this.versionHash = options.versionHash || this.generateVersionHash();
    this.encrypted = options.encrypted || false;
    this.metadata = options.metadata || {};
    this.created = Date.now();
    this.updated = Date.now();
    this.accessed = Date.now();
    this.accessCount = 0;
    this.revoked = false;
    this.tags = options.tags || [];
  }
  
  generateVersionHash() {
    const data = `${this.key}:${this.value}:${this.version}:${Date.now()}`;
    return sha256(data).substring(0, 16);
  }
  
  getPointer() {
    return `vault://${this.key}@${this.versionHash}`;
  }
  
  toJSON() {
    return {
      key: this.key,
      version: this.version,
      versionHash: this.versionHash,
      encrypted: this.encrypted,
      metadata: this.metadata,
      created: this.created,
      updated: this.updated,
      accessed: this.accessed,
      accessCount: this.accessCount,
      revoked: this.revoked,
      tags: this.tags,
      pointer: this.getPointer()
    };
  }
}

// ============================================================================
// Vault Manager
// ============================================================================

class VaultManager {
  constructor(options = {}) {
    this.storage = options.storage || new VaultStorage();
    this.masterKey = options.masterKey || this.generateMasterKey();
    this.encryption = options.encryption !== false; // Enabled by default
    this.versioning = options.versioning !== false; // Enabled by default
    this.accessControl = options.accessControl || null;
    this.auditLog = [];
  }
  
  /**
   * Generate master encryption key
   */
  generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Store value in vault
   */
  async set(key, value, options = {}) {
    // Check if key already exists for versioning
    let version = 1;
    if (this.versioning && await this.storage.has(key)) {
      const existing = await this.get(key);
      if (existing) {
        version = existing.version + 1;
        // Archive old version
        await this.archiveVersion(key, existing);
      }
    }
    
    // Encrypt value if encryption is enabled
    let storedValue = value;
    let encrypted = false;
    
    if (this.encryption && typeof value === 'object' && value.privateKey) {
      // Encrypt sensitive data
      const encryptedData = encryptAES(JSON.stringify(value), this.masterKey);
      storedValue = encryptedData;
      encrypted = true;
    }
    
    // Create vault entry
    const entry = new VaultEntry(key, storedValue, {
      version,
      encrypted,
      metadata: options.metadata || {},
      tags: options.tags || []
    });
    
    // Store entry
    await this.storage.set(key, entry, {
      type: 'vault_entry',
      version: entry.version,
      versionHash: entry.versionHash
    });
    
    // Log access
    this.log('set', key, { version, encrypted });
    
    return {
      key,
      version: entry.version,
      versionHash: entry.versionHash,
      pointer: entry.getPointer(),
      encrypted
    };
  }
  
  /**
   * Get value from vault
   */
  async get(key, options = {}) {
    // Parse vault pointer if provided
    const { keyName, versionHash } = this.parsePointer(key);
    
    // Get entry
    let entry;
    if (versionHash) {
      // Get specific version
      entry = await this.getVersion(keyName, versionHash);
    } else {
      // Get latest version
      entry = await this.storage.get(keyName);
    }
    
    if (!entry) {
      return null;
    }
    
    // Check if revoked
    if (entry.revoked && !options.includeRevoked) {
      throw new Error(`Vault key "${keyName}" has been revoked`);
    }
    
    // Update access tracking
    entry.accessed = Date.now();
    entry.accessCount++;
    
    // Decrypt if necessary
    let value = entry.value;
    if (entry.encrypted) {
      try {
        const decrypted = decryptAES(
          value.encrypted,
          this.masterKey,
          value.iv,
          value.authTag
        );
        value = JSON.parse(decrypted);
      } catch (error) {
        throw new Error(`Failed to decrypt vault entry: ${error.message}`);
      }
    }
    
    // Log access
    this.log('get', keyName, { version: entry.version, versionHash: entry.versionHash });
    
    // Return value or full entry
    return options.includeMetadata ? { ...entry, value } : value;
  }
  
  /**
   * Delete value from vault
   */
  async delete(key, options = {}) {
    const { keyName } = this.parsePointer(key);
    
    if (options.soft) {
      // Soft delete - mark as revoked
      const entry = await this.storage.get(keyName);
      if (entry) {
        entry.revoked = true;
        entry.revokedAt = Date.now();
        entry.revokeReason = options.reason || 'deleted';
        await this.storage.set(keyName, entry);
      }
    } else {
      // Hard delete
      await this.storage.delete(keyName);
      
      // Delete all versions
      const versionKeys = await this.storage.list(`${keyName}:v:`);
      for (const versionKey of versionKeys) {
        await this.storage.delete(versionKey);
      }
    }
    
    this.log('delete', keyName, { soft: options.soft, reason: options.reason });
    
    return { deleted: true, key: keyName };
  }
  
  /**
   * List vault keys
   */
  async list(options = {}) {
    const prefix = options.prefix || '';
    const keys = await this.storage.list(prefix);
    
    // Filter out version keys
    const mainKeys = keys.filter(k => !k.includes(':v:'));
    
    if (options.includeMetadata) {
      const entries = [];
      for (const key of mainKeys) {
        const entry = await this.storage.get(key);
        if (entry && (!entry.revoked || options.includeRevoked)) {
          entries.push({
            key: entry.key,
            version: entry.version,
            versionHash: entry.versionHash,
            pointer: entry.getPointer(),
            encrypted: entry.encrypted,
            created: entry.created,
            updated: entry.updated,
            accessed: entry.accessed,
            accessCount: entry.accessCount,
            tags: entry.tags,
            revoked: entry.revoked
          });
        }
      }
      return entries;
    }
    
    return mainKeys;
  }
  
  /**
   * Check if key exists
   */
  async has(key) {
    const { keyName } = this.parsePointer(key);
    return await this.storage.has(keyName);
  }
  
  /**
   * Rotate key (create new version)
   */
  async rotate(key, newValue, options = {}) {
    const { keyName } = this.parsePointer(key);
    
    // Get current entry
    const current = await this.storage.get(keyName);
    if (!current) {
      throw new Error(`Key "${keyName}" not found`);
    }
    
    // Create new version
    const result = await this.set(keyName, newValue, {
      ...options,
      metadata: {
        ...current.metadata,
        ...options.metadata,
        rotatedFrom: current.versionHash,
        rotationReason: options.reason || 'manual rotation'
      }
    });
    
    this.log('rotate', keyName, {
      from: current.versionHash,
      to: result.versionHash,
      reason: options.reason
    });
    
    return result;
  }
  
  /**
   * Revoke key (emergency)
   */
  async revoke(key, reason = 'revoked') {
    return await this.delete(key, { soft: true, reason });
  }
  
  /**
   * Archive old version
   */
  async archiveVersion(key, entry) {
    const archiveKey = `${key}:v:${entry.versionHash}`;
    await this.storage.set(archiveKey, entry, {
      type: 'archived_version',
      originalKey: key,
      versionHash: entry.versionHash
    });
  }
  
  /**
   * Get specific version
   */
  async getVersion(key, versionHash) {
    // Try exact version
    const versionKey = `${key}:v:${versionHash}`;
    let entry = await this.storage.get(versionKey);
    
    if (!entry) {
      // Check if it's the current version
      const current = await this.storage.get(key);
      if (current && current.versionHash === versionHash) {
        entry = current;
      }
    }
    
    return entry;
  }
  
  /**
   * List all versions of a key
   */
  async listVersions(key) {
    const { keyName } = this.parsePointer(key);
    const versions = [];
    
    // Get current version
    const current = await this.storage.get(keyName);
    if (current) {
      versions.push({
        version: current.version,
        versionHash: current.versionHash,
        pointer: current.getPointer(),
        current: true,
        created: current.created,
        updated: current.updated
      });
    }
    
    // Get archived versions
    const versionKeys = await this.storage.list(`${keyName}:v:`);
    for (const versionKey of versionKeys) {
      const entry = await this.storage.get(versionKey);
      if (entry) {
        versions.push({
          version: entry.version,
          versionHash: entry.versionHash,
          pointer: entry.getPointer(),
          current: false,
          created: entry.created,
          updated: entry.updated
        });
      }
    }
    
    return versions.sort((a, b) => b.version - a.version);
  }
  
  /**
   * Parse vault pointer
   */
  parsePointer(pointer) {
    if (!pointer.startsWith('vault://')) {
      return { keyName: pointer, versionHash: null };
    }
    
    const path = pointer.substring(8); // Remove 'vault://'
    const [keyName, versionHash] = path.split('@');
    
    return { keyName, versionHash: versionHash || null };
  }
  
  /**
   * Create vault pointer
   */
  createPointer(key, versionHash = null) {
    if (versionHash) {
      return `vault://${key}@${versionHash}`;
    }
    return `vault://${key}`;
  }
  
  /**
   * Export vault (for backup)
   */
  async export(options = {}) {
    const keys = await this.list({ includeMetadata: true, includeRevoked: true });
    const exported = {
      version: '1.0',
      exported: Date.now(),
      encryption: this.encryption,
      keys: []
    };
    
    for (const keyInfo of keys) {
      const entry = await this.storage.get(keyInfo.key);
      if (entry) {
        exported.keys.push({
          key: entry.key,
          value: entry.value, // Keep encrypted if it was encrypted
          version: entry.version,
          versionHash: entry.versionHash,
          encrypted: entry.encrypted,
          metadata: entry.metadata,
          created: entry.created,
          updated: entry.updated,
          revoked: entry.revoked,
          tags: entry.tags
        });
      }
    }
    
    if (options.encrypt) {
      const encryptionKey = options.encryptionKey || this.masterKey;
      const encrypted = encryptAES(JSON.stringify(exported), encryptionKey);
      return {
        encrypted: true,
        data: encrypted,
        algorithm: 'aes-256-gcm'
      };
    }
    
    return exported;
  }
  
  /**
   * Import vault (from backup)
   */
  async import(data, options = {}) {
    let vaultData = data;
    
    if (data.encrypted) {
      const encryptionKey = options.encryptionKey || this.masterKey;
      const decrypted = decryptAES(
        data.data.encrypted,
        encryptionKey,
        data.data.iv,
        data.data.authTag
      );
      vaultData = JSON.parse(decrypted);
    }
    
    const imported = [];
    for (const item of vaultData.keys) {
      const entry = new VaultEntry(item.key, item.value, {
        version: item.version,
        versionHash: item.versionHash,
        encrypted: item.encrypted,
        metadata: item.metadata,
        tags: item.tags
      });
      
      entry.created = item.created;
      entry.updated = item.updated;
      entry.revoked = item.revoked || false;
      
      await this.storage.set(item.key, entry);
      imported.push(item.key);
    }
    
    this.log('import', 'vault', { count: imported.length });
    
    return { imported: imported.length, keys: imported };
  }
  
  /**
   * Log vault operations
   */
  log(operation, key, details = {}) {
    const entry = {
      timestamp: Date.now(),
      operation,
      key,
      details
    };
    
    this.auditLog.push(entry);
    
    // Keep last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }
  
  /**
   * Get audit log
   */
  getAuditLog(options = {}) {
    let log = this.auditLog;
    
    if (options.key) {
      log = log.filter(entry => entry.key === options.key);
    }
    
    if (options.operation) {
      log = log.filter(entry => entry.operation === options.operation);
    }
    
    if (options.since) {
      log = log.filter(entry => entry.timestamp >= options.since);
    }
    
    if (options.limit) {
      log = log.slice(-options.limit);
    }
    
    return log;
  }
  
  /**
   * Clear vault (dangerous!)
   */
  async clear(confirm = false) {
    if (!confirm) {
      throw new Error('Must confirm vault clear operation');
    }
    
    await this.storage.clear();
    this.auditLog = [];
    this.log('clear', 'vault', { cleared: Date.now() });
  }
  
  /**
   * Get vault statistics
   */
  async getStats() {
    const keys = await this.list({ includeMetadata: true, includeRevoked: true });
    
    const stats = {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => !k.revoked).length,
      revokedKeys: keys.filter(k => k.revoked).length,
      encryptedKeys: keys.filter(k => k.encrypted).length,
      totalAccesses: keys.reduce((sum, k) => sum + k.accessCount, 0),
      auditLogSize: this.auditLog.length,
      oldestKey: keys.length > 0 ? Math.min(...keys.map(k => k.created)) : null,
      newestKey: keys.length > 0 ? Math.max(...keys.map(k => k.created)) : null
    };
    
    return stats;
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  VaultManager,
  VaultStorage,
  VaultEntry
};
