/**
 * One budget for every filesystem walk this adapter performs.
 *
 * The walks run on the critical path of `before_agent_start` and again on
 * every `tool_call`, so a walk whose cost scales with the tree above the
 * working directory stalls the whole session. All of them share this type so
 * a bound added here cannot be forgotten on one call path and not the other.
 */

/**
 * Depth. Instruction files live near the top of a tree, so a path this far
 * down is in generated output, a vendored dependency, or a fixture rather
 * than in the guidance a person wrote.
 */
export const MAX_SCAN_DEPTH = 6;

/** Entries, across every directory visited. Bounds wide-and-shallow trees. */
export const MAX_SCAN_ENTRIES = 20_000;

/**
 * Wall clock. The only bound that holds on a filesystem where counting
 * entries is itself slow, such as a network mount or a cold cache.
 */
export const MAX_SCAN_DURATION_MS = 2_000;

export interface ScanBudget {
  entries: number;
  readonly deadline: number;
}

/** Start a budget. One per walk, not one per session. */
export function createScanBudget(): ScanBudget {
  return { entries: 0, deadline: Date.now() + MAX_SCAN_DURATION_MS };
}

export function exhausted(budget: ScanBudget): boolean {
  return budget.entries >= MAX_SCAN_ENTRIES || Date.now() >= budget.deadline;
}

/** Count one entry and report whether the walk may continue. */
export function countEntry(budget: ScanBudget): boolean {
  budget.entries += 1;
  return !exhausted(budget);
}
