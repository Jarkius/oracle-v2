---
title: ## PowerShell: Avoid Backtick-Quote Escaping in Strings
tags: [powershell, windows, strings, escaping, best-practice]
created: 2026-02-16
source: Previous Oracle session (not indexed)
---

# ## PowerShell: Avoid Backtick-Quote Escaping in Strings

## PowerShell: Avoid Backtick-Quote Escaping in Strings

**Problem**: PowerShell uses backtick (`) as escape character. Escaping quotes with backtick-quote (`` ` `` + `"`) is fragile — it breaks across different PowerShell versions, in nested contexts, and when strings pass through multiple layers of interpretation.

**Anti-pattern**:
```powershell
# Fragile — breaks in nested contexts
$msg = "He said `"hello`""
```

**Robust Alternatives**:
1. **Single-quote concatenation**: `'He said "hello"'`
2. **Format operator**: `'He said {0}hello{0}' -f '"'`
3. **Here-strings**: `@"...\n"@` for multiline
4. **Double-double-quote inside double-quotes**: `"He said ""hello"""` (in some contexts)

**Rule of thumb**: If you're using backtick to escape quotes in PowerShell, there's almost always a cleaner way. Single quotes don't interpret any escape sequences, making them the safest choice for literal strings.

---
*Added via Oracle Learn*
