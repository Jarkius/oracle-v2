# Oracle v2 — Architecture

**Explored**: 2026-02-12 11:01 GMT+7 | **Mode**: default (3 agents)

---

## High-Level Architecture

```
Claude Code → MCP Server (stdio) → SQLite + ChromaDB + Drizzle ORM
                                          ↕
                                    HTTP Server (Hono.js :47778)
                                          ↕
                                    React Dashboard (:3000)
                                          ↕
                                    ψ/memory/ files
```

## Three Integrated Systems

### 1. MCP Server (`src/index.ts`)
- Model Context Protocol interface for Claude Code
- 19+ tools: search, consult, learn, trace, threads, decisions
- Runs on stdio (subprocess of Claude Code)
- Class: `OracleMCPServer` — dual DB access (raw SQLite + Drizzle)

### 2. HTTP Server (`src/server.ts`)
- Hono.js REST API on port 47778
- 30+ endpoints under `/api/`
- Serves React dashboard from `frontend/dist/`
- CORS enabled, SPA fallback routing

### 3. Indexer (`src/indexer.ts`)
- Parses markdown files from `ψ/memory/` directories
- Chunks documents into searchable segments
- Populates SQLite FTS5 + ChromaDB vectors
- Backup before re-index ("Nothing is Deleted")

## Data Layer

| Component | Purpose | Access |
|-----------|---------|--------|
| **SQLite** | Primary storage, FTS5 full-text search | `bun:sqlite` (raw) + Drizzle ORM |
| **ChromaDB** | Vector embeddings for semantic search | via `chroma-mcp` (Python subprocess over MCP) |
| **Drizzle ORM** | Type-safe queries for regular tables | `drizzle-orm/bun-sqlite` |
| **FTS5** | Keyword search with Porter stemmer | Raw SQL (Drizzle doesn't support virtual tables) |

### Dual Database Pattern
- **Raw SQLite** (`bun:sqlite`): Used for FTS5 virtual tables (CREATE, MATCH queries)
- **Drizzle ORM**: Used for type-safe CRUD on regular tables (documents, logs, decisions)
- Both share the same `.db` file at `~/.oracle-v2/oracle.db`

## Key Abstractions

| Abstraction | Location | Purpose |
|-------------|----------|---------|
| `OracleDocuments` | `src/db/schema.ts` | Typed document store with granular chunking |
| `ChromaMcpClient` | `src/chroma-mcp.ts` | MCP protocol wrapper for ChromaDB subprocess |
| `Forum System` | `src/forum/handler.ts` | Threaded discussions with GitHub sync |
| `Decision Tracker` | `src/decisions/handler.ts` | Status machine: pending → decided → implemented |
| `Trace Logger` | `src/trace/handler.ts` | Discovery sessions with dig points |
| `Supersede Pattern` | Built into schema | "Nothing is Deleted" audit trail |

## Directory Structure

```
oracle-v2/
├── src/
│   ├── index.ts              # MCP server (19 tools)
│   ├── server.ts             # HTTP server (Hono.js)
│   ├── indexer.ts            # Markdown → DB pipeline
│   ├── chroma-mcp.ts         # ChromaDB MCP client
│   ├── ensure-server.ts      # Auto-start HTTP
│   ├── db/
│   │   ├── schema.ts         # Drizzle table definitions
│   │   └── index.ts          # DB client + FTS5 init
│   ├── server/
│   │   ├── handlers.ts       # Search, consult, list handlers
│   │   ├── dashboard.ts      # Dashboard API
│   │   ├── logging.ts        # Query logging (dual: DB + console)
│   │   ├── context.ts        # Project context
│   │   └── project-detect.ts # ghq-style path detection
│   ├── forum/handler.ts      # Thread & message management
│   ├── decisions/handler.ts  # Decision lifecycle
│   ├── trace/handler.ts      # Trace logging
│   └── process-manager/      # PID files, graceful shutdown
├── frontend/                 # React + Vite + Three.js
├── scripts/                  # Install, setup, seed
├── e2e/                      # Playwright tests
└── drizzle.config.ts         # ORM configuration
```

## Database Schema (10 tables)

| Table | Type | Purpose |
|-------|------|---------|
| `oracle_documents` | Core | Document metadata + project + supersede tracking |
| `oracle_fts` | Virtual (FTS5) | Full-text search with Porter stemmer |
| `search_log` | Logging | Search queries + top 5 results |
| `consult_log` | Logging | Consultation queries + guidance |
| `learn_log` | Logging | New patterns added |
| `document_access` | Logging | Access tracking |
| `forum_threads` | Forum | Discussion threads |
| `forum_messages` | Forum | Messages within threads |
| `decisions` | Tracking | Decision lifecycle (pending → closed) |
| `trace_log` | Tracking | Discovery sessions with dig points |
| `supersede_log` | Audit | Document version chain |
| `activity_log` | Audit | User activity tracking |
| `indexing_status` | Meta | Indexer progress (singleton row) |

## Frontend Architecture

- **React 19** + **Vite** + **Three.js** (3D knowledge graph)
- Pages: Home, Feed, Search, Consult, Graph (2D/3D), Forum, Decisions, Evolution, Traces, Activity
- API client in `frontend/src/api/oracle.ts`
- Dev proxy: `:3000` → `:47778` for `/api/*`
- Production: built to `frontend/dist/`, served by Hono

## Design Patterns

1. **Graceful Degradation**: ChromaDB failure → FTS5-only mode (no crash)
2. **Nothing is Deleted**: Supersede tracking, backup before re-index, JSON+CSV exports
3. **Hybrid Ranking**: FTS (keywords) + vectors (semantic), 10% boost for dual matches
4. **Project Scoping**: Universal docs (NULL project) + project-specific filtering via ghq paths
5. **MCP for Subprocess**: ChromaDB accessed via Model Context Protocol instead of Node.js imports
6. **Dual Logging**: Every query logged to both database and console

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | Lightweight HTTP framework |
| `drizzle-orm` | Type-safe SQLite ORM |
| `@modelcontextprotocol/sdk` | MCP server + client |
| `chromadb` | Vector embeddings (via chroma-mcp) |
| `better-sqlite3` | SQLite driver (dev/Node.js) |
| `bun:sqlite` | SQLite driver (Bun runtime) |

---
*Generated by /learn — 3 parallel Haiku agents*
