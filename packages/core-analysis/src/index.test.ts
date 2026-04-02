import { describe, expect, it } from "vitest";
import {
  ParsedGitCommand,
  RepoStateSnapshot,
  createEmptySnapshot
} from "@git-observatory/core-domain";
import {
  createDefaultGraphExpansionState,
  createDefaultGraphVisibilityFilters,
  diffSnapshots,
  explainTransition,
  projectGraph
} from "./index";

function command(subcommand: string): ParsedGitCommand {
  return {
    raw: `git ${subcommand}`,
    binary: "git",
    subcommand,
    args: [],
    flags: [],
    nouns: []
  };
}

describe("diffSnapshots", () => {
  it("detects object, index, ref, and HEAD changes", () => {
    const before: RepoStateSnapshot = createEmptySnapshot("C:/repo");
    const after: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      index: [{ mode: "100644", oid: "abc", stage: 0, path: "README.md" }],
      refs: [{ name: "refs/heads/main", oid: "def", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "def" },
      objects: [
        { oid: "abc", type: "blob", size: 12, storage: "loose" },
        { oid: "tree123", type: "tree", size: 24, storage: "loose" },
        { oid: "def", type: "commit", size: 92, storage: "loose" }
      ],
      commitGraph: [
        { oid: "def", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const delta = diffSnapshots(before, after);

    expect(delta.indexChanged).toEqual(["README.md:0"]);
    expect(delta.objectsAdded).toEqual(["abc", "tree123", "def"]);
    expect(delta.refsChanged).toEqual([
      {
        name: "refs/heads/main",
        beforeOid: null,
        afterOid: "def"
      }
    ]);
    expect(delta.headChanged).toBe(true);
  });
});

describe("explainTransition", () => {
  it("special-cases commit explanations", () => {
    const after: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      head: { detached: false, target: "refs/heads/main", oid: "1234567890abcdef" }
    };

    const explanation = explainTransition(
      command("commit"),
      {
        workingTreeChanged: [],
        indexChanged: ["README.md:0"],
        objectsAdded: ["blob", "tree", "commit"],
        refsChanged: [{ name: "refs/heads/main", beforeOid: null, afterOid: "123" }],
        headChanged: true,
        operationsChanged: false,
        gitDirectoryChanged: ["HEAD"],
        remoteChanged: [],
        packfilesChanged: false
      },
      after
    );

    expect(explanation[0]).toContain("tree object");
    expect(explanation.at(-1)).toContain("refs/heads/main");
  });
});

describe("projectGraph", () => {
  it("projects HEAD, refs, commits, trees, blobs, and status panels from a snapshot", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      workingTree: [{ path: "README.md", indexStatus: "M", workTreeStatus: "M" }],
      index: [{ mode: "100644", oid: "blob123", stage: 0, path: "README.md" }],
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      objects: [
        { oid: "blob123", type: "blob", size: 12, storage: "loose" },
        { oid: "tree123", type: "tree", size: 24, storage: "loose" },
        { oid: "commit123", type: "commit", size: 96, storage: "loose" }
      ],
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      visibilityFilters: createDefaultGraphVisibilityFilters(),
      expansionState: { ...createDefaultGraphExpansionState(), expandedTreeOids: ["tree123"] },
      treeInspections: {
        tree123: {
          type: "tree",
          oid: "tree123",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob123", path: "README.md" }]
        }
      }
    });

    expect(graph.nodes.some((node) => node.id === "head")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "ref:refs/heads/main")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "commit:commit123")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "tree:tree123")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "blob:blob123")).toBe(true);
    expect(graph.edges.some((edge) => edge.id === "symbolic:head:ref:refs/heads/main")).toBe(true);
    expect(graph.edges.some((edge) => edge.id === "contains:commit:commit123:tree:tree123")).toBe(true);
    expect(graph.workingArea).toHaveLength(1);
    expect(graph.stagingArea).toHaveLength(1);
  });

  it("fans out refs that point at the same commit", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [
        { name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" },
        { name: "refs/heads/feature", oid: "commit123", objectType: "commit", scope: "local" }
      ],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main", "feature"] }
      ]
    };

    const graph = projectGraph({ snapshot });
    const mainRef = graph.nodes.find((node) => node.id === "ref:refs/heads/main");
    const featureRef = graph.nodes.find((node) => node.id === "ref:refs/heads/feature");

    expect(mainRef).toBeTruthy();
    expect(featureRef).toBeTruthy();
    expect(mainRef?.position.y).not.toEqual(featureRef?.position.y);
  });

  it("shows staged blobs even when they are not yet part of a committed tree", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      index: [{ mode: "100644", oid: "blob999", stage: 0, path: "notes.txt" }],
      head: { detached: false, target: null, oid: null },
      commitGraph: []
    };

    const graph = projectGraph({ snapshot });
    const stagedBlob = graph.nodes.find((node) => node.id === "blob:blob999");

    expect(stagedBlob).toBeTruthy();
    expect(stagedBlob?.type).toBe("blob");
    expect(stagedBlob?.metadata.staged).toBe(true);
    expect(stagedBlob?.metadata.stagedOnly).toBe(true);
  });

  it("surfaces additional staged paths when a staged blob reuses an existing blob object", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      index: [{ mode: "100644", oid: "blob123", stage: 0, path: "notes.txt" }],
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      visibilityFilters: createDefaultGraphVisibilityFilters(),
      expansionState: { ...createDefaultGraphExpansionState(), expandedTreeOids: ["tree123"] },
      treeInspections: {
        tree123: {
          type: "tree",
          oid: "tree123",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob123", path: "README.md" }]
        }
      }
    });

    const reusedBlob = graph.nodes.find((node) => node.id === "blob:blob123");
    expect(reusedBlob?.label).toContain("+1");
    expect(reusedBlob?.metadata.staged).toBe(true);
  });

  it("fans out blob nodes that would otherwise overlap", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      index: [{ mode: "100644", oid: "blob-b", stage: 0, path: "third.md" }],
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      visibilityFilters: createDefaultGraphVisibilityFilters(),
      expansionState: { ...createDefaultGraphExpansionState(), expandedTreeOids: ["tree123"] },
      treeInspections: {
        tree123: {
          type: "tree",
          oid: "tree123",
          size: 24,
          storage: "loose",
          entries: [
            { mode: "100644", type: "blob", oid: "blob-a", path: "README.md" },
            { mode: "100644", type: "blob", oid: "blob-b", path: "second.md" }
          ]
        }
      }
    });

    const blobA = graph.nodes.find((node) => node.id === "blob:blob-a");
    const blobB = graph.nodes.find((node) => node.id === "blob:blob-b");

    expect(blobA).toBeTruthy();
    expect(blobB).toBeTruthy();
    expect(blobA?.position.x === blobB?.position.x && blobA?.position.y === blobB?.position.y).toBe(false);
  });
});
