/**
 * Project Detection via ghq/symlink resolution + git remote fallback
 *
 * Auto-detects project context from working directory. Cross-platform (macOS/Windows/Linux).
 *
 * Algorithm:
 * 1. Resolve symlinks to get real path (fs.realpathSync)
 * 2. Match ghq pattern: [path]/github.com/owner/repo/[...] (forward or back slashes)
 * 3. Fallback: read .git/config for remote origin URL
 * 4. Extract project identifier
 *
 * Examples:
 *   macOS:   ~/Code/github.com/laris-co/headline-mono/src/ → "github.com/laris-co/headline-mono"
 *   Windows: C:\Users\dev\ghq\github.com\owner\repo\       → "github.com/owner/repo"
 *   Any OS:  C:\Workspace\Dev\my-app\ (has .git remote)    → "github.com/owner/my-app"
 */

import fs from 'fs';
import path from 'path';

/**
 * Detect project from working directory.
 * Tries ghq path pattern first, then falls back to git remote origin.
 * @param cwd - Current working directory (may be symlink)
 * @returns Project identifier (e.g., "github.com/owner/repo") or null if not detectable
 */
export function detectProject(cwd?: string): string | null {
  if (!cwd) return null;

  try {
    // 1. Resolve symlinks to get real path
    const realPath = fs.realpathSync(cwd);

    // Normalize to forward slashes for cross-platform regex matching
    const normalized = realPath.replace(/\\/g, '/');

    // 2. Match ghq pattern: */github.com/owner/repo/* or */gitlab.com/owner/repo/*
    // Works on both macOS (/Users/.../github.com/...) and Windows (C:/Users/.../github.com/...)
    const match = normalized.match(/[/\\](github\.com|gitlab\.com|bitbucket\.org)[/\\]([^/\\]+[/\\][^/\\]+)/);

    if (match) {
      const [, host, ownerRepo] = match;
      return `${host}/${ownerRepo.replace(/\\/g, '/')}`;
    }

    // 3. Fallback: check for ghq root pattern without known host
    // Pattern: ~/Code/*/owner/repo or similar
    const ghqMatch = normalized.match(/\/Code\/([^/]+\/[^/]+\/[^/]+)/);
    if (ghqMatch) {
      return ghqMatch[1];
    }

    // 4. Fallback: detect from git remote origin URL
    const gitProject = detectProjectFromGitRemote(cwd);
    if (gitProject) {
      return gitProject;
    }

    return null;
  } catch (e) {
    // Path doesn't exist or can't be resolved
    return null;
  }
}

/**
 * Detect project by reading .git/config for remote origin URL
 * Walks up directories to find .git folder (cross-platform, no subprocess needed)
 * @param cwd - Directory to check
 * @returns Project identifier or null
 */
function detectProjectFromGitRemote(cwd: string): string | null {
  try {
    // Walk up to find .git directory
    let dir = path.resolve(cwd);
    const root = path.parse(dir).root;

    while (dir !== root) {
      const gitConfig = path.join(dir, '.git', 'config');
      if (fs.existsSync(gitConfig)) {
        const config = fs.readFileSync(gitConfig, 'utf-8');
        // Match: url = https://github.com/owner/repo.git or url = git@github.com:owner/repo.git
        const urlMatch = config.match(/\[remote\s+"origin"\][^[]*url\s*=\s*(.+)/m);
        if (urlMatch) {
          return extractProjectFromRemoteUrl(urlMatch[1].trim());
        }
        return null; // Found .git but no origin remote
      }
      dir = path.dirname(dir);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract project identifier from a git remote URL
 * Handles: https://github.com/owner/repo.git, git@github.com:owner/repo.git, etc.
 */
function extractProjectFromRemoteUrl(url: string): string | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/([^/]+\/[^/\s]+)/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2].replace(/\.git$/, '')}`;
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/(github\.com|gitlab\.com|bitbucket\.org)[:/]([^/]+\/[^/\s]+)/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2].replace(/\.git$/, '')}`;
  }

  return null;
}

/**
 * Detect project from a file path
 * @param filePath - Absolute file path
 * @returns Project identifier or null
 */
export function detectProjectFromFile(filePath: string): string | null {
  return detectProject(path.dirname(filePath));
}

/**
 * Check if a path is within a specific project
 * @param cwd - Current working directory
 * @param project - Project identifier to check against
 * @returns true if cwd is within the project
 */
export function isInProject(cwd: string, project: string): boolean {
  const detected = detectProject(cwd);
  return detected === project;
}

/**
 * Normalize project input to ghq format: "github.com/owner/repo"
 *
 * Handles:
 * - "github.com/owner/repo" → as-is
 * - "owner/repo" → "github.com/owner/repo"
 * - "https://github.com/owner/repo" → "github.com/owner/repo"
 * - "~/Code/github.com/owner/repo" → "github.com/owner/repo"
 * - "/Users/nat/Code/github.com/owner/repo/..." → "github.com/owner/repo"
 */
export function normalizeProject(input?: string): string | null {
  if (!input) return null;

  // Already normalized
  if (input.match(/^github\.com\/[^\/]+\/[^\/]+$/)) {
    return input;
  }

  // GitHub URL: https://github.com/owner/repo or http://github.com/owner/repo
  const urlMatch = input.match(/https?:\/\/github\.com\/([^\/]+\/[^\/]+)/);
  if (urlMatch) return `github.com/${urlMatch[1].replace(/\.git$/, '')}`;

  // Local path with github.com: ~/Code/github.com/owner/repo or /Users/.../github.com/owner/repo
  const pathMatch = input.match(/github\.com\/([^\/]+\/[^\/]+)/);
  if (pathMatch) return `github.com/${pathMatch[1]}`;

  // Short format: owner/repo (no slashes except the one between owner/repo)
  const shortMatch = input.match(/^([^\/\s]+\/[^\/\s]+)$/);
  if (shortMatch) return `github.com/${shortMatch[1]}`;

  return null;
}

/**
 * Extract project from source field (fallback)
 * Handles formats:
 * - "oracle_learn from github.com/owner/repo ..."
 * - "rrr: org/repo" or "rrr: Owner/Repo"
 */
export function extractProjectFromSource(source?: string): string | null {
  if (!source) return null;

  // Try "oracle_learn from github.com/owner/repo"
  const oracleLearnMatch = source.match(/from\s+(github\.com\/[^\/\s]+\/[^\/\s]+)/);
  if (oracleLearnMatch) return oracleLearnMatch[1];

  // Try "rrr: org/repo" format (convert to github.com/org/repo)
  const rrrMatch = source.match(/^rrr:\s*([^\/\s]+\/[^\/\s]+)/);
  if (rrrMatch) return `github.com/${rrrMatch[1]}`;

  // Try direct "github.com/owner/repo" anywhere in source
  const directMatch = source.match(/(github\.com\/[^\/\s]+\/[^\/\s]+)/);
  if (directMatch) return directMatch[1];

  return null;
}
