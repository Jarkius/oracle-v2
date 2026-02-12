# Oracle Nightly - MCP Memory Layer

> Forked from [Soul-Brews-Studio/oracle-v2](https://github.com/Soul-Brews-Studio/oracle-v2)

> "The Oracle Keeps the Human Human" - now queryable via MCP

| | |
|---|---|
| **Status** | Always Nightly |
| **Version** | 0.2.4-nightly |
| **Upstream** | [Soul-Brews-Studio/oracle-v2](https://github.com/Soul-Brews-Studio/oracle-v2) |
| **Fork** | [Jarkius/oracle-v2](https://github.com/Jarkius/oracle-v2) |
| **Updated** | 2026-02-12 |

TypeScript implementation of semantic search over Oracle philosophy using Model Context Protocol (MCP), with HTTP API and React dashboard.

## Architecture

```
Claude Code → MCP Server → SQLite + Chroma + Drizzle ORM
                ↓
           HTTP Server → React Dashboard
                ↓
          ψ/memory files
```

**Stack:**
- **SQLite** + FTS5 for full-text search
- **ChromaDB** for vector/semantic search (optional)
- **Drizzle ORM** for type-safe queries
- **React** dashboard for visualization
- **MCP** protocol for Claude integration

## Install

### Prerequisites

- [Bun](https://bun.sh/) (runtime)
- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (`gh`)
- [ghq](https://github.com/x-motemen/ghq) (optional, for structured repo management)

### Quick Install (macOS/Linux)

```bash
# 1. Install (clones, deps, and adds to Claude Code)
curl -sSL https://raw.githubusercontent.com/Soul-Brews-Studio/oracle-v2/main/scripts/install.sh | bash

# 2. Restart Claude Code
```

### Windows Install

```bash
# 1. Clone the repo
git clone https://github.com/Jarkius/oracle-v2.git C:\Workspace\Dev\oracle-v2
cd C:\Workspace\Dev\oracle-v2

# 2. Install dependencies
bun install

# 3. Initialize database
bun run db:push

# 4. Seed test data (optional)
bun run test:seed

# 5. Index knowledge base
bun run index

# 6. Register as global MCP server
claude mcp add -s user oracle-v2 -- bun run C:\Workspace\Dev\oracle-v2\src\index.ts

# 7. Restart Claude Code
```

### Manual Install (Any OS)

```bash
# 1. Clone
git clone https://github.com/Jarkius/oracle-v2.git /path/to/oracle-v2
cd /path/to/oracle-v2 && bun install

# 2. Setup database
bun run db:push

# 3. Register MCP server (user scope = available in every project)
claude mcp add -s user oracle-v2 -- bun run /path/to/oracle-v2/src/index.ts
```

<details>
<summary>Troubleshooting</summary>

| # | Problem | Cause | Fix |
|---|---------|-------|-----|
| 1 | `bun: command not found` | PATH not updated after install | `export PATH="$HOME/.bun/bin:$PATH"` |
| 2 | `db:push` fails with "index already exists" | Known Drizzle bug with existing DB | Safe to ignore if tables exist |
| 3 | ChromaDB hangs/timeout | uv not installed | Skip it — SQLite FTS5 works fine without vectors |
| 4 | MCP config not loading | Wrong scope | Use `claude mcp add -s user` for global access |
| 5 | Server crashes on empty DB | No documents indexed | Run `bun run index` first |
| 6 | `execSync` ENOENT on Windows | Bun/Windows cmd.exe issue | Fixed in v0.2.4 — uses file reads instead |

</details>

## How It Works Across Projects

Oracle is a **centralized MCP server**. You install it once, register it globally, and it's available in every project.

```
# Work on any project — Oracle follows you
cd ~/projects/my-app
claude
# Oracle MCP tools available: oracle_search, oracle_learn, etc.

cd ~/projects/another-app
claude
# Same Oracle, same memory, auto-detects project from git remote
```

### Project Auto-Detection

Oracle detects which project you're in automatically (no configuration needed):

| Method | Priority | Example |
|--------|----------|---------|
| ghq path | 1st | `~/ghq/github.com/owner/repo` |
| `/Code/` path | 2nd | `~/Code/github.com/owner/repo` |
| git remote | 3rd | Any directory with `.git/config` pointing to GitHub |

**Cross-platform**: Works on macOS, Windows, and Linux. Normalizes both forward and back slashes.

### What you DON'T need per project

- No `ψ/memory/` files in each project (centralized in oracle-v2)
- No `/awaken` per project (one-time setup only)
- No symlinks or ghq (git remote fallback handles detection)
- No MCP config per project (user-scope = global)

## Services

| Service | Port | Command | Description |
|---------|------|---------|-------------|
| **HTTP API** | `:47778` | `bun run server` | REST endpoints for search, consult, learn |
| **Dashboard** | `:3000` | `cd frontend && bun dev` | React UI with knowledge graph |
| **MCP Server** | stdio | auto-started by Claude Code | Claude Code integration (19 tools) |
| **Drizzle Studio** | browser | `bun db:studio` | Database GUI at local.drizzle.studio |

Use `/dev` slash command (in oracle-v2 directory) to start backend + frontend in one shot.

**Quick test:**
```bash
curl http://localhost:47778/api/health
curl "http://localhost:47778/api/search?q=nothing+deleted"
```

## API Endpoints

All endpoints are under `/api/` prefix:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/search?q=...` | Full-text search with exact match boosting |
| `GET /api/consult?q=...` | Get guidance on decision |
| `GET /api/reflect` | Random wisdom |
| `GET /api/list` | Browse documents |
| `GET /api/stats` | Database statistics |
| `GET /api/graph` | Knowledge graph data |
| `GET /api/context` | Project context |
| `POST /api/learn` | Add new pattern |
| `GET /api/dashboard/*` | Dashboard API |
| `GET /api/threads` | List threads |
| `GET /api/decisions` | List decisions |

See [docs/API.md](./docs/API.md) for full documentation.

## MCP Tools

| Tool | Description |
|------|-------------|
| `oracle_search` | Search knowledge base |
| `oracle_consult` | Get guidance on decisions |
| `oracle_reflect` | Random wisdom |
| `oracle_learn` | Add new patterns |
| `oracle_list` | Browse documents |
| `oracle_stats` | Database statistics |
| `oracle_concepts` | List concept tags |

## Oracle Skills (Global CLI)

Install [oracle-skills-cli](https://github.com/Soul-Brews-Studio/oracle-skills-cli) for 26 slash commands available in every project:

```bash
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli#v1.5.79 install
```

Key skills: `/learn`, `/trace`, `/recap`, `/rrr`, `/standup`, `/forward`

Update later: `/oracle-soul-sync-calibrate-update` or reinstall with new version.

## Project Structure

```
oracle-v2/
├── src/
│   ├── index.ts              # MCP server (19 tools)
│   ├── server.ts             # HTTP server (routing)
│   ├── indexer.ts            # Knowledge indexer
│   ├── server/               # Server modules
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── db.ts             # Database config
│   │   ├── logging.ts        # Query logging
│   │   ├── handlers.ts       # Request handlers
│   │   ├── dashboard.ts      # Dashboard API
│   │   ├── context.ts        # Project context
│   │   └── project-detect.ts # Cross-platform project detection
│   └── db/                   # Drizzle ORM
│       ├── schema.ts         # Table definitions
│       └── index.ts          # Client export
├── frontend/                 # React dashboard
├── docs/                     # Documentation
├── .claude/
│   ├── commands/             # Project slash commands (/dev, /wip, etc.)
│   ├── agents/               # Custom agent definitions
│   └── knowledge/            # Oracle philosophy & writing style
├── ψ/memory/                 # Centralized knowledge base
│   ├── resonance/            # Core principles
│   ├── learnings/            # Patterns learned
│   ├── retrospectives/       # Session records
│   └── traces/               # Search trace logs
└── drizzle.config.ts         # Drizzle configuration
```

## Database

**Tables:**
- `oracle_documents` - Main document index
- `oracle_fts` - FTS5 virtual table for search
- `search_log` - Search query logging
- `consult_log` - Consultation logging
- `learn_log` - Learning/pattern logging
- `document_access` - Access logging
- `indexing_status` - Indexer progress

### Drizzle Commands

```bash
bun db:generate   # Generate migrations
bun db:migrate    # Apply migrations
bun db:push       # Push schema directly
bun db:pull       # Introspect existing DB
bun db:studio     # Open Drizzle Studio GUI
```

## Data Model

### Source Files

```
ψ/memory/
├── resonance/        → IDENTITY (principles)
├── learnings/        → PATTERNS (what I've learned)
├── retrospectives/   → HISTORY (session records)
└── traces/           → SEARCHES (discovery logs)
```

### Hybrid Search

1. **FTS5** - SQLite full-text search with Porter stemmer + exact match boosting
2. **ChromaDB** - Vector similarity (optional, graceful degradation if unavailable)
3. **Query-aware weights** - Short queries favor FTS, long favor vectors

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_PORT` | 47778 | HTTP server port |
| `ORACLE_REPO_ROOT` | `process.cwd()` | Knowledge base root (your ψ/ repo) |

## Testing

```bash
bun test              # Run unit tests
bun test:watch        # Watch mode
bun test:coverage     # With coverage
```

## Fork Changes (from upstream)

Changes made in this fork:

| Change | Description |
|--------|-------------|
| Cross-platform project detection | Windows backslash normalization + git remote fallback |
| Shared normalizeProject | Extracted to `project-detect.ts`, works in both MCP and HTTP API |
| FTS5 exact match boosting | Fixes Porter stemmer miscorrection (#133) |
| ChromaDB getStats logging | Better diagnostics when count returns 0 (#136) |
| `/dev` slash command | Start backend + frontend in one shot |
| Windows compatibility | No `execSync` dependency (reads .git/config directly) |

## Acknowledgments & Inspiration

- [Soul-Brews-Studio/oracle-v2](https://github.com/Soul-Brews-Studio/oracle-v2) - Original Oracle by Nat
- [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman - Process manager and memory patterns
- [oracle-skills-cli](https://github.com/Soul-Brews-Studio/oracle-skills-cli) - Global skills for Claude Code

## References

### Documentation
- [docs/INSTALL.md](./docs/INSTALL.md) - Complete installation guide (cross-platform)
- [docs/API.md](./docs/API.md) - API documentation
- [docs/architecture.md](./docs/architecture.md) - Architecture details
- [docs/WORKFLOW.md](./docs/WORKFLOW.md) - How to use Oracle across projects

### External
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [MCP SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Protocol docs
- [claude-mem](https://github.com/thedotmack/claude-mem) - Inspiration for memory & process management
