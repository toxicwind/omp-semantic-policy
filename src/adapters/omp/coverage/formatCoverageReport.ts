import { brandPolicyText } from "../policyIdentity.js";

/**
 * How completely a policy surface is enforced.
 *
 * `enforced` means every call on that surface is checked. `dispatch-gated`
 * means the surface is checked at a boundary and not at each nested effect,
 * so a call that fans out into several effects is judged once. `uncovered`
 * means the surface is deliberately outside policy's reach and says why.
 */
export type CoverageState = "enforced" | "dispatch-gated" | "uncovered";

export interface CoverageEntry {
  readonly surface: string;
  readonly state: CoverageState;
  readonly detail: string;
}

/**
 * The enforcement surface of this adapter against the OMP host, by hand.
 *
 * This is a statement about what the host's hook surface can reach, not a
 * runtime measurement: a surface moves between states when OMP's extension
 * contract changes, and nothing in the code can detect that. Keep it
 * reviewed alongside the host's hook list.
 */
export const CURRENT_OMP_COVERAGE: readonly CoverageEntry[] = [
  {
    surface: "Enabled main-session registered tools",
    state: "enforced",
    detail:
      "Tool filters select remote semantic evaluation, not local enforcement. Grounded literal-path protections and incomplete-intent checks run first. Routine glob, lsp (including write to xd://lsp), and inspection tools skip TypeSafe by default.",
  },
  {
    surface: "Broad registered execution",
    state: "dispatch-gated",
    detail:
      "Enabled execution tools are checked at dispatch boundaries, not at each nested effect.",
  },
  {
    surface: "Unrestricted subagents",
    state: "enforced",
    detail:
      "OMP propagates the installed extension into the child runner; configured tool filters still apply.",
  },
  {
    surface: "Restricted subagents",
    state: "dispatch-gated",
    detail:
      "When enabled, the parent task call is checked; OMP removes extensions from the restricted child runner.",
  },
  {
    surface: "Direct user shell and Python",
    state: "enforced",
    detail: "user_bash and user_python are evaluated before direct execution.",
  },
  {
    surface: "OMP utility slash commands",
    state: "uncovered",
    detail:
      "Host-owned utilities bypass policy evaluation so login, model, session, and configuration commands remain usable.",
  },
  {
    surface: "Turn completion workflow",
    state: "enforced",
    detail:
      "session_stop is checked against project-wide workflow rules with at most one continuation.",
  },
  {
    surface: "Restricted child internals",
    state: "uncovered",
    detail:
      "OMP intentionally removes extensions inside restricted children; only parent dispatch is enforceable.",
  },
];

export function formatCoverageReport(entries: readonly CoverageEntry[] = CURRENT_OMP_COVERAGE): string {
  return `${brandPolicyText("OMP coverage")}

${entries.map((entry) => `${entry.state.toUpperCase()}: ${entry.surface}
${entry.detail}`).join("\n\n")}`;
}
