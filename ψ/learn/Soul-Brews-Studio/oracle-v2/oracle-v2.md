# oracle-v2 Learning Index

## Source
- **GitHub**: https://github.com/Soul-Brews-Studio/oracle-v2
- **Local**: C:\Workspace\Dev\oracle-v2

## Explorations

### 2026-02-12 1101 (default — 3 agents)
- [Architecture](2026-02-12/1101_ARCHITECTURE.md)
- [Code Snippets](2026-02-12/1101_CODE-SNIPPETS.md)
- [Quick Reference](2026-02-12/1101_QUICK-REFERENCE.md)

**Key insights**:
- Dual DB pattern: raw SQLite for FTS5 + Drizzle ORM for type-safe queries
- Graceful degradation: ChromaDB failure → FTS5-only (no crash)
- 19+ MCP tools, 30+ HTTP endpoints, 13 database tables
