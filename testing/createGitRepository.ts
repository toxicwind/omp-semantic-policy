import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/**
 * Create the `.git` directory a real repository would have.
 *
 * `hasGitMarker` deliberately rejects a `.git` entry that only exists, because
 * tools leave stub directories behind and treating a stub as a repository root
 * makes the plugin adopt that whole directory as "the project" and walk all of
 * it. Tests that model a repository have to build a repository, not the stub
 * that caused the bug.
 */
export async function createGitRepository(root: string): Promise<string> {
  const gitDir = join(root, ".git");
  await mkdir(join(gitDir, "objects"), { recursive: true });
  await mkdir(join(gitDir, "refs"), { recursive: true });
  await writeFile(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  return gitDir;
}

/**
 * Model a linked worktree: a `.git` FILE holding a `gitdir:` pointer, exactly
 * as `git worktree add` and submodules produce. The pointed-at directory is
 * created, because a pointer to nothing is not a worktree.
 */
export async function createGitWorktree(worktreeRoot: string, storeRoot: string): Promise<string> {
  const gitDir = join(storeRoot, "git", "worktrees", relative(storeRoot, worktreeRoot));
  await mkdir(join(gitDir, "objects"), { recursive: true });
  await writeFile(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  await writeFile(join(worktreeRoot, ".git"), `gitdir: ${toPosix(relative(worktreeRoot, gitDir))}\n`);
  return gitDir;
}
/**
 * Normalize separators for a `gitdir:` pointer. The value is relative to the
 * worktree, so it must not be resolved against the process working directory.
 */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}