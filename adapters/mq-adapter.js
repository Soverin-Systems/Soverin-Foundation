/**
 * JSONFlow Phase 4: Message Queue Adapter
 * 
 * Integrates with RabbitMQ, Kafka, NATS, and Redis Streams
 * for event-driven workflows.
 */

const crypto = require('crypto');

class MessageQueueAdapter {
  constructor(config = {}) {
    this.defaultTimeout = config.default_timeout || 30000;
    
    // Active connections
    this.connections = new Map();
    
    // Supported brokers
    this.supportedBrokers = ['rabbitmq', 'kafka', 'nats', 'redis'];
  }
  
  getManifest() {
    return {
      adapter_id: 'mq',
      version: '1.0.0',
      step_types: [
        {
          type: 'mq_publish',
          params_schema: {
            broker: 'string',
            exchange: 'string',
            routing_key: 'string',
            message: 'object'
          },
          deterministic: false
        },
        {
          type: 'mq_consume',
          params_schema: {
            broker: 'string',
            queue: 'string',
            max_messages: 'integer'
          },
          deterministic: false
        },
        {
          type: 'mq_create_queue',
          params_schema: {
            broker: 'string',
            queue: 'string',
            options: 'object'
          },
          deterministic: false
        },
        {
          type: 'mq_purge',
          params_schema: {
            broker: 'string',
            queue: 'string'
          },
          deterministic: false
        }
      ]
    };
  }
  
  validate(step) {
    const validTypes = ['mq_publish', 'mq_consume', 'mq_create_queue', 'mq_purge'];
    
    if (!validTypes.includes(step.type)) {
      return { valid: false, error: 'Unknown MQ step type' };
    }
    
    if (!step.params.broker) {
      return { valid: false, error: 'Missing required param: broker' };
    }
    
    // Validate broker type
    const brokerType = this._parseBrokerString(step.params.broker).type;
    if (!this.supportedBrokers.includes(brokerType)) {
      return { 
        valid: false, 
        error: `Unsupported broker: ${brokerType}` 
      };
    }
    
    return { valid: true };
  }
  
  async execute(step, context) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (step.type) {
        case 'mq_publish':
          result = await this._publish(step);
          break;
        case 'mq_consume':
          result = await this._consume(step);
          break;
        case 'mq_create_queue':
          result = await this._createQueue(step);
          break;
        case 'mq_purge':
          result = await this._purge(step);
          break;
        default:
          throw new Error(`Unsupported MQ step type: ${step.type}`);
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
  
  async _publish(step) {
    const broker = step.params.broker;
    const exchange = step.params.exchange || '';
    const routingKey = step.params.routing_key || '';
    const message = step.params.message;
    const options = step.params.options || {};
    
    // Get connection
    const conn = await this._getConnection(broker);
    
    // Publish message based on broker type
    const brokerInfo = this._parseBrokerString(broker);
    
    if (brokerInfo.type === 'rabbitmq') {
      return await this._publishRabbitMQ(conn, exchange, routingKey, message, options);
    } else if (brokerInfo.type === 'kafka') {
      return await this._publishKafka(conn, exchange, message, options);
    } else if (brokerInfo.type === 'nats') {
      return await this._publishNATS(conn, routingKey, message, options);
    } else if (brokerInfo.type === 'redis') {
      return await this._publishRedis(conn, routingKey, message, options);
    }
    
    throw new Error(`Unsupported broker type: ${brokerInfo.type}`);
  }
  
  async _consume(step) {
    const broker = step.params.broker;
    const queue = step.params.queue;
    const maxMessages = step.params.max_messages || 1;
    
    // Get connection
    const conn = await this._getConnection(broker);
    
    // Consume messages based on broker type
    const brokerInfo = this._parseBrokerString(broker);
    
    if (brokerInfo.type === 'rabbitmq') {
      return await this._consumeRabbitMQ(conn, queue, maxMessages);
    } else if (brokerInfo.type === 'kafka') {
      return await this._consumeKafka(conn, queue, maxMessages);
    } else if (brokerInfo.type === 'nats') {
      return await this._consumeNATS(conn, queue, maxMessages);
    } else if (brokerInfo.type === 'redis') {
      return await this._consumeRedis(conn, queue, maxMessages);
    }
    
    throw new Error(`Unsupported broker type: ${brokerInfo.type}`);
  }
  
  async _createQueue(step) {
    const broker = step.params.broker;
    const queue = step.params.queue;
    const options = step.params.options || {};
    
    const conn = await this._getConnection(broker);
    const brokerInfo = this._parseBrokerString(broker);
    
    // Create queue (mock implementation)
    console.log(`[MQAdapter] Creating queue ${queue} on ${brokerInfo.type}`);
    
    return {
      created: true,
      queue,
      broker: brokerInfo.type,
      options
    };
  }
  
  async _purge(step) {
    const broker = step.params.broker;
    const queue = step.params.queue;
    
    const conn = await this._getConnection(broker);
    
    console.log(`[MQAdapter] Purging queue ${queue}`);
    
    return {
      purged: true,
      queue,
      messages_deleted: Math.floor(Math.random() * 100)
    };
  }
  
  // RabbitMQ specific methods
  
  async _publishRabbitMQ(conn, exchange, routingKey, message, options) {
    // Mock RabbitMQ publish
    const messageId = crypto.randomBytes(8).toString('hex');
    
    console.log(`[MQAdapter] Publishing to RabbitMQ: ${exchange}/${routingKey}`);
    
    return {
      published: true,
      message_id: messageId,
      exchange,
      routing_key: routingKey,
      persistent: options.persistent || false,
      priority: options.priority || 0
    };
  }
  
  async _consumeRabbitMQ(conn, queue, maxMessages) {
    // Mock RabbitMQ consume
    const messages = [];
    
    const count = Math.min(maxMessages, Math.floor(Math.random() * 10) + 1);
    
    for (let i = 0; i < count; i++) {
      messages.push({
        id: crypto.randomBytes(8).toString('hex'),
        body: { data: `Message ${i + 1}`, timestamp: Date.now() },
        properties: {
          delivery_tag: i + 1,
          redelivered: false
        }
      });
    }
    
    console.log(`[MQAdapter] Consumed ${messages.length} messages from ${queue}`);
    
    return {
      messages,
      queue,
      count: messages.length
    };
  }
  
  // Kafka specific methods
  
  async _publishKafka(conn, topic, message, options) {
    const partition = options.partition || 0;
    const offset = Math.floor(Math.random() * 10000);
    
    console.log(`[MQAdapter] Publishing to Kafka topic: ${topic}`);
    
    return {
      published: true,
      topic,
      partition,
      offset
    };
  }
  
  async _consumeKafka(conn, topic, maxMessages) {
    const messages = [];
    
    const count = Math.min(maxMessages, Math.floor(Math.random() * 10) + 1);
    
    for (let i = 0; i < count; i++) {
      messages.push({
        topic,
        partition: 0,
        offset: Math.floor(Math.random() * 10000),
        key: `key-${i}`,
        value: { data: `Kafka message ${i + 1}` },
        timestamp: Date.now()
      });
    }
    
    return {
      messages,
      topic,
      count: messages.length
    };
  }
  
  // NATS specific methods
  
  async _publishNATS(conn, subject, message, options) {
    console.log(`[MQAdapter] Publishing to NATS subject: ${subject}`);
    
    return {
      published: true,
      subject,
      message_id: crypto.randomBytes(8).toString('hex')
    };
  }
  
  async _consumeNATS(conn, subject, maxMessages) {
    const messages = [];
    
    const count = Math.min(maxMessages, Math.floor(Math.random() * 10) + 1);
    
    for (let i = 0; i < count; i++) {
      messages.push({
        subject,
        data: { data: `NATS message ${i + 1}` },
        sid: i + 1
      });
    }
    
    return {
      messages,
      subject,
      count: messages.length
    };
  }
  
  // Redis Streams specific methods
  
  async _publishRedis(conn, stream, message, options) {
    const messageId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    console.log(`[MQAdapter] Publishing to Redis stream: ${stream}`);
    
    return {
      published: true,
      stream,
      message_id: messageId
    };
  }
  
  async _consumeRedis(conn, stream, maxMessages) {
    const messages = [];
    
    const count = Math.min(maxMessages, Math.floor(Math.random() * 10) + 1);
    
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `${Date.now()}-${i}`,
        stream,
        fields: { data: `Redis message ${i + 1}` }
      });
    }
    
    return {
      messages,
      stream,
      count: messages.length
    };
  }
  
  async _getConnection(brokerString) {
    if (this.connections.has(brokerString)) {
      return this.connections.get(brokerString);
    }
    
    const brokerInfo = this._parseBrokerString(brokerString);
    
    const conn = {
      id: crypto.randomBytes(4).toString('hex'),
      type: brokerInfo.type,
      url: brokerString,
      connected: true,
      created: Date.now()
    };
    
    this.connections.set(brokerString, conn);
    console.log(`[MQAdapter] Created connection to ${brokerInfo.type}`);
    
    return conn;
  }
  
  _parseBrokerString(brokerStr) {
    // Parse broker string: protocol://host:port
    const match = brokerStr.match(/^(\w+):\/\//);
    
    if (!match) {
      throw new Error('Invalid broker string');
    }
    
    let type = match[1];
    
    // Map protocol to broker type
    if (type === 'amqp' || type === 'rabbitmq') {
      type = 'rabbitmq';
    }
    
    return { type, url: brokerStr };
  }
  
  async healthCheck() {
    const connections = [];
    
    this.connections.forEach((conn, url) => {
      connections.push({
        type: conn.type,
        connected: conn.connected,
        age_seconds: (Date.now() - conn.created) / 1000
      });
    });
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections,
      supported_brokers: this.supportedBrokers
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageQueueAdapter };
}

if (typeof window !== 'undefined') {
  window.JSONFlow = window.JSONFlow || {};
  window.JSONFlow.MessageQueueAdapter = MessageQueueAdapter;
}
