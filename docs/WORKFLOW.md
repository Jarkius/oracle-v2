# Oracle v2 Workflow Guide

> How to use Oracle across multiple projects

## Overview

Oracle is a **centralized MCP server**. Install once, use everywhere. No per-project setup needed.

## Setup (One-Time)

```bash
# 1. Install oracle-v2
git clone https://github.com/Jarkius/oracle-v2.git /path/to/oracle-v2
cd /path/to/oracle-v2 && bun install && bun run db:push

# 2. Register as global MCP server
claude mcp add -s user oracle-v2 -- bun run /path/to/oracle-v2/src/index.ts

# 3. Install global skills (optional)
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli#v1.5.79 install

# 4. Restart Claude Code
```

## Daily Workflow

```bash
# Just cd to your project and start Claude
cd ~/projects/my-app
claude

# Oracle is automatically available
# Skills like /learn, /trace, /recap work globally
# MCP tools like oracle_search, oracle_learn work automatically
```

## How Project Detection Works

Oracle auto-detects which project you're working on:

```
Priority 1: ghq path    → ~/ghq/github.com/owner/repo/  → "github.com/owner/repo"
Priority 2: /Code/ path → ~/Code/github.com/owner/repo/ → "github.com/owner/repo"
Priority 3: git remote  → reads .git/config → extracts origin URL → "github.com/owner/repo"
```

On Windows, backslashes are normalized automatically.

## What Lives Where

```
~/.claude/skills/              → Global skills (26 from oracle-skills-cli)
~/.claude.json                 → Global MCP server config
~/.oracle-v2/oracle.db         → Centralized SQLite database

/path/to/oracle-v2/            → Oracle source code
/path/to/oracle-v2/ψ/memory/  → All knowledge (learnings, retros, traces)
/path/to/oracle-v2/.claude/    → Project-specific commands (/dev, /wip)

~/projects/my-app/             → Your project (no Oracle files needed)
~/projects/my-app/.claude/     → Project-specific commands (optional)
```

## Knowledge Flow

```
You work on project-a
  → Claude learns something → oracle_learn → stored in oracle-v2 DB
  → Tagged with project: "github.com/you/project-a"

You switch to project-b
  → Claude searches memory → oracle_search → finds knowledge from ALL projects
  → Can filter by project if needed
```

## Slash Commands

### Available Everywhere (Global Skills)
| Command | Description |
|---------|-------------|
| `/learn [repo]` | Explore a codebase with parallel agents |
| `/trace [query]` | Search across git, repos, docs, Oracle |
| `/recap` | Session orientation and context |
| `/rrr` | Create session retrospective |
| `/standup` | Daily standup check |
| `/forward` | Create handoff for next session |

### Available in oracle-v2 Only (Project Commands)
| Command | Description |
|---------|-------------|
| `/dev` | Start backend + frontend servers |
| `/wip` | Show work in progress |
| `/now` | Current session awareness |

## When to Be in oracle-v2 Directory

Only when working **on Oracle itself**:
- Editing Oracle source code (`src/`)
- Running the dashboard (`/dev`)
- Managing ψ/memory files
- Re-indexing knowledge (`bun run index`)

## FAQ

### Do I need ψ/memory/ in each project?
No. All knowledge is centralized in oracle-v2's ψ/memory/.

### Do I need /awaken per project?
No. /awaken creates a new Oracle — you already have one.

### Do I need ghq?
No. The git remote fallback detects projects from any directory. ghq is optional for structured repo management.

### How do I start the dashboard from another project?
Either:
1. Open a separate terminal: `cd /path/to/oracle-v2 && bun run server`
2. Or the MCP tools work without the HTTP server (MCP uses stdio)

### How do I update Oracle skills?
```bash
bunx --bun oracle-skills@github:Soul-Brews-Studio/oracle-skills-cli#vX.Y.Z install
```
Or use `/oracle-soul-sync-calibrate-update` from any project.
