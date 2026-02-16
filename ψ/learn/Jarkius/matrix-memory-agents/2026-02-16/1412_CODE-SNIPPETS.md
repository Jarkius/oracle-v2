# Code Snippets: matrix-memory-agents

**Date:** 2026-02-16
**Source:** `ψ/learn/Jarkius/matrix-memory-agents/origin/`
**Purpose:** Annotated code snippets showing the most important and interesting patterns in this codebase.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Main Entry Point](#main-entry-point)
3. [Core Agent Execution (claude-agent.ts)](#core-agent-execution)
4. [Type System and Interfaces](#type-system-and-interfaces)
5. [Agent Spawner](#agent-spawner)
6. [Oracle Orchestrator](#oracle-orchestrator)
7. [Task Decomposer](#task-decomposer)
8. [Learning Loop](#learning-loop)
9. [Vector DB (ChromaDB integration)](#vector-db)
10. [Matrix Hub (WebSocket cross-project comms)](#matrix-hub)
11. [MCP Server Entry Point](#mcp-server-entry-point)
12. [Key Patterns and Idioms](#key-patterns-and-idioms)

---

## Project Overview

`matrix-memory-agents` is a multi-agent orchestration system for Claude. Key capabilities:

- **Multi-agent spawning** via PTY (tmux panes), each running a real `claude` CLI instance
- **Persistent memory** via SQLite (source of truth) + ChromaDB (semantic search)
- **Intelligent routing** via Oracle Orchestrator: complexity analysis → model tier selection (haiku/sonnet/opus)
- **Cross-project messaging** via Matrix Hub (WebSocket, PIN-authenticated)
- **Learning loop**: automatically extracts learnings from mission output, stores them, and injects them into future task prompts
- **Task decomposition**: breaks complex tasks into subtasks with dependency graphs
- **MCP server** exposes all orchestration tools to Claude Code via Model Context Protocol

Data flow: `MCP Server → Mission Queue → Oracle → Agent Spawner → PTY/tmux → claude CLI → Results → Learning Loop`

---

## Main Entry Point

**File:** `origin/index.ts`

```typescript
// Minimal stub - real entry is src/mcp/server.ts
console.log("Hello via Bun!");
```

The real entry is the MCP server at `src/mcp/server.ts` (see below). The `index.ts` at root is a placeholder.

---

## Core Agent Execution

**File:** `origin/src/claude-agent.ts`

This is the heart of the system - how a sub-agent actually gets its work done.

### Prompt Construction: Layered Context Injection

```typescript
// Build full prompt: CLAUDE.md → Agent Instructions → Agent Status → Relevant Learnings → Shared Context → Task
const claudeMdSection = claudeMd ? `## Project Instructions (CLAUDE.md)\n${claudeMd}\n\n` : '';
fullPrompt = `${claudeMdSection}${agentContext}\n\n${relevantLearnings}${fullPrompt}`;
```

**Why this matters:** The agent receives the full project context at every invocation. Agents are "mirrors of the orchestrator" - they get the same CLAUDE.md, their own status history, and relevant past learnings injected automatically.

### Running Claude CLI as a Sub-agent

```typescript
// Use bypassPermissions to allow autonomous execution without plan mode prompts
const result = await $`claude -p ${fullPrompt} --output-format text --allowedTools ${allowedTools} --permission-mode bypassPermissions`
  .cwd(cwd)
  .text();
```

**Pattern:** Each sub-agent is literally a `claude` CLI invocation. No custom model API - uses Bun's shell template literal `$` to spawn the process. `--permission-mode bypassPermissions` skips interactive confirmation dialogs.

### Allowed Tools List

```typescript
const allowedTools = [
  'WebSearch',   // Internet search capability
  'WebFetch',    // URL fetching
  'Bash',        // Shell commands
  'Read',        // File reading
  'Write',       // File writing
  'Edit',        // File editing
  'Glob',        // File pattern matching
  'Grep',        // Content search
  'mcp__agent-orchestrator__*',  // All MCP orchestrator tools
].join(',');
```

**Pattern:** Sub-agents get the full Claude Code toolset plus access to the orchestrator's MCP tools - enabling agents to spawn their own sub-agents recursively.

### Relevant Learnings Injection

```typescript
async function getRelevantLearnings(taskPrompt: string, agentId: number, limit = 5): Promise<string> {
  // Search with agent scoping - agent's own learnings + shared/public from others
  const results = await searchLearnings(taskPrompt, {
    limit,
    agentId,
    includeShared: true,
  });

  const parts: string[] = ['## Relevant Learnings from Past Sessions'];

  for (let i = 0; i < results.ids[0].length; i++) {
    const distance = results.distances?.[0]?.[i] ?? 1;
    const similarity = 1 - distance;

    // Only include if relevance is above threshold
    if (similarity < 0.5) continue;

    const confidence = metadata?.confidence || 'medium';
    // Marker based on confidence
    const marker = confidence === 'proven' ? '✓' : confidence === 'high' ? '•' : '○';

    // Indicate source: own learnings vs shared
    const sourceIndicator = learningAgentId === agentId
      ? '(yours)'
      : learningAgentId === null
        ? '(orchestrator)'
        : '(shared)';

    parts.push(`${marker} [${category}] ${content} ${sourceIndicator}`);
  }
}
```

**Pattern:** Semantic search (ChromaDB cosine similarity) filters learnings by relevance threshold (>0.5). Visual confidence markers (`✓ • ○`) and source attribution help agents understand which learnings to trust.

### Shared Scratchpad (Agent-to-Agent Communication)

```typescript
export async function writeToScratchpad(agentId: number, message: string) {
  await mkdir(SHARED_DIR, { recursive: true });
  const scratchpadPath = `${SHARED_DIR}/scratchpad.md`;

  const timestamp = new Date().toISOString();
  const entry = `\n## Agent ${agentId} - ${timestamp}\n${message}\n`;

  let existing = "";
  if (existsSync(scratchpadPath)) {
    existing = await readFile(scratchpadPath, "utf-8");
  }

  await writeFile(scratchpadPath, existing + entry);
}
```

**Pattern:** Append-only markdown file as a low-tech but reliable inter-agent communication channel. Timestamp headers enable chronological reading.

---

## Type System and Interfaces

**File:** `origin/src/interfaces/spawner.ts`

### Core Type Definitions

```typescript
export type AgentRole = 'coder' | 'tester' | 'analyst' | 'reviewer' | 'generalist'
  | 'oracle' | 'architect' | 'debugger' | 'researcher' | 'scribe';
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type IsolationMode = 'worktree' | 'shared';

export interface Agent {
  id: number;
  name: string;
  role: AgentRole;
  model: ModelTier;
  status: 'idle' | 'busy' | 'working' | 'error';
  ptyHandle?: PTYHandle;          // Reference to tmux pane
  currentTaskId?: string;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: Date;
  worktreePath?: string;          // For git worktree isolation
  worktreeBranch?: string;
}
```

### Role-to-Model Default Mapping

```typescript
// Role-based model selection - bakes in cost/capability tradeoffs
export const ROLE_MODELS: Record<AgentRole, ModelTier> = {
  oracle: 'opus',        // Orchestration needs deep reasoning
  architect: 'opus',     // Design decisions need deep reasoning
  coder: 'sonnet',       // Balanced for implementation
  analyst: 'sonnet',
  reviewer: 'sonnet',
  tester: 'sonnet',      // upgraded from haiku for better test quality
  debugger: 'sonnet',
  researcher: 'haiku',   // quick lookups, speed matters
  scribe: 'sonnet',      // upgraded from haiku for better documentation
  generalist: 'sonnet',
};
```

**Design Decision:** Default models are opinionated - `oracle` and `architect` always use opus because orchestration correctness matters more than cost. `researcher` uses haiku because speed matters more for lookups.

### Model Selection by Task Priority

```typescript
export function selectModel(task: Task): ModelTier {
  if (task.priority === 'critical' || task.type === 'synthesis') return 'opus';
  if (task.type === 'analysis' || task.type === 'review') return 'sonnet';
  return 'haiku';
}
```

---

## Agent Spawner

**File:** `origin/src/pty/spawner.ts`

### Spawning an Agent in tmux

```typescript
async spawnAgent(config?: AgentConfig): Promise<Agent> {
  const cfg = { ...DEFAULT_AGENT_CONFIG, ...config };

  // Use role-based model if no explicit model specified
  if (config?.role && !config?.model) {
    cfg.model = ROLE_MODELS[cfg.role!];
  }

  // Share task list across all agents for visibility (Ctrl+T to see all agent tasks)
  const sharedTaskListId = process.env.CLAUDE_CODE_TASK_LIST_ID ||
    `${process.env.PROJECT_NAME || 'agent-orchestra'}-shared`;

  const ptyHandle = await this.ptyManager.spawn(agentId, {
    cwd: cfg.cwd,
    env: {
      ...cfg.env,
      AGENT_ROLE: cfg.role!,
      AGENT_MODEL: cfg.model!,
      AGENT_SYSTEM_PROMPT: cfg.systemPrompt || ROLE_PROMPTS[cfg.role!],
      CLAUDE_CODE_TASK_LIST_ID: sharedTaskListId,  // Shared task visibility
    },
    ...
  });
}
```

**Pattern:** Role and model are passed as environment variables into each agent's shell session. `CLAUDE_CODE_TASK_LIST_ID` is shared across all agents so Claude Code's task list UI shows all agent work in one view.

### Load Balancing

```typescript
getLeastBusyAgent(): Agent | null {
  const agents = Array.from(this.agents.values());
  if (agents.length === 0) return null;

  // Sort by tasks completed (proxy for busyness), then status
  return agents.sort((a, b) => {
    if (a.status === 'idle' && b.status !== 'idle') return -1;
    if (b.status === 'idle' && a.status !== 'idle') return 1;
    return (a.tasksCompleted + a.tasksFailed) - (b.tasksCompleted + b.tasksFailed);
  })[0] || null;
}
```

**Pattern:** Sort by status first (idle > busy), then by total task count as a proxy for utilization. Simple but effective load balancing without needing real-time CPU/memory metrics.

### Specialist Routing

```typescript
getAvailableAgent(taskType?: string): Agent | null {
  const available = Array.from(this.agents.values())
    .filter(a => a.status === 'idle' && !a.currentTaskId);

  if (taskType) {
    const roleMap: Record<string, AgentRole> = {
      'extraction': 'researcher',
      'analysis': 'analyst',
      'synthesis': 'oracle',
      'review': 'reviewer',
      'testing': 'tester',
      'coding': 'coder',
      'debugging': 'debugger',
    };

    const preferredRole = roleMap[taskType];
    if (preferredRole) {
      const specialist = available.find(a => a.role === preferredRole);
      if (specialist) return specialist;
    }
  }

  // Return first available (fallback)
  return available[0] || null;
}
```

**Pattern:** Task type → preferred role mapping. Always tries specialist first, falls back to any available agent. Clean separation of routing logic from spawning.

### Spawning a Pool

```typescript
async spawnPool(count: number, template?: AgentConfig): Promise<Agent[]> {
  const agents: Agent[] = [];

  for (let i = 0; i < count; i++) {
    const agent = await this.spawnAgent(template);
    agents.push(agent);
    // Small delay to prevent tmux overwhelm
    await new Promise(r => setTimeout(r, 500));
  }

  return agents;
}
```

**Pattern:** 500ms delay between agent spawns prevents tmux from being overwhelmed by rapid pane creation. Simple throttle instead of a complex queue.

---

## Oracle Orchestrator

**File:** `origin/src/oracle/orchestrator.ts`

This is the intelligence layer. The Oracle analyzes workload and makes spawn/retire/reassign decisions.

### Task Complexity Analysis by Signal Detection

```typescript
analyzeTaskComplexity(prompt: string, context?: string): TaskComplexity {
  const fullText = `${prompt} ${context || ''}`.toLowerCase();

  // Complex signals → Opus
  const complexSignals = [
    { pattern: /architect|design.*system|design.*pattern/i, signal: 'architecture' },
    { pattern: /refactor.*multiple|cross.?file|multi.?file/i, signal: 'multi-file-refactor' },
    { pattern: /implement.*from.*scratch|build.*new.*system/i, signal: 'greenfield-implementation' },
    { pattern: /optimize.*algorithm|performance.*critical/i, signal: 'algorithm-optimization' },
    { pattern: /security.*audit|vulnerability.*analysis/i, signal: 'security-analysis' },
    { pattern: /debug.*complex|investigate.*intermittent|debug.*flaky|debug.*race/i, signal: 'complex-debugging' },
    { pattern: /design.*decision|trade.?off.*analysis/i, signal: 'design-decision' },
  ];

  // Moderate signals → Sonnet (implementation, bug-fix, testing)
  // Simple signals → Haiku (read-file, search, rename, format)

  for (const { pattern, signal } of complexSignals) {
    if (pattern.test(fullText)) signals.push(signal);
  }

  if (signals.length > 0) {
    return {
      tier: 'complex',
      recommendedModel: 'opus',
      reasoning: `Task requires deep reasoning: ${signals.join(', ')}`,
      signals,
    };
  }
  // ... (similar for moderate and simple)
}
```

**Pattern:** Pure regex signal detection, no LLM call needed for complexity classification. Priority order: complex checks first, then moderate, then simple, then default to sonnet. Each matched signal is recorded for explainability in the `reasoning` field.

### Proactive Spawning: 4 Trigger Conditions

```typescript
evaluateProactiveSpawning(): ProactiveSpawnDecision[] {
  const decisions: ProactiveSpawnDecision[] = [];
  const analysis = this.analyzeWorkload();
  const queuedMissions = this.queue.getByStatus('queued');

  // Trigger 1: Queue growing fast with no idle agents
  if (growthRate > this.spawnTriggers.queueGrowthRate && analysis.idleAgents === 0) {
    decisions.push({
      shouldSpawn: true,
      reason: `Queue growing at ${growthRate.toFixed(1)} tasks/min with no idle agents`,
      suggestedRole: 'generalist',
      suggestedModel: 'sonnet',
      urgency: 'immediate',
    });
  }

  // Trigger 2: Queue depth threshold with no idle for specific roles
  for (const [role, need] of Object.entries(roleNeed)) {
    if (need >= this.spawnTriggers.queueDepthThreshold) {
      const idleInRole = ...;
      if (idleInRole === 0) {
        decisions.push({ urgency: need > 10 ? 'immediate' : 'soon', ... });
      }
    }
  }

  // Trigger 3: Complex tasks waiting but no opus agents available
  if (complexTasksWaiting >= this.spawnTriggers.taskComplexityBacklog) {
    if (opusAgentsIdle === 0) {
      decisions.push({ suggestedModel: 'opus', urgency: 'immediate', ... });
    }
  }

  // Trigger 4: Maintain minimum idle agents per active role
  for (const role of activeRoles) {
    if (idleInRole < this.spawnTriggers.idleAgentMinimum) {
      decisions.push({ urgency: 'optional', ... });
    }
  }

  return decisions;
}
```

**Pattern:** Multiple orthogonal trigger conditions evaluated independently. Urgency levels (`immediate`, `soon`, `optional`) allow downstream filtering - auto-execution only handles `immediate` and `soon`, skipping `optional`.

### Queue Growth Rate Calculation

```typescript
getQueueGrowthRate(): number {
  if (this.queueHistory.length < 2) return 0;

  const oldest = this.queueHistory[0]!;
  const newest = this.queueHistory[this.queueHistory.length - 1]!;

  const timeDiffMs = newest.timestamp - oldest.timestamp;
  if (timeDiffMs < 1000) return 0; // Need at least 1 second of data

  const depthDiff = newest.depth - oldest.depth;
  const timeDiffMinutes = timeDiffMs / 60000;

  return depthDiff / timeDiffMinutes;
}

// Rolling 2-minute window
recordQueueSnapshot(): void {
  const now = Date.now();
  this.queueHistory.push({ timestamp: now, depth: this.queue.getQueueLength() });

  // Prune old history
  this.queueHistory = this.queueHistory.filter(
    s => now - s.timestamp < this.HISTORY_WINDOW_MS // 120000ms
  );
}
```

**Pattern:** Simple sliding window rate calculation. Rolling 2-minute window prevents stale data from affecting decisions. The `timeDiffMs < 1000` guard prevents division-by-zero and noise from rapid sampling.

### Priority Escalation (Anti-Starvation)

```typescript
optimizeMissionQueue(): PriorityAdjustment[] {
  for (const mission of missions) {
    const ageMinutes = (now - mission.createdAt.getTime()) / 60000;

    // Age-based escalation
    if (mission.priority === 'low' && ageMinutes > 30) {
      suggestedPriority = 'normal';
      reason = `Mission waiting ${ageMinutes.toFixed(0)}min, escalating from low`;
    } else if (mission.priority === 'normal' && ageMinutes > 60) {
      suggestedPriority = 'high';
      reason = `Mission waiting ${ageMinutes.toFixed(0)}min, escalating from normal`;
    }

    // Critical path escalation: if this unblocks many others, elevate it
    const dependentCount = this.countDependents(mission.id, missions);
    if (dependentCount >= 3 && mission.priority !== 'critical') {
      suggestedPriority = 'critical';
      reason = `Unblocks ${dependentCount} other missions`;
    }

    // Flaky mission de-escalation
    if (mission.retryCount >= 2 && mission.priority !== 'low') {
      suggestedPriority = 'low';
      reason = `${mission.retryCount} retries, reducing priority to avoid blocking`;
    }
  }
}
```

**Pattern:** Three orthogonal priority adjustment rules - age escalation (anti-starvation), critical path elevation, and flaky mission de-escalation. Produces `PriorityAdjustment[]` for review before applying, rather than mutating directly.

### Workload Analysis with Utilization Normalization

```typescript
analyzeWorkload(): WorkloadAnalysis {
  const agentMetrics = agents.map(agent => {
    const total = agent.tasksCompleted + agent.tasksFailed;
    const successRate = total > 0 ? agent.tasksCompleted / total : 0;
    return { ...agent, successRate, utilizationScore: 0 }; // normalized below
  });

  // Normalize utilization scores (0-1 relative to most-used agent)
  const maxTasks = Math.max(...agentMetrics.map(m => m.tasksCompleted + m.tasksFailed), 1);
  agentMetrics.forEach(m => {
    m.utilizationScore = (m.tasksCompleted + m.tasksFailed) / maxTasks;
  });
}
```

**Pattern:** Relative normalization rather than absolute thresholds. The most active agent gets score 1.0, all others are relative to it. Avoids hardcoded "overloaded if >N tasks" which would break with different workload scales.

### Dependency Depth Calculation (Cycle-Safe)

```typescript
private calculateDependencyDepth(
  missionId: string,
  missions: Mission[],
  visited = new Set<string>()  // Cycle detection
): number {
  if (visited.has(missionId)) return 0;  // Break cycles
  visited.add(missionId);

  const mission = missions.find(m => m.id === missionId);
  if (!mission?.dependsOn || mission.dependsOn.length === 0) return 0;

  let maxDepth = 0;
  for (const depId of mission.dependsOn) {
    const depth = this.calculateDependencyDepth(depId, missions, visited);
    maxDepth = Math.max(maxDepth, depth + 1);
  }

  return maxDepth;
}
```

**Pattern:** Recursive DFS with a `visited` set passed by reference for cycle detection. Returns max depth in the dependency tree - used to find missions blocking many others via deep chains.

---

## Task Decomposer

**File:** `origin/src/oracle/task-decomposer.ts`

### LLM-Powered Decomposition with Fallback

```typescript
async decompose(task: string, context?: string): Promise<DecomposedTask> {
  const oracle = getOracleOrchestrator();
  const complexity = oracle.analyzeTaskComplexity(task, context);

  // Simple tasks don't need decomposition
  if (complexity.tier === 'simple') {
    return this.createSingleTaskPlan(task, complexity.recommendedModel);
  }

  // Try LLM decomposition first
  if (this.llm) {
    try {
      return await this.decomposeWithLLM(task, context);
    } catch (error) {
      console.error(`[TaskDecomposer] LLM decomposition failed: ${error}`);
    }
  }

  // Fallback to heuristic decomposition
  return this.decomposeWithHeuristics(task, context);
}
```

**Pattern:** Three-tier strategy: early exit for simple tasks, LLM with graceful fallback, heuristic rules as last resort. Never throws - always returns a usable plan.

### Structured LLM Prompt for JSON Decomposition

```typescript
private buildDecompositionPrompt(task: string, context?: string): string {
  return `You are a task decomposition expert for a multi-agent system. Break down the following task...

## Agent Roles Available
- coder: Implementation, coding
- tester: Writing tests, QA
...

## Model Tiers
- haiku: Simple tasks
- sonnet: Standard tasks
- opus: Complex tasks

## Guidelines
1. Each subtask should be completable by a single agent
2. Identify dependencies between subtasks
...

Respond in this exact JSON format:
{
  "subtasks": [
    {
      "id": "task_1",
      "prompt": "...",
      "recommendedRole": "role_name",
      "recommendedModel": "model_tier",
      "dependsOn": [],
      "estimatedComplexity": "simple|moderate|complex"
    }
  ],
  "executionOrder": "sequential|parallel|mixed",
  "totalEstimatedComplexity": "..."
}`;
}
```

**Pattern:** Prompt engineering for reliable JSON output - lists all valid enum values directly in prompt, provides exact JSON schema, temperature=0.3 for deterministic output.

### JSON Response Parsing with Validation

```typescript
private parseDecompositionResponse(response: string, originalTask: string): DecomposedTask {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);  // Extract JSON from mixed output
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    const subtasks = (parsed.subtasks || [])
      .slice(0, this.config.maxSubtasks)  // Enforce max subtasks limit
      .map((s: any, i: number) => ({
        id: s.id || `task_${i + 1}`,
        prompt: s.prompt || originalTask,
        recommendedRole: this.validateRole(s.recommendedRole),    // Type-safe validation
        recommendedModel: this.validateModel(s.recommendedModel),
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn : [],
        estimatedComplexity: this.validateComplexity(s.estimatedComplexity),
      }));
  } catch (error) {
    return this.decomposeWithHeuristics(originalTask);  // Fallback on parse failure
  }
}
```

**Pattern:** Regex extraction of JSON from potentially messy LLM output. Each field goes through a validator that returns a safe default. Max subtasks enforced at parse time, not just in the prompt.

---

## Learning Loop

**File:** `origin/src/learning/loop.ts`

### Category Detection by Keyword Scoring

```typescript
const CATEGORY_KEYWORDS: Record<LearningCategory, string[]> = {
  performance: ['fast', 'slow', 'optimize', 'cache', 'memory', 'latency', 'throughput'],
  architecture: ['design', 'structure', 'pattern', 'layer', 'module', 'component', 'system'],
  tooling: ['tool', 'cli', 'config', 'setup', 'install', 'dependency', 'build'],
  debugging: ['bug', 'fix', 'error', 'issue', 'debug', 'trace', 'log'],
  // ... more categories
};

private detectCategory(text: string): LearningCategory {
  const lower = text.toLowerCase();
  let bestCategory: LearningCategory = 'insight';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as LearningCategory;
    }
  }

  return bestCategory;
}
```

**Pattern:** Bag-of-words keyword scoring for category classification. Simple, fast, no LLM needed. `insight` is the default fallback category.

### Insight Extraction from Mission Output

```typescript
private extractInsights(output: string): string[] {
  const insights: string[] = [];

  const patterns = [
    /(?:learned|discovered|realized|found that|key insight|important)[:.]?\s*(.+?)(?:\.|$)/gi,
    /(?:best practice|recommendation|tip)[:.]?\s*(.+?)(?:\.|$)/gi,
    /(?:should|must|always|never)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of patterns) {
    const matches = output.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 20 && match[1].length < 300) {
        insights.push(match[1].trim());
      }
    }
  }

  // Deduplicate and limit
  return [...new Set(insights)].slice(0, 5);
}
```

**Pattern:** Regex patterns target common "learning announcement" phrases. Length filtering (20-300 chars) keeps insights actionable - filters out single words and full paragraphs. `Set` deduplication before slicing.

### Confidence Decay

```typescript
async autoValidateFromUsage(): Promise<{ validated: number; decayed: number }> {
  for (const learning of learnings) {
    if (learning.confidence === 'proven') continue; // Proven learnings don't decay

    const daysSinceUpdate = (Date.now() - new Date(learning.updated_at || learning.created_at).getTime())
      / (1000 * 60 * 60 * 24);

    // Decay very old low-confidence learnings
    if (learning.confidence === 'low' && daysSinceUpdate > 30) {
      decayed++;
    }
  }
}
```

**Pattern:** Conservative decay - only `low` confidence learnings older than 30 days are marked for decay. `proven` learnings are immune. This prevents valuable institutional knowledge from disappearing.

### Agent Recommendation by Historical Success Rate

```typescript
async recommendAgent(task: { prompt: string; type?: string }): Promise<AgentRecommendation> {
  const similarLearnings = await searchLearnings(task.prompt, { limit: 10 });

  // Count which agents succeeded with similar tasks
  const agentScores: Record<number, { success: number; total: number }> = {};

  for (const learning of similarLearnings) {
    if (record.confidence === 'proven' || record.confidence === 'high') {
      agentScores[record.agent_id].success++;
    }
  }

  // Score = success_rate * log(total_tasks)
  // Rewards both high accuracy AND experience
  const score = successRate * Math.log(scores.total + 1);
}
```

**Pattern:** `score = success_rate * log(experience)` - Wilson score variant. A new agent with 100% on 2 tasks scores lower than a veteran with 80% on 20 tasks. `log` dampens the experience factor to avoid extreme bias.

---

## Vector DB

**File:** `origin/src/vector-db.ts`

### Adaptive Chunking by Content Category

```typescript
export function getAdaptiveChunkParams(
  content: string,
  category?: string
): { chunkSize: number; overlap: number } {
  const isCodeHeavy = content.includes('```') ||
    content.includes('function ') ||
    content.includes('const ') ||
    content.includes('class ') ||
    (content.match(/\n {2,}/g)?.length ?? 0) > 5; // Indented blocks

  if (category === 'debugging' || category === 'tooling' || isCodeHeavy) {
    return { chunkSize: 300, overlap: 50 };  // Precise, small chunks
  }

  if (category === 'philosophy' || category === 'principle' || category === 'retrospective') {
    return { chunkSize: 800, overlap: 150 }; // Large chunks preserve context
  }

  if (category === 'architecture' || category === 'process' || category === 'pattern') {
    return { chunkSize: 600, overlap: 120 }; // Medium-large for structure context
  }

  return { chunkSize: 500, overlap: 100 }; // Default: balanced
}
```

**Pattern:** Content-aware chunking - code needs small precise chunks, philosophical content needs larger context windows. Heuristic detection (`isCodeHeavy`) handles categories that aren't explicitly set.

### Semantic Boundary-Aware Chunking

```typescript
export function chunkContent(content: string, chunkSize = 500, overlap = 100): string[] {
  const breakPoints = [
    '\n\n',      // Paragraphs (highest priority)
    '\n```',     // Code blocks
    '\n## ',     // Markdown H2
    '\n### ',    // Markdown H3
    '\n- ',      // List items
    '\n',        // Lines
    '. ',        // Sentences
    '! ',
    '? ',
    '; ',
  ];

  while (start < content.length) {
    let end = Math.min(start + chunkSize, content.length);

    if (end < content.length) {
      for (const bp of breakPoints) {
        const lastBreak = content.lastIndexOf(bp, end);
        // Only use break point if it's in the valid range (past 40% of chunk)
        if (lastBreak > start + chunkSize * 0.4) {
          end = lastBreak + bp.length;
          break;
        }
      }
    }

    chunks.push(content.slice(start, end).trim());
    start = Math.max(end - overlap, start + 1); // Always advance at least 1 char

    if (chunks.length >= 200) break; // Safety cap
  }
}
```

**Pattern:** Tries to break at semantic boundaries (paragraph, code block, header, list item) rather than mid-sentence. The "past 40% of chunk" rule prevents tiny chunks at the start. Safety cap at 200 chunks prevents runaway processing.

### Embedding Batcher (Non-Blocking Write Queue)

```typescript
class EmbeddingBatcher {
  private batch: BatchItem[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  add(item: BatchItem): void {
    this.batch.push(item);

    // Start timer on first item
    if (this.batch.length === 1 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), BATCH_TIMEOUT_MS); // 1000ms
    }

    // Flush immediately if batch is full (20 items)
    if (this.batch.length >= BATCH_SIZE) {
      this.flush();
    }
  }
}

// Singleton write queue - prevents concurrent ChromaDB corruption
const writeQueue = new PQueue({ concurrency: 1 });
```

**Pattern:** Classic debounce batcher - accumulates writes, flushes on size limit (20) or timeout (1s). Outer `PQueue` with concurrency=1 serializes all writes to prevent ChromaDB corruption. Non-blocking `add()` allows hot paths to continue.

### Circuit Breaker with Exponential Backoff

```typescript
let consecutiveFailures = 0;
let circuitBroken = false;
let circuitBrokenAt = 0;
const CIRCUIT_BREAK_THRESHOLD = 3;
const CIRCUIT_TIMEOUT_MS = 60000; // 1 minute recovery window

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  throwOnFailure = false,
  operationTimeoutMs = DEFAULT_OPERATION_TIMEOUT_MS
): Promise<T | null> {
  // Fast-fail if circuit is broken
  if (circuitBroken) {
    if (Date.now() - circuitBrokenAt < CIRCUIT_TIMEOUT_MS) {
      console.error(`[VectorDB] ${operationName} skipped - circuit breaker open`);
      return null;
    }
    // Reset circuit after timeout
    circuitBroken = false;
    consecutiveFailures = 0;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await operation();
      consecutiveFailures = 0; // Reset on success
      return result;
    } catch (error) {
      const isRetryable = errorMsg.includes('compaction') ||
                          errorMsg.includes('timeout') ||
                          errorMsg.includes('connection') ||
                          errorMsg.includes('econnrefused');

      if (!isRetryable || attempt === MAX_RETRIES - 1) break;

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
    circuitBroken = true;
    circuitBrokenAt = Date.now();
  }

  return throwOnFailure ? (throw lastError) : null;
}
```

**Pattern:** Circuit breaker pattern - after 3 consecutive failures, all operations fast-fail for 60 seconds to give the system time to recover. Retryable errors (network/timeout) get exponential backoff; logic errors get immediate failure.

### HNSW Tuning for Better Recall

```typescript
const hnswMetadata = {
  "hnsw:space": "cosine",
  "hnsw:construction_ef": 200,  // More neighbors during build (better quality, slower build)
  "hnsw:M": 32,                 // More connections per node (better recall, more memory)
  "hnsw:search_ef": 50,         // More neighbors during search (better accuracy, slower query)
};
```

**Pattern:** ChromaDB HNSW parameters tuned for quality over speed - this is a memory system where recall matters more than throughput. Default ChromaDB settings optimize for speed; these sacrifice some query speed for significantly better semantic matching.

### Auto-Link: Similarity Thresholds

```typescript
export async function findSimilarSessions(content: string, ...): Promise<AutoLinkResult> {
  for (let i = 0; i < ids.length; i++) {
    const similarity = 1 - distance; // ChromaDB returns distance (lower = more similar)

    if (similarity > 0.85) {
      autoLinked.push({ id, similarity });   // Auto-link: very similar
    } else if (similarity > 0.70) {
      suggested.push({ id, similarity });    // Suggest: somewhat similar
    }
    // Below 0.70: ignored
  }
}
```

**Pattern:** Two-tier similarity thresholds - auto-link at >0.85 (nearly identical content), suggest at >0.70 (related content). Makes ChromaDB distance scores human-readable by converting to similarity (1 - distance).

---

## Matrix Hub

**File:** `origin/src/matrix-hub.ts`

### PIN Authentication for WebSocket Access

```typescript
function generateRandomPin(): string {
  // 6-character alphanumeric PIN (uppercase for readability)
  return randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
}

let hubPin = pinDisabled ? '' : (process.env.MATRIX_HUB_PIN || generateRandomPin());

// /register endpoint validates PIN before issuing connection token
if (!pinDisabled) {
  if (!pin || pin !== hubPin) {
    return new Response(JSON.stringify({
      error: 'Invalid or missing PIN',
      hint: 'Check the hub console for the PIN, or set MATRIX_HUB_PIN in your environment'
    }), { status: 401 });
  }
}
```

**Pattern:** PIN displayed on hub startup console, like WiFi password. Tokens are deterministic (SHA-256 of matrixId + secret) for stable reconnection, but the PIN gates initial registration. Useful security model for LAN/same-machine multi-project setups.

### Deterministic Token Generation

```typescript
export function generateMatrixToken(matrixId: string): string {
  // Generate deterministic token based on matrix ID and secret
  // This allows reconnection with same token if matrix ID is known
  const token = createHash('sha256')
    .update(matrixId + HUB_SECRET)
    .digest('hex');

  matrixTokens.set(token, {
    token,
    matrixId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
  });

  return token;
}
```

**Pattern:** Deterministic token from `SHA256(matrixId + secret)` means a reconnecting matrix gets the same token - no need to re-authenticate. Token expiry is still enforced (default 2h).

### Grace Period on Reconnection

```typescript
websocket: {
  open(ws) {
    const existing = connectedMatrices.get(matrixId);
    if (existing && existing.ws !== ws) {
      // Grace period: wait 2 seconds before closing old connection
      const oldWs = existing.ws;
      setTimeout(() => {
        try {
          if (oldWs.readyState === 1) { // OPEN
            oldWs.close(1000, 'Replaced by new connection');
          }
        } catch {}
      }, 2000);
    }
    // Register new connection immediately
    connectedMatrices.set(matrixId, { ws, matrixId, ... });
  }
}
```

**Pattern:** 2-second grace period on reconnection prevents message loss during network blips. New connection is registered immediately; old connection is closed after 2s if still open. `readyState === 1` check prevents double-close errors.

### Heartbeat with Dead Connection Detection

```typescript
heartbeatInterval = setInterval(() => {
  const now = new Date();

  for (const [matrixId, conn] of connectedMatrices) {
    // Check for dead connections (no pong in 30s)
    if (now.getTime() - conn.lastPing.getTime() > HEARTBEAT_TIMEOUT_MS) {
      console.log(`[Hub] Matrix ${matrixId} timed out, disconnecting`);
      try { conn.ws.close(1000, 'Ping timeout'); } catch {}
      connectedMatrices.delete(matrixId);
      updateMatrixStatus(matrixId, 'offline');
      notifyPresenceChange(matrixId, 'offline', conn.displayName);
      continue;
    }

    // Send ping
    try {
      conn.ws.send(JSON.stringify({ type: 'ping' }));
    } catch {
      connectedMatrices.delete(matrixId);
    }
  }
}, HEARTBEAT_INTERVAL_MS); // 10 second interval
```

**Pattern:** Active heartbeat sends ping every 10s, disconnects after 30s without response. The try/catch around `ws.close()` and `ws.send()` prevents crashes from already-closed connections. Presence notifications broadcast disconnect to other matrices.

### Type-Safe Message Discriminated Unions

```typescript
// Hub → Matrix messages
type HubToMatrixMessage =
  | { type: 'registered'; matrix_id: string; online_matrices: string[] }
  | { type: 'message'; from: string; content: string; timestamp: string; metadata?: Record<string, any> }
  | { type: 'presence'; matrix_id: string; status: MatrixStatus; display_name?: string }
  | { type: 'ping' }
  | { type: 'error'; code: string; message: string };

// Matrix → Hub messages
type MatrixToHubMessage =
  | { type: 'message'; to?: string; content: string; metadata?: Record<string, any> }
  | { type: 'pong'; matrix_id: string }
  | { type: 'ping' }
  | { type: 'presence'; status: 'online' | 'away' };
```

**Pattern:** Full TypeScript discriminated unions for both directions of the WebSocket protocol. Exhaustive type checking catches missing message type handlers at compile time.

---

## MCP Server Entry Point

**File:** `origin/src/mcp/server.ts`

### Graceful Startup with Non-Blocking Fallbacks

```typescript
async function main() {
  // Health check (non-blocking)
  try {
    const startupHealth = await checkStartupHealth();
    const warning = formatStartupWarning(startupHealth);
    if (warning) console.error(warning);
  } catch {
    // Don't block startup if health check fails
  }

  // ChromaDB auto-start
  if (process.env.SKIP_VECTORDB !== "true") {
    try {
      const health = await initVectorDBWithAutoStart();
      console.error(`[MCP] ChromaDB: ${health.chromadb.status}`);
    } catch (error) {
      console.error(`[MCP] Warning: Vector DB init failed: ${error}`);
      console.error("[MCP] Continuing without semantic search...");
    }
  }

  // WebSocket server for real-time agent communication
  if (process.env.SKIP_WEBSOCKET !== "true") {
    try {
      startWsServer(wsPort);
    } catch (error) {
      console.error("[MCP] Continuing without real-time delivery...");
    }
  }

  // Matrix hub connection
  if (process.env.SKIP_MATRIX_HUB !== "true") {
    try {
      const connected = await connectToHub(hubUrl);
      if (connected) {
        onMessage((msg) => {
          console.error(`[MCP] Message from ${msg.from}: ${msg.content.substring(0, 100)}`);
        });
      } else {
        console.error(`[MCP] Matrix hub: not available, using SQLite fallback`);
      }
    } catch { ... }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

**Pattern:** Every optional service has its own try/catch with graceful degradation. `SKIP_*` environment variables allow selectively disabling components for testing or restricted environments. The system starts even if ChromaDB, WebSocket, and Matrix Hub all fail.

### Tool Dispatch Pattern

```typescript
// All tools registered in allTools/allHandlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = allHandlers[name];

  if (!handler) {
    return errorResponse(`Unknown tool: ${name}`);
  }

  try {
    return await handler(args);
  } catch (error) {
    // Handle Zod validation errors nicely
    if (error && typeof error === 'object' && 'issues' in error) {
      const issues = (error as any).issues;
      const messages = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`);
      return errorResponse(`Validation error:\n${messages.join('\n')}`);
    }
    return errorResponse(error instanceof Error ? error.message : String(error));
  }
});
```

**Pattern:** Handler registry pattern - `allHandlers` is a `Record<toolName, handlerFn>`. Centralized Zod validation error handling surfaces field-level errors in a readable format.

---

## Key Patterns and Idioms

### 1. Singleton with Lazy Initialization

Used consistently throughout:

```typescript
let instance: OracleOrchestrator | null = null;

export function getOracleOrchestrator(): OracleOrchestrator {
  if (!instance) {
    instance = new OracleOrchestrator();
  }
  return instance;
}
```

Seen in: `OracleOrchestrator`, `AgentSpawner`, `LearningLoop`, `TaskDecomposer`, `PTYManager`.

### 2. Backward-Compatible Function Signatures

```typescript
export async function searchLearnings(
  query: string,
  limitOrOptions: number | LearningSearchOptions = 5,  // Accepts both old and new API
  category?: string
): Promise<SearchResult> {
  const options = typeof limitOrOptions === 'number'
    ? { limit: limitOrOptions, category }
    : limitOrOptions;
  // ...
}
```

Used to evolve APIs without breaking existing callers.

### 3. SQLite as Source of Truth, ChromaDB as Index

```typescript
// Pattern throughout: write to SQLite first (durable), then embed to ChromaDB (searchable)
const learningId = createLearning({ ... }); // SQLite
const learning = getLearningById(learningId); // SQLite read-back
await saveLearning(learningId, title, description, metadata); // ChromaDB index

// Rebuild from SQLite when ChromaDB goes stale
export async function rebuildFromSqlite(): Promise<RebuildProgress> {
  const learnings = listLearningsFromDb({ limit: 10000 });
  // Re-embed all records...
}
```

**Pattern:** "Dual write, SQLite-first" - SQLite is authoritative, ChromaDB is a semantic index that can be rebuilt. This means data is never lost if ChromaDB fails or gets corrupted.

### 4. Never-Throw in Embedding Paths

```typescript
// Embedding is non-critical - silently fail
async function withRetry<T>(operation, operationName, throwOnFailure = false) {
  // ...
  return throwOnFailure ? (throw lastError) : null;
}
```

The `throwOnFailure` flag defaults to `false` for most embedding operations - the system continues working without semantic search.

### 5. Collection-Prefixed ChromaDB Collections

```typescript
function getCollectionPrefix(): string {
  const prefix = process.env.CHROMADB_PREFIX || basename(process.cwd());
  return prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Collections: `agent-orchestra_task_prompts`, `agent-orchestra_learnings`, etc.
```

**Pattern:** Multiple projects can share a single ChromaDB container. Prefix isolates each project's data without needing separate containers.

### 6. Error Handling in shell.ts

```typescript
export function isValidEnvVarName(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

export function buildEnvAssignment(key: string, value: string): string {
  // Escape for shell safety - prevents injection via env vars
  const escaped = escapeShellPath(value);
  return `export ${key}=${escaped}`;
}
```

**Pattern:** Env var name validation before injecting into shell commands - prevents injection attacks via malicious key names like `A=B; rm -rf`.

---

*End of code snippets document.*
