/**
 * JSONFlow Phase 4: Database Adapter
 * 
 * Execute SQL/NoSQL operations with connection pooling,
 * transactions, and automatic retry logic.
 */

const crypto = require('crypto');

class DatabaseAdapter {
  constructor(config = {}) {
    this.defaultPoolSize = config.default_pool_size || 10;
    this.defaultTimeout = config.default_timeout || 30000;
    
    // Connection pools
    this.pools = new Map();
    
    // Supported databases
    this.supportedDatabases = ['postgres', 'mysql', 'mongodb', 'redis', 'sqlite'];
  }
  
  getManifest() {
    return {
      adapter_id: 'database',
      version: '1.0.0',
      step_types: [
        {
          type: 'db_query',
          params_schema: {
            connection: 'string',
            query: 'string',
            params: 'array'
          },
          deterministic: false
        },
        {
          type: 'db_insert',
          params_schema: {
            connection: 'string',
            table: 'string',
            data: 'object'
          },
          deterministic: false
        },
        {
          type: 'db_update',
          params_schema: {
            connection: 'string',
            table: 'string',
            data: 'object',
            where: 'object'
          },
          deterministic: false
        },
        {
          type: 'db_transaction',
          params_schema: {
            connection: 'string',
            operations: 'array'
          },
          deterministic: false
        }
      ]
    };
  }
  
  validate(step) {
    const validTypes = ['db_query', 'db_insert', 'db_update', 'db_transaction'];
    
    if (!validTypes.includes(step.type)) {
      return { valid: false, error: 'Unknown database step type' };
    }
    
    if (!step.params.connection) {
      return { valid: false, error: 'Missing required param: connection' };
    }
    
    // Validate connection string
    const dbType = this._parseConnectionString(step.params.connection).type;
    if (!this.supportedDatabases.includes(dbType)) {
      return { 
        valid: false, 
        error: `Unsupported database: ${dbType}` 
      };
    }
    
    return { valid: true };
  }
  
  async execute(step, context) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (step.type) {
        case 'db_query':
          result = await this._executeQuery(step);
          break;
        case 'db_insert':
          result = await this._executeInsert(step);
          break;
        case 'db_update':
          result = await this._executeUpdate(step);
          break;
        case 'db_transaction':
          result = await this._executeTransaction(step);
          break;
        default:
          throw new Error(`Unsupported database step type: ${step.type}`);
      }
      
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
    } catch (error) {
      // Retry logic
      const retryAttempts = step.params.options?.retry_attempts || 0;
      if (retryAttempts > 0) {
        return await this._retryExecution(step, context, retryAttempts);
      }
      
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
  
  async _executeQuery(step) {
    const connection = step.params.connection;
    const query = step.params.query;
    const params = step.params.params || [];
    const options = step.params.options || {};
    
    // Get connection from pool
    const conn = await this._getConnection(connection, options);
    
    try {
      // Execute query
      const result = await this._runQuery(conn, query, params);
      
      return {
        rows: result.rows,
        row_count: result.rows.length,
        fields: result.fields || [],
        query_time_ms: result.duration
      };
    } finally {
      // Return connection to pool
      await this._releaseConnection(conn);
    }
  }
  
  async _executeInsert(step) {
    const connection = step.params.connection;
    const table = step.params.table;
    const data = step.params.data;
    
    // Build INSERT query
    const dbType = this._parseConnectionString(connection).type;
    const query = this._buildInsertQuery(table, data, dbType);
    
    const conn = await this._getConnection(connection);
    
    try {
      const result = await this._runQuery(conn, query.sql, query.values);
      
      return {
        inserted: true,
        inserted_id: result.insertId,
        affected_rows: result.affectedRows || 1
      };
    } finally {
      await this._releaseConnection(conn);
    }
  }
  
  async _executeUpdate(step) {
    const connection = step.params.connection;
    const table = step.params.table;
    const data = step.params.data;
    const where = step.params.where || {};
    
    // Build UPDATE query
    const dbType = this._parseConnectionString(connection).type;
    const query = this._buildUpdateQuery(table, data, where, dbType);
    
    const conn = await this._getConnection(connection);
    
    try {
      const result = await this._runQuery(conn, query.sql, query.values);
      
      return {
        updated: true,
        affected_rows: result.affectedRows || 0
      };
    } finally {
      await this._releaseConnection(conn);
    }
  }
  
  async _executeTransaction(step) {
    const connection = step.params.connection;
    const operations = step.params.operations || [];
    
    const conn = await this._getConnection(connection);
    
    try {
      // Begin transaction
      await this._runQuery(conn, 'BEGIN');
      
      const results = [];
      
      // Execute each operation
      for (const op of operations) {
        const result = await this._runQuery(conn, op.query, op.params || []);
        results.push(result);
      }
      
      // Commit transaction
      await this._runQuery(conn, 'COMMIT');
      
      return {
        transaction_completed: true,
        operations_count: operations.length,
        results
      };
    } catch (error) {
      // Rollback on error
      await this._runQuery(conn, 'ROLLBACK');
      throw error;
    } finally {
      await this._releaseConnection(conn);
    }
  }
  
  async _getConnection(connectionString, options = {}) {
    const poolKey = connectionString;
    
    // Check if pool exists
    if (!this.pools.has(poolKey)) {
      const poolSize = options.pool_size || this.defaultPoolSize;
      await this._createPool(connectionString, poolSize);
    }
    
    const pool = this.pools.get(poolKey);
    
    // Get connection from pool (mock implementation)
    return {
      id: crypto.randomBytes(4).toString('hex'),
      connectionString,
      pool
    };
  }
  
  async _createPool(connectionString, size) {
    const connInfo = this._parseConnectionString(connectionString);
    
    const pool = {
      type: connInfo.type,
      size,
      active: 0,
      available: size,
      created: Date.now()
    };
    
    this.pools.set(connectionString, pool);
    console.log(`[DatabaseAdapter] Created connection pool for ${connInfo.type}`);
  }
  
  async _runQuery(conn, query, params = []) {
    // Mock query execution
    // In a real implementation, this would use the actual database driver
    
    const startTime = Date.now();
    
    // Simulate query execution
    await this._sleep(Math.random() * 50);
    
    // Mock results based on query type
    if (query.toUpperCase().startsWith('SELECT')) {
      return {
        rows: this._generateMockRows(query),
        fields: ['id', 'name', 'created_at'],
        duration: Date.now() - startTime
      };
    } else if (query.toUpperCase().startsWith('INSERT')) {
      return {
        insertId: Math.floor(Math.random() * 10000),
        affectedRows: 1,
        duration: Date.now() - startTime
      };
    } else if (query.toUpperCase().startsWith('UPDATE')) {
      return {
        affectedRows: Math.floor(Math.random() * 10),
        duration: Date.now() - startTime
      };
    }
    
    return { duration: Date.now() - startTime };
  }
  
  _generateMockRows(query) {
    const count = Math.floor(Math.random() * 10) + 1;
    const rows = [];
    
    for (let i = 0; i < count; i++) {
      rows.push({
        id: i + 1,
        name: `Record ${i + 1}`,
        created_at: new Date().toISOString()
      });
    }
    
    return rows;
  }
  
  async _releaseConnection(conn) {
    // Return connection to pool
    if (conn.pool) {
      conn.pool.active--;
      conn.pool.available++;
    }
  }
  
  _parseConnectionString(connStr) {
    // Parse connection string: protocol://user:pass@host:port/database
    const match = connStr.match(/^(\w+):\/\//);
    
    if (!match) {
      throw new Error('Invalid connection string');
    }
    
    const type = match[1];
    
    return {
      type,
      connectionString: connStr
    };
  }
  
  _buildInsertQuery(table, data, dbType) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    if (dbType === 'postgres') {
      const placeholders = columns.map((_, i) => `$${i + 1}`);
      return {
        sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      };
    } else if (dbType === 'mysql') {
      const placeholders = columns.map(() => '?');
      return {
        sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      };
    } else if (dbType === 'mongodb') {
      // MongoDB uses different syntax
      return {
        sql: `db.${table}.insertOne`,
        values: [data]
      };
    }
    
    throw new Error(`Unsupported database type: ${dbType}`);
  }
  
  _buildUpdateQuery(table, data, where, dbType) {
    const setClauses = Object.keys(data).map((col, i) => 
      dbType === 'postgres' ? `${col} = $${i + 1}` : `${col} = ?`
    );
    
    const whereClauses = Object.keys(where).map((col, i) => 
      dbType === 'postgres' ? `${col} = $${Object.keys(data).length + i + 1}` : `${col} = ?`
    );
    
    const values = [...Object.values(data), ...Object.values(where)];
    
    return {
      sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`,
      values
    };
  }
  
  async _retryExecution(step, context, maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DatabaseAdapter] Retry attempt ${attempt}/${maxRetries}`);
        
        // Exponential backoff
        if (attempt > 1) {
          await this._sleep(Math.pow(2, attempt - 1) * 1000);
        }
        
        return await this.execute(
          { ...step, params: { ...step.params, options: { ...step.params.options, retry_attempts: 0 } } },
          context
        );
      } catch (error) {
        lastError = error;
      }
    }
    
    throw lastError;
  }
  
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async healthCheck() {
    const pools = [];
    
    this.pools.forEach((pool, connStr) => {
      pools.push({
        connection: this._parseConnectionString(connStr).type,
        size: pool.size,
        active: pool.active,
        available: pool.available
      });
    });
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pools,
      supported_databases: this.supportedDatabases
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DatabaseAdapter };
}

if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.DatabaseAdapter = DatabaseAdapter;
}
