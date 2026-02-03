# Alignment Guide: Search Engine → Social Spec

## Current State vs Spec Requirements

### ✅ ALIGNED
- Identity resolution (address/alias matching)
- Namespace filtering (posts, videos, files, workflows, messages)
- Hybrid search (BM25 + TF-IDF)
- Scoped search (identity + namespace filtering)

### ❌ MISSING

## 1. Extend Identity Data Model

**Current:**
```javascript
{
  id: '0xA1B2C3D4E5F6',
  address: '0xA1B2C3D4E5F6789012345678',
  aliases: ['alice', 'alice.sovereign'],
  namespaces: { posts: [...], videos: [...] }
}
```

**Spec Requires:**
```javascript
{
  id: 'did:sovereign:0xA1B2C3D4E5F6',  // DID format
  address: '0xA1B2C3D4E5F6789012345678',
  publicKey: 'base64_encoded_public_key',
  aliases: ['alice', 'alice.sovereign'],
  
  // ADD THESE:
  capabilities: {
    canSign: true,
    canHost: true,
    canPublish: true,
    canDelegate: false
  },
  
  preferences: {
    defaultNamespace: 'posts',
    displayName: 'Alice Researcher',
    bio: 'Exploring decentralized systems',
    theme: 'dark'
  },
  
  social: {
    followers: ['did:sovereign:0xF6E5D4C3B2A1'],
    following: ['did:sovereign:0x123456789ABC'],
    blocked: []
  },
  
  namespaces: {
    posts: [...],
    videos: [...],
    messages: [...],
    files: [...],
    workflows: [...],
    events: [],
    storage: []
  }
}
```

## 2. Extend Content Items with Interactions

**Current:**
```javascript
{
  id: 'post_001',
  title: 'Decentralized Identity Systems',
  content: '...',
  tags: ['identity', 'blockchain'],
  created: Date.now()
}
```

**Spec Requires:**
```javascript
{
  cid: 'QmXxx...', // IPFS Content ID
  type: 'post',
  createdAt: Date.now(),
  author: 'did:sovereign:0xA1B2C3D4E5F6',
  
  metadata: {
    title: 'Decentralized Identity Systems',
    description: '...',
    tags: ['identity', 'blockchain'],
    mimeType: 'text/markdown'
  },
  
  // ADD THESE:
  embedding: [...],  // Dense vector
  sparseTokens: ['decentr', 'ident', 'system'],
  
  interactions: {
    likes: 42,
    comments: [
      {
        cid: 'QmYyy...',
        author: 'did:sovereign:0xF6E5D4C3B2A1',
        createdAt: Date.now(),
        content: 'Great post!',
        likes: 5
      }
    ],
    shares: 12
  }
}
```

## 3. Add URL Routing

**Current:** Single-page app

**Spec Requires:**
```javascript
// URL structure
/id/{did-or-address}
/id/{did-or-address}/posts?q=search+query
/id/{did-or-address}/videos?q=...
/id/{did-or-address}/workflows/{workflow-id}
/id/{did-or-address}/events

// Implementation with History API
function navigateTo(identityId, namespace, query) {
  const url = `/id/${identityId}/${namespace}${query ? '?q=' + query : ''}`;
  window.history.pushState({ identityId, namespace, query }, '', url);
  performSearch(query, identityId, namespace);
}

window.addEventListener('popstate', (event) => {
  if (event.state) {
    performSearch(event.state.query, event.state.identityId, event.state.namespace);
  }
});
```

## 4. Add Content Creation Actions

**Missing Capabilities:**
- Post creation
- Comment posting
- Like/unlike
- Share content
- Send messages
- Upload files
- Create workflows

**Implementation Pattern:**
```javascript
async function createPost(identityId, content) {
  // 1. Sign content with identity's private key
  const signature = await cryptoService.sign(identityId, content);
  
  // 2. Upload to IPFS
  const cid = await ipfsService.add({
    ...content,
    signature,
    author: identityId,
    createdAt: Date.now()
  });
  
  // 3. Add to identity's namespace
  const identity = await getIdentity(identityId);
  identity.namespaces.posts.push({
    cid,
    type: 'post',
    author: identityId,
    metadata: content,
    interactions: { likes: 0, comments: [], shares: 0 }
  });
  
  // 4. Re-index for search
  searchEngine.indexIdentity(identity);
  searchEngine.build();
}

async function likeContent(identityId, contentCid) {
  const content = await findContentByCid(contentCid);
  content.interactions.likes++;
  
  // Emit event
  eventBus.emit(`identity://${content.author}/events`, {
    type: 'like',
    actor: identityId,
    target: contentCid,
    timestamp: Date.now()
  });
}
```

## 5. Add Identity Verification

**Current:** No cryptographic validation

**Spec Requires:**
```javascript
class IdentityVerifier {
  async verifyAddress(address) {
    // Validate checksum
    if (!this.isValidChecksum(address)) {
      throw new Error('Invalid address checksum');
    }
    
    // Normalize
    return address.toLowerCase();
  }
  
  async verifySignature(content, signature, publicKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(content));
    const sig = this.base64ToArrayBuffer(signature);
    
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sig,
      data
    );
    
    return valid;
  }
  
  isValidChecksum(address) {
    // Implement EIP-55 checksum validation
    // or your own checksum algorithm
    return true; // Simplified
  }
}
```

## 6. Scoped Search Function (From Spec)

**Your current implementation is close, but should match:**

```javascript
async function searchIdentityNamespace(identityId, namespace, query, config, ai) {
  // Load namespace items
  const items = loadNamespace(identityId, namespace);
  
  // AI rewrite (optional)
  const rewrittenQuery = ai ? await ai.rewriteQuery(query) : query;
  
  // Dense embedding
  const qv = ai ? await ai.embed(rewrittenQuery) : embed(rewrittenQuery);
  
  // Dense candidates
  const denseCandidates = await Promise.all(items.map(async item => {
    const dv = item.embedding || 
      (ai ? await ai.embed(item.metadata?.title || "") : embed(item.metadata?.title || ""));
    return { item, denseScore: cosineSim(qv, dv) };
  }));
  
  // Adaptive top-N
  const adaptiveTopN = Math.min(
    Math.max(rewrittenQuery.split(/\s+/).length * 10, config.minDense),
    config.maxDense
  );
  
  const topDense = denseCandidates
    .sort((a,b) => b.denseScore - a.denseScore)
    .slice(0, adaptiveTopN);
  
  // Sparse re-rank
  const sparseEngine = new SparseEngine();
  sparseEngine.init(topDense.map(c => c.item.metadata));
  
  const qTokens = topDense.flatMap(c => sparseEngine.tokenize(c.item.metadata));
  const uniqueTokens = [...new Set(qTokens)];
  const sparseResults = sparseEngine.search(uniqueTokens, adaptiveTopN);
  
  // Fusion
  return sparseResults.map(sr => {
    const dr = topDense.find(dc => dc.item === sr.doc) || { denseScore: 0 };
    return {
      item: sr.doc,
      sparseScore: sr.sparseScore,
      denseScore: dr.denseScore,
      finalScore: (1 - config.fusionAlpha) * sr.sparseScore + 
                  config.fusionAlpha * dr.denseScore
    };
  }).sort((a,b) => b.finalScore - a.finalScore);
}
```

## Summary: What to Add

### High Priority (Core Spec Alignment)
1. ✅ Identity capabilities object
2. ✅ Social graph (followers/following)
3. ✅ Interactions (likes/comments/shares)
4. ✅ CID references for content
5. ✅ URL routing pattern

### Medium Priority (Functionality)
6. Content creation actions
7. Identity verification
8. Event streams
9. Preferences management

### Low Priority (Nice to Have)
10. IPFS integration
11. E2E encryption for messages
12. Workflow execution
13. Analytics

## Your Engine's Current Alignment Score: 60%

**Strong:** Identity resolution, namespace filtering, hybrid search
**Missing:** Social features, content creation, verification, URL routing
