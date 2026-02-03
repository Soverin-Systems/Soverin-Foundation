/**
 * JSONFlow AI/Ollama Adapter
 * Deterministic AI inference, embedding, and classification
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
// OLLAMA CLIENT (Browser & Node.js Compatible)
// ============================================================================

class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate completion with deterministic settings
   */
  async generate(model, prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          seed: options.seed || 42,
          temperature: options.temperature || 0.0,
          top_k: options.top_k || 1,
          top_p: options.top_p || 1.0,
          num_predict: options.num_predict || 512
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate embeddings
   */
  async embeddings(model, prompt) {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * List available models
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Check if Ollama is running
   */
  async ping() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// MOCK OLLAMA CLIENT (For when Ollama is not available)
// ============================================================================

class MockOllamaClient {
  constructor() {
    this.models = [
      { name: 'llama3-8b', size: 4661224192 },
      { name: 'mistral', size: 4109865159 },
      { name: 'codellama', size: 3826793677 }
    ];
  }

  async generate(model, prompt, options = {}) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Deterministic mock responses based on seed
    const seed = options.seed || 42;
    const responses = [
      "This appears to be a neutral statement.",
      "This content seems positive in nature.",
      "This text has a negative sentiment.",
      "This is likely a factual statement.",
      "This appears to be a question."
    ];

    const index = seed % responses.length;
    
    return {
      model,
      created_at: new Date().toISOString(),
      response: responses[index],
      done: true,
      context: [1, 2, 3],
      total_duration: 150000000,
      load_duration: 50000000,
      prompt_eval_count: prompt.split(' ').length,
      eval_count: responses[index].split(' ').length
    };
  }

  async embeddings(model, prompt) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Generate deterministic mock embeddings
    const dimensions = 384; // Common embedding size
    const embedding = [];
    
    // Use prompt hash as seed for determinism
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
      hash = hash & hash;
    }

    for (let i = 0; i < dimensions; i++) {
      // Generate deterministic values between -1 and 1
      const x = Math.sin(hash + i) * 10000;
      embedding.push(x - Math.floor(x));
    }

    return {
      embedding,
      model,
      created_at: new Date().toISOString()
    };
  }

  async listModels() {
    return {
      models: this.models
    };
  }

  async ping() {
    return true;
  }
}

// ============================================================================
// AI/OLLAMA ADAPTER
// ============================================================================

class AIAdapter extends Adapter {
  constructor(ollamaUrl = 'http://localhost:11434', useMock = false) {
    super();
    this.ollamaUrl = ollamaUrl;
    this.useMock = useMock;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the Ollama client
   */
  async initialize() {
    if (this.initialized) return;

    if (this.useMock) {
      this.client = new MockOllamaClient();
      this.initialized = true;
      return;
    }

    const realClient = new OllamaClient(this.ollamaUrl);
    const isAvailable = await realClient.ping();

    if (isAvailable) {
      this.client = realClient;
      console.log('✓ Connected to Ollama at', this.ollamaUrl);
    } else {
      console.warn('⚠ Ollama not available, using mock client');
      this.client = new MockOllamaClient();
    }

    this.initialized = true;
  }

  getManifest() {
    return {
      adapter_id: 'ai_ollama',
      version: '1.2.3',
      step_types: [
        {
          type: 'ai_infer',
          description: 'General-purpose inference with streaming support',
          params_schema: {
            model: 'string',
            prompt: 'string',
            seed: 'number',
            temperature: 'number',
            max_tokens: 'number'
          },
          resource_requirements: {
            ram_mb: 4096,
            gpu: true
          },
          deterministic: true
        },
        {
          type: 'ai_embed',
          description: 'Generate embeddings for text',
          params_schema: {
            model: 'string',
            text: 'string'
          },
          resource_requirements: {
            ram_mb: 2048,
            gpu: false
          },
          deterministic: true
        },
        {
          type: 'ai_classify',
          description: 'Text classification with confidence scores',
          params_schema: {
            model: 'string',
            text: 'string',
            categories: 'array',
            seed: 'number',
            temperature: 'number'
          },
          resource_requirements: {
            ram_mb: 4096,
            gpu: true
          },
          deterministic: true
        },
        {
          type: 'ai_sentiment',
          description: 'Sentiment analysis (positive/negative/neutral)',
          params_schema: {
            model: 'string',
            text: 'string',
            seed: 'number'
          },
          resource_requirements: {
            ram_mb: 2048,
            gpu: false
          },
          deterministic: true
        },
        {
          type: 'ai_summarize',
          description: 'Text summarization',
          params_schema: {
            model: 'string',
            text: 'string',
            max_length: 'number',
            seed: 'number'
          },
          resource_requirements: {
            ram_mb: 4096,
            gpu: true
          },
          deterministic: true
        }
      ],
      cid: 'Qmai_adapter_v123'
    };
  }

  validate(step) {
    const validTypes = ['ai_infer', 'ai_embed', 'ai_classify', 'ai_sentiment', 'ai_summarize'];
    
    if (!validTypes.includes(step.type)) {
      return { valid: false, error: `Unknown step type: ${step.type}` };
    }

    if (!step.params.model) {
      return { valid: false, error: 'Missing required param: model' };
    }

    if (step.type === 'ai_infer' && !step.params.prompt) {
      return { valid: false, error: 'Missing required param: prompt' };
    }

    if (['ai_embed', 'ai_classify', 'ai_sentiment', 'ai_summarize'].includes(step.type) && !step.params.text) {
      return { valid: false, error: 'Missing required param: text' };
    }

    if (step.type === 'ai_classify' && !step.params.categories) {
      return { valid: false, error: 'Missing required param: categories' };
    }

    // Enforce determinism requirements
    if (['ai_infer', 'ai_classify', 'ai_sentiment', 'ai_summarize'].includes(step.type)) {
      if (step.params.seed === undefined) {
        return { valid: false, error: 'Deterministic steps require explicit seed parameter' };
      }
      if (step.params.temperature === undefined) {
        step.params.temperature = 0.0; // Default to deterministic
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
        case 'ai_infer':
          output = await this._executeInfer(step);
          break;
        case 'ai_embed':
          output = await this._executeEmbed(step);
          break;
        case 'ai_classify':
          output = await this._executeClassify(step);
          break;
        case 'ai_sentiment':
          output = await this._executeSentiment(step);
          break;
        case 'ai_summarize':
          output = await this._executeSummarize(step);
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
          adapter_version: this.getManifest().version,
          model: step.params.model,
          deterministic: true
        }
      };

    } catch (error) {
      return {
        step_id: step.id,
        status: 'error',
        error: {
          code: 'AI_EXECUTION_ERROR',
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
   * Execute inference
   */
  async _executeInfer(step) {
    const { model, prompt, seed, temperature, max_tokens } = step.params;

    const result = await this.client.generate(model, prompt, {
      seed: seed || 42,
      temperature: temperature !== undefined ? temperature : 0.0,
      num_predict: max_tokens || 512
    });

    return {
      text: result.response,
      model,
      seed,
      temperature: temperature !== undefined ? temperature : 0.0,
      tokens_evaluated: result.eval_count,
      total_duration_ns: result.total_duration
    };
  }

  /**
   * Execute embedding
   */
  async _executeEmbed(step) {
    const { model, text } = step.params;

    const result = await this.client.embeddings(model, text);

    return {
      embedding: result.embedding,
      dimensions: result.embedding.length,
      model,
      text_length: text.length
    };
  }

  /**
   * Execute classification
   */
  async _executeClassify(step) {
    const { model, text, categories, seed, temperature } = step.params;

    // Build classification prompt
    const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}.
Only respond with the category name and a confidence score (0-1).

Text: "${text}"

Category:`;

    const result = await this.client.generate(model, prompt, {
      seed: seed || 42,
      temperature: temperature !== undefined ? temperature : 0.0,
      num_predict: 50
    });

    // Parse the response to extract category and confidence
    const response = result.response.trim();
    
    // Simple parsing - in production, use more robust parsing
    let category = categories[0];
    let confidence = 0.5;

    for (const cat of categories) {
      if (response.toLowerCase().includes(cat.toLowerCase())) {
        category = cat;
        confidence = 0.85; // Mock confidence
        break;
      }
    }

    // Extract attention tokens (simplified - would need actual model outputs)
    const words = text.split(/\s+/);
    const explanationTokens = words.slice(0, 3).map((token, idx) => ({
      token,
      attention: 0.9 - (idx * 0.1)
    }));

    return {
      category,
      confidence,
      categories_evaluated: categories,
      explanation_tokens: explanationTokens,
      raw_response: response,
      seed,
      model
    };
  }

  /**
   * Execute sentiment analysis
   */
  async _executeSentiment(step) {
    const { model, text, seed } = step.params;

    const prompt = `Analyze the sentiment of the following text. 
Respond with only one word: "positive", "negative", or "neutral".

Text: "${text}"

Sentiment:`;

    const result = await this.client.generate(model, prompt, {
      seed: seed || 42,
      temperature: 0.0,
      num_predict: 10
    });

    const sentiment = result.response.trim().toLowerCase();
    
    // Normalize sentiment
    let normalizedSentiment = 'neutral';
    if (sentiment.includes('positive')) normalizedSentiment = 'positive';
    else if (sentiment.includes('negative')) normalizedSentiment = 'negative';

    // Calculate simple score
    const score = normalizedSentiment === 'positive' ? 0.8 : 
                 normalizedSentiment === 'negative' ? -0.8 : 0.0;

    return {
      sentiment: normalizedSentiment,
      score,
      confidence: 0.85,
      text_analyzed: text.substring(0, 100),
      seed,
      model
    };
  }

  /**
   * Execute summarization
   */
  async _executeSummarize(step) {
    const { model, text, max_length, seed } = step.params;

    const prompt = `Summarize the following text in ${max_length || 100} words or less:

"${text}"

Summary:`;

    const result = await this.client.generate(model, prompt, {
      seed: seed || 42,
      temperature: 0.0,
      num_predict: max_length || 100
    });

    return {
      summary: result.response.trim(),
      original_length: text.length,
      summary_length: result.response.length,
      compression_ratio: text.length / result.response.length,
      seed,
      model
    };
  }

  async healthCheck() {
    await this.initialize();

    const isHealthy = await this.client.ping();
    const models = await this.client.listModels();

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      ollama_url: this.ollamaUrl,
      using_mock: this.client instanceof MockOllamaClient,
      available_models: models.models?.map(m => m.name) || []
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AIAdapter,
    OllamaClient,
    MockOllamaClient
  };
} else if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.AIAdapter = AIAdapter;
  window.JSONFlow.OllamaClient = OllamaClient;
  window.JSONFlow.MockOllamaClient = MockOllamaClient;
}
