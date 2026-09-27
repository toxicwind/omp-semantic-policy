import { createGitRepository, createGitWorktree } from "../../../../testing/createGitRepository.js";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { discoverProjectInstructionSources, findGitProjectRoot } from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Git project identity and instruction discovery", () => {
  test("selects the nearest canonical worktree through a symlink", async () => {
    const fixture = await createFixture();
    const outerRoot = join(fixture, "outer");
    const nestedRoot = join(outerRoot, "packages", "nested");
    await createGitRepository(outerRoot);
    await mkdir(join(nestedRoot, "src"), { recursive: true });
    await createGitWorktree(nestedRoot, outerRoot);
    const linkedRoot = join(fixture, "linked-nested");
    await symlink(nestedRoot, linkedRoot);

    expect(await findGitProjectRoot(join(linkedRoot, "src"))).toBe(await realpath(nestedRoot));
  });

  test("stays inside the root and excludes nested repositories and symlinks", async () => {
    const fixture = await createFixture();
    const root = join(fixture, "project");
    await createGitRepository(root);
    await mkdir(join(root, "packages", "api"), { recursive: true });
    await mkdir(join(root, "packages", "nested"), { recursive: true });
    await createGitRepository(join(root, "packages", "nested"));
    await mkdir(join(root, "node_modules", "dependency"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "Root rule\n");
    await writeFile(join(root, "packages", "api", "CLAUDE.md"), "API rule\n");
    await writeFile(join(root, "packages", "nested", "AGENTS.md"), "Nested rule\n");
    await writeFile(join(root, "node_modules", "dependency", "AGENTS.md"), "Dependency rule\n");
    await writeFile(join(fixture, "outside.md"), "Outside rule\n");
    await symlink(join(fixture, "outside.md"), join(root, "packages", "linked-AGENTS.md"));

    const sources = await discoverProjectInstructionSources(root);
    const canonicalRoot = await realpath(root);

    expect(sources.map((source) => relative(canonicalRoot, source.path))).toEqual([
      "AGENTS.md",
      join("packages", "api", "CLAUDE.md"),
    ]);
    expect(sources.map((source) => source.kind)).toEqual(["project", "subtree"]);
    expect(sources[1]?.scopeRoot).toBe(join(canonicalRoot, "packages", "api"));
  });

  test("does not adopt an ancestor whose .git is a stub", async () => {
    const fixture = await createFixture();
    const ancestor = join(fixture, "ancestor");
    const project = join(ancestor, "code");
    await mkdir(project, { recursive: true });
    // Exactly the shape a tool leaves behind: a .git holding only hooks/, with
    // no repository anywhere below it. This is what made a home directory
    // look like a project root and sent the walk over the whole tree.
    await mkdir(join(ancestor, ".git", "hooks"), { recursive: true });
    await writeFile(join(project, "AGENTS.md"), "Real rule\n");

    expect(await findGitProjectRoot(project)).toBeUndefined();
    // And the real repository one level down still wins over the stub above it.
    const repository = join(project, "app");
    await createGitRepository(repository);
    await writeFile(join(repository, "AGENTS.md"), "App rule\n");
    const resolved = await findGitProjectRoot(repository);
    const canonicalRepository = await realpath(repository);
    expect(resolved).toBe(canonicalRepository);
    const sources = await discoverProjectInstructionSources(resolved ?? canonicalRepository);
    expect(sources.map((source) => relative(canonicalRepository, source.path))).toEqual([
      "AGENTS.md",
    ]);
  });

  test("stops the project walk at its depth budget", async () => {
    const fixture = await createFixture();
    const root = join(fixture, "project");
    await createGitRepository(root);
    // Deeper than the walk descends, so it must be invisible to discovery.
    const deep = join(root, "a", "b", "c", "d", "e", "f", "g");
    await mkdir(deep, { recursive: true });
    await writeFile(join(deep, "AGENTS.md"), "Too deep\n");
    await writeFile(join(root, "AGENTS.md"), "Root rule\n");

    const sources = await discoverProjectInstructionSources(root);
    const canonicalRoot = await realpath(root);
    expect(sources.map((source) => relative(canonicalRoot, source.path))).toEqual(["AGENTS.md"]);
  });
});

async function createFixture(): Promise<string> {
  const fixture = await mkdtemp(join(tmpdir(), "omp-policy-projects-"));
  temporaryDirectories.push(fixture);
  return fixture;
}
