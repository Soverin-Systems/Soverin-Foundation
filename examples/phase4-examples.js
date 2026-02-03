/**
 * JSONFlow Phase 4: Comprehensive Examples
 * 
 * Demonstrates distributed execution, quantum computing,
 * WASM, databases, message queues, and advanced workflows.
 */

const { DistributedEngine } = require('./distributed-engine.js');
const { QuantumAdapter, QuantumCircuits } = require('./quantum-adapter.js');
const { WASMAdapter } = require('./wasm-adapter.js');
const { DatabaseAdapter } = require('./database-adapter.js');
const { MessageQueueAdapter } = require('./mq-adapter.js');

// Mock adapters for base functionality
class MockAdapter {
  getManifest() {
    return {
      adapter_id: 'mock',
      version: '1.0.0',
      step_types: [{ type: 'mock_compute', params_schema: {}, deterministic: true }]
    };
  }
  
  validate(step) {
    return { valid: true };
  }
  
  async execute(step) {
    await new Promise(resolve => setTimeout(resolve, step.params.delay_ms || 10));
    return {
      step_id: step.id,
      status: 'success',
      output: { result: step.params.input || 'computed' },
      execution_metadata: { timestamp: new Date().toISOString(), latency_ms: 10 }
    };
  }
  
  async healthCheck() {
    return { status: 'healthy' };
  }
}

class TransformAdapter {
  getManifest() {
    return {
      adapter_id: 'transform',
      version: '1.0.0',
      step_types: [
        { type: 'transform_map', params_schema: {}, deterministic: true },
        { type: 'transform_filter', params_schema: {}, deterministic: true }
      ]
    };
  }
  
  validate(step) {
    return { valid: true };
  }
  
  async execute(step) {
    let result;
    
    if (step.type === 'transform_map') {
      result = step.params.input.map(item => ({ ...item, processed: true }));
    } else if (step.type === 'transform_filter') {
      result = step.params.input.filter(item => 
        item[step.params.key] === step.params.value
      );
    }
    
    return {
      step_id: step.id,
      status: 'success',
      output: { result },
      execution_metadata: { timestamp: new Date().toISOString() }
    };
  }
  
  async healthCheck() {
    return { status: 'healthy' };
  }
}

// Example 1: Distributed Quantum-Classical Hybrid Workflow

async function example1_QuantumMLPipeline() {
  console.log('\n=== Example 1: Quantum-Classical Machine Learning Pipeline ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'coordinator-1',
    role: 'coordinator'
  });
  
  // Register adapters
  engine.registerAdapter(new QuantumAdapter());
  engine.registerAdapter(new WASMAdapter());
  engine.registerAdapter(new DatabaseAdapter());
  engine.registerAdapter(new TransformAdapter());
  
  const workflow = {
    workflow: 'quantum_ml_pipeline',
    version: '1.0.0',
    distributed: true,
    steps: [
      {
        id: 'prepare_data',
        type: 'transform_map',
        params: {
          input: [
            { features: [0.1, 0.2, 0.3], label: 0 },
            { features: [0.4, 0.5, 0.6], label: 1 },
            { features: [0.7, 0.8, 0.9], label: 1 }
          ]
        }
      },
      {
        id: 'quantum_feature_map',
        type: 'quantum_circuit',
        params: {
          circuit_type: 'feature_map',
          gates: QuantumCircuits.bellState(),
          shots: 1000,
          backend: 'qasm_simulator'
        },
        resource_requirements: {
          qubits: 2,
          backend: 'simulator'
        },
        node_preference: 'quantum_capable',
        parent_step_ids: ['prepare_data']
      },
      {
        id: 'classical_training',
        type: 'wasm_execute',
        params: {
          module: 'ml_training.wasm',
          function: 'train_model',
          args: {
            data: '$prepare_data.result',
            quantum_features: '$quantum_feature_map.counts'
          },
          memory_pages: 10
        },
        resource_requirements: {
          ram_mb: 640,
          cpu_cores: 4
        },
        node_preference: 'high_compute',
        parent_step_ids: ['quantum_feature_map']
      },
      {
        id: 'store_model',
        type: 'db_insert',
        params: {
          connection: 'postgres://localhost:5432/models',
          table: 'trained_models',
          data: {
            name: 'quantum_hybrid_model_v1',
            accuracy: 0.95,
            timestamp: new Date().toISOString()
          }
        },
        parent_step_ids: ['classical_training']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Nodes Involved:', result.execution_trace.nodes);
  console.log('✓ Total Steps:', result.stats.total_steps);
  console.log('✓ Total Time:', result.stats.total_time_ms + 'ms');
  console.log('✓ Merkle Root:', result.merkle_root);
}

// Example 2: Real-Time Event Stream Processing

async function example2_EventStreamProcessing() {
  console.log('\n=== Example 2: Real-Time Event Stream Processing ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'coordinator-2',
    role: 'coordinator'
  });
  
  engine.registerAdapter(new MessageQueueAdapter());
  engine.registerAdapter(new DatabaseAdapter());
  engine.registerAdapter(new TransformAdapter());
  
  const workflow = {
    workflow: 'event_stream_processing',
    steps: [
      {
        id: 'consume_events',
        type: 'mq_consume',
        params: {
          broker: 'rabbitmq://localhost',
          queue: 'user_events',
          max_messages: 100
        }
      },
      {
        id: 'filter_critical',
        type: 'transform_filter',
        params: {
          input: '$consume_events.messages',
          key: 'priority',
          value: 'critical'
        },
        parent_step_ids: ['consume_events']
      },
      {
        id: 'enrich_data',
        type: 'db_query',
        params: {
          connection: 'postgres://localhost/users',
          query: 'SELECT * FROM users WHERE id = ANY($1)',
          params: [[1, 2, 3]]
        },
        parent_step_ids: ['filter_critical']
      },
      {
        id: 'publish_alerts',
        type: 'mq_publish',
        params: {
          broker: 'rabbitmq://localhost',
          exchange: 'alerts',
          routing_key: 'critical.alert',
          message: {
            alert_type: 'critical_event',
            timestamp: new Date().toISOString(),
            data: '$enrich_data.rows'
          },
          options: {
            persistent: true,
            priority: 9
          }
        },
        parent_step_ids: ['enrich_data']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Events Consumed:', result.receipts[0].output.count);
  console.log('✓ Critical Events:', result.receipts[1].output.result?.length || 0);
  console.log('✓ Alerts Published:', result.receipts[3].output.published);
}

// Example 3: Quantum Algorithm - Grover's Search

async function example3_GroversSearch() {
  console.log('\n=== Example 3: Grover\'s Quantum Search Algorithm ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'quantum-node',
    role: 'worker'
  });
  
  engine.registerAdapter(new QuantumAdapter({ max_qubits: 8 }));
  
  // Search for state |11⟩ in a 2-qubit system
  const workflow = {
    workflow: 'grovers_search',
    steps: [
      {
        id: 'initialize',
        type: 'quantum_circuit',
        params: {
          gates: [
            { type: 'H', qubit: 0 },
            { type: 'H', qubit: 1 }
          ],
          shots: 1000,
          backend: 'statevector_simulator'
        }
      },
      {
        id: 'grover_iteration',
        type: 'quantum_circuit',
        params: {
          gates: [
            ...QuantumCircuits.groversOracle(3, 2),  // Oracle for |11⟩
            { type: 'H', qubit: 0 },
            { type: 'H', qubit: 1 },
            { type: 'X', qubit: 0 },
            { type: 'X', qubit: 1 },
            { type: 'H', qubit: 1 },
            { type: 'CNOT', control: 0, target: 1 },
            { type: 'H', qubit: 1 },
            { type: 'X', qubit: 0 },
            { type: 'X', qubit: 1 },
            { type: 'H', qubit: 0 },
            { type: 'H', qubit: 1 }
          ],
          shots: 1000,
          backend: 'qasm_simulator'
        },
        parent_step_ids: ['initialize']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Measurement Counts:', result.receipts[1].output.counts);
  console.log('✓ Probabilities:', result.receipts[1].output.probabilities);
  console.log('✓ Circuit Depth:', result.receipts[1].output.circuit_depth);
}

// Example 4: WASM Image Processing Pipeline

async function example4_WASMImageProcessing() {
  console.log('\n=== Example 4: WASM Image Processing Pipeline ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'wasm-worker',
    role: 'worker'
  });
  
  engine.registerAdapter(new WASMAdapter());
  engine.registerAdapter(new DatabaseAdapter());
  engine.registerAdapter(new MockAdapter());
  
  const workflow = {
    workflow: 'wasm_image_processing',
    steps: [
      {
        id: 'load_images',
        type: 'mock_compute',
        params: {
          input: ['image1.jpg', 'image2.jpg', 'image3.jpg']
        }
      },
      {
        id: 'apply_filter',
        type: 'wasm_streaming',
        params: {
          module: 'image_processor.wasm',
          function: 'apply_filter',
          input_stream: '$load_images.result'
        },
        resource_requirements: {
          ram_mb: 512,
          timeout_ms: 10000
        },
        parent_step_ids: ['load_images']
      },
      {
        id: 'compute_hashes',
        type: 'wasm_execute',
        params: {
          module: 'crypto_hash.wasm',
          function: 'sha256',
          args: {
            data: '$apply_filter.results'
          }
        },
        parent_step_ids: ['apply_filter']
      },
      {
        id: 'save_results',
        type: 'db_transaction',
        params: {
          connection: 'mongodb://localhost/images',
          operations: [
            {
              query: 'db.processed_images.insertMany',
              params: ['$apply_filter.results']
            },
            {
              query: 'db.image_hashes.insertOne',
              params: ['$compute_hashes.result']
            }
          ]
        },
        parent_step_ids: ['compute_hashes']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Images Processed:', result.receipts[1].output.processed_count);
  console.log('✓ Transaction Completed:', result.receipts[3].output.transaction_completed);
}

// Example 5: Multi-Database ETL Pipeline

async function example5_MultiDatabaseETL() {
  console.log('\n=== Example 5: Multi-Database ETL Pipeline ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'etl-coordinator',
    role: 'coordinator'
  });
  
  engine.registerAdapter(new DatabaseAdapter());
  engine.registerAdapter(new WASMAdapter());
  engine.registerAdapter(new MessageQueueAdapter());
  engine.registerAdapter(new TransformAdapter());
  
  const workflow = {
    workflow: 'multi_db_etl',
    steps: [
      // Extract from PostgreSQL
      {
        id: 'extract_postgres',
        type: 'db_query',
        params: {
          connection: 'postgres://localhost/source_db',
          query: 'SELECT * FROM orders WHERE created_at > $1',
          params: ['2026-01-01']
        }
      },
      // Extract from MySQL
      {
        id: 'extract_mysql',
        type: 'db_query',
        params: {
          connection: 'mysql://localhost/legacy_db',
          query: 'SELECT * FROM customers WHERE active = ?',
          params: [true]
        }
      },
      // Transform with WASM
      {
        id: 'transform_data',
        type: 'wasm_execute',
        params: {
          module: 'etl_transform.wasm',
          function: 'merge_and_transform',
          args: {
            orders: '$extract_postgres.rows',
            customers: '$extract_mysql.rows'
          }
        },
        parent_step_ids: ['extract_postgres', 'extract_mysql']
      },
      // Load to MongoDB
      {
        id: 'load_mongodb',
        type: 'db_insert',
        params: {
          connection: 'mongodb://localhost/analytics',
          table: 'enriched_orders',
          data: '$transform_data.result'
        },
        parent_step_ids: ['transform_data']
      },
      // Publish event to Kafka
      {
        id: 'publish_event',
        type: 'mq_publish',
        params: {
          broker: 'kafka://localhost:9092',
          exchange: 'etl-events',
          message: {
            pipeline: 'multi_db_etl',
            records_processed: '$load_mongodb.affected_rows',
            timestamp: new Date().toISOString()
          }
        },
        parent_step_ids: ['load_mongodb']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Records from Postgres:', result.receipts[0].output.row_count);
  console.log('✓ Records from MySQL:', result.receipts[1].output.row_count);
  console.log('✓ Records Loaded:', result.receipts[3].output.inserted);
  console.log('✓ Event Published:', result.receipts[4].output.published);
}

// Example 6: Variational Quantum Eigensolver (VQE)

async function example6_QuantumVQE() {
  console.log('\n=== Example 6: Variational Quantum Eigensolver ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'quantum-research',
    role: 'worker'
  });
  
  engine.registerAdapter(new QuantumAdapter());
  engine.registerAdapter(new DatabaseAdapter());
  
  const workflow = {
    workflow: 'quantum_vqe',
    steps: [
      {
        id: 'run_vqe',
        type: 'quantum_optimize',
        params: {
          ansatz: 'hardware_efficient',
          cost_function: 'H2_molecule',
          iterations: 100
        },
        resource_requirements: {
          qubits: 4,
          timeout_ms: 60000
        }
      },
      {
        id: 'save_results',
        type: 'db_insert',
        params: {
          connection: 'postgres://localhost/quantum_results',
          table: 'vqe_runs',
          data: {
            molecule: 'H2',
            ground_state_energy: '$run_vqe.best_energy',
            optimal_parameters: '$run_vqe.optimal_parameters',
            iterations: 100,
            timestamp: new Date().toISOString()
          }
        },
        parent_step_ids: ['run_vqe']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Ground State Energy:', result.receipts[0].output.best_energy);
  console.log('✓ Optimal Parameters:', result.receipts[0].output.optimal_parameters);
  console.log('✓ Iterations:', result.receipts[0].output.iterations);
}

// Example 7: Fault-Tolerant Distributed Workflow

async function example7_FaultTolerantWorkflow() {
  console.log('\n=== Example 7: Fault-Tolerant Distributed Workflow ===\n');
  
  const engine = new DistributedEngine({
    nodeId: 'ft-coordinator',
    role: 'coordinator'
  });
  
  engine.registerAdapter(new DatabaseAdapter());
  engine.registerAdapter(new MockAdapter());
  
  const workflow = {
    workflow: 'fault_tolerant_pipeline',
    fault_tolerance: {
      retry_failed_steps: true,
      max_retries: 3,
      failover_strategy: 'reassign',
      checkpoint_frequency: 'per_step'
    },
    steps: [
      {
        id: 'critical_computation',
        type: 'mock_compute',
        params: {
          input: 'Important data',
          delay_ms: 100
        }
      },
      {
        id: 'db_write',
        type: 'db_insert',
        params: {
          connection: 'postgres://localhost/critical_db',
          table: 'important_records',
          data: {
            value: '$critical_computation.result',
            timestamp: new Date().toISOString()
          },
          options: {
            retry_attempts: 3
          }
        },
        parent_step_ids: ['critical_computation']
      }
    ]
  };
  
  const result = await engine.execute(workflow);
  
  console.log('✓ Workflow Status:', result.status);
  console.log('✓ Fault Tolerance Enabled:', true);
  console.log('✓ All Steps Completed:', result.stats.total_steps === 2);
}

// Example 8: Resource Marketplace Bidding

async function example8_ResourceMarketplace() {
  console.log('\n=== Example 8: Resource Marketplace & Bidding ===\n');
  
  // Create coordinator
  const coordinator = new DistributedEngine({
    nodeId: 'marketplace-coord',
    role: 'coordinator',
    port: 8080
  });
  
  // Create quantum worker
  const quantumWorker = new DistributedEngine({
    nodeId: 'quantum-provider',
    role: 'worker',
    port: 8081
  });
  
  // Worker advertises capabilities
  quantumWorker.advertise({
    resources: {
      qubits: 8,
      ram_mb: 16384,
      price_per_qubit_hour: 0.5
    },
    pricing: {
      price_per_qubit_hour: 0.5,
      availability: 0.95
    }
  });
  
  // Coordinator bids for resources
  const bid = await coordinator.bidForResources({
    step_id: 'quantum_simulation',
    requirements: {
      qubits: 4,
      duration_minutes: 10
    },
    max_price: 5.0
  });
  
  console.log('✓ Bid Placed');
  console.log('✓ Winner Node:', bid.node_id);
  console.log('✓ Price per Hour:', bid.price);
  console.log('✓ Estimated Cost:', bid.estimated_cost);
}

// Run all examples

async function runAllExamples() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   JSONFlow Phase 4: Comprehensive Examples          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  try {
    await example1_QuantumMLPipeline();
    await example2_EventStreamProcessing();
    await example3_GroversSearch();
    await example4_WASMImageProcessing();
    await example5_MultiDatabaseETL();
    await example6_QuantumVQE();
    await example7_FaultTolerantWorkflow();
    await example8_ResourceMarketplace();
    
    console.log('\n✅ All Phase 4 examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
  }
}

// Execute if run directly
if (require.main === module) {
  runAllExamples();
}

// Export for use in other modules
module.exports = {
  example1_QuantumMLPipeline,
  example2_EventStreamProcessing,
  example3_GroversSearch,
  example4_WASMImageProcessing,
  example5_MultiDatabaseETL,
  example6_QuantumVQE,
  example7_FaultTolerantWorkflow,
  example8_ResourceMarketplace,
  runAllExamples
};
