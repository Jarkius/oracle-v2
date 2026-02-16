---
title: ## PowerShell 5.1 Encoding: Complete Guide (Merged)
tags: [powershell, windows, encoding, utf-8, debugging, root-cause, ai-output]
created: 2026-02-16
source: Merged from project auto-memory (C:\TEMP\TH-Windows) + Oracle learning
---

# ## PowerShell 5.1 Encoding: Complete Guide (Merged)

## PowerShell 5.1 Encoding: Complete Guide (Merged)

**Root Cause**: PowerShell 5.1 (`powershell.exe`) reads .ps1 files without a BOM as ANSI (Windows-1252). It does NOT auto-detect UTF-8. PowerShell 7+ (`pwsh.exe`) defaults to UTF-8 — this version difference is the root cause.

**Symptoms**:
- Cascading parse errors: "Missing expression", "Missing terminator", "Missing closing '}'"
- Errors appear on lines AFTER the actual problem line
- The reported lines look syntactically correct — the real issue is a non-ASCII character earlier in the file

**Common Offenders**:
| Character | Unicode | UTF-8 bytes | Source |
|-----------|---------|-------------|--------|
| `—` (em-dash) | U+2014 | E2 80 94 | Claude/AI output, Word paste |
| `–` (en-dash) | U+2013 | E2 80 93 | Word paste |
| `"` `"` (smart quotes) | U+201C/201D | E2 80 9C/9D | Word, Outlook, some editors |
| `'` `'` (smart apostrophes) | U+2018/2019 | E2 80 98/99 | Word, Outlook |

**Solutions (in order of preference)**:
1. **ASCII only** — never use non-ASCII in .ps1 files. Replace em-dash with `-`, smart quotes with `"`
2. **Add UTF-8 BOM** — save as "UTF-8 with BOM" (bytes EF BB BF at start)
3. **Use `-Encoding UTF8`** when loading via `Get-Content` or similar
4. Use PowerShell 7+ (`pwsh.exe`) which defaults to UTF-8

**Debugging Checklist**:
1. Check for non-ASCII: `Select-String -Path script.ps1 -Pattern '[^\x00-\x7F]'`
2. Check BOM: `[System.IO.File]::ReadAllBytes($path)[0..2]` — should be `EF BB BF`
3. Check PS version: `$PSVersionTable.PSVersion`

**AI-specific risk**: Claude/AI assistants naturally produce em-dashes and smart quotes. When this output ends up in .ps1 files, it silently breaks PowerShell 5.1. Always sanitize AI-generated PowerShell content to ASCII.

---
*Added via Oracle Learn*
