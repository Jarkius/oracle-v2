---
project: github.com/Jarkius/oracle-v2
title: Cross-Platform Oracle Project Detection
tags: [windows, cross-platform, project-detection, git-remote, mcp]
created: 2026-02-12
source: Session 2026-02-12
---

# Cross-Platform Oracle Project Detection

## Problem
Oracle's project detection assumed ghq-style paths (`~/Code/github.com/owner/repo`). On Windows with paths like `C:\Workspace\Dev\my-app`, detection returned null — Oracle couldn't identify which project you're working on.

## Solution: 3-Tier Detection with Git Remote Fallback

```
Priority 1: ghq path pattern  → /github.com/owner/repo/ in resolved path
Priority 2: /Code/ path       → /Code/host/owner/repo/ pattern
Priority 3: git remote (NEW)  → read .git/config → extract origin URL
```

### Key Implementation Details

1. **Normalize backslashes first**: `realPath.replace(/\\/g, '/')` before regex matching
2. **Read .git/config directly** — don't use `execSync('git remote get-url origin')` because Bun on Windows can't find `cmd.exe` (ENOENT)
3. **Walk up directories** to find `.git/config` (handles subdirectories)
4. **Parse both HTTPS and SSH remotes**: `https://github.com/owner/repo.git` and `git@github.com:owner/repo.git`

### MCP Registration

Use user-scope for global availability:
```bash
claude mcp add -s user oracle-v2 -- bun run /path/to/src/index.ts
```

Not `-s local` (project only) or `-s project` (needs .mcp.json).

## Key Takeaway

Never assume the user's directory structure. Git remote is the universal fallback — every repo has one, every OS supports it, no dependencies needed.

---
*Added via Oracle Learn*
