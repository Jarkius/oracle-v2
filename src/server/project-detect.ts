/**
 * Project Detection via ghq/symlink resolution
 *
 * Auto-detects project context from working directory by following
 * symlinks to ghq paths. No hardcoding or marker files needed.
 *
 * Algorithm:
 * 1. Resolve symlinks to get real path (fs.realpathSync)
 * 2. Match ghq pattern: [path]/github.com/owner/repo/[...]
 * 3. Extract project identifier
 *
 * Example:
 *   cwd: ~/Nat-s-Agents/incubated/headline-mono/src/
 *        -> (symlink resolves)
 *   real: ~/Code/github.com/laris-co/headline-mono/src/
 *        -> (regex match)
 *   project: "github.com/laris-co/headline-mono"
 */

import fs from 'fs';
import path from 'path';

/**
 * Detect project from working directory by following symlinks to ghq path
 * @param cwd - Current working directory (may be symlink)
 * @returns Project identifier (e.g., "github.com/owner/repo") or null if not detectable
 */
export function detectProject(cwd?: string): string | null {
  if (!cwd) return null;

  try {
    // 1. Resolve symlinks to get real path
    const realPath = fs.realpathSync(cwd);

    // 2. Match ghq pattern: */github.com/owner/repo/* or */gitlab.com/owner/repo/*
    // Supports: github.com, gitlab.com, bitbucket.org, etc.
    const match = realPath.match(/\/(github\.com|gitlab\.com|bitbucket\.org)\/([^/]+\/[^/]+)/);

    if (match) {
      const [, host, ownerRepo] = match;
      return `${host}/${ownerRepo}`;
    }

    // 3. Fallback: check for ghq root pattern without known host
    // Pattern: ~/Code/*/owner/repo or similar
    const ghqMatch = realPath.match(/\/Code\/([^/]+\/[^/]+\/[^/]+)/);
    if (ghqMatch) {
      return ghqMatch[1];
    }

    return null;
  } catch (e) {
    // Path doesn't exist or can't be resolved
    return null;
  }
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
