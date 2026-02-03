# JSONFlow Workflow Examples

## 1. Simple Text Message with Transport Fallback

```json
{
  "function": "send_text_message",
  "description": "Send text with automatic transport fallback",
  "steps": [
    {
      "id": "load_key",
      "type": "vault_get",
      "config": {
        "pointer": "vault://identity/signing-key"
      }
    },
    {
      "id": "sign_message",
      "type": "crypto_sign",
      "config": {
        "key": "{{steps.load_key.output}}",
        "payload": {
          "from": "{{inputs.sender}}",
          "to": "{{inputs.recipient}}",
          "text": "{{inputs.text}}",
          "timestamp": "now"
        }
      }
    },
    {
      "id": "route",
      "type": "transport_router",
      "config": {
        "recipient": "{{inputs.recipient}}",
        "payload": {
          "text": "{{inputs.text}}",
          "signature": "{{steps.sign_message.output.signature}}"
        },
        "fallback_order": ["app", "sms_gateway", "smtp_gateway"]
      }
    }
  ]
}
```

**Usage:**
```javascript
const result = await engine.execute(workflow, {
  sender: "did:sov:alice123",
  recipient: "did:sov:bob456",
  text: "Hello from the sovereign network!"
});
```

---

## 2. Video Publication to IPFS with Social Feed

```json
{
  "function": "publish_video",
  "description": "Upload video to IPFS and broadcast to subscribers",
  "steps": [
    {
      "id": "upload_video",
      "type": "ipfs_add",
      "config": {
        "content": "{{inputs.video_blob}}"
      }
    },
    {
      "id": "upload_thumbnail",
      "type": "ipfs_add",
      "config": {
        "content": "{{inputs.thumbnail_blob}}"
      }
    },
    {
      "id": "compose_post",
      "type": "json_compose",
      "config": {
        "message": {
          "type": "video_post",
          "title": "{{inputs.title}}",
          "description": "{{inputs.description}}",
          "video_cid": "{{steps.upload_video.output.cid}}",
          "thumbnail_cid": "{{steps.upload_thumbnail.output.cid}}",
          "duration": "{{inputs.duration}}",
          "tags": "{{inputs.tags}}",
          "published_at": "now"
        }
      }
    },
    {
      "id": "sign_post",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": "{{steps.compose_post.output}}"
      }
    },
    {
      "id": "emit_to_feed",
      "type": "event_emit",
      "config": {
        "channel": "identity://{{inputs.creator_address}}/feed",
        "payload": {
          "post": "{{steps.compose_post.output}}",
          "signature": "{{steps.sign_post.output.signature}}"
        }
      }
    }
  ]
}
```

**Usage:**
```javascript
const result = await engine.execute(workflow, {
  creator_address: "did:sov:creator789",
  video_blob: videoFile,
  thumbnail_blob: thumbnailImage,
  title: "Introduction to Sovereign Identity",
  description: "Learn how identity-as-kernel works",
  duration: 480,
  tags: ["education", "tech", "decentralization"]
});
```

---

## 3. Multi-Recipient Broadcast

```json
{
  "function": "broadcast_message",
  "description": "Send message to multiple recipients with individual transport preferences",
  "steps": [
    {
      "id": "load_key",
      "type": "vault_get",
      "config": {
        "pointer": "vault://identity/signing-key"
      }
    },
    {
      "id": "sign_broadcast",
      "type": "crypto_sign",
      "config": {
        "key": "{{steps.load_key.output}}",
        "payload": {
          "from": "{{inputs.sender}}",
          "recipients": "{{inputs.recipients}}",
          "message": "{{inputs.message}}",
          "timestamp": "now"
        }
      }
    },
    {
      "id": "route_to_all",
      "type": "parallel_route",
      "config": {
        "recipients": "{{inputs.recipients}}",
        "payload": {
          "message": "{{inputs.message}}",
          "signature": "{{steps.sign_broadcast.output.signature}}"
        },
        "fallback_order": ["app", "sms_gateway", "smtp_gateway"]
      }
    }
  ]
}
```

---

## 4. Encrypted Direct Message

```json
{
  "function": "send_encrypted_message",
  "description": "E2E encrypted message with recipient's public key",
  "steps": [
    {
      "id": "fetch_recipient_pubkey",
      "type": "vault_get",
      "config": {
        "pointer": "vault://contacts/{{inputs.recipient}}/pubkey"
      }
    },
    {
      "id": "encrypt_message",
      "type": "crypto_encrypt",
      "config": {
        "recipient_key": "{{steps.fetch_recipient_pubkey.output}}",
        "message": "{{inputs.message}}"
      }
    },
    {
      "id": "sign_encrypted",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": {
          "encrypted_data": "{{steps.encrypt_message.output.ciphertext}}",
          "ephemeral_key": "{{steps.encrypt_message.output.ephemeral_pubkey}}",
          "mac": "{{steps.encrypt_message.output.mac}}"
        }
      }
    },
    {
      "id": "route",
      "type": "transport_router",
      "config": {
        "recipient": "{{inputs.recipient}}",
        "payload": {
          "encrypted_data": "{{steps.encrypt_message.output.ciphertext}}",
          "ephemeral_key": "{{steps.encrypt_message.output.ephemeral_pubkey}}",
          "mac": "{{steps.encrypt_message.output.mac}}",
          "signature": "{{steps.sign_encrypted.output.signature}}"
        },
        "fallback_order": ["webrtc", "app"]
      }
    }
  ]
}
```

---

## 5. File Sharing with Access Control

```json
{
  "function": "share_file",
  "description": "Upload file to IPFS and grant access to specific recipients",
  "steps": [
    {
      "id": "upload_file",
      "type": "ipfs_add",
      "config": {
        "content": "{{inputs.file_blob}}"
      }
    },
    {
      "id": "generate_access_token",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": {
          "file_cid": "{{steps.upload_file.output.cid}}",
          "allowed_recipients": "{{inputs.allowed_recipients}}",
          "expires_at": "{{inputs.expiration_timestamp}}",
          "permissions": ["read", "download"]
        }
      }
    },
    {
      "id": "compose_share",
      "type": "json_compose",
      "config": {
        "message": {
          "type": "file_share",
          "filename": "{{inputs.filename}}",
          "cid": "{{steps.upload_file.output.cid}}",
          "size": "{{steps.upload_file.output.size}}",
          "access_token": "{{steps.generate_access_token.output.signature}}",
          "expires_at": "{{inputs.expiration_timestamp}}"
        }
      }
    },
    {
      "id": "notify_recipients",
      "type": "parallel_route",
      "config": {
        "recipients": "{{inputs.allowed_recipients}}",
        "payload": "{{steps.compose_share.output}}",
        "fallback_order": ["app", "smtp_gateway"]
      }
    }
  ]
}
```

---

## 6. WebRTC Call Initiation

```json
{
  "function": "initiate_call",
  "description": "Start WebRTC call with signaling through JSONFlow",
  "steps": [
    {
      "id": "create_offer",
      "type": "webrtc_create_offer",
      "config": {
        "media_constraints": {
          "audio": true,
          "video": "{{inputs.video_enabled}}"
        }
      }
    },
    {
      "id": "sign_offer",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": {
          "call_type": "{{inputs.call_type}}",
          "sdp_offer": "{{steps.create_offer.output.sdp}}",
          "ice_candidates": "{{steps.create_offer.output.ice_candidates}}"
        }
      }
    },
    {
      "id": "send_offer",
      "type": "transport_router",
      "config": {
        "recipient": "{{inputs.recipient}}",
        "payload": {
          "intent": "call_offer",
          "call_type": "{{inputs.call_type}}",
          "sdp_offer": "{{steps.create_offer.output.sdp}}",
          "ice_candidates": "{{steps.create_offer.output.ice_candidates}}",
          "signature": "{{steps.sign_offer.output.signature}}"
        },
        "fallback_order": ["webrtc", "app"]
      }
    },
    {
      "id": "wait_for_answer",
      "type": "event_listen",
      "config": {
        "channel": "identity://{{inputs.sender}}/calls",
        "timeout_ms": 30000,
        "filter": {
          "intent": "call_answer",
          "call_id": "{{steps.send_offer.output.message_id}}"
        }
      }
    }
  ]
}
```

---

## 7. Transport Configuration Change

```json
{
  "function": "switch_sms_provider",
  "description": "Detach old SMS bridge and attach new one with zero downtime",
  "steps": [
    {
      "id": "verify_identity",
      "type": "crypto_verify",
      "config": {
        "public_key": "{{inputs.sender_address}}",
        "signature": "{{inputs.auth_signature}}",
        "payload": {
          "action": "change_transport",
          "timestamp": "now"
        }
      }
    },
    {
      "id": "detach_old_sms",
      "type": "transport_detach",
      "config": {
        "address": "{{inputs.sender_address}}",
        "transport": "sms_gateway",
        "provider": "{{inputs.old_provider}}"
      }
    },
    {
      "id": "attach_new_sms",
      "type": "transport_attach",
      "config": {
        "address": "{{inputs.sender_address}}",
        "transport": "sms_gateway",
        "provider": "{{inputs.new_provider}}",
        "config": {
          "number": "{{inputs.new_number}}",
          "api_credentials": "{{inputs.new_credentials}}"
        }
      }
    },
    {
      "id": "emit_change_event",
      "type": "event_emit",
      "config": {
        "channel": "identity://{{inputs.sender_address}}/config",
        "payload": {
          "event": "transport_changed",
          "transport": "sms_gateway",
          "old_provider": "{{inputs.old_provider}}",
          "new_provider": "{{inputs.new_provider}}",
          "timestamp": "now"
        }
      }
    }
  ]
}
```

---

## 8. Cross-Device Sync

```json
{
  "function": "sync_to_new_device",
  "description": "Sync identity and messages to a new device",
  "steps": [
    {
      "id": "generate_sync_token",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": {
          "action": "device_sync",
          "device_id": "{{inputs.new_device_id}}",
          "expires_at": "{{inputs.token_expiration}}",
          "scope": ["messages", "contacts", "transports"]
        }
      }
    },
    {
      "id": "fetch_messages",
      "type": "vault_get",
      "config": {
        "pointer": "vault://messages/archive"
      }
    },
    {
      "id": "fetch_contacts",
      "type": "vault_get",
      "config": {
        "pointer": "vault://contacts/list"
      }
    },
    {
      "id": "fetch_transports",
      "type": "vault_get",
      "config": {
        "pointer": "vault://transports/config"
      }
    },
    {
      "id": "encrypt_sync_bundle",
      "type": "crypto_encrypt",
      "config": {
        "recipient_key": "{{inputs.new_device_pubkey}}",
        "message": {
          "messages": "{{steps.fetch_messages.output}}",
          "contacts": "{{steps.fetch_contacts.output}}",
          "transports": "{{steps.fetch_transports.output}}",
          "sync_token": "{{steps.generate_sync_token.output.signature}}"
        }
      }
    },
    {
      "id": "upload_sync_bundle",
      "type": "ipfs_add",
      "config": {
        "content": "{{steps.encrypt_sync_bundle.output.ciphertext}}"
      }
    },
    {
      "id": "return_sync_link",
      "type": "json_compose",
      "config": {
        "message": {
          "sync_bundle_cid": "{{steps.upload_sync_bundle.output.cid}}",
          "ephemeral_key": "{{steps.encrypt_sync_bundle.output.ephemeral_pubkey}}",
          "expires_at": "{{inputs.token_expiration}}"
        }
      }
    }
  ]
}
```

---

## 9. Subscription Management

```json
{
  "function": "subscribe_to_feed",
  "description": "Subscribe to another identity's content feed",
  "steps": [
    {
      "id": "sign_subscription",
      "type": "crypto_sign",
      "config": {
        "key": "vault://identity/signing-key",
        "payload": {
          "action": "subscribe",
          "subscriber": "{{inputs.subscriber_address}}",
          "creator": "{{inputs.creator_address}}",
          "feed_types": ["video", "image", "text"],
          "timestamp": "now"
        }
      }
    },
    {
      "id": "store_subscription",
      "type": "vault_set",
      "config": {
        "pointer": "vault://subscriptions/{{inputs.creator_address}}",
        "value": {
          "creator": "{{inputs.creator_address}}",
          "subscribed_at": "now",
          "feed_types": ["video", "image", "text"],
          "signature": "{{steps.sign_subscription.output.signature}}"
        }
      }
    },
    {
      "id": "notify_creator",
      "type": "transport_router",
      "config": {
        "recipient": "{{inputs.creator_address}}",
        "payload": {
          "intent": "new_subscriber",
          "subscriber": "{{inputs.subscriber_address}}",
          "signature": "{{steps.sign_subscription.output.signature}}"
        },
        "fallback_order": ["app"]
      }
    },
    {
      "id": "fetch_recent_content",
      "type": "event_query",
      "config": {
        "channel": "identity://{{inputs.creator_address}}/feed",
        "limit": 10,
        "since": "{{inputs.fetch_history_days}}"
      }
    }
  ]
}
```

---

## 10. Automated Response Workflow

```json
{
  "function": "auto_reply_workflow",
  "description": "Conditional auto-reply based on message content",
  "steps": [
    {
      "id": "analyze_message",
      "type": "message_classifier",
      "config": {
        "message": "{{inputs.incoming_message}}",
        "categories": ["question", "greeting", "urgent", "spam"]
      }
    },
    {
      "id": "check_availability",
      "type": "vault_get",
      "config": {
        "pointer": "vault://settings/availability-status"
      }
    },
    {
      "id": "compose_reply",
      "type": "conditional_compose",
      "config": {
        "conditions": [
          {
            "if": "{{steps.analyze_message.output.category}} == 'urgent'",
            "then": {
              "template": "I'm currently {{steps.check_availability.output.status}}. This is urgent, so I'll get back to you within 1 hour."
            }
          },
          {
            "if": "{{steps.check_availability.output.status}} == 'busy'",
            "then": {
              "template": "Thanks for your message. I'm currently busy and will respond within 24 hours."
            }
          },
          {
            "else": {
              "template": null
            }
          }
        ]
      }
    },
    {
      "id": "send_auto_reply",
      "type": "transport_router",
      "config": {
        "recipient": "{{inputs.sender}}",
        "payload": {
          "text": "{{steps.compose_reply.output}}",
          "auto_reply": true
        },
        "fallback_order": ["app", "sms_gateway"]
      }
    }
  ]
}
```

---

## Workflow Composition Patterns

### Pattern 1: Sequential Steps
Each step depends on the previous one:
```
load_key → sign → route → confirm
```

### Pattern 2: Parallel Execution
Multiple independent steps run simultaneously:
```
upload_video ┐
              ├→ compose → sign → emit
upload_thumb ┘
```

### Pattern 3: Conditional Branching
Different paths based on runtime conditions:
```
check_status → if(available) → direct_reply
            └→ if(busy) → auto_reply
            └→ if(away) → queue_for_later
```

### Pattern 4: Event-Driven
Steps wait for external events:
```
send_offer → wait_for_answer → establish_connection
```

### Pattern 5: Loop/Iteration
Repeat steps for multiple items:
```
for_each(recipient) → sign → route → log
```

---

## Custom Step Types

You can extend the workflow engine with custom step types:

```javascript
class CustomStepExecutor {
  async execute(config, context) {
    // Your custom logic
    return result;
  }
}

// Register custom step type
engine.registerStepType('custom_step_name', CustomStepExecutor);
```

---

## Error Handling

All workflows support error handling:

```json
{
  "id": "risky_step",
  "type": "external_api_call",
  "config": {...},
  "on_error": {
    "retry": {
      "max_attempts": 3,
      "backoff_ms": 1000
    },
    "fallback": {
      "type": "log_error",
      "config": {
        "message": "Step failed after retries"
      }
    }
  }
}
```

---

These workflows demonstrate the full power of the **unified address dispatch** system:

1. **Cryptographic integrity** - Everything is signed
2. **Multi-transport routing** - Automatic fallback
3. **Content addressing** - IPFS for media
4. **Event-driven messaging** - Pub/sub for real-time
5. **Conditional logic** - Smart routing based on context
6. **Cross-device sync** - Identity is portable
7. **Access control** - Granular permissions

The workflow engine is the glue that makes sovereign identity **practical** and **powerful**.
