# Oracle Nightly Installation Guide

Complete guide for fresh installation. Cross-platform (macOS, Windows, Linux).

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| [Bun](https://bun.sh/) | Yes | `curl -fsSL https://bun.sh/install \| bash` |
| [Git](https://git-scm.com/) | Yes | System package manager |
| [GitHub CLI](https://cli.github.com/) | Yes | `brew install gh` / `winget install GitHub.cli` |
| [ghq](https://github.com/x-motemen/ghq) | Optional | `brew install ghq` / `winget install x-motemen.ghq` |
| [uv](https://astral.sh/uv) | Optional | For ChromaDB vector search |

## Quick Install (macOS/Linux)

```bash
curl -sSL https://raw.githubusercontent.com/Soul-Brews-Studio/oracle-v2/main/scripts/fresh-install.sh | bash
```

This one-liner will:
1. Clone to `~/.local/share/oracle-v2`
2. Install dependencies
3. Create seed philosophy files
4. Index seed data
5. Run tests

## Windows Install

```bash
# 1. Clone the repo
git clone https://github.com/Jarkius/oracle-v2.git C:\Workspace\Dev\oracle-v2
cd C:\Workspace\Dev\oracle-v2

# 2. Install dependencies
bun install

# 3. Initialize database
bun run db:push
# Note: May show "index already exists" error — safe to ignore

# 4. Seed test data (optional)
bun run test:seed

# 5. Index knowledge base
bun run index

# 6. Register as global MCP server
claude mcp add -s user oracle-v2 -- bun run C:\Workspace\Dev\oracle-v2\src\index.ts

# 7. Restart Claude Code
```

## Manual Install (Any OS)

```bash
# 1. Clone
git clone https://github.com/Jarkius/oracle-v2.git /path/to/oracle-v2
cd /path/to/oracle-v2

# 2. Install dependencies
bun install

# 3. Setup database
bun run db:push

# 4. Register MCP server (user scope = available in every project)
claude mcp add -s user oracle-v2 -- bun run /path/to/oracle-v2/src/index.ts

# 5. Restart Claude Code
```

## What Gets Created

### Installation Directory
```
/path/to/oracle-v2/          # Code
~/.oracle-v2/                 # Data
├── oracle.db                 # SQLite database
└── seed/                     # Seed philosophy files (if seeded)
    └── ψ/memory/
        ├── resonance/        # Core principles
        └── learnings/        # Example learnings
```

### MCP Registration
The `claude mcp add -s user` command registers Oracle globally in `~/.claude.json`:
```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "bun",
      "args": ["run", "/path/to/oracle-v2/src/index.ts"]
    }
  }
}
```

This means Oracle MCP tools are available in **every Claude Code session**, regardless of which directory you're in.

## Post-Install Verification

### 1. Check MCP Registration
```bash
claude mcp list
# Should show: oracle-v2 (user)
```

### 2. Start Server (optional, for dashboard)
```bash
cd /path/to/oracle-v2
bun run server
```

### 3. Test Search
```bash
curl http://localhost:47778/api/health
curl "http://localhost:47778/api/search?q=nothing+deleted"
```

### 4. Test from Another Project
```bash
cd ~/some-other-project
claude
# Ask Claude to search Oracle — MCP tools should work
```

## Install Oracle Skills (Optional)

Global slash commands for Claude Code:

```bash
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli#v1.5.79 install
```

Installs 26 skills to `~/.claude/skills/` — available in every project.

Key skills: `/learn`, `/trace`, `/recap`, `/rrr`, `/standup`, `/forward`

## Index Your Own Knowledge

To index your own ψ/memory files:

```bash
cd /path/to/oracle-v2
ORACLE_REPO_ROOT=/path/to/your/repo bun run index
```

The indexer scans:
- `ψ/memory/resonance/*.md` → principles
- `ψ/memory/learnings/*.md` → learnings
- `ψ/memory/retrospectives/**/*.md` → retrospectives

## Optional: Vector Search (ChromaDB)

For semantic/vector search in addition to keyword FTS5:

```bash
# Install uv (provides uvx for chroma-mcp)
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows:
winget install astral-sh.uv
```

Without uv, Oracle falls back to FTS5-only search (still works fine).

## Troubleshooting

### `db:push` fails with "index already exists"
Known Drizzle bug. Safe to ignore if tables already exist in the database.

### Search returns 0 results after indexing
Server caches database state. Restart after indexing:
```bash
# macOS/Linux:
pkill -f 'bun.*server' && bun run server

# Windows:
# Close the terminal running the server and restart it
```

### ChromaDB unavailable warning
uv/uvx not installed. FTS5 keyword search still works. Install uv for vector search.

### MCP tools not available in other projects
Check registration scope:
```bash
claude mcp list
# Should show: oracle-v2 (user)
# If it shows (local), re-register with: claude mcp add -s user oracle-v2 -- ...
```

### Windows: `execSync` ENOENT error
Fixed in v0.2.4. Project detection now reads `.git/config` directly instead of spawning a subprocess.

## Uninstall

```bash
# Remove MCP registration
claude mcp remove oracle-v2

# Remove code
rm -rf /path/to/oracle-v2

# Remove data
rm -rf ~/.oracle-v2
```

---

See also:
- [README.md](../README.md) - Overview
- [API.md](./API.md) - API documentation
- [architecture.md](./architecture.md) - System architecture
- [WORKFLOW.md](./WORKFLOW.md) - How to use Oracle across projects
