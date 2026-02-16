/**
 * ChromaDB Direct Client
 *
 * Replaces chroma-mcp.ts (3-hop: Bun -> MCP -> Python -> Ollama)
 * with direct architecture: Bun -> chromadb npm -> ChromaDB server
 * and in-process embeddings via @huggingface/transformers (ONNX).
 *
 * Pattern learned from matrix-memory-agents.
 */

import { ChromaClient, Collection } from 'chromadb';

interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, string | number>;
}

// Singleton embedding pipeline
let extractorPromise: Promise<any> | null = null;
let extractor: any = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    console.error('[Embeddings] Loading multilingual-e5-base (first run downloads ~300MB)...');
    const startTime = Date.now();
    const { pipeline } = await import('@huggingface/transformers');
    const pipe = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base', {
      dtype: 'q8' as any,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Embeddings] Model loaded in ${elapsed}s`);
    extractor = pipe;
    return pipe;
  })();

  return extractorPromise;
}

/**
 * Generate embeddings for an array of texts using multilingual-e5-base.
 * Returns number[][] (768-dimensional vectors).
 */
async function embed(texts: string[]): Promise<number[][]> {
  const pipe = await getExtractor();
  const results: number[][] = [];

  // Process one at a time to avoid OOM on large batches
  for (const text of texts) {
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }

  return results;
}

export class ChromaDirectClient {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private connected: boolean = false;
  private collectionName: string;
  private chromaUrl: string;

  constructor(collectionName: string, chromaUrl: string = 'http://localhost:8000') {
    this.collectionName = collectionName;
    this.chromaUrl = chromaUrl;

    // Parse URL into host/port/ssl (chromadb 3.2+ deprecated 'path' arg)
    const url = new URL(chromaUrl);
    this.client = new ChromaClient({
      host: url.hostname,
      port: parseInt(url.port || (url.protocol === 'https:' ? '443' : '8000')),
      ssl: url.protocol === 'https:',
    });
  }

  /**
   * Connect to ChromaDB server and verify heartbeat
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      await this.client.heartbeat();
      this.connected = true;
      console.error('[ChromaDirect] Connected to ChromaDB server');
    } catch (error) {
      throw new Error(`ChromaDB connection failed (${this.chromaUrl}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pre-load the embedding model for faster first query
   */
  async warmUp(): Promise<void> {
    await getExtractor();
  }

  /**
   * Ensure collection exists (create if needed)
   */
  async ensureCollection(): Promise<void> {
    await this.connect();

    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: {
          'hnsw:space': 'cosine',
          'hnsw:construction_ef': 200,
          'hnsw:M': 32,
          'hnsw:search_ef': 50,
        },
      });
      console.error(`[ChromaDirect] Collection '${this.collectionName}' ready`);
    } catch (error) {
      throw new Error(`Failed to ensure collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete collection if it exists
   */
  async deleteCollection(): Promise<void> {
    await this.connect();

    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = null;
      console.error(`[ChromaDirect] Collection '${this.collectionName}' deleted`);
    } catch {
      // Collection doesn't exist, ignore
    }
  }

  /**
   * Add documents to collection in batch (with in-process embeddings)
   */
  async addDocuments(documents: ChromaDocument[]): Promise<void> {
    if (documents.length === 0) return;

    await this.ensureCollection();
    if (!this.collection) throw new Error('Collection not initialized');

    // Generate embeddings in-process
    const texts = documents.map(d => d.document);
    const embeddings = await embed(texts);

    await this.collection.add({
      ids: documents.map(d => d.id),
      documents: texts,
      embeddings,
      metadatas: documents.map(d => d.metadata),
    });

    console.error(`[ChromaDirect] Added ${documents.length} documents`);
  }

  /**
   * Query collection for semantic search (with in-process embeddings)
   */
  async query(
    queryText: string,
    limit: number = 10,
    whereFilter?: Record<string, any>
  ): Promise<{ ids: string[]; documents: string[]; distances: number[]; metadatas: any[] }> {
    // Reconnect if needed
    if (!this.connected) {
      await this.connect();
    }

    if (!this.collection) {
      await this.ensureCollection();
    }

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Generate query embedding in-process
    const queryEmbedding = (await embed([queryText]))[0];

    const args: any = {
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: ['documents', 'metadatas', 'distances'],
    };

    if (whereFilter) {
      args.where = whereFilter;
    }

    const result = await this.collection.query(args);

    return {
      ids: result.ids?.[0] || [],
      documents: (result.documents?.[0] || []) as string[],
      distances: (result.distances?.[0] || []) as number[],
      metadatas: result.metadatas?.[0] || [],
    };
  }

  /**
   * Get collection stats
   */
  async getStats(): Promise<{ count: number }> {
    try {
      await this.connect();

      if (!this.collection) {
        await this.ensureCollection();
      }

      if (!this.collection) {
        return { count: 0 };
      }

      const count = await this.collection.count();
      return { count };
    } catch (error) {
      console.error('[ChromaDirect] getStats error:', error instanceof Error ? error.message : String(error));
      return { count: 0 };
    }
  }

  /**
   * Close connection (no-op for HTTP client, but matches interface)
   */
  async close(): Promise<void> {
    this.connected = false;
    this.collection = null;
    console.error('[ChromaDirect] Client closed');
  }
}
