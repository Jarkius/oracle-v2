---
title: ## PowerShell 5.1 + BOM-less UTF-8 = Cascading Parse Errors
tags: [powershell, windows, encoding, utf-8, debugging, root-cause]
created: 2026-02-16
source: Previous Oracle session (not indexed)
---

# ## PowerShell 5.1 + BOM-less UTF-8 = Cascading Parse Errors

## PowerShell 5.1 + BOM-less UTF-8 = Cascading Parse Errors

**Root Cause**: PowerShell 5.1 defaults to Windows-1252 encoding. When it encounters BOM-less UTF-8 files containing non-ASCII characters (e.g., em-dashes, smart quotes, Unicode), it misinterprets the bytes, causing cascading parse failures.

**Symptoms**:
- Commands fail with cryptic parse errors
- String interpolation breaks unexpectedly
- Scripts work in PowerShell 7+ but fail in 5.1
- Errors appear unrelated to the actual encoding issue

**Debugging Checklist**:
1. Check PowerShell version: `$PSVersionTable.PSVersion`
2. Check file encoding: look for BOM (EF BB BF) at start of file
3. Check for non-ASCII characters in scripts and config files
4. Test with `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`

**Fix Options**:
- Add UTF-8 BOM to files (`EF BB BF` prefix)
- Use PowerShell 7+ which defaults to UTF-8
- Set `$PSDefaultParameterValues['*:Encoding'] = 'utf8BOM'`
- Avoid non-ASCII characters in scripts (replace em-dashes, smart quotes with ASCII equivalents)

**Real-world Impact**: This caused failures in Claude Code sessions where shell commands were constructed with non-ASCII characters from AI-generated content.

---
*Added via Oracle Learn*
