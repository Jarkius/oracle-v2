# Learning: uv/uvx on Corporate Proxy Networks

**Date**: 2026-02-13
**Context**: ChromaDB (via `uvx chroma-mcp`) failed to start on corporate network due to TLS certificate interception
**Source**: rrr: oracle-v2

## Problem

Corporate proxies intercept HTTPS traffic with their own TLS certificates. `uv`/`uvx` uses its own bundled certificate store by default, which doesn't trust the proxy CA. Result: `UnknownIssuer` error, package download hangs.

## Solution

```bash
# Pre-cache the package using system certificates (one-time)
uv tool install --native-tls chroma-mcp

# After this, `uvx chroma-mcp` works offline from cache
```

The `--native-tls` flag tells `uv` to use the OS certificate store (which trusts the corporate CA) instead of its bundled certs.

## Alternative: Environment Variable

```bash
set UV_NATIVE_TLS=true
# or
set SSL_CERT_FILE=C:\path\to\corporate-ca.crt
```

## Key Insight

Don't bypass tools that fail on corporate networks — fix their certificate trust. `--native-tls` is the clean solution for `uv`/`uvx`. Once cached, packages work offline.

## Also Learned

- Startup timeouts for subprocess tools (like chroma-mcp) should be generous (30s+) — first cold start from cache is slower than steady state
- `bun:sqlite` is the correct SQLite API in Bun, not `better-sqlite3`
- Oracle DB path: `~/.oracle-v2/oracle.db` (via `ORACLE_DATA_DIR`)

## Tags

`uv`, `uvx`, `tls`, `corporate-proxy`, `chroma`, `windows`, `certificate`
