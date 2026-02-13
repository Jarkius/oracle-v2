---
title: uv/uvx on Corporate Proxy: Use `uv tool install --native-tls <package>` to pre-c
tags: [uv, uvx, tls, corporate-proxy, chroma, windows, certificate, timeout]
created: 2026-02-13
source: rrr: oracle-v2
---

# uv/uvx on Corporate Proxy: Use `uv tool install --native-tls <package>` to pre-c

uv/uvx on Corporate Proxy: Use `uv tool install --native-tls <package>` to pre-cache Python packages using OS certificate store. Works on corporate proxies where default uvx fails (UnknownIssuer error). Once cached, uvx runs offline. Also: startup timeouts for subprocess tools should be 30s+ for first cold start. bun:sqlite is the correct API in Bun (not better-sqlite3). Oracle DB at ~/.oracle-v2/oracle.db.

---
*Added via Oracle Learn*
