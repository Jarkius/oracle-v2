---
title: ## How to Save Learnings to Oracle Knowledge Base
tags: [oracle, mcp, knowledge-base, workflow, onboarding]
created: 2026-02-16
source: Session observation — previous Oracle wrote files without indexing
---

# ## How to Save Learnings to Oracle Knowledge Base

## How to Save Learnings to Oracle Knowledge Base

**The right way**: Use `oracle_learn` MCP tool. This both creates the file AND indexes it in the knowledge base (FTS5 + ChromaDB vectors).

**Wrong way**: Manually writing files to `ψ/memory/learnings/` — this creates the file but does NOT index it. The learning will be invisible to `oracle_search` and `oracle_consult`.

**MCP availability**: Oracle v2 MCP server must be registered. Check with any `oracle_*` tool call. If MCP tools are not available:
- Register user-scope: `claude mcp add -s user oracle-v2 -- bun run C:/Workspace/Dev/oracle-v2/src/index.ts`
- Or check if backend is running on port 47778

**oracle_learn parameters**:
- `pattern` (required): The learning content in markdown
- `concepts` (optional): Tag array for categorization, e.g. `["git", "windows", "debugging"]`
- `source` (optional): Attribution string
- `project` (optional): Project context in `github.com/owner/repo` format

**When to learn**: After discovering a root cause, debugging insight, architectural decision, or reusable pattern. If it took you more than 10 minutes to figure out, it's worth learning.

**Verify it worked**: After `oracle_learn`, you can `oracle_search` for the topic to confirm it's indexed.

---
*Added via Oracle Learn*
