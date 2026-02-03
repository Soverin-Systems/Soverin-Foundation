/**
 * JSONFlow Phase 2 Examples
 * AI/Ollama and IPFS/P2P Adapter Demonstrations
 */

const JSONFlow = require('./jsonflow-engine.js');
const { AIAdapter } = require('./ai-adapter.js');
const { IPFSAdapter } = require('./ipfs-adapter.js');

// ============================================================================
// EXAMPLE 1: AI Text Classification
// ============================================================================

async function exampleAIClassification() {
  console.log('\n========================================');
  console.log('EXAMPLE 1: AI Text Classification');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  
  // Use mock client (set to false if Ollama is running)
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));

  const workflow = {
    workflow: 'content_moderation',
    version: '1.0.0',
    steps: [
      {
        id: 'classify_1',
        type: 'ai_classify',
        params: {
          model: 'llama3-8b',
          text: 'This product is amazing! I love it!',
          categories: ['positive', 'negative', 'neutral'],
          seed: 42,
          temperature: 0.0
        }
      },
      {
        id: 'classify_2',
        type: 'ai_classify',
        params: {
          model: 'llama3-8b',
          text: 'This is terrible and broken.',
          categories: ['positive', 'negative', 'neutral'],
          seed: 42,
          temperature: 0.0
        }
      },
      {
        id: 'classify_3',
        type: 'ai_classify',
        params: {
          model: 'llama3-8b',
          text: 'The product arrived on Tuesday.',
          categories: ['positive', 'negative', 'neutral'],
          seed: 42,
          temperature: 0.0
        }
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Classification Results:');
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`\n${receipt.step_id}:`);
      console.log('  Category:', receipt.output.category);
      console.log('  Confidence:', receipt.output.confidence);
      console.log('  Model:', receipt.output.model);
    }
  });

  console.log('\nMerkle Root:', result.merkle_root);
  return result;
}

// ============================================================================
// EXAMPLE 2: AI Sentiment Analysis Pipeline
// ============================================================================

async function exampleSentimentPipeline() {
  console.log('\n========================================');
  console.log('EXAMPLE 2: Sentiment Analysis Pipeline');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));

  const workflow = {
    workflow: 'customer_feedback_analysis',
    version: '1.0.0',
    steps: [
      {
        id: 'sentiment_1',
        type: 'ai_sentiment',
        params: {
          model: 'llama3-8b',
          text: 'Absolutely fantastic experience! Highly recommend.',
          seed: 42
        }
      },
      {
        id: 'sentiment_2',
        type: 'ai_sentiment',
        params: {
          model: 'llama3-8b',
          text: 'Worst purchase ever. Total waste of money.',
          seed: 42
        }
      },
      {
        id: 'aggregate',
        type: 'transform_reduce',
        params: {
          input: [
            { sentiment: 'positive', score: 0.8 },
            { sentiment: 'negative', score: -0.8 }
          ],
          operation: 'avg',
          key: 'score'
        },
        parent_step_ids: ['sentiment_1', 'sentiment_2']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Sentiment Analysis:');
  result.receipts.forEach(receipt => {
    if (receipt.output && receipt.step_id.startsWith('sentiment')) {
      console.log(`\n${receipt.step_id}:`);
      console.log('  Sentiment:', receipt.output.sentiment);
      console.log('  Score:', receipt.output.score);
      console.log('  Confidence:', receipt.output.confidence);
    }
  });

  console.log('\nOverall Sentiment Score:', 
    result.receipts.find(r => r.step_id === 'aggregate')?.output?.result || 'N/A');

  return result;
}

// ============================================================================
// EXAMPLE 3: AI Embedding & Similarity
// ============================================================================

async function exampleEmbeddings() {
  console.log('\n========================================');
  console.log('EXAMPLE 3: Text Embeddings');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));

  const workflow = {
    workflow: 'semantic_search',
    version: '1.0.0',
    steps: [
      {
        id: 'embed_query',
        type: 'ai_embed',
        params: {
          model: 'llama3-8b',
          text: 'machine learning algorithms'
        }
      },
      {
        id: 'embed_doc1',
        type: 'ai_embed',
        params: {
          model: 'llama3-8b',
          text: 'neural networks and deep learning'
        }
      },
      {
        id: 'embed_doc2',
        type: 'ai_embed',
        params: {
          model: 'llama3-8b',
          text: 'cooking recipes and ingredients'
        }
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Embedding Results:');
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`\n${receipt.step_id}:`);
      console.log('  Dimensions:', receipt.output.dimensions);
      console.log('  Text Length:', receipt.output.text_length);
      console.log('  First 5 values:', receipt.output.embedding.slice(0, 5).map(v => v.toFixed(4)));
    }
  });

  return result;
}

// ============================================================================
// EXAMPLE 4: AI Summarization
// ============================================================================

async function exampleSummarization() {
  console.log('\n========================================');
  console.log('EXAMPLE 4: Text Summarization');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));

  const longText = `
    Artificial intelligence (AI) is transforming industries across the globe.
    From healthcare to finance, AI systems are being deployed to automate tasks,
    improve decision-making, and unlock new insights from data. Machine learning,
    a subset of AI, enables systems to learn from experience without being explicitly
    programmed. Deep learning, using neural networks with many layers, has achieved
    remarkable success in image recognition, natural language processing, and game playing.
  `;

  const workflow = {
    workflow: 'document_summarization',
    version: '1.0.0',
    steps: [
      {
        id: 'summarize',
        type: 'ai_summarize',
        params: {
          model: 'llama3-8b',
          text: longText,
          max_length: 50,
          seed: 42
        }
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Summarization Result:');
  const summary = result.receipts[0];
  console.log('  Original Length:', summary.output.original_length);
  console.log('  Summary Length:', summary.output.summary_length);
  console.log('  Compression Ratio:', summary.output.compression_ratio.toFixed(2) + 'x');
  console.log('  Summary:', summary.output.summary);

  return result;
}

// ============================================================================
// EXAMPLE 5: IPFS Content Storage
// ============================================================================

async function exampleIPFSStorage() {
  console.log('\n========================================');
  console.log('EXAMPLE 5: IPFS Content Storage');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new IPFSAdapter('http://localhost:5001', true));

  const workflow = {
    workflow: 'decentralized_storage',
    version: '1.0.0',
    steps: [
      {
        id: 'store_text',
        type: 'ipfs_add',
        params: {
          content: 'Hello, IPFS! This is a test message.'
        }
      },
      {
        id: 'store_json',
        type: 'ipfs_add',
        params: {
          content: {
            title: 'My Data',
            timestamp: new Date().toISOString(),
            values: [1, 2, 3, 4, 5]
          }
        }
      },
      {
        id: 'pin_content',
        type: 'ipfs_pin',
        params: {
          cid: '$store_text.cid',
          service: 'local'
        },
        parent_step_ids: ['store_text']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('IPFS Storage Results:');
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`\n${receipt.step_id}:`);
      if (receipt.output.cid) {
        console.log('  CID:', receipt.output.cid);
        console.log('  Size:', receipt.output.size, 'bytes');
        if (receipt.output.gateway_url) {
          console.log('  Gateway URL:', receipt.output.gateway_url);
        }
      }
      if (receipt.output.pinned) {
        console.log('  Pinned:', receipt.output.pinned);
      }
    }
  });

  return result;
}

// ============================================================================
// EXAMPLE 6: IPFS Pubsub Communication
// ============================================================================

async function exampleIPFSPubsub() {
  console.log('\n========================================');
  console.log('EXAMPLE 6: IPFS Pubsub Communication');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new IPFSAdapter('http://localhost:5001', true));

  const workflow = {
    workflow: 'distributed_messaging',
    version: '1.0.0',
    steps: [
      {
        id: 'publish_1',
        type: 'ipfs_pubsub_publish',
        params: {
          topic: '/jsonflow/demo',
          message: {
            type: 'status_update',
            status: 'running',
            timestamp: Date.now()
          }
        }
      },
      {
        id: 'publish_2',
        type: 'ipfs_pubsub_publish',
        params: {
          topic: '/jsonflow/demo',
          message: {
            type: 'data_point',
            value: 42,
            timestamp: Date.now()
          }
        }
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('Pubsub Results:');
  result.receipts.forEach(receipt => {
    if (receipt.output) {
      console.log(`\n${receipt.step_id}:`);
      console.log('  Topic:', receipt.output.topic);
      console.log('  Published:', receipt.output.published);
      console.log('  Message Size:', receipt.output.message_size, 'bytes');
    }
  });

  return result;
}

// ============================================================================
// EXAMPLE 7: Workflow Pulse Emission
// ============================================================================

async function exampleWorkflowPulse() {
  console.log('\n========================================');
  console.log('EXAMPLE 7: Workflow Pulse Emission');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new IPFSAdapter('http://localhost:5001', true));

  // First, execute a simple workflow
  const simpleWorkflow = {
    workflow: 'test_pulse',
    steps: [
      { id: 'step1', type: 'mock_compute', params: { input: 'test', delay_ms: 50 } },
      { id: 'step2', type: 'mock_compute', params: { input: 'test2', delay_ms: 50 }, parent_step_ids: ['step1'] }
    ]
  };

  const executed = await engine.execute(simpleWorkflow);

  // Now emit it as a pulse
  const pulseWorkflow = {
    workflow: 'emit_pulse',
    version: '1.0.0',
    steps: [
      {
        id: 'emit',
        type: 'ipfs_workflow_pulse',
        params: {
          workflow_id: executed.workflow_id,
          receipts: executed.receipts,
          merkle_root: executed.merkle_root
        }
      }
    ]
  };

  const result = await engine.execute(pulseWorkflow);
  
  console.log('Workflow Pulse:');
  const pulse = result.receipts[0];
  console.log('  Pulse CID:', pulse.output.pulse_cid);
  console.log('  Workflow ID:', pulse.output.workflow_id);
  console.log('  Merkle Root:', pulse.output.merkle_root);
  console.log('  Topic:', pulse.output.topic);
  console.log('  Receipts Count:', pulse.output.receipts_count);

  return result;
}

// ============================================================================
// EXAMPLE 8: AI + IPFS Integration (Killer Demo)
// ============================================================================

async function exampleAIPlusIPFS() {
  console.log('\n========================================');
  console.log('EXAMPLE 8: AI + IPFS Integration');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));
  engine.registerAdapter(new IPFSAdapter('http://localhost:5001', true));

  const workflow = {
    workflow: 'ai_content_pipeline',
    version: '1.0.0',
    steps: [
      {
        id: 'classify',
        type: 'ai_classify',
        params: {
          model: 'llama3-8b',
          text: 'This is an important research paper about quantum computing.',
          categories: ['research', 'news', 'opinion', 'tutorial'],
          seed: 42,
          temperature: 0.0
        }
      },
      {
        id: 'embed',
        type: 'ai_embed',
        params: {
          model: 'llama3-8b',
          text: 'This is an important research paper about quantum computing.'
        },
        parent_step_ids: ['classify']
      },
      {
        id: 'store_classification',
        type: 'ipfs_add',
        params: {
          content: {
            original_text: 'This is an important research paper about quantum computing.',
            classification: '$classify.category',
            confidence: '$classify.confidence'
          }
        },
        parent_step_ids: ['classify']
      },
      {
        id: 'store_embedding',
        type: 'ipfs_add',
        params: {
          content: '$embed.embedding'
        },
        parent_step_ids: ['embed']
      },
      {
        id: 'publish_results',
        type: 'ipfs_pubsub_publish',
        params: {
          topic: '/jsonflow/ai-pipeline',
          message: {
            classification_cid: '$store_classification.cid',
            embedding_cid: '$store_embedding.cid',
            category: '$classify.category',
            timestamp: Date.now()
          }
        },
        parent_step_ids: ['store_classification', 'store_embedding']
      }
    ]
  };

  const result = await engine.execute(workflow);
  
  console.log('AI + IPFS Pipeline Results:');
  console.log('\nClassification:');
  const classify = result.receipts.find(r => r.step_id === 'classify');
  console.log('  Category:', classify.output.category);
  console.log('  Confidence:', classify.output.confidence);

  console.log('\nEmbedding:');
  const embed = result.receipts.find(r => r.step_id === 'embed');
  console.log('  Dimensions:', embed.output.dimensions);

  console.log('\nIPFS Storage:');
  const storeClass = result.receipts.find(r => r.step_id === 'store_classification');
  console.log('  Classification CID:', storeClass.output.cid);
  
  const storeEmbed = result.receipts.find(r => r.step_id === 'store_embedding');
  console.log('  Embedding CID:', storeEmbed.output.cid);

  console.log('\nPubsub:');
  const publish = result.receipts.find(r => r.step_id === 'publish_results');
  console.log('  Published to:', publish.output.topic);
  console.log('  Message Published:', publish.output.published);

  console.log('\nWorkflow Merkle Root:', result.merkle_root);

  return result;
}

// ============================================================================
// EXAMPLE 9: Deterministic AI Inference Verification
// ============================================================================

async function exampleDeterministicAI() {
  console.log('\n========================================');
  console.log('EXAMPLE 9: Deterministic AI Verification');
  console.log('========================================\n');

  const engine = new JSONFlow.JSONFlowEngine();
  engine.registerAdapter(new AIAdapter('http://localhost:11434', true));

  // Run the same workflow twice with the same seed
  const workflow = {
    workflow: 'deterministic_test',
    version: '1.0.0',
    steps: [
      {
        id: 'infer',
        type: 'ai_infer',
        params: {
          model: 'llama3-8b',
          prompt: 'What is 2+2?',
          seed: 12345,
          temperature: 0.0,
          max_tokens: 10
        }
      }
    ]
  };

  console.log('Running workflow twice with same seed...\n');

  const result1 = await engine.execute(workflow);
  const result2 = await engine.execute(workflow);

  console.log('First Execution:');
  console.log('  Merkle Root:', result1.merkle_root);
  console.log('  Response:', result1.receipts[0].output.text.substring(0, 50));

  console.log('\nSecond Execution:');
  console.log('  Merkle Root:', result2.merkle_root);
  console.log('  Response:', result2.receipts[0].output.text.substring(0, 50));

  console.log('\nDeterminism Verified:', result1.merkle_root === result2.merkle_root ? '✓ Yes' : '✗ No');

  return { result1, result2 };
}

// ============================================================================
// RUN ALL PHASE 2 EXAMPLES
// ============================================================================

async function runAllPhase2Examples() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         JSONFlow Phase 2 - AI & IPFS Examples            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await exampleAIClassification();
    await exampleSentimentPipeline();
    await exampleEmbeddings();
    await exampleSummarization();
    await exampleIPFSStorage();
    await exampleIPFSPubsub();
    await exampleWorkflowPulse();
    await exampleAIPlusIPFS();
    await exampleDeterministicAI();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         Phase 2 Examples Completed Successfully!          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
    console.error(error.stack);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  exampleAIClassification,
  exampleSentimentPipeline,
  exampleEmbeddings,
  exampleSummarization,
  exampleIPFSStorage,
  exampleIPFSPubsub,
  exampleWorkflowPulse,
  exampleAIPlusIPFS,
  exampleDeterministicAI,
  runAllPhase2Examples
};

// Auto-run if executed directly
if (require.main === module) {
  runAllPhase2Examples();
}
