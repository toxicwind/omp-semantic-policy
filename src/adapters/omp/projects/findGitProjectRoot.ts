import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Resolve the nearest enclosing Git worktree without crossing realpath boundaries. */
export async function findGitProjectRoot(startPath: string): Promise<string | undefined> {
  const resolvedStart = await realpath(startPath);
  const startStats = await stat(resolvedStart);
  let current = startStats.isDirectory() ? resolvedStart : dirname(resolvedStart);

  for (;;) {
    if (await hasGitMarker(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * Report whether `directory` is the root of a real Git worktree.
 *
 * The existence of a `.git` entry is not enough. Tools leave stub directories
 * behind (a `.git` holding only `hooks/` is common), and treating one as a
 * repository root makes this plugin adopt that whole directory as "the
 * project" and walk all of it on every onboarding pass. A stub at a home
 * directory turns that into a multi-gigabyte scan, so require the two entries
 * Git itself cannot operate without.
 */
export async function hasGitMarker(directory: string): Promise<boolean> {
  const markerPath = join(directory, ".git");
  let marker;
  try {
    marker = await lstat(markerPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }

  if (marker.isFile()) {
    return await isGitdirPointer(markerPath);
  }
  if (!marker.isDirectory()) {
    return false;
  }
  return (await exists(join(markerPath, "HEAD"))) && (await exists(join(markerPath, "objects")));
}

/** Resolve a `gitdir: <path>` worktree pointer, as used by submodules and worktrees. */
async function isGitdirPointer(markerPath: string): Promise<boolean> {
  let contents: string;
  try {
    contents = await readFile(markerPath, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
  const target = /^gitdir:\s*(.+?)\s*$/m.exec(contents)?.[1];
  if (target === undefined) {
    return false;
  }
  return exists(resolve(dirname(markerPath), target));
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
