---
title: ## Fix: Oracle MCP Missing from Claude Code Sessions
tags: [oracle, mcp, troubleshooting, setup, onboarding, windows, settings]
created: 2026-02-16
source: Verified fix — edited settings.json directly from inside session
---

# ## Fix: Oracle MCP Missing from Claude Code Sessions

## Fix: Oracle MCP Missing from Claude Code Sessions

**Symptom**: Oracle session says "I don't see oracle_learn in my available MCP tools" or "no MCP tools available."

**Root Cause**: The Oracle v2 MCP server is not registered user-scope, OR `settings.json` was overwritten/reset losing the `mcpServers` config.

**Where the config lives**: `~/.claude/settings.json` under the `mcpServers` key:
```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "bun",
      "args": ["run", "C:/Workspace/Dev/oracle-v2/src/index.ts"]
    }
  }
}
```

**Fix Option 1 — CLI** (run OUTSIDE of Claude Code):
```bash
claude mcp add -s user oracle-v2 -- bun run C:/Workspace/Dev/oracle-v2/src/index.ts
```

**Fix Option 2 — Direct edit** (works FROM INSIDE Claude Code):
Edit `~/.claude/settings.json` and add the `mcpServers` block above. This is the only way to fix it mid-session since `claude mcp add` cannot run inside a Claude Code session (nested session error).

**Important notes**:
- Use forward slashes in paths on Windows: `C:/Workspace/Dev/...` not `C:\Workspace\Dev\...`
- User-scope makes it available in ALL projects, not just oracle-v2
- Existing sessions won't pick up changes — must restart Claude Code
- The backend (port 47778) does NOT need to be running — MCP spawns its own process
- There is NO `.mcp.json` file in the oracle-v2 project root — it's purely in user settings
- `claude mcp add` inside Claude Code fails with: "Claude Code cannot be launched inside another Claude Code session"

**Verification**: Any `oracle_*` tool call should work. Try `oracle_search` with any query to confirm.

**Real incident**: Feb 2026 — Oracle session in TH-Windows repo couldn't find MCP tools, wrote learnings as raw files instead of using `oracle_learn`. The `mcpServers` key was completely missing from settings.json.

---
*Added via Oracle Learn*
