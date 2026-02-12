# Oracle v2 — Code Snippets

**Explored**: 2026-02-12 11:01 GMT+7 | **Mode**: default (3 agents)

---

## 1. MCP Server — Dual Database Setup

**File**: `src/index.ts`

```typescript
class OracleMCPServer {
  private server: Server;
  private sqlite: Database;  // Raw bun:sqlite for FTS operations
  private db: BunSQLiteDatabase<typeof schema>;  // Drizzle for type-safe queries
  private chromaMcp: ChromaMcpClient;

  constructor(options: { readOnly?: boolean } = {}) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const oracleDataDir = path.join(homeDir, '.oracle-v2');
    const dbPath = path.join(oracleDataDir, 'oracle.db');

    // Two access patterns to same DB file
    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite, { schema });

    // ChromaDB via MCP subprocess
    const chromaPath = path.join(homeDir, '.chromadb');
    this.chromaMcp = new ChromaMcpClient('oracle_knowledge', chromaPath, '3.12');
  }
}
```

**Pattern**: Raw SQLite for FTS5 (virtual tables) + Drizzle ORM for regular queries.

---

## 2. Hybrid Search — FTS5 + ChromaDB

**File**: `src/server/handlers.ts`

```typescript
export async function handleSearch(query, type, limit, offset, mode, project, cwd) {
  const safeQuery = query.replace(/[?*+\-()^~"':]/g, ' ').replace(/\s+/g, ' ').trim();
  const resolvedProject = project ?? detectProject(cwd);

  // FTS5 keyword search (raw SQL)
  const ftsResults = sqlite.prepare(`
    SELECT f.id, f.content, d.type, d.source_file, d.concepts, d.project, rank as score
    FROM oracle_fts f
    JOIN oracle_documents d ON f.id = d.id
    WHERE oracle_fts MATCH ? AND (d.project = ? OR d.project IS NULL)
    ORDER BY rank LIMIT ?
  `).all(safeQuery, resolvedProject, limit * 2);

  // Vector search (ChromaDB via MCP)
  try {
    const chromaResults = await client.query(query, limit * 2, whereFilter);
    vectorResults = chromaResults.ids.map((id, i) => ({
      id,
      score: Math.max(0, 1 - chromaResults.distances[i] / 2), // Cosine → similarity
      source: 'vector'
    }));
  } catch (error) {
    warning = `Vector search unavailable. Using FTS5 only.`;
  }

  // Combine: deduplicate, boost dual-match by 10%
  return combineSearchResults(ftsResults, vectorResults);
}
```

**Pattern**: Graceful degradation — vector failure falls back to FTS5-only.

---

## 3. FTS5 Score Normalization

**File**: `src/server/handlers.ts`

```typescript
// FTS5 rank is negative, lower = better match
function normalizeRank(rank: number): number {
  const absRank = Math.abs(rank);
  return Math.exp(-0.3 * absRank);  // Exponential decay
}
```

**Pattern**: Exponential decay separates top results from noise.

---

## 4. ChromaDB MCP Client — Subprocess Communication

**File**: `src/chroma-mcp.ts`

```typescript
export class ChromaMcpClient {
  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: 'uvx',
      args: ['--python', '3.12', 'chroma-mcp',
             '--client-type', 'persistent',
             '--data-dir', this.dataDir],
      stderr: 'ignore'
    });

    this.client = new Client({ name: 'oracle-v2-chroma', version: '1.0.0' }, { capabilities: {} });
    await this.client.connect(this.transport);
  }

  async query(query: string, limit: number, whereFilter?: Record<string, any>) {
    await this.connect();
    return this.client.callTool({
      name: 'chroma_query_collection',
      arguments: { collection_name: this.collectionName, query_text: query, n_results: limit, where: whereFilter }
    });
  }
}
```

**Pattern**: MCP protocol for subprocess communication — avoids Node.js import issues with Python packages.

---

## 5. HTTP Server — Hono.js Routing

**File**: `src/server.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';

const app = new Hono();
app.use('*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok', server: 'oracle-nightly', port: PORT }));
app.get('/api/search', async (c) => {
  const q = c.req.query('q');
  const result = await handleSearch(q, type, limit, 0, mode, project, cwd);
  return c.json({ ...result, query: q });
});

// SPA fallback — serve React dashboard
app.use('/*', serveStatic({ root: FRONTEND_DIST }));
app.get('*', (c) => c.html(fs.readFileSync(path.join(FRONTEND_DIST, 'index.html'), 'utf-8')));

export default { port: Number(PORT), fetch: app.fetch };
```

---

## 6. Indexer — Backup Before Re-index

**File**: `src/indexer.ts`

```typescript
private backupDatabase(): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${this.config.dbPath}.backup-${timestamp}`;
  fs.copyFileSync(this.config.dbPath, backupPath);

  // Also export to JSON + CSV for portability
  const docs = this.sqlite.prepare(`
    SELECT d.id, d.type, d.source_file, d.concepts, d.project, f.content
    FROM oracle_documents d JOIN oracle_fts f ON d.id = f.id
  `).all();

  fs.writeFileSync(jsonPath, JSON.stringify({ exported_at: new Date().toISOString(), count: docs.length, documents: docs }, null, 2));
}
```

**Pattern**: Triple backup (SQLite copy + JSON + CSV) before destructive operations.

---

## 7. Decision Tracker — Status Machine

**File**: `src/decisions/handler.ts`

```typescript
export function updateDecision(input: UpdateDecisionInput): Decision | null {
  // Validate status transition
  if (input.status !== undefined) {
    if (!isValidTransition(existing.status, input.status)) {
      throw new Error(`Invalid status transition: ${existing.status} → ${input.status}`);
    }
    // Auto-set decidedAt when moving to 'decided'
    if (input.status === 'decided' && existing.status !== 'decided') {
      updateData.decidedAt = now;
    }
  }
  db.update(decisions).set(updateData).where(eq(decisions.id, input.id)).run();
}
```

**Pattern**: Validated state transitions with automatic timestamp tracking.

---

## 8. Query Logging — Dual Output

**File**: `src/server/logging.ts`

```typescript
export function logSearch(query, type, mode, resultsCount, searchTimeMs, results, project) {
  // Database log (with top 5 results as JSON)
  const resultsJson = JSON.stringify(results.slice(0, 5).map(r => ({
    id: r.id, type: r.type, score: r.score, snippet: r.content?.substring(0, 100)
  })));
  db.insert(searchLog).values({ query, type, mode, resultsCount, searchTimeMs, createdAt: Date.now(), results: resultsJson }).run();

  // Console log (structured)
  console.log(`[SEARCH] Query: "${query}" | Results: ${resultsCount} in ${searchTimeMs}ms`);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.type}] score=${r.score} ${r.content?.substring(0, 80)}...`);
  });
}
```

**Pattern**: Both database and console logging for audit + debugging.

---

## 9. Project Detection — ghq-style Paths

**File**: `src/server/project-detect.ts`

```typescript
export function detectProject(cwd?: string): string | null {
  const parts = (cwd || process.cwd()).split(path.sep);
  const ghIndex = parts.findIndex(p => p === 'github.com');
  if (ghIndex >= 0 && ghIndex + 2 < parts.length) {
    return `github.com/${parts[ghIndex + 1]}/${parts[ghIndex + 2]}`;
  }
  return null;
}
```

**Pattern**: Automatic project detection from directory structure (works with ghq repos).

---

## 10. Drizzle Schema — Supersede Tracking

**File**: `src/db/schema.ts`

```typescript
export const oracleDocuments = sqliteTable('oracle_documents', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  sourceFile: text('source_file').notNull(),
  concepts: text('concepts').notNull(),     // JSON array
  project: text('project'),                  // ghq-style: 'github.com/owner/repo'

  // "Nothing is Deleted" — supersede chain
  supersededBy: text('superseded_by'),
  supersededAt: integer('superseded_at'),
  supersededReason: text('superseded_reason'),

  // Provenance
  origin: text('origin'),      // 'mother' | 'arthur' | 'volt' | 'human'
  createdBy: text('created_by'), // 'indexer' | 'oracle_learn' | 'manual'
}, (table) => [
  index('idx_source').on(table.sourceFile),
  index('idx_type').on(table.type),
  index('idx_project').on(table.project),
]);
```

---

## 11. Graceful Shutdown

**File**: `src/server.ts` (via process-manager)

```typescript
registerSignalHandlers(async () => {
  console.log('\n🔮 Shutting down gracefully...');
  await performGracefulShutdown({
    closeables: [
      { name: 'database', close: () => { closeDb(); return Promise.resolve(); } }
    ]
  });
  removePidFile();
});
```

**Pattern**: Signal handling with cleanup, PID file tracking.

---
*Generated by /learn — 3 parallel Haiku agents*
