# matrix-memory-agents Learning Index

## Source
- **Origin**: ./origin/
- **GitHub**: https://github.com/Jarkius/matrix-memory-agents

## Explorations

### 2026-02-16 1412 (default)
- [2026-02-16/1412_ARCHITECTURE](2026-02-16/1412_ARCHITECTURE.md)
- [2026-02-16/1412_CODE-SNIPPETS](2026-02-16/1412_CODE-SNIPPETS.md)
- [2026-02-16/1412_QUICK-REFERENCE](2026-02-16/1412_QUICK-REFERENCE.md)

**Key insights**:
- Multi-agent orchestration system (Agent Orchestra) built on Bun/TypeScript, exposed as MCP server
- Spawns Claude CLI agents in tmux PTYs with isolated git worktrees, coordinated via priority queue
- Persistent memory layer: SQLite (source of truth) + ChromaDB (rebuildable search index) — same pattern as Oracle v2
- Self-evolving knowledge loop: sessions → distill → consolidate → validate → proven knowledge
- Matrix communication: cross-project/cross-machine WebSocket messaging with PIN auth
