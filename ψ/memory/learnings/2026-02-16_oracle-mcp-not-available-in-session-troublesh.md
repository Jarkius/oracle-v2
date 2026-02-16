---
title: ## Oracle MCP Not Available in Session — Troubleshooting
tags: [oracle, mcp, troubleshooting, setup, onboarding, windows]
created: 2026-02-16
source: Session observation — other Oracle instances can't find MCP tools
---

# ## Oracle MCP Not Available in Session — Troubleshooting

## Oracle MCP Not Available in Session — Troubleshooting

**Symptom**: Oracle session says "I don't see oracle_learn in my available MCP tools" or "no MCP tools available."

**Root Cause**: The Oracle v2 MCP server is not registered or not running for that session.

**Fix — Register MCP (user-scope, works across all projects)**:
```bash
claude mcp add -s user oracle-v2 -- bun run C:/Workspace/Dev/oracle-v2/src/index.ts
```

**Important notes**:
- Use forward slashes in paths on Windows: `C:/Workspace/Dev/...` not `C:\Workspace\Dev\...`
- The backend (port 47778) does NOT need to be running — MCP spawns its own process via `bun run`
- User-scope (`-s user`) makes it available in ALL projects, not just oracle-v2
- After registering, restart the Claude Code session for it to take effect

**Verification**: Any `oracle_*` tool call should work. Try `oracle_search` with any query to confirm.

**If the Oracle is in a different repo**: MCP is still available if registered user-scope. The Oracle doesn't need to be in the oracle-v2 repo to use `oracle_learn`.

---
*Added via Oracle Learn*
