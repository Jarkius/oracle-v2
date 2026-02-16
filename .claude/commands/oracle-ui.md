---
description: Start Oracle web UI (backend API + frontend dashboard)
---

# /oracle-ui - Start Oracle Web UI

Start the Oracle web dashboard. This is for browsing the knowledge base in a browser — NOT required for MCP tools (`oracle_learn`, `oracle_search`, etc.) which work automatically via stdio.

## Usage

```
/oracle-ui          # Start both servers
/oracle-ui stop     # Stop both servers
/oracle-ui status   # Check if servers are running
```

## Note

MCP tools are available in ALL Claude Code sessions without running this. The web UI is optional — use it when you want to browse learnings, traces, or threads visually.

## Implementation

### If "stop" argument:

Stop running servers:
```bash
# Find and stop bun processes on dev ports
# Port 47778 = backend, Port 3000 = frontend
netstat -ano | findstr ":47778\|:3000" | findstr LISTENING
```
Then kill the PIDs found. Confirm before killing.

### If "status" argument:

Check server status:
```bash
curl -s http://localhost:47778/api/health 2>/dev/null && echo "Backend: UP" || echo "Backend: DOWN"
curl -s http://localhost:3000 2>/dev/null && echo "Frontend: UP" || echo "Frontend: DOWN"
```

### Default (start):

1. **Check if already running**:
```bash
curl -s http://localhost:47778/api/health 2>/dev/null
curl -s http://localhost:3000 2>/dev/null
```
Skip starting a server if it's already running.

2. **Start backend** (background):
```bash
cd C:\Workspace\Dev\oracle-v2 && bun run server
```
Run in background. Wait 2 seconds, verify with health check.

3. **Start frontend** (background):
```bash
cd C:\Workspace\Dev\oracle-v2\frontend && bun run dev
```
Run in background.

4. **Report**:
```
## Oracle Web UI Started

| Service | Port | Status |
|---------|------|--------|
| Backend API | :47778 | Running |
| Frontend    | :3000  | Running |

Backend: http://localhost:47778
Frontend: http://localhost:3000
```

ARGUMENTS: $ARGUMENTS
