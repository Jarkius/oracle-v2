---
title: ## ChromaDB bge-m3 via Ollama — Patching chroma-mcp
tags: [chromadb, ollama, bge-m3, embeddings, chroma-mcp, patch, fragile]
created: 2026-02-16
source: Embedding upgrade session 2026-02-16
---

# ## ChromaDB bge-m3 via Ollama — Patching chroma-mcp

## ChromaDB bge-m3 via Ollama — Patching chroma-mcp

**What**: Upgraded Oracle v2 embeddings from all-MiniLM-L6-v2 (384 dims, 256 tokens, English) to bge-m3 (1024 dims, 8192 tokens, multilingual + code) via Ollama.

**How it works**: ChromaDB's `OllamaEmbeddingFunction` calls Ollama's HTTP API at `localhost:11434` to generate embeddings. Ollama must be running as a service.

**Fragile patch**: The `OllamaEmbeddingFunction` was added directly to chroma-mcp's installed `server.py` at:
`AppData/Roaming/uv/tools/chroma-mcp/Lib/site-packages/chroma_mcp/server.py`

This patch will be **overwritten** if `uvx` updates chroma-mcp. After any chroma-mcp update, re-apply:
1. Add `OllamaEmbeddingFunction` to imports
2. Add `"ollama": lambda: OllamaEmbeddingFunction(model_name="bge-m3", url="http://localhost:11434")` to `mcp_known_embedding_functions`

**Oracle side**: `src/chroma-mcp.ts` uses `embedding_function_name: 'ollama'` (was `'default'`).

**Re-index after changes**: `bun run index` to rebuild all 590 documents with new embeddings.

---
*Added via Oracle Learn*
