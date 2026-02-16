# Agent Orchestra - Quick Reference Guide

**Source**: `matrix-memory-agents` (Jarkius fork)
**Date Captured**: 2026-02-16
**Package Name**: `matrix-memory-agents`
**Runtime**: Bun 1.0+

---

## What It Does

Agent Orchestra is an **expert multi-agent orchestration system** for Claude CLI. It solves three core problems that arise when working with AI agents on complex tasks:

1. **Context Loss** - Sessions end and context vanishes. Agent Orchestra provides persistent memory (SQLite + ChromaDB) so every session, learning, and task survives across conversations.
2. **Single Agent Limits** - One agent cannot parallelize work. This system spawns pools of specialized Claude agents managed via tmux PTY, each isolated in their own git worktree.
3. **Fragile Infrastructure** - Vector databases corrupt and searches break. The system treats SQLite as the source of truth and ChromaDB as a rebuildable search index, so corruption never loses data.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| Multi-Agent Orchestration | Spawn pools of specialized Claude agents in tmux panes with health checks and auto-restart |
| Persistent Memory | Sessions, learnings, and tasks stored in SQLite, indexed in ChromaDB for semantic search |
| Oracle Intelligence | LLM-driven task routing, complexity analysis, proactive agent spawning, and task decomposition |
| Knowledge Graph | Entity extraction, relationship mapping, and cross-session pattern detection |
| Matrix Communication | Cross-project and cross-machine WebSocket messaging with PIN authentication |
| Semantic Code Search | Vector-indexed codebase search with hybrid fast-path routing |
| Self-Evolving Knowledge | Learning loop: sessions -> distill -> consolidate -> validate -> proven knowledge |

---

## Installation

### Prerequisites

```bash
bun --version    # 1.0+ required (https://bun.sh)
docker --version # For ChromaDB vector database
tmux --version   # For agent PTY management (multi-agent only)
```

### Method 1: One-Command Setup (Recommended for fresh clone)

```bash
git clone https://github.com/Jarkius/matrix-memory-agents.git
cd matrix-memory-agents

# Handles everything: deps, ChromaDB, SQLite init, initial vector index
./scripts/setup.sh
```

### Method 2: Manual Setup

```bash
# 1. Install dependencies
bun install

# 2. Start ChromaDB (persisted, auto-restarts on reboot)
docker run -d --name chromadb --restart unless-stopped \
  -p 8100:8000 -v $(pwd)/chroma_data:/data \
  chromadb/chroma

# 3. Wait for ChromaDB
sleep 5

# 4. Initialize database and build vector index
bun memory reindex
```

### Method 3: Skip ChromaDB (SQLite-only mode)

```bash
bun run src/index.ts --no-chroma
# Memory commands work, semantic search degraded
```

### Verify Installation

```bash
bun memory status            # Check all services
bun memory stats             # View database statistics
bun memory recall "test"     # Test semantic search
curl http://localhost:8100/api/v2/heartbeat  # Check ChromaDB
```

### Claude Code Integration

Add to `~/.claude/settings.json`:

```json
{
  "enableAllProjectMcpServers": true
}
```

---

## Configuration

### Environment Variables (.env)

```bash
# ChromaDB
CHROMA_URL=http://localhost:8100
CHROMA_PORT=8100
CHROMA_CONTAINER=chromadb

# Embedding model (local, no API costs)
# multilingual-e5-base: 768 dims, best multilingual (default)
# bge-m3: 1024 dims, better for code search, 8192 token context
EMBEDDING_PROVIDER=transformers
EMBEDDING_MODEL=multilingual-e5-base

# Matrix Communication (cross-project/machine)
MATRIX_HUB_HOST=localhost          # Use 0.0.0.0 for LAN access
MATRIX_HUB_PORT=8081               # Hub WebSocket port
MATRIX_HUB_URL=ws://localhost:8081 # Hub URL for clients
MATRIX_HUB_PIN=                    # Auto-generated if empty; "disabled" to turn off
MATRIX_DAEMON_PORT=37888           # Daemon HTTP API port

# TLS (for internet/secure LAN)
MATRIX_HUB_TLS_CERT=/path/to/cert.pem
MATRIX_HUB_TLS_KEY=/path/to/key.pem
```

### Service Ports

| Port | Service | Configurable Via |
|------|---------|-----------------|
| 8080 | WebSocket server (agent comms) | `WS_PORT` |
| 8081 | Matrix Hub (cross-matrix) | `MATRIX_HUB_PORT` |
| 8100 | ChromaDB vector database | `CHROMA_PORT` |
| 37888 | Matrix Daemon HTTP API | `MATRIX_DAEMON_PORT` |
| 37889 | Indexer Daemon HTTP API | `INDEXER_DAEMON_PORT` |

### Context Protection Hooks (Auto-save before /compact)

In `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "/path/to/pre-compact-autosave.sh"
      }]
    }]
  }
}
```

---

## Core Usage Patterns

### Startup Checklist (Run Every Session)

```bash
bun memory status     # Always run first - checks hub, daemon, indexer
bun memory init       # If anything shows unhealthy
bun memory recall     # Resume last session context
```

### Session Memory

```bash
# Save session at end of work
bun memory save "Implemented feature X with tests"
bun memory save --auto                  # Auto-capture from Claude Code history

# Recall sessions
bun memory recall                       # Resume last session
bun memory recall "authentication"      # Semantic search
bun memory recall session_123456        # Exact session ID
bun memory recall "#42"                 # Recall learning by ID

# List and browse
bun memory list sessions                # Table view
bun memory list -i                      # Interactive browser (arrow keys + Enter)
bun memory list learnings               # Grouped by category with confidence
```

### Learning Capture

```bash
# Smart mode - auto-detects input type
bun memory learn ./docs/file.md                      # Extract from local file
bun memory learn HEAD~3                              # Extract from git commits
bun memory learn https://example.com/article         # Extract from URL
bun memory learn https://github.com/user/repo.git    # Extract from git repo

# Traditional mode - structured fields
bun memory learn debugging "Fixed null pointer" --lesson "Always check for null"
bun memory learn architecture "JWT pattern" \
  --lesson "Use httpOnly cookies" \
  --prevention "Never store tokens in localStorage"

# Distill from sessions
bun memory distill                      # Extract from last session (interactive)
bun memory distill session_123          # From specific session
bun memory distill --all                # From all sessions
bun memory distill --smart             # LLM-enhanced extraction (Sonnet)
bun memory distill --smart --dedupe    # With smart deduplication
bun memory distill --last 5 --yes      # Batch mode, auto-accept

# LLM-enhanced quality
bun memory quality                      # Score learning quality
bun memory quality --smart             # Deep LLM scoring
bun memory quality --sort              # Sort by quality score
```

### Task Management

```bash
# List tasks
bun memory task                         # All pending tasks
bun memory task:list --system           # GitHub-synced tasks
bun memory task:list --project          # Local project tasks
bun memory task:list --session          # Session-scoped tasks

# Create tasks
bun memory task:create "Fix bug" --system     # Creates GitHub issue too
bun memory task:create "Study X" --project   # Local only
bun memory task:create "Step 1" --session    # Session scope

# Update tasks
bun memory task:update 5 done           # Complete (closes GitHub if synced)
bun memory task:sync                    # Sync with GitHub + analyze commits
bun memory task:sync --auto             # Sync + auto-close completed tasks
bun memory task:analyze                 # Analyze commits for completions
bun memory task:analyze 7 --auto        # Last 7 days, auto-close
bun memory task:stats                   # Task statistics
bun memory task:promote 5               # Promote project task to system
```

### Knowledge Graph

```bash
bun memory graph                        # Explore all entities
bun memory graph "chromadb"             # Find related learnings
bun memory analyze                      # Cross-session pattern detection
bun memory analyze --smart             # With Gemini codebase context
bun memory analyze --days 30           # Analyze last 30 days
bun memory correlate                    # Link learnings to code files
bun memory correlate --smart           # LLM-enhanced correlation
```

### Semantic Code Search

```bash
# First time (required)
bun memory index once                   # Full codebase index
bun memory index once --force           # Force re-index all files

# Search strategies
bun memory index find "daemon"          # Fast file/symbol lookup (<2ms)
bun memory index find "connectToHub"    # Find files containing symbol (<2ms)
bun memory index grep "WebSocket"       # Smart grep (SQLite-narrowed, ~26ms)
bun memory index grep "TODO" --in matrix  # Filter by file path
bun memory index grep "import" --lang typescript
bun memory index search "how auth works"  # Semantic/conceptual (~400ms)
bun memory index hybrid "query"         # Auto-route to best method

# Daemon for auto-updates
bun memory indexer start                # Start file watcher daemon
bun memory indexer status               # Check daemon health
bun memory indexer stop                 # Stop daemon

# Codebase map
bun memory map                          # Display codebase map
bun memory map --update                 # Update CLAUDE.md with map
```

---

## Multi-Agent Orchestration

### Spawn Agents

```bash
# Spawn 3 agents with git worktree isolation + watch pane
./scripts/spawn/spawn_claude_agents.sh 3

# Programmatic spawning
bun run spawn --count 3 --isolation worktree

# Attach to view agents
tmux attach -t claude-agents-<pid>
```

### Agent Roles and Models

| Role | Model | Use Case |
|------|-------|---------|
| `oracle` | opus | Orchestration, synthesis, critical decisions |
| `architect` | opus | System design, architecture decisions |
| `coder` | sonnet | Implementation, coding tasks |
| `analyst` | sonnet | Requirements analysis, problem breakdown |
| `reviewer` | sonnet | Code review, quality assurance |
| `tester` | sonnet | Test creation, edge cases, coverage |
| `debugger` | sonnet | Bug investigation, root cause analysis |
| `researcher` | haiku | Fast information gathering |
| `scribe` | sonnet | Documentation, session notes |
| `generalist` | sonnet | General-purpose tasks |

### MCP Tools for Orchestration

From within Claude Code (as MCP tools):

```
# Agent lifecycle
agent spawn [role] [model]      # Spawn single agent
agent spawn_pool [n]            # Spawn pool of agents
agent kill [id]                 # Terminate agent
agent restart [id]              # Restart crashed agent
agent health [id]               # Check single agent health
agent health_all                # Check all agents
agent status                    # List all agents

# Mission queue
mission distribute [task]       # Add task to priority queue
mission complete [id]           # Mark mission complete
mission fail [id]               # Mark mission failed
mission status                  # Mission queue status
mission rebalance               # Rebalance load across agents

# Git worktree isolation
worktree provision [agent_id] [task_id]  # Create isolated branch
worktree merge [agent_id]               # Merge back to main
worktree sync                           # Sync all worktrees
worktree cleanup                        # Remove stale worktrees
worktree status                         # Status of all worktrees
worktree list                           # List all worktrees
```

### Git Worktree Layout

Each agent gets an isolated directory and branch, preventing file conflicts:

```
/workspace/
├── .git/                      # Main repo
├── src/
└── .worktrees/
    ├── agent-1/               # branch: agent-1/work-xxx
    ├── agent-2/               # branch: agent-2/work-xxx
    └── agent-3/               # branch: agent-3/work-xxx
```

---

## Oracle Intelligence

The Oracle is the automated brain that makes spawning and routing decisions.

### Task Complexity Auto-Routing

| Complexity | Model Assigned | Signal Keywords |
|-----------|---------------|----------------|
| Simple | haiku | file reads, searches, formatting, list operations |
| Moderate | sonnet | implementation, testing, standard coding |
| Complex | opus | architecture, security analysis, multi-file refactoring |

### Proactive Spawn Triggers

| Trigger | Condition | Action |
|---------|-----------|--------|
| Queue Growth | >5 tasks/min AND no idle agents | Spawn generalist |
| Queue Depth | >5 tasks with zero idle for role | Spawn specialist |
| Complexity Mismatch | Opus task queued, only haiku available | Spawn opus agent |
| Idle Minimum | <1 idle agent per active role | Maintain coverage |

### Task Decomposition Example

Input: "Refactor auth module and write comprehensive tests"

Output:
```json
{
  "subtasks": [
    { "id": "task_1", "role": "analyst", "prompt": "Analyze current auth implementation", "dependsOn": [] },
    { "id": "task_2", "role": "coder", "prompt": "Refactor auth module", "dependsOn": ["task_1"] },
    { "id": "task_3", "role": "tester", "prompt": "Write comprehensive tests", "dependsOn": ["task_2"] }
  ],
  "executionOrder": "sequential"
}
```

### Checkpoint Protocol

Agents report progress mid-task. This enables adaptive timeouts and prevents premature termination:

```json
// Agent sends
{ "type": "checkpoint", "taskId": "task_123", "step": 2, "status": "progressing",
  "summary": "Completed analysis, starting implementation" }

// Oracle responds
{ "type": "checkpoint_response", "status": "acknowledged", "extendTimeout": 60000 }
```

---

## Matrix Communication (Cross-Project / Cross-Machine)

Matrix Hub enables messaging between different projects or different machines on LAN/internet.

### Quick Setup

```bash
bun memory init                 # Start hub + daemon automatically
bun memory status               # Check connection status
```

### Messaging

```bash
bun memory message "Hello everyone!"        # Broadcast to all matrices
bun memory message --to other-proj "Hey!"   # Direct message to specific matrix
bun memory message --inbox                  # Check received messages
bun memory watch                            # Live message feed (dedicated process)
```

### Cross-Machine LAN Setup

```bash
# Machine A (Hub Host)
MATRIX_HUB_HOST=0.0.0.0 bun run src/matrix-hub.ts
# Note the PIN displayed: "Hub PIN: A1B2C3"

# Machine B (Client)
MATRIX_HUB_URL=ws://192.168.1.100:8081 bun run src/matrix-daemon.ts start --pin A1B2C3
bun memory message "Hello from Machine B!"
```

### PIN Authentication

The hub generates a PIN on startup (like a WiFi password). Clients must provide the PIN to connect.

```bash
# Custom PIN
MATRIX_HUB_PIN=mysecret bun run src/matrix-hub.ts

# Disable PIN (not recommended for LAN/internet)
MATRIX_HUB_PIN=disabled bun run src/matrix-hub.ts

# Client with PIN
bun run src/matrix-daemon.ts start --pin A1B2C3
```

### Daemon Management

```bash
bun run src/matrix-daemon.ts start   # Start daemon
bun run src/matrix-daemon.ts stop    # Stop daemon
bun run src/matrix-daemon.ts status  # Check status
```

---

## Learning System Deep Dive

### Knowledge Lifecycle

```
Session Save
    |
    v
SQLite sessions table (immediate, crash-safe)
    |
    v
bun memory distill (interactive extraction)
    |
    v
Learnings table [confidence: low]
    |
    v
bun memory validate / auto-validate
    |
    v
low -> medium -> high -> proven (20x+ validated)
    |
    v
bun memory export -> LEARNINGS.md
```

### Learning Categories

**Technical**: `performance`, `architecture`, `tooling`, `process`, `debugging`, `security`, `testing`

**Wisdom**: `philosophy`, `principle`, `insight`, `pattern`, `retrospective`

### Quality Dimensions (LLM Scoring)

| Dimension | Description |
|-----------|-------------|
| Specificity | How concrete and actionable (vs. vague) |
| Actionability | Can someone act on it immediately? |
| Evidence | Is there supporting data or metrics? |
| Novelty | New insight vs. commonly known fact |

### Distill Interactive Flow

```
Found 3 potential learning(s):
1. [architecture] JWT refresh tokens work well
2. [debugging] Cookie SameSite issues on Safari
3. [insight] Always test on Safari early

For each:
  Y - Save with suggested category
  n - Skip
  c - Change category
  s - Skip all remaining

Optional structured fields:
  What happened? > Safari blocked cookies in iframe
  Lesson learned? > SameSite=None requires Secure flag
  How to prevent? > Test cross-origin flows on Safari early

Saved as learning #135 (confidence: low)
```

---

## Resilient Architecture

### Data Storage Pattern

```
SQLite (agents.db) - Source of Truth
  Always written first, never loses data
  WAL mode: concurrent multi-project access
  busy_timeout=5000ms: prevents lock errors

ChromaDB (:8100) - Disposable Search Index
  Best-effort writes (failures don't crash)
  Rebuildable anytime from SQLite
  3 retries with 100ms/200ms/400ms backoff
```

### Data Paths

| Path | Purpose |
|------|---------|
| `agents.db` | SQLite database (everything) |
| `./data/agent_inbox/{id}/` | Persistent task queue |
| `./data/agent_outbox/{id}/` | Agent results |
| `./data/agent_shared/` | Shared agent context |
| `~/.matrix-daemon/` | Matrix daemon PID/socket |
| `~/.indexer-daemon/` | Indexer daemon PID |
| `chroma_data/` | ChromaDB vector data |

### SQLite Schema (Key Tables)

```
agents           # Agent registry + stats
agent_tasks      # Task history + results + traceability links
unified_tasks    # Business requirements (system/project/session scoped)
missions         # Orchestration queue + dependency graph
sessions         # Session recordings with full git context
learnings        # Knowledge base with confidence tracking
lessons          # Problem -> solution pairs
events           # Agent lifecycle events
messages         # Matrix inbox/outbox logs
matrix_registry  # Cross-matrix discovery
entity_relationships  # Knowledge graph edges
```

---

## Recovery and Troubleshooting

### ChromaDB Recovery

```bash
# Connection refused - check if running
docker ps | grep chromadb
docker start chromadb

# Corruption - full rebuild (data is safe in SQLite)
docker stop chromadb
rm -rf chroma_data/*
docker start chromadb
bun memory reindex

# Check health
curl http://localhost:8100/api/v2/heartbeat
```

### Memory Search Not Working

```bash
bun memory reindex     # Rebuild vector index from SQLite
bun memory stats       # Check index status
bun memory status      # Full system health check
```

### Agent Spawn Failures

```bash
tmux list-sessions     # Check tmux state
tmux kill-server       # Kill all sessions (clean slate)
docker ps              # Check ChromaDB
bun memory init        # Re-initialize everything
```

### Switch Embedding Model

```bash
# Switch to bge-m3 for better code search (larger, slower)
EMBEDDING_MODEL=bge-m3 bun memory reindex
```

---

## MCP Memory Tools Reference

Available from within Claude Code as MCP tools:

| Tool | Description |
|------|-------------|
| `save_session` | Save session with full context |
| `recall_session` | Search past sessions semantically |
| `add_learning` | Capture a learning with structured fields |
| `recall_learnings` | Search learnings by query |
| `consolidate_learnings` | Merge duplicate learnings |
| `search` | Semantic search across all collections |
| `search_code` | Semantic code search (auto-routes: SQLite fast path or vector) |
| `get_context_bundle` | Get relevant context for starting a new session |
| `export_learnings` | Export knowledge to LEARNINGS.md |
| `stats` | System statistics |
| `get_inbox` | Check cross-matrix messages with hub status |
| `matrix_send` | Send to other matrices (broadcast or direct) |

---

## Slash Commands (Claude Code)

```
/memory-save          # Save current session
/memory-save-full     # Full save (Claude asks for wins/challenges/learnings)
/memory-recall        # Resume or search sessions
/memory-learn         # Capture learning (smart auto-detect or manual)
/memory-distill       # Extract learnings from sessions
/memory-validate      # Increase learning confidence
/memory-graph         # Explore knowledge graph
/memory-stats         # View statistics
/matrix-connect       # Start matrix daemon for cross-project messaging
/matrix-watch         # Open tmux pane with live matrix message feed
```

---

## Performance Reference

| Operation | Latency |
|-----------|---------|
| Embedding (short text) | ~3ms |
| Embedding (long text) | ~20ms |
| ChromaDB query | ~6ms |
| SQLite insert | ~0.3ms |
| SQLite query | ~0.04ms |
| Code index find (SQLite) | <2ms |
| Code index grep (smart) | ~26ms |
| Code semantic search | ~400ms |

---

## Source File Map

```
src/
├── oracle/
│   ├── orchestrator.ts      # Workload analysis, auto-rebalancing
│   ├── task-router.ts       # LLM-driven task routing (Haiku)
│   └── task-decomposer.ts   # Complex task breakdown into subtasks
├── pty/
│   ├── manager.ts           # PTYManager - tmux management
│   ├── spawner.ts           # AgentSpawner - role-based spawning
│   ├── mission-queue.ts     # MissionQueue - priority task queue
│   └── worktree-manager.ts  # Git worktree isolation
├── learning/
│   ├── loop.ts              # Learning loop (harvest, distill)
│   ├── consolidation.ts     # Duplicate merging + smart dedup
│   ├── content-router.ts    # Route to knowledge/lessons collections
│   ├── context-router.ts    # Task-aware retrieval boosting
│   ├── quality-scorer.ts    # Quality scoring (4 dimensions)
│   ├── entity-extractor.ts  # LLM-based entity/relationship extraction
│   ├── distill-engine.ts    # Smart distill with Sonnet
│   ├── cross-session.ts     # Cross-session pattern detection
│   ├── code-correlation.ts  # Learning-to-code-file linking
│   └── code-analyzer.ts     # Gemini-based codebase analysis
├── mcp/tools/handlers/      # MCP tool implementations
├── db/
│   ├── index.ts             # SQLite operations (modular)
│   └── utils.ts             # Shared helpers
├── db.ts                    # Backwards-compatible shim
├── vector-db.ts             # ChromaDB with resilience + retry
├── ws-server.ts             # WebSocket server for real-time agent tasks
├── matrix-hub.ts            # Cross-matrix WebSocket hub
├── matrix-daemon.ts         # Persistent hub connection manager
├── matrix-client.ts         # Hub client library
├── matrix-watch.ts          # SSE streaming for live message feed
├── embeddings/              # Transformers.js embedding models
└── indexer/
    ├── code-indexer.ts      # Semantic code indexer
    └── indexer-daemon.ts    # File watcher auto-update daemon
scripts/memory/
├── index.ts                 # CLI command router
├── save-session.ts          # Session save
├── recall.ts                # Smart recall (ID + semantic)
├── learn.ts                 # Learning capture (smart + traditional)
├── distill.ts               # Extraction from sessions
├── list.ts                  # List sessions/learnings
├── stats.ts                 # Statistics
├── export.ts                # Export to LEARNINGS.md
├── context.ts               # Context bundle for session start
├── quality.ts               # Quality scoring CLI
├── analyze.ts               # Cross-session analysis CLI
└── correlate.ts             # Code correlation CLI
```

---

## Test Suite

```bash
# Full test run (129 tests across 7 suites)
bun test scripts/tests/task-routing.test.ts \
  scripts/tests/oracle-spawning.test.ts \
  scripts/tests/simulation.test.ts \
  scripts/tests/chaos.test.ts \
  scripts/tests/sonnet-extraction.test.ts \
  scripts/tests/relationship-reasoning.test.ts \
  scripts/tests/gemini-analysis.test.ts

# Individual suites
bun test scripts/tests/task-routing.test.ts      # 27 tests - routing & decomposition
bun test scripts/tests/oracle-spawning.test.ts   # 17 tests - spawning & complexity
bun test scripts/tests/simulation.test.ts        # 17 tests - end-to-end workflows
bun test scripts/tests/chaos.test.ts             # 13 tests - failure & recovery
bun test scripts/tests/sonnet-extraction.test.ts # 15 tests - quality scoring
bun test scripts/tests/relationship-reasoning.test.ts  # 22 tests - knowledge graph
bun test scripts/tests/gemini-analysis.test.ts   # 18 tests - Gemini analysis
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `@huggingface/transformers` | Local embedding models (Transformers.js) |
| `chromadb` | Vector database client |
| `@anthropic-ai/tokenizer` | Token counting |
| `@google/genai` | Gemini API for codebase analysis |
| `chokidar` | File watching for indexer daemon |
| `p-queue` | Task queue with concurrency control |
| `zod` | Runtime type validation |
| `enquirer` | Interactive CLI prompts |
| `gray-matter` | Markdown frontmatter parsing |
| `sharp` | Image processing |
