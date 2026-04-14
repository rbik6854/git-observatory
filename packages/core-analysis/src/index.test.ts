import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ParsedGitCommand,
  RepoStateSnapshot,
  createEmptySnapshot
} from "@git-observatory/core-domain";
import type {
  CurriculumConcept,
  GitHubTeachingTopic,
  WorkflowScenario
} from "@git-observatory/core-domain";
import {
  buildHistoryTimeline,
  createRepoInvalidation,
  createDefaultGraphExpansionState,
  createDefaultGraphVisibilityFilters,
  diffSnapshots,
  explainTransition,
  projectHistoryGraph,
  projectRemoteView,
  projectTreeExplorer,
  projectGraph,
  projectGraphIncremental
} from "./index";

describe("core domain exports", () => {
  it("exports curriculum and workflow contracts", () => {
    const curriculumConcept = {
      id: "repository-birth",
      title: "Repository birth and Git metadata",
      guidedChapterIds: ["chapter-1-repository-birth"],
      practiceScenarioIds: ["step-init-repository"],
      githubBridgeTopics: ["pull-request-mental-model"]
    } satisfies CurriculumConcept;

    const workflowScenario = {
      id: "feature-branch-rebase-release",
      title: "Feature branch rebase release",
      realism: {
        largeRepoFaithful: true,
        simplifiedTeachingNotes: ["Use a compact repo to explain the same state transitions."]
      },
      githubBridgeTopics: ["branch-protection", "merge-strategy-outcomes"]
    } satisfies WorkflowScenario;

    const githubTopic = "review-feedback-loop" satisfies GitHubTeachingTopic;

    expectTypeOf<CurriculumConcept>().toEqualTypeOf<{
      id: string;
      title: string;
      guidedChapterIds: string[];
      practiceScenarioIds: string[];
      githubBridgeTopics: string[];
    }>();
    expectTypeOf<WorkflowScenario>().toEqualTypeOf<{
      id: string;
      title: string;
      realism: {
        largeRepoFaithful: boolean;
        simplifiedTeachingNotes: string[];
      };
      githubBridgeTopics: GitHubTeachingTopic[];
    }>();
    expectTypeOf<GitHubTeachingTopic>().toEqualTypeOf<
      | "pull-request-mental-model"
      | "branch-protection"
      | "merge-strategy-outcomes"
      | "review-feedback-loop"
    >();

    expect(curriculumConcept.guidedChapterIds).toContain("chapter-1-repository-birth");
    expect(workflowScenario.realism.largeRepoFaithful).toBe(true);
    expect(githubTopic).toBe("review-feedback-loop");
  });
});

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
          entries: [{ mode: "100644", type: "blob", oid: "blob123", path: "README.md" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
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
      workingTree: [{ path: "notes.txt", indexStatus: "A", workTreeStatus: " " }],
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

  it("does not mark clean tracked index entries as staged blobs", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      index: [{ mode: "100644", oid: "blob123", stage: 0, path: "README.md" }],
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
          entries: [{ mode: "100644", type: "blob", oid: "blob123", path: "README.md" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        }
      }
    });

    const committedBlob = graph.nodes.find((node) => node.id === "blob:blob123");

    expect(committedBlob?.metadata.staged).toBeFalsy();
    expect(committedBlob?.metadata.stagedOnly).toBeFalsy();
  });

  it("shows an unborn branch ref after git init before the first commit exists", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      head: { detached: false, target: "refs/heads/main", oid: null },
      refs: [],
      commitGraph: []
    };

    const graph = projectGraph({ snapshot });

    expect(graph.nodes.some((node) => node.id === "ref:refs/heads/main")).toBe(true);
    expect(graph.edges.some((edge) => edge.id === "symbolic:head:ref:refs/heads/main")).toBe(true);
  });

  it("surfaces additional staged paths when a staged blob reuses an existing blob object", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      workingTree: [{ path: "notes.txt", indexStatus: "A", workTreeStatus: " " }],
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
          entries: [{ mode: "100644", type: "blob", oid: "blob123", path: "README.md" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        }
      }
    });

    const reusedBlob = graph.nodes.find((node) => node.id === "blob:blob123");
    expect(reusedBlob?.label).toBe("README.md");
    expect(reusedBlob?.metadata.pathCount).toBe(2);
    expect(reusedBlob?.metadata.staged).toBe(true);
  });

  it("surfaces staged deletes in the index panel even though the deleted path has no index entry", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      workingTree: [{ path: "removed.txt", indexStatus: "D", workTreeStatus: " " }],
      index: [],
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectGraph({ snapshot });

    expect(graph.stagingArea).toEqual([
      expect.objectContaining({
        path: "removed.txt",
        indexStatus: "D",
        oid: ""
      })
    ]);
  });

  it("places side branch commits in a separate lane from the current branch first-parent path", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [
        { name: "refs/heads/main", oid: "main3", objectType: "commit", scope: "local" },
        { name: "refs/heads/feature", oid: "feature4", objectType: "commit", scope: "local" }
      ],
      head: { detached: false, target: "refs/heads/main", oid: "main3" },
      commitGraph: [
        { oid: "main3", treeOid: "tree-main3", parents: ["main2"], subject: "Main adds line 3", decorations: ["HEAD -> main"] },
        { oid: "feature4", treeOid: "tree-feature4", parents: ["feature3"], subject: "Feature adds line 4", decorations: ["feature"] },
        { oid: "feature3", treeOid: "tree-feature3", parents: ["main2"], subject: "Feature adds line 3", decorations: [] },
        { oid: "main2", treeOid: "tree-main2", parents: ["initial"], subject: "Main adds line 2", decorations: [] },
        { oid: "initial", treeOid: "tree-initial", parents: [], subject: "Initial commit", decorations: [] }
      ]
    };

    const graph = projectGraph({ snapshot });
    const main3 = graph.nodes.find((node) => node.id === "commit:main3");
    const main2 = graph.nodes.find((node) => node.id === "commit:main2");
    const feature4 = graph.nodes.find((node) => node.id === "commit:feature4");
    const mainParentEdge = graph.edges.find((edge) => edge.id === "parent:commit:main3:commit:main2");

    expect(mainParentEdge).toBeTruthy();
    expect(main3?.position.x).toBe(main2?.position.x);
    expect(feature4?.position.x).not.toBe(main3?.position.x);
  });

  it("keeps branch labels attached to their commit lanes when tree objects are expanded", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [
        { name: "refs/heads/main", oid: "main3", objectType: "commit", scope: "local" },
        { name: "refs/heads/feature", oid: "feature3", objectType: "commit", scope: "local" }
      ],
      head: { detached: false, target: "refs/heads/main", oid: "main3" },
      index: [{ mode: "100644", oid: "blob-main3", stage: 0, path: "app.txt" }],
      commitGraph: [
        { oid: "main3", treeOid: "tree-main3", parents: ["main2"], subject: "Main adds line 3", decorations: ["HEAD -> main"] },
        { oid: "feature3", treeOid: "tree-feature3", parents: ["feature4"], subject: "Feature adds line 3", decorations: ["feature"] },
        { oid: "feature4", treeOid: "tree-feature4", parents: ["main2"], subject: "Feature adds line 4", decorations: [] },
        { oid: "main2", treeOid: "tree-main2", parents: ["initial"], subject: "Main adds line 2", decorations: [] },
        { oid: "initial", treeOid: "tree-initial", parents: [], subject: "Initial commit", decorations: [] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      visibilityFilters: createDefaultGraphVisibilityFilters(),
      expansionState: {
        ...createDefaultGraphExpansionState(),
        expandedTreeOids: ["tree-main3", "tree-feature3", "tree-feature4", "tree-main2", "tree-initial"]
      },
      treeInspections: {
        "tree-main3": {
          type: "tree",
          oid: "tree-main3",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-main3", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-feature3": {
          type: "tree",
          oid: "tree-feature3",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-feature3", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-feature4": {
          type: "tree",
          oid: "tree-feature4",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-feature4", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-main2": {
          type: "tree",
          oid: "tree-main2",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-main2", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-initial": {
          type: "tree",
          oid: "tree-initial",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-initial", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        }
      }
    });

    const main3 = graph.nodes.find((node) => node.id === "commit:main3");
    const main2 = graph.nodes.find((node) => node.id === "commit:main2");
    const feature3 = graph.nodes.find((node) => node.id === "commit:feature3");
    const feature4 = graph.nodes.find((node) => node.id === "commit:feature4");
    const featureRef = graph.nodes.find((node) => node.id === "ref:refs/heads/feature");
    const trees = graph.nodes.filter((node) => node.type === "tree");
    const maxCommitX = Math.max(...graph.nodes.filter((node) => node.type === "commit").map((node) => node.position.x));
    const minTreeX = Math.min(...trees.map((node) => node.position.x));

    expect(main3?.position.x).toBe(main2?.position.x);
    expect(feature3?.position.x).toBe(feature4?.position.x);
    expect(feature3?.position.x).toBeGreaterThan(main3?.position.x ?? 0);
    expect(featureRef?.position.x).toBeLessThan((feature3?.position.x ?? 0) - 80);
    expect(minTreeX).toBeGreaterThan(maxCommitX + 160);
  });

  it("shows a rebased linear history without ref labels or object details cluttering the lane", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [
        { name: "refs/heads/feature", oid: "feature4", objectType: "commit", scope: "local" },
        { name: "refs/heads/main", oid: "main3", objectType: "commit", scope: "local" }
      ],
      head: { detached: false, target: "refs/heads/feature", oid: "feature4" },
      commitGraph: [
        { oid: "feature4", treeOid: "tree-feature4", parents: ["feature3"], subject: "Feature adds line 4", decorations: ["HEAD -> feature"] },
        { oid: "feature3", treeOid: "tree-feature3", parents: ["main3"], subject: "Feature adds line 3", decorations: [] },
        { oid: "main3", treeOid: "tree-main3", parents: ["main2"], subject: "Main adds line 3", decorations: ["main"] },
        { oid: "main2", treeOid: "tree-main2", parents: ["initial"], subject: "Main adds line 2", decorations: [] },
        { oid: "initial", treeOid: "tree-initial", parents: [], subject: "Initial commit", decorations: [] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      visibilityFilters: createDefaultGraphVisibilityFilters(),
      expansionState: {
        ...createDefaultGraphExpansionState(),
        expandedTreeOids: ["tree-feature4", "tree-feature3", "tree-main3", "tree-main2", "tree-initial"]
      },
      treeInspections: {
        "tree-feature4": {
          type: "tree",
          oid: "tree-feature4",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-feature4", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-feature3": {
          type: "tree",
          oid: "tree-feature3",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-feature3", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-main3": {
          type: "tree",
          oid: "tree-main3",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-main3", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-main2": {
          type: "tree",
          oid: "tree-main2",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-main2", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        },
        "tree-initial": {
          type: "tree",
          oid: "tree-initial",
          size: 24,
          storage: "loose",
          entries: [{ mode: "100644", type: "blob", oid: "blob-initial", path: "app.txt" }],
          summary: { renderedEntries: 1, totalEntries: 1, truncated: false }
        }
      }
    });

    const commits = ["feature4", "feature3", "main3", "main2", "initial"].map((oid) =>
      graph.nodes.find((node) => node.id === `commit:${oid}`)
    );
    const featureRef = graph.nodes.find((node) => node.id === "ref:refs/heads/feature");
    const mainRef = graph.nodes.find((node) => node.id === "ref:refs/heads/main");
    const trees = graph.nodes.filter((node) => node.type === "tree");
    const blobs = graph.nodes.filter((node) => node.type === "blob");

    expect(new Set(commits.map((node) => node?.position.x)).size).toBe(1);
    expect(featureRef?.position.x).toBeLessThan((commits[0]?.position.x ?? 0) - 80);
    expect(mainRef?.position.x).toBeLessThan((commits[2]?.position.x ?? 0) - 80);
    expect(Math.abs((featureRef?.position.y ?? 0) - (commits[0]?.position.y ?? 0))).toBeLessThan(28);
    expect(Math.abs((mainRef?.position.y ?? 0) - (commits[2]?.position.y ?? 0))).toBeLessThan(28);
    expect(trees).toHaveLength(1);
    expect(blobs).toHaveLength(1);
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
          ],
          summary: { renderedEntries: 2, totalEntries: 2, truncated: false }
        }
      }
    });

    const blobA = graph.nodes.find((node) => node.id === "blob:blob-a");
    const blobB = graph.nodes.find((node) => node.id === "blob:blob-b");

    expect(blobA).toBeTruthy();
    expect(blobB).toBeTruthy();
    expect(blobA?.position.x === blobB?.position.x && blobA?.position.y === blobB?.position.y).toBe(false);
  });

  it("reuses structural graph nodes and edges when only selection changes", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const first = projectGraphIncremental({ snapshot });
    const second = projectGraphIncremental({
      snapshot,
      selection: { kind: "node", id: "commit:commit123" },
      cache: first.cache
    });

    expect(second.graph.nodes).toBe(first.graph.nodes);
    expect(second.graph.edges).toBe(first.graph.edges);
    expect(second.graph.selection).toEqual({ kind: "node", id: "commit:commit123" });
  });

  it("marks changed refs, head, graph edges, and status items for playback emphasis", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      workingTree: [{ path: "README.md", indexStatus: "M", workTreeStatus: "M" }],
      index: [{ mode: "100644", oid: "blob123", stage: 0, path: "README.md" }],
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectGraph({
      snapshot,
      delta: {
        workingTreeChanged: ["README.md"],
        indexChanged: ["README.md:0"],
        objectsAdded: ["commit123", "tree123", "blob123"],
        refsChanged: [{ name: "refs/heads/main", beforeOid: null, afterOid: "commit123" }],
        headChanged: true,
        operationsChanged: false,
        gitDirectoryChanged: [],
        remoteChanged: [],
        packfilesChanged: false
      }
    });

    expect(graph.nodes.find((node) => node.id === "head")?.emphasis).toBe("changed");
    expect(graph.nodes.find((node) => node.id === "ref:refs/heads/main")?.emphasis).toBe("changed");
    expect(graph.nodes.find((node) => node.id === "commit:commit123")?.emphasis).toBe("new");
    expect(graph.edges.some((edge) => edge.emphasis === "changed")).toBe(true);
    expect(graph.workingArea[0]?.emphasis).toBe("changed");
    expect(graph.stagingArea[0]?.emphasis).toBe("changed");
  });
});

describe("projectHistoryGraph", () => {
  it("keeps staged blobs out of the history surface", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      index: [{ mode: "100644", oid: "blob123", stage: 0, path: "README.md" }],
      refs: [{ name: "refs/heads/main", oid: "commit123", objectType: "commit", scope: "local" }],
      head: { detached: false, target: "refs/heads/main", oid: "commit123" },
      commitGraph: [
        { oid: "commit123", treeOid: "tree123", parents: [], subject: "Initial commit", decorations: ["HEAD -> main"] }
      ]
    };

    const graph = projectHistoryGraph({ snapshot });
    expect(graph.nodes.some((node) => node.type === "blob")).toBe(false);
  });
});

describe("createRepoInvalidation", () => {
  it("scopes fetch to remote/history/timeline slices", () => {
    expect(createRepoInvalidation({ command: "git fetch --all" }).slices).toEqual(["remote", "history", "timeline"]);
  });

  it("scopes workspace file changes to workspace and changes slices", () => {
    expect(createRepoInvalidation({ changedPath: "src/App.tsx" }).slices).toEqual(["workspace", "changes"]);
  });
});

describe("buildHistoryTimeline", () => {
  it("builds oldest-to-newest durable history events", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      commitGraph: [
        { oid: "commit2", treeOid: "tree2", parents: ["commit1"], subject: "Second", decorations: ["HEAD -> main"] },
        { oid: "commit1", treeOid: "tree1", parents: [], subject: "First", decorations: [] }
      ]
    };

    const journal = buildHistoryTimeline(snapshot);
    expect(journal.events[0]?.commitOid).toBe("commit1");
    expect(journal.events[1]?.commitOid).toBe("commit2");
  });
});

describe("projectRemoteView", () => {
  it("surfaces upstream divergence summary", () => {
    const snapshot: RepoStateSnapshot = {
      ...createEmptySnapshot("C:/repo"),
      remoteState: {
        remotes: [{ name: "origin", fetchUrl: "https://example.com/repo.git", pushUrl: "https://example.com/repo.git" }],
        remoteRefs: [{ name: "refs/remotes/origin/main", oid: "abc", objectType: "commit", scope: "remote" }],
        currentBranchName: "main",
        currentBranchRef: "refs/heads/main",
        upstreamRefName: "refs/remotes/origin/main",
        ahead: 2,
        behind: 1,
        divergence: "diverged",
        lastOperation: null
      }
    };

    const remoteView = projectRemoteView(snapshot);
    expect(remoteView.divergence).toBe("diverged");
    expect(remoteView.summary.join(" ")).toContain("Ahead 2 / Behind 1");
  });
});

describe("projectTreeExplorer", () => {
  it("builds a committed tree-to-blob graph for the selected tree", () => {
    const tree = projectTreeExplorer({
      selectedTreeOid: "tree123",
      inspection: {
        type: "tree",
        oid: "tree123",
        size: 24,
        storage: "loose",
        entries: [
          { mode: "100644", type: "blob", oid: "blob123", path: "README.md" },
          { mode: "040000", type: "tree", oid: "tree456", path: "src" }
        ],
        summary: { renderedEntries: 2, totalEntries: 2, truncated: false }
      }
    });

    expect(tree.graph?.nodes.some((node) => node.id === "tree:tree123")).toBe(true);
    expect(tree.graph?.nodes.some((node) => node.id === "blob:blob123")).toBe(true);
    expect(tree.graph?.edges.some((edge) => edge.relationship === "contains")).toBe(true);
  });
});
