import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphProjectionCache, projectGraphIncremental } from "@git-observatory/core-analysis";
import {
  GitObjectInspection,
  GraphExpansionState,
  GraphSelection,
  GraphVisibilityFilters,
  RepoStateSnapshot,
  SandboxDescriptor
} from "@git-observatory/core-domain";
import { GraphCanvas, StatusPanel, TreeInspectorPanel } from "@git-observatory/ui-shared";

const graphVisibility: GraphVisibilityFilters = {
  showRefs: true,
  showTrees: true,
  showBlobs: true,
  showTags: true
};

function formatTime(value: string | null): string {
  return value ?? "Not refreshed yet";
}

function isNodeSelection(selection: GraphSelection): selection is { kind: "node"; id: string } {
  return selection.kind === "node";
}

function isWorkingTreeVisible(item: NonNullable<ReturnType<typeof projectGraphIncremental>["graph"]>["workingArea"][number]): boolean {
  return item.workTreeStatus.trim().length > 0 || item.indexStatus === "?";
}

function isIndexVisible(
  item: NonNullable<ReturnType<typeof projectGraphIncremental>["graph"]>["stagingArea"][number],
  workingArea: NonNullable<ReturnType<typeof projectGraphIncremental>["graph"]>["workingArea"]
): boolean {
  if (item.stage !== 0) {
    return true;
  }

  const workingTreeEntry = workingArea.find((candidate) => candidate.path === item.path);
  return Boolean(workingTreeEntry?.indexStatus.trim() && workingTreeEntry.indexStatus !== "?");
}

export default function App() {
  const [repoPath, setRepoPath] = useState("");
  const [sandbox, setSandbox] = useState<SandboxDescriptor | null>(null);
  const [snapshot, setSnapshot] = useState<RepoStateSnapshot | null>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [treeInspections, setTreeInspections] = useState<Record<string, GitObjectInspection | undefined>>({});
  const [expandedTreeOids, setExpandedTreeOids] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const cacheRef = useRef<GraphProjectionCache | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const graphExpansion = useMemo<GraphExpansionState>(() => ({
    expandedTreeOids
  }), [expandedTreeOids]);

  const graph = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    const result = projectGraphIncremental({
      snapshot,
      selection,
      visibilityFilters: graphVisibility,
      expansionState: graphExpansion,
      treeInspections,
      includeIndexBlobs: true,
      cache: cacheRef.current
    });

    cacheRef.current = result.cache;
    return result.graph;
  }, [selection, snapshot, treeInspections]);
  const workingTreeItems = useMemo(() => graph?.workingArea.filter(isWorkingTreeVisible) ?? [], [graph]);
  const indexItems = useMemo(
    () => graph?.stagingArea.filter((item) => isIndexVisible(item, graph.workingArea)) ?? [],
    [graph]
  );
  const selectedTreeNode = useMemo(() => {
    if (!graph || !selection || !isNodeSelection(selection)) {
      return null;
    }

    const node = graph.nodes.find((item) => item.id === selection.id);
    return node?.type === "tree" ? node : null;
  }, [graph, selection]);
  const selectedTreeInspection = selectedTreeNode?.oid ? treeInspections[selectedTreeNode.oid] : null;

  const refreshSnapshot = useCallback(async (path = repoPath) => {
    if (!path) {
      return;
    }

    try {
      const nextSnapshot = await window.gitObservatory.inspectRepo(path);
      setSnapshot(nextSnapshot);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to refresh playground.");
    }
  }, [repoPath]);

  useEffect(() => {
    const unsubscribe = window.gitObservatory.onRepoWatchEvent((event) => {
      if (!repoPath || event.repoPath !== repoPath) {
        return;
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        void refreshSnapshot(event.repoPath);
      }, 250);
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshSnapshot, repoPath]);

  useEffect(() => {
    if (!repoPath) {
      return;
    }

    void window.gitObservatory.startWatchingRepo(repoPath);

    return () => {
      void window.gitObservatory.stopWatchingRepo();
    };
  }, [repoPath]);

  async function createPlayground() {
    setBusy(true);
    setError(null);
    setSelection(null);
    setTreeInspections({});
    setExpandedTreeOids([]);
    cacheRef.current = null;

    try {
      const result = await window.gitObservatory.createSandbox("practice", "playground");
      setRepoPath(result.repoPath);
      setSandbox(result.sandbox);
      setSnapshot(result.snapshot);
      setLastUpdated(new Date().toLocaleTimeString());
      await window.gitObservatory.startWatchingRepo(result.repoPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create playground.");
    } finally {
      setBusy(false);
    }
  }

  async function openSystemTerminal() {
    if (!repoPath) {
      return;
    }

    try {
      await window.gitObservatory.openSystemTerminal(repoPath);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to open system terminal.");
    }
  }

  async function handleSelect(nextSelection: GraphSelection) {
    if (!snapshot || !graph) {
      setSelection(nextSelection);
      return;
    }

    if (isNodeSelection(nextSelection)) {
      const node = graph.nodes.find((item) => item.id === nextSelection.id);
      if (node?.type === "tree" && node.oid && !treeInspections[node.oid]) {
        try {
          const inspection = await window.gitObservatory.inspectObjectWithOptions(snapshot.repoPath, node.oid, { entryLimit: 120 });
          const oid = node.oid;
          setTreeInspections((current) => ({
            ...current,
            [oid]: inspection ?? undefined
          }));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Failed to inspect tree.");
        }
      }
    }

    setSelection(nextSelection);
  }

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const rootTreeOids = Array.from(new Set(snapshot.commitGraph.map((commit) => commit.treeOid).filter(Boolean)));
    const missingTreeOids = rootTreeOids.filter((oid) => !treeInspections[oid]);

    if (rootTreeOids.some((oid) => !expandedTreeOids.includes(oid))) {
      setExpandedTreeOids((current) => Array.from(new Set([...current, ...rootTreeOids])));
    }

    if (missingTreeOids.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      missingTreeOids.map(async (oid) => {
        const inspection = await window.gitObservatory.inspectObjectWithOptions(snapshot.repoPath, oid, { entryLimit: 120 });
        return [oid, inspection] as const;
      })
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setTreeInspections((current) => {
          const next = { ...current };
          entries.forEach(([oid, inspection]) => {
            next[oid] = inspection ?? undefined;
          });
          return next;
        });
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to inspect committed tree.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [expandedTreeOids, snapshot, treeInspections]);

  if (!repoPath || !snapshot) {
    return (
      <main className="playground-app playground-app--empty">
        <section className="playground-launcher" aria-labelledby="playground-title">
          <p className="playground-kicker">Visual Git state</p>
          <h1 id="playground-title">Git Observatory</h1>
          <button className="playground-primary" disabled={busy} onClick={() => void createPlayground()} type="button">
            {busy ? "Creating..." : "New Playground"}
          </button>
          {error ? <p className="playground-error" role="alert">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="playground-app">
      <header className="playground-topbar">
        <div className="playground-title">
          <p className="playground-kicker">Git Observatory</p>
          <h1>Git Observatory</h1>
        </div>
        <div className="playground-path" title={repoPath}>
          {repoPath}
        </div>
        <div className="playground-actions">
          <button disabled={busy} onClick={() => void openSystemTerminal()} type="button">
            Open System Terminal
          </button>
          <button disabled={busy} onClick={() => void refreshSnapshot()} type="button">
            Refresh
          </button>
          <button disabled={busy} onClick={() => void createPlayground()} type="button">
            New Playground
          </button>
        </div>
      </header>

      {error ? <p className="playground-error" role="alert">{error}</p> : null}

      <section className="playground-workspace" aria-label="Git playground workspace">
        <div className="playground-canvas" aria-label="Git graph canvas">
          <GraphCanvas
            actions={<span className="playground-status">{sandbox?.kind ?? "practice"} / {formatTime(lastUpdated)}</span>}
            graph={graph}
            onSelectNode={(nextSelection) => void handleSelect(nextSelection)}
            subtitle="Run Git commands in your terminal. This canvas updates from the repository state."
            title="Git Graph"
          />
        </div>
        <aside className="playground-state" aria-label="Local repository state">
          <div className="playground-state-panel">
            <StatusPanel
              items={workingTreeItems}
              kind="working"
              onSelect={(nextSelection) => void handleSelect(nextSelection)}
              selection={selection}
              subtitle="Files changed on disk"
              title="Working Tree"
            />
          </div>
          <div className="playground-state-panel">
            <StatusPanel
              items={indexItems}
              kind="staging"
              onSelect={(nextSelection) => void handleSelect(nextSelection)}
              selection={selection}
              subtitle="Files staged for commit"
              title="Index"
            />
          </div>
          {selectedTreeNode ? (
            <div className="playground-state-panel">
              <TreeInspectorPanel
                inspection={selectedTreeInspection}
                treeOid={selectedTreeNode.oid}
              />
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
