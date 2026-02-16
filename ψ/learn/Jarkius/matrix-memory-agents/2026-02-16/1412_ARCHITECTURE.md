# Architecture: matrix-memory-agents (Agent Orchestra)

**Date**: 2026-02-16
**Source**: `/c/Workspace/Dev/oracle-v2/ψ/learn/Jarkius/matrix-memory-agents/origin/`

---

## 1. What Is This?

Agent Orchestra is a **multi-agent orchestration system** built on Bun/TypeScript. It exposes its capabilities as an MCP (Model Context Protocol) server so Claude Code (or any MCP-compatible client) can spawn and coordinate real Claude CLI agents, each running in a separate tmux PTY. The system couples those agents with a **persistent memory layer** (SQLite + ChromaDB) so knowledge survives across sessions and agents can share context.

In short: "spawn a pool of specialized Claude agents, give them isolated git worktrees, feed them tasks through a priority queue, and automatically harvest learnings from their work into a searchable knowledge base."

---

## 2. Directory Structure and Organization Philosophy

```
origin/
├── index.ts                 # Trivial placeholder ("Hello via Bun!")
├── package.json             # Bun project, scripts keyed to scripts/memory/*
├── tsconfig.json
├── config/                  # Configuration files (env examples, etc.)
├── docs/                    # Long-form documentation per feature area
├── plans/                   # Implementation planning docs
├── psi/                     # ψ memory files (learnings synced from/to psi)
├── scripts/
│   ├── memory/              # CLI commands (bun memory <subcommand>)
│   │   ├── index.ts         # Router: dispatches `bun memory <cmd>` to subcommands
│   │   ├── save-session.ts
│   │   ├── recall.ts
│   │   ├── learn.ts
│   │   ├── distill.ts
│   │   ├── task.ts
│   │   ├── status.ts
│   │   ├── init.ts
│   │   └── ... (30+ subcommand files)
│   ├── spawn/               # Shell scripts for tmux agent spawning
│   ├── tests/               # Test suites (Bun test runner)
│   └── *.ts                 # One-off scripts (setup, migration, stress tests)
├── src/
│   ├── mcp/                 # MCP server (primary entry point)
│   ├── db/                  # SQLite layer (modular)
│   ├── vector-db.ts         # ChromaDB semantic search
│   ├── embeddings/          # Embedding provider abstraction
│   ├── oracle/              # Intelligent orchestration
│   ├── pty/                 # PTY/tmux agent management
│   ├── learning/            # Knowledge extraction pipeline
│   ├── indexer/             # Code indexing + search
│   ├── matrix-hub.ts        # Cross-matrix WebSocket server
│   ├── matrix-daemon.ts     # Persistent hub connection manager
│   ├── matrix-client.ts     # Hub client library
│   ├── matrix-watch.ts      # SSE streaming for live message feed
│   ├── ws-server.ts         # Local WebSocket for agent communication
│   ├── services/            # Supporting services
│   ├── soul/                # Agent philosophy/identity injection
│   ├── interfaces/          # TypeScript interface contracts
│   ├── types/               # Protocol types
│   └── utils/               # Shared utilities
└── tests/                   # Integration test stubs
```

**Organization philosophy**: The codebase separates concerns into two main entry paths — the **MCP server** (src/mcp/) for programmatic orchestration and the **CLI** (scripts/memory/) for interactive use. The SQLite layer is fully modular (one file per domain in src/db/), and all vector operations are isolated to src/vector-db.ts with the SQLite layer as the source of truth.

---

## 3. Entry Points

There are three distinct entry points depending on use case:

### 3a. MCP Server (Primary)
**File**: `src/mcp/server.ts`

This is the main entry point for Claude Code integration. It:
1. Creates an MCP `Server` over stdio transport.
2. On startup, auto-initializes ChromaDB (unless `SKIP_VECTORDB=true`).
3. Starts the WebSocket server for local agent communication (port 8080).
4. Connects to the Matrix Hub for cross-project messaging (port 8081).
5. Registers `allTools` and dispatches `CallToolRequest` to the matching handler.

**Registration (user-scope MCP)**:
```bash
bun run C:/Workspace/Dev/oracle-v2/src/index.ts
# or the project's own:
bun run src/mcp/server.ts
```

### 3b. Memory CLI
**File**: `scripts/memory/index.ts`

Invoked as `bun memory <subcommand>`. Acts as a shell router, dynamically importing the relevant subcommand module. Covers ~30 subcommands for memory management, task tracking, code indexing, cross-matrix messaging, and maintenance.

### 3c. Daemon Processes (Long-running)
These are secondary entry points for persistent infrastructure:

| Entry Point | Purpose |
|-------------|---------|
| `src/matrix-hub.ts` | Runs the cross-matrix WebSocket hub (port 8081) |
| `src/matrix-daemon.ts` | Manages persistent connection to the hub |
| `src/indexer/indexer-daemon.ts` | File-watch daemon for automatic code re-indexing (port 37889) |

### 3d. Root index.ts
**File**: `index.ts` — Contains only `console.log("Hello via Bun!")`. It is a placeholder and is **not** a functional entry point.

---

## 4. Core Abstractions and Their Relationships

### 4a. MCP Server + Tools (`src/mcp/`)

The MCP server is a thin dispatcher. It owns no state — all state lives in the database layer. It registers tool definitions and handlers grouped by domain:

```
src/mcp/server.ts
  └── src/mcp/tools/index.ts  (aggregates all tool groups)
        ├── handlers/task.ts       (assign/get tasks)
        ├── handlers/agents.ts     (spawn/kill/query agents)
        ├── handlers/pty.ts        (PTY orchestration: agent, mission, worktree)
        ├── handlers/worktree.ts   (git worktree isolation)
        ├── handlers/session.ts    (save/recall sessions)
        ├── handlers/learning.ts   (add/search learnings)
        ├── handlers/vector.ts     (semantic search)
        ├── handlers/context.ts    (context bundles)
        ├── handlers/query.ts      (SQLite query tools)
        ├── handlers/analytics.ts  (stats + export)
        ├── handlers/oracle-consult.ts  (Oracle knowledge consultation)
        └── handlers/oracle-reflect.ts  (Oracle wisdom reflection)
```

Tool definitions use Zod schemas for input validation (errors surface as structured messages).

### 4b. Database Layer (`src/db/`)

A **modular SQLite layer** using `bun:sqlite`. The canonical instance lives in `src/db/core.ts` and is imported by all sub-modules via `{ db } from './core'`.

**Schema domains:**

| Module | Tables | Purpose |
|--------|--------|---------|
| `core.ts` | (schema init + all tables via migrations) | Foundation |
| `agents.ts` | `agents` | Agent registry |
| `agent-tasks.ts` | `agent_tasks` | Task queue + execution |
| `unified-tasks.ts` | `unified_tasks` | Business requirements |
| `sessions.ts` | `sessions`, `session_links` | Session memory |
| `learnings.ts` | `learnings`, `learning_links`, `learnings_fts` | Knowledge base |
| `entities.ts` | `entities`, `learning_entities`, `entity_relationships` | Knowledge graph |
| `knowledge.ts` | `knowledge`, `lessons` | Dual-collection facts/solutions |
| `code-files.ts` | `code_files` | Code file index |
| `code-symbols.ts` | `symbols`, `code_patterns`, `learning_code_links` | Symbol index |
| `matrix-messages.ts` | `matrix_messages`, `matrix_sequence_counters` | Cross-matrix inbox |
| `matrix-registry.ts` | `matrix_registry` | Matrix discovery |
| `conversations.ts` | `agent_conversations`, `agent_conversation_messages` | Agent RPC |
| `events.ts` | `events` | Lifecycle events |
| `messages.ts` | `messages` | Agent communication log |
| `analytics.ts` | — | Query helpers |
| `behavioral-logs.ts` | `behavioral_logs` | Search/access tracking |
| `purge.ts` | — | Cleanup operations |

**Schema migration strategy**: Incremental `ALTER TABLE ADD COLUMN` with try/catch (idempotent). Table recreation is used only when CHECK constraints must change. All initialization is protected by a file-based lock (`agents.db.init.lock`) to prevent concurrent init races.

**FTS5**: `learnings_fts` is a virtual table mirroring `learnings.title`, `learnings.description`, `learnings.lesson` via auto-maintained triggers.

### 4c. Vector Database (`src/vector-db.ts`)

A wrapper around **ChromaDB** (via `chromadb` npm package) with these characteristics:
- **SQLite-first writes**: Data is always saved to SQLite first; ChromaDB writes are best-effort.
- **Retry queue** (`p-queue`): ChromaDB writes are queued and retried up to 3 times with exponential backoff.
- **Adaptive chunking**: Content is split into overlapping chunks based on category (code → small chunks 300 tokens; philosophy → large chunks 800 tokens).
- **Collection naming**: Prefixed by `basename(cwd())` so multiple projects can share one ChromaDB container.

**ChromaDB Collections:**

| Collection | Content |
|------------|---------|
| `{prefix}_sessions` | Session embeddings |
| `{prefix}_learnings` | Learning embeddings |
| `{prefix}_knowledge` | Knowledge facts |
| `{prefix}_lessons` | Problem→solution lessons |
| `{prefix}_code_index` | Code file embeddings |

### 4d. Embedding Layer (`src/embeddings/`)

An abstraction over embedding models, currently supporting only **Transformers.js** (`@huggingface/transformers`). The provider is selected by `EMBEDDING_MODEL` env var. Models include `multilingual-e5-base` (768 dims, default), `bge-m3` (1024 dims, recommended for code), and others.

### 4e. PTY Orchestration (`src/pty/`)

Three interacting classes:

**`PTYManager`** (`src/pty/manager.ts`):
- Manages tmux sessions and panes.
- Creates new panes, monitors health via `kill -0 <pid>` checks every 5s.
- Auto-restarts crashed agents after 2s delay.

**`AgentSpawner`** (`src/pty/spawner.ts`):
- Builds on `PTYManager` to spawn role-typed agents.
- Maps `AgentRole` → `ModelTier` (oracle/architect → opus; coder/analyst → sonnet; researcher → haiku).
- Supports `worktree` isolation mode — each agent gets its own git worktree branch.
- Integrates with `agent-memory-service.ts` to create a per-agent session on spawn.

**`MissionQueue`** (`src/pty/mission-queue.ts`):
- Priority queue (critical > high > normal > low) persisted to SQLite.
- Dependency tracking: missions can `dependsOn` other mission IDs.
- Retry with exponential backoff (base 1s, max 60s, ±25% jitter).
- Serialized to SQLite on every state change for crash recovery.

### 4f. Oracle Intelligence (`src/oracle/`)

Three components for intelligent orchestration:

**`OracleOrchestrator`** (`src/oracle/orchestrator.ts`):
- Analyzes workload metrics: agent utilization, role distribution, queue depth.
- Generates `RebalanceAction` recommendations (spawn/reassign/retire agents).
- **Proactive spawning**: Monitors queue growth rate and triggers agent spawning before backlogs form.

**`TaskRouter`** (`src/oracle/task-router.ts`):
- Uses Claude Haiku via `@anthropic-ai/sdk` to analyze task descriptions.
- Selects optimal model tier and agent role.
- Generates `PreTaskBriefing` with patterns, pitfalls, and success criteria.

**`TaskDecomposer`** (`src/oracle/task-decomposer.ts`):
- Breaks complex tasks into subtasks with dependency relationships.
- Subtasks are fed back into the `MissionQueue`.

### 4g. Learning System (`src/learning/`)

A pipeline for extracting and curating knowledge:

```
MissionResult / SessionText / Code / URL / Commits
        ↓
LearningLoop.harvestFromMission()  ← loop.ts
        ↓
DistillEngine.extract()            ← distill-engine.ts (LLM-enhanced)
        ↓
ContentRouter.route()              ← content-router.ts (→ knowledge vs. lessons)
        ↓
Consolidation.merge()              ← consolidation.ts (>85% similarity → merge)
        ↓
QualityScorer.score()              ← quality-scorer.ts
        ↓
ContextRouter.retrieve()           ← context-router.ts (task-type-aware boosting)
```

Additional components:
- `entity-extractor.ts`: Extracts named concepts for the knowledge graph.
- `code-analyzer.ts`: Detects design patterns from code files.
- `code-correlation.ts`: Links learnings to source code files.
- `cross-session.ts`: Cross-session pattern detection with Gemini API.
- `search-validation.ts`: Validates that search results are quality.

**Confidence lifecycle**: `low → medium → high → proven` (requires 20+ validations for "proven").
**Maturity lifecycle**: `observation → learning → pattern → principle → wisdom`.

### 4h. Code Indexer (`src/indexer/`)

**`CodeIndexer`** (`src/indexer/code-indexer.ts`):
- Indexes files into SQLite (`code_files`, `symbols`) and ChromaDB (`code_index` collection).
- Supports 20+ languages via extension mapping.
- Extracts function/class symbols from TypeScript/JavaScript AST via regex heuristics.
- Integrates `chokidar` for file-watch based incremental updates.

**`HybridSearch`** (`src/indexer/hybrid-search.ts`):
- Routes queries based on detected intent:
  - Exact symbol/file name → SQLite FTS (`<2ms`)
  - Exact string in code → Smart grep against SQLite-indexed files (`~26ms`)
  - Conceptual query → ChromaDB vector search (`~400ms`)

**`IndexerDaemon`** (`src/indexer/indexer-daemon.ts`):
- Runs as a separate HTTP process (port 37889).
- Manages the indexer lifecycle (start/stop/status).

### 4i. Matrix Communication (`src/matrix-*.ts`)

Three-layer cross-instance messaging:

```
matrix-hub.ts         — WebSocket server (port 8081)
                         PIN authentication + JWT tokens
                         Heartbeat-based presence (10s interval)
                         TLS support (wss://)

matrix-daemon.ts      — Long-running connection manager
                         Reconnects on disconnect
                         Reads/writes SQLite for offline-queuing
                         HTTP API on port 37888

matrix-client.ts      — In-process client library
                         Called by MCP server on startup
                         Provides connectToHub(), onMessage(), send()

matrix-watch.ts       — SSE stream for real-time message feed
                         Used by the "watch pane" tmux layout
```

**Fallback**: When the hub is unavailable, all messages are queued in `matrix_messages` (SQLite) with status `pending`. The daemon retries delivery with exponential backoff.

### 4j. Soul (`src/soul/`)

A lightweight identity/philosophy injection module. Provides `getSoulSeed()`, `seedAgent()`, and `CURIOSITY_DIRECTIVE` — compact token-efficient prompts (~300 tokens total) injected into each spawned agent's system prompt to propagate philosophy and curiosity across the agent pool.

### 4k. Services (`src/services/`)

Supporting services used by the rest of the system:

| Service | Purpose |
|---------|---------|
| `recall-service.ts` | Unified recall with smart routing (sessions + learnings + graph) |
| `agent-memory-service.ts` | Per-agent session/learning CRUD |
| `agent-rpc.ts` | Agent-to-agent RPC over SQLite `agent_conversations` |
| `external-llm.ts` | Abstraction over Anthropic/OpenAI/Gemini for LLM-enhanced operations |
| `query-expansion.ts` | Expands search queries semantically |
| `content-fetcher.ts` | Fetches content from URLs/files/git for learning ingestion |
| `brave-search.ts` | Web search integration for the `web-search` CLI command |

---

## 5. Dependencies

### Direct Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework (stdio transport) |
| `chromadb` + `chromadb-default-embed` | Vector database client |
| `@huggingface/transformers` | Local embedding inference (Transformers.js) |
| `@anthropic-ai/tokenizer` | Token counting for context budgeting |
| `@google/genai` | Gemini API for cross-session pattern analysis |
| `chokidar` | File-system watching for the code indexer daemon |
| `glob` | File globbing for codebase indexing |
| `gray-matter` | YAML frontmatter parsing (for psi markdown files) |
| `p-queue` | Concurrency-limited queue for ChromaDB write retries |
| `sharp` + `@img/sharp-libvips-darwin-arm64` | Image processing (used in content ingestion) |
| `zod` | Schema validation for MCP tool inputs |
| `enquirer` | Interactive CLI prompts |
| `bun:sqlite` | Built-in SQLite (not a dependency, part of Bun runtime) |

### Transitive / Runtime Patterns

- **Bun runtime** is required (uses `bun:sqlite`, `Bun.sleepSync`, `Bun.file`, etc.).
- **Docker** is needed for ChromaDB (unless running ChromaDB externally).
- **tmux** is needed for agent PTY management.
- **Claude CLI** (`claude`) must be available on PATH for agents to spawn.
- **Git** is required for worktree isolation.

---

## 6. How the Pieces Fit Together

### Startup Flow (MCP Server)

```
1. src/mcp/server.ts starts
2.   → checkStartupHealth()        (warn if fresh clone, DB empty, etc.)
3.   → initVectorDBWithAutoStart()  (start ChromaDB Docker container if needed)
4.   → startWsServer(8080)          (local WebSocket for agent task delivery)
5.   → connectToHub('ws://...:8081') (cross-matrix messaging)
6.   → StdioServerTransport.connect() (MCP over stdin/stdout)
```

### Task Execution Flow

```
Claude Code
  → MCP tool call: pty (action: spawn_pool, count: 3)
      → AgentSpawner.spawnPool(3)
          → PTYManager creates tmux panes
          → Each agent gets a git worktree branch
          → Each agent session created in SQLite
  → MCP tool call: mission (action: distribute, prompt: "...")
      → MissionQueue.enqueue(mission)
          → Saved to SQLite immediately
          → TaskRouter analyzes complexity (Haiku API call)
          → Assigned to best-fit agent via WebSocket
  → Agent executes task in its tmux pane
  → Agent reports result via file-based outbox (./data/agent_outbox/{id}/)
  → MCP tool call: mission (action: complete, result: "...")
      → MissionQueue.complete()
          → LearningLoop.harvestFromMission()
              → Learnings saved to SQLite
              → Embeddings queued to ChromaDB (best-effort)
```

### Memory Query Flow

```
bun memory recall "authentication patterns"
  → scripts/memory/recall.ts
  → RecallService.search("authentication patterns")
      → HybridSearch decides: semantic query → vector search
      → ChromaDB: search sessions + learnings collections
      → ContextRouter boosts results based on detected task type
      → Returns ranked results from SQLite with metadata
```

### Learning Loop

```
Session saved
  → LearningLoop.harvestFromMission()  (extract insights from output)
  → DistillEngine.extract()            (LLM-enhanced extraction)
  → ContentRouter.route()              (fact → knowledge; problem/solution → lesson)
  → Consolidation.merge()              (deduplicate >85% similar learnings)
  → QualityScorer.score()              (rank by quality metrics)
  → EntityExtractor.extract()          (build knowledge graph nodes/edges)
  → learning saved to SQLite + ChromaDB
```

### Data Architecture (Two-Layer)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SQLite (agents.db)                              │
│           Source of Truth — Always Written First                    │
│                                                                     │
│  agents / agent_tasks / missions / unified_tasks                    │
│  sessions / learnings / knowledge / lessons                         │
│  entities / entity_relationships / learning_entities                │
│  code_files / symbols / code_patterns / learning_code_links         │
│  matrix_messages / matrix_registry                                  │
│  agent_conversations / agent_conversation_messages                  │
│  behavioral_logs / events / messages                                │
│  learnings_fts (FTS5 virtual table)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    best-effort writes
                    (retry with backoff)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ChromaDB (localhost:8100)                           │
│              Disposable Search Index — Rebuildable                  │
│                                                                     │
│  {prefix}_sessions / {prefix}_learnings                             │
│  {prefix}_knowledge / {prefix}_lessons                              │
│  {prefix}_code_index                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Task Linking (Intelligence Bridge)

Full traceability from user intent to execution to knowledge:

```
unified_tasks (business requirement)
    ├── missions (orchestration)
    │       └── agent_tasks (execution)
    │                └── learnings (knowledge harvested)
    └── sessions (context at the time)
```

Linking columns:
- `agent_tasks.unified_task_id` → business requirement
- `agent_tasks.parent_mission_id` → orchestration context
- `missions.unified_task_id` → business requirement
- `learnings.source_task_id` → task that generated the learning
- `learnings.source_mission_id` → mission context
- `learnings.source_unified_task_id` → business requirement
- `learnings.source_code_file_id` → code file it applies to

---

## 7. Communication Ports Reference

| Port | Service | Protocol | Configurable |
|------|---------|----------|--------------|
| 8080 | WebSocket (agent task delivery) | WS | `WS_PORT` |
| 8081 | Matrix Hub (cross-matrix) | WS/WSS | `MATRIX_HUB_PORT` |
| 8100 | ChromaDB | HTTP | `CHROMA_PORT` |
| 37888 | Matrix Daemon HTTP API | HTTP | `MATRIX_DAEMON_PORT` |
| 37889 | Indexer Daemon HTTP API | HTTP | `INDEXER_DAEMON_PORT` |

---

## 8. Test Coverage

Tests are in `scripts/tests/` (Bun test runner) and `src/*/tests/`:

| Test File | What It Tests |
|-----------|---------------|
| `oracle-spawning.test.ts` | 17 tests for proactive spawning |
| `task-routing.test.ts` | 27 tests for LLM-driven routing |
| `simulation.test.ts` | 17 tests for end-to-end orchestration |
| `chaos.test.ts` | 13 tests for failure/resilience |
| `task-linking.test.ts` | Task traceability across layers |
| `matrix.test.ts` | Cross-matrix messaging |
| `vector-db.test.ts` | ChromaDB resilience |
| `memory.test.ts` | Session/learning persistence |
| `integration.test.ts` | Full flow integration |

---

## 9. Key Design Decisions

1. **SQLite-first, ChromaDB-optional**: All writes go to SQLite first. ChromaDB is treated as a rebuildable cache. This prevents data loss if the vector DB corrupts or is unavailable.

2. **MCP over stdio**: The MCP server runs over stdin/stdout (no HTTP port needed for the orchestrator interface). This is the standard Claude Code integration pattern.

3. **File-based agent communication fallback**: Agents poll `./data/agent_inbox/{id}/` at 1s intervals as a fallback when the WebSocket is unavailable. Results are written to `./data/agent_outbox/{id}/`. This survived reboots when paths moved from `/tmp/` to `./data/`.

4. **WAL mode + busy_timeout**: SQLite is configured with `journal_mode=WAL` and `busy_timeout=5000ms` to handle concurrent access from multiple MCP processes and CLI commands without lock errors.

5. **Modular DB layer**: Each domain in `src/db/` is a separate file re-exported from `src/db/index.ts`. The legacy shim at `src/db.ts` re-exports everything from `src/db/index.ts` for backwards compatibility.

6. **Soul injection at ~300 tokens**: Rather than passing a full "BIBLE" document to each agent, the `src/soul/` module provides compact seed prompts covering role, philosophy, and curiosity in ~300 tokens total.

7. **Dual-collection learnings**: Raw facts go to `knowledge` table, structured problem→solution→outcome go to `lessons` table. This separation supports different retrieval strategies (fact lookup vs. troubleshooting).
