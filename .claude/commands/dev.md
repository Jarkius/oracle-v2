---
description: Start backend + frontend dev servers in one shot
---

# /dev - Start Development Servers

Start both the backend API server and frontend dev server.

## Usage

```
/dev          # Start both servers
/dev stop     # Stop both servers
/dev status   # Check if servers are running
```

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
## Dev Servers Started

| Service | Port | Status |
|---------|------|--------|
| Backend API | :47778 | ✓ Running |
| Frontend    | :3000  | ✓ Running |

Backend: http://localhost:47778
Frontend: http://localhost:3000
```

ARGUMENTS: $ARGUMENTS
