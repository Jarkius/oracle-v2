# Oracle v2 — Quick Reference

**Explored**: 2026-02-12 11:01 GMT+7 | **Mode**: default (3 agents)

---

## What Is It?

Oracle Nightly (v0.3.0) — TypeScript MCP Memory Layer with hybrid search (FTS5 + ChromaDB), HTTP API, and React dashboard. Indexes markdown files from `ψ/memory/` into a searchable knowledge base.

## Scripts (package.json)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `bun src/index.ts` | MCP server on stdio |
| `server` | `bun src/server.ts` | HTTP API on :47778 |
| `index` | `bun src/indexer.ts` | Index ψ/memory/ → DB |
| `build` | `tsc` | TypeScript compile |
| `test` | unit + integration + e2e | All tests |
| `test:unit` | `bun test src/oracle-core.test.ts` | Unit tests |
| `test:integration` | `bun test src/integration/` | Integration tests |
| `test:e2e` | `playwright test` | Browser tests |
| `test:seed` | `bun scripts/seed-test-data.ts` | Seed test data |
| `db:push` | `bunx drizzle-kit push` | Push schema to DB |
| `db:studio` | `bunx drizzle-kit studio` | Database GUI |
| `frontend:dev` | `cd frontend && bun dev` | React dashboard |

## MCP Tools (19+)

### Search & Read
| Tool | Description |
|------|-------------|
| `oracle_search` | Hybrid search (query, type, limit, mode) |
| `oracle_list` | Browse documents |
| `oracle_consult` | Get guidance on decisions |
| `oracle_reflect` | Random wisdom |
| `oracle_stats` | Database statistics |
| `oracle_concepts` | List concept tags |

### Write
| Tool | Description |
|------|-------------|
| `oracle_learn` | Add new pattern/learning |
| `oracle_supersede` | Mark doc as superseded |

### Threads & Decisions
| Tool | Description |
|------|-------------|
| `oracle_thread` | Send/create thread message |
| `oracle_threads` | List threads |
| `oracle_thread_read` | Read thread messages |
| `oracle_thread_update` | Update thread status |
| `oracle_decisions_list` | List decisions |
| `oracle_decisions_create` | Create decision |
| `oracle_decisions_get` | Get decision details |
| `oracle_decisions_update` | Update decision |

### Trace
| Tool | Description |
|------|-------------|
| `oracle_trace` | Log discovery session |
| `oracle_trace_list` | List traces |
| `oracle_trace_get` | Get trace details |
| `oracle_trace_link` | Link traces |
| `oracle_trace_chain` | Get trace chain |

## HTTP API Endpoints

### Core
```
GET  /api/health              # Health check
GET  /api/search?q=...        # Search (q, type, limit, mode, project)
GET  /api/list?type=...       # Browse documents
GET  /api/consult?q=...       # Get guidance
GET  /api/reflect             # Random wisdom
GET  /api/stats               # Database stats
GET  /api/concepts            # Concept tags
POST /api/learn               # Add pattern {pattern, source, concepts}
GET  /api/doc/:id             # Get document by ID
GET  /api/file?path=...       # Read raw file
GET  /api/context?cwd=...     # Project context from path
```

### Dashboard
```
GET  /api/dashboard           # Summary stats
GET  /api/dashboard/activity  # Recent activity
GET  /api/dashboard/growth    # Growth over time
GET  /api/session/stats       # Session stats
```

### Threads
```
GET  /api/threads             # List threads
GET  /api/thread/:id          # Get thread + messages
POST /api/thread              # Create/send message
PATCH /api/thread/:id/status  # Update status
```

### Decisions
```
GET   /api/decisions          # List (status, project, tags)
GET   /api/decisions/:id      # Get details
POST  /api/decisions          # Create
PATCH /api/decisions/:id      # Update
POST  /api/decisions/:id/transition  # Status transition
```

### Traces
```
GET    /api/traces            # List traces
GET    /api/traces/:id        # Get trace + dig points
GET    /api/traces/:id/chain  # Hierarchical chain
POST   /api/traces/:prevId/link  # Link traces
DELETE /api/traces/:id/link   # Unlink
```

### Supersede
```
GET  /api/supersede           # List supersessions
GET  /api/supersede/chain/:path  # Version chain
POST /api/supersede           # Log supersession
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `oracle_documents` | Document metadata (id, type, source, project, supersede) |
| `oracle_fts` | FTS5 virtual table (content, concepts, Porter stemmer) |
| `search_log` | Search queries + top 5 results |
| `consult_log` | Consultation queries |
| `learn_log` | New patterns added |
| `document_access` | Access tracking |
| `forum_threads` | Discussion threads |
| `forum_messages` | Thread messages |
| `decisions` | Decision lifecycle tracking |
| `trace_log` | Discovery sessions + dig points |
| `supersede_log` | Document version audit trail |
| `activity_log` | User activity |
| `indexing_status` | Indexer progress (singleton) |

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `ORACLE_PORT` | `47778` | HTTP server port |
| `ORACLE_REPO_ROOT` | `cwd()` | Knowledge base root |
| `ORACLE_DATA_DIR` | `~/.oracle-v2` | Database directory |
| `ORACLE_DB_PATH` | `~/.oracle-v2/oracle.db` | DB file path |

## Key File Locations

| File | Purpose |
|------|---------|
| `~/.oracle-v2/oracle.db` | SQLite database |
| `~/.oracle-v2/oracle-http.pid` | Server PID file |
| `ψ/memory/resonance/` | Identity, principles |
| `ψ/memory/learnings/` | Patterns discovered |
| `ψ/memory/retrospectives/` | Session reflections |

## Quick Commands

```bash
# Setup
bun install && bun run db:push

# Run
bun run server                    # HTTP API
cd frontend && bun dev            # Dashboard

# Test
curl http://localhost:47778/api/health
curl "http://localhost:47778/api/search?q=oracle"
curl http://localhost:47778/api/stats

# Index
bun run test:seed                 # Seed test data
bun run index                     # Index ψ/memory/

# Database
bun db:studio                     # GUI
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `bun: command not found` | `export PATH="$HOME/.bun/bin:$PATH"` |
| `directory does not exist` | `mkdir -p ~/.oracle-v2` |
| ChromaDB hangs | Ignore — FTS5 works without vectors |
| `database is locked` | Kill existing server: `pkill -f "bun run server"` |
| `db:push` index error | Known Drizzle bug — indexes already exist, DB is fine |
| No search results | Run `bun run index` to populate DB |
| Port in use | `ORACLE_PORT=8888 bun run server` |

---
*Generated by /learn — 3 parallel Haiku agents*
