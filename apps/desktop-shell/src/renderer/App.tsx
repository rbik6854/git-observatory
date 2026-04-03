import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
  GitObjectInspection,
  GraphExpansionState,
  GraphSelection,
  GraphVisibilityFilters,
  InspectorTab,
  LessonWorkspace,
  RepoStateSnapshot,
  SandboxDescriptor,
  TerminalSessionDescriptor
} from "@git-observatory/core-domain";
import {
  buildInspectorModel,
  createDefaultGraphExpansionState,
  createDefaultGraphVisibilityFilters,
  GraphProjectionCache,
  projectGraph,
  projectGraphIncremental
} from "@git-observatory/core-analysis";
import { EmptyState, GraphCanvas, InfoBadge, InspectorPanel, Panel, StatusPanel } from "@git-observatory/ui-shared";

type Mode = "idle" | "practice" | "analyze";

function isSelectionStillValid(
  selection: GraphSelection | null,
  snapshot: RepoStateSnapshot | null,
  workspace: LessonWorkspace | null,
  visibilityFilters: GraphVisibilityFilters,
  expansionState: GraphExpansionState,
  treeInspections: Record<string, GitObjectInspection | undefined>
): boolean {
  if (!selection || selection.kind === "composer") {
    return true;
  }

  if (!snapshot) {
    return false;
  }

  if (selection.kind === "node") {
    const graph = projectGraph({
      snapshot,
      selection,
      visibilityFilters,
      expansionState,
      treeInspections
    });
    return graph.nodes.some((node) => node.id === selection.id);
  }

  if (selection.kind === "working-tree") {
    return Boolean(
      snapshot.workingTree.some((item) => item.path === selection.path) ||
        workspace?.files.some((file) => file.path === selection.path)
    );
  }

  return snapshot.index.some((entry) => entry.path === selection.path && entry.stage === selection.stage);
}

export default function App() {
  const [mode, setMode] = useState<Mode>("idle");
  const [repoPath, setRepoPath] = useState("");
  const [sandbox, setSandbox] = useState<SandboxDescriptor | null>(null);
  const [snapshot, setSnapshot] = useState<RepoStateSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<LessonWorkspace | null>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [inspectedObject, setInspectedObject] = useState<GitObjectInspection | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("what");
  const [filters, setFilters] = useState<GraphVisibilityFilters>(createDefaultGraphVisibilityFilters);
  const [expansionState, setExpansionState] = useState<GraphExpansionState>(createDefaultGraphExpansionState);
  const [treeInspections, setTreeInspections] = useState<Record<string, GitObjectInspection | undefined>>({});
  const [editorPath, setEditorPath] = useState("README.md");
  const [editorContent, setEditorContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [terminalSession, setTerminalSession] = useState<TerminalSessionDescriptor | null>(null);
  const [attachingTerminal, setAttachingTerminal] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(96);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [lastExternalChange, setLastExternalChange] = useState<string>("");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [detailPanel, setDetailPanel] = useState<"working" | "staging" | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const graphCacheRef = useRef<GraphProjectionCache | null>(null);

  const baseGraph = useMemo(() => {
    if (!snapshot) {
      graphCacheRef.current = null;
      return null;
    }

    const result = projectGraphIncremental({
      snapshot,
      visibilityFilters: filters,
      expansionState,
      treeInspections,
      cache: graphCacheRef.current
    });

    graphCacheRef.current = result.cache;
    return result.graph;
  }, [expansionState, filters, snapshot, treeInspections]);

  const graph = useMemo(() => (baseGraph ? { ...baseGraph, selection } : null), [baseGraph, selection]);

  const inspector = useMemo(
    () =>
      snapshot && graph && selection
        ? buildInspectorModel({
            snapshot,
            graph,
            selection,
            inspectedObject,
            workspaceFiles: workspace?.files.map((file) => ({
              path: file.path,
              content: file.content,
              status: file.status
            }))
          })
        : null,
    [graph, inspectedObject, selection, snapshot, workspace]
  );

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalSessionIdRef = useRef<string | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const lastRefreshRepoRef = useRef<string>("");
  const commandRefreshSuppressUntilRef = useRef(0);
  const terminalDebugProbeRef = useRef<HTMLElement | null>(null);
  const terminalDebugBufferRef = useRef("");
  const terminalDebugFlushRef = useRef<number | null>(null);

  function scheduleRefresh(delay = 400) {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      void refreshState(repoPath, true);
    }, delay);
  }

  function scheduleCommandRefresh() {
    commandRefreshSuppressUntilRef.current = Date.now() + 1800;
    scheduleRefresh(350);
  }

  function syncTerminalSize() {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const sessionId = terminalSessionIdRef.current;

    if (!terminal || !fitAddon || terminalCollapsed) {
      return;
    }

    fitAddon.fit();
    if (sessionId) {
      void window.gitObservatory.resizeTerminal(sessionId, terminal.cols, terminal.rows);
    }
  }

  function focusTerminalInput() {
    terminalHostRef.current?.focus();
    terminalRef.current?.focus();
    const helperTextarea = terminalContainerRef.current?.querySelector(".xterm-helper-textarea");
    if (helperTextarea instanceof HTMLTextAreaElement) {
      helperTextarea.focus();
    }
  }

  function writeToTerminalSession(data: string) {
    const sessionId = terminalSession?.id ?? terminalSessionIdRef.current ?? null;
    if (!sessionId) {
      return;
    }

    void window.gitObservatory.writeTerminal(sessionId, data);
  }

  function pushTerminalDebugOutput(data: string) {
    terminalDebugBufferRef.current = `${terminalDebugBufferRef.current}${data}`.slice(-12000);
    if (terminalDebugFlushRef.current !== null) {
      return;
    }

    terminalDebugFlushRef.current = window.setTimeout(() => {
      terminalDebugFlushRef.current = null;
      if (terminalDebugProbeRef.current) {
        terminalDebugProbeRef.current.textContent = terminalDebugBufferRef.current;
      }
    }, 80);
  }

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (selection?.kind === "composer") {
      return;
    }

    const selectedPath =
      selection?.kind === "working-tree" || selection?.kind === "staging" ? selection.path : workspace.selectedPath;
    const file = workspace.files.find((item) => item.path === selectedPath);

    if (file) {
      setEditorPath(file.path);
      setEditorContent(file.content ?? "");
    }
  }, [selection, workspace]);

  useEffect(() => {
    if (!snapshot?.head.oid) {
      return;
    }

    const headCommit = snapshot.commitGraph.find((commit) => commit.oid === snapshot.head.oid);
    if (!headCommit?.treeOid) {
      return;
    }

    setExpansionState((current) =>
      current.expandedTreeOids.includes(headCommit.treeOid)
        ? current
        : { expandedTreeOids: [...current.expandedTreeOids, headCommit.treeOid] }
    );
  }, [snapshot]);

  useEffect(() => {
    if (selection?.kind !== "node" || !graph) {
      return;
    }

    const node = graph.nodes.find((item) => item.id === selection.id);
    if (!node || node.type !== "tree" || !node.oid) {
      return;
    }

    setExpansionState((current) =>
      current.expandedTreeOids.includes(node.oid!)
        ? current
        : { expandedTreeOids: [...current.expandedTreeOids, node.oid!] }
    );
  }, [graph, selection]);

  useEffect(() => {
    if (!repoPath) {
      return;
    }

    const requiredTreeOids = Array.from(new Set(expansionState.expandedTreeOids)).filter(
      (oid) => oid && !treeInspections[oid]
    );

    if (requiredTreeOids.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(requiredTreeOids.map((oid) => window.gitObservatory.inspectObject(repoPath, oid))).then((results) => {
      if (cancelled) {
        return;
      }

      setTreeInspections((current) => {
        const next = { ...current };
        requiredTreeOids.forEach((oid, index) => {
          next[oid] = results[index] ?? undefined;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [expansionState.expandedTreeOids, repoPath, treeInspections]);

  useEffect(() => {
    if (!selection) {
      setInspectedObject(null);
      return;
    }

    if (!repoPath || !snapshot || !graph || selection.kind !== "node") {
      setInspectedObject(null);
      return;
    }

    const node = graph.nodes.find((item) => item.id === selection.id);
    if (!node || !node.oid || !["commit", "tree", "blob"].includes(node.type)) {
      setInspectedObject(null);
      return;
    }

    if (node.type === "tree" && treeInspections[node.oid]) {
      setInspectedObject(treeInspections[node.oid] ?? null);
      return;
    }

    let cancelled = false;
    void window.gitObservatory.inspectObject(repoPath, node.oid).then((detail) => {
      if (cancelled) {
        return;
      }
      setInspectedObject(detail);
      if (detail?.type === "tree") {
        setTreeInspections((current) => ({ ...current, [node.oid!]: detail }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [graph, repoPath, selection, snapshot, treeInspections]);

  useEffect(() => {
    if (
      !isSelectionStillValid(selection, snapshot, workspace, filters, expansionState, treeInspections)
    ) {
      setSelection(null);
      setInspectedObject(null);
    }
  }, [selection, snapshot, workspace, filters, expansionState, treeInspections]);

  useEffect(() => {
    let cancelled = false;
    let helperTextarea: HTMLTextAreaElement | null = null;
    let terminalDataDisposable: { dispose(): void } | null = null;
    const handlePaste = (event: Event) => {
      const clipboardEvent = event as ClipboardEvent;
      const text = clipboardEvent.clipboardData?.getData("text/plain") ?? "";
      if (!text) {
        return;
      }

      clipboardEvent.preventDefault();
      writeToTerminalSession(text.replace(/\r?\n/g, "\r"));
    };
    void (async () => {
      if (!repoPath || !terminalContainerRef.current || terminalRef.current) {
        return;
      }

      const terminal = new XTerm({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "Cascadia Code, Consolas, monospace",
        fontSize: 14,
        scrollback: 5000,
        theme: {
          background: "#0d1020",
          foreground: "#f3f6ff",
          cursor: "#6ddcff",
          black: "#0d1020",
          red: "#ff8a8a",
          green: "#16b84f",
          yellow: "#ffd93d",
          blue: "#1f45fc",
          magenta: "#9c36d7",
          cyan: "#6ddcff",
          white: "#f3f6ff"
        }
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(terminalContainerRef.current);
      terminalDataDisposable = terminal.onData((data) => {
        writeToTerminalSession(data);
        if (data.includes("\r")) {
          scheduleCommandRefresh();
        }
      });

      const textareaCandidate = terminalContainerRef.current.querySelector(".xterm-helper-textarea");
      if (textareaCandidate instanceof HTMLTextAreaElement) {
        helperTextarea = textareaCandidate;
        helperTextarea.addEventListener("paste", handlePaste);
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      if (!cancelled) {
        window.requestAnimationFrame(() => {
          fitAddon.fit();
        });
        const ro = new ResizeObserver(() => {
          if (terminalContainerRef.current && terminalContainerRef.current.clientWidth > 0 && !terminalCollapsed) {
            syncTerminalSize();
          }
        });
        ro.observe(terminalContainerRef.current);
        helperTextarea = helperTextarea as HTMLTextAreaElement | null;
        const oldDisposable = terminalDataDisposable;
        terminalDataDisposable = {
          dispose: () => {
            ro.disconnect();
            oldDisposable?.dispose();
          }
        };
      }
    })();

    return () => {
      cancelled = true;
      if (helperTextarea) {
        helperTextarea.removeEventListener("paste", handlePaste);
      }
      terminalDataDisposable?.dispose();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [repoPath]);

  useEffect(() => {
    const unsubscribe = window.gitObservatory.onTerminalEvent((event) => {
      if (!terminalSessionIdRef.current || event.sessionId !== terminalSessionIdRef.current) {
        return;
      }

      const terminal = terminalRef.current;
      if (!terminal) {
        return;
      }

      switch (event.type) {
        case "ready":
          syncTerminalSize();
          break;
        case "output":
          terminal.write(event.data);
          pushTerminalDebugOutput(event.data);
          break;
        case "exit":
          terminal.writeln(`\r\n[terminal exited with code ${event.exitCode}]`);
          terminalSessionIdRef.current = null;
          (window as typeof window & { __terminalSessionId?: string | null }).__terminalSessionId = null;
          setTerminalSession(null);
          setInfoMessage(`Terminal session exited with code ${event.exitCode}.`);
          break;
        case "cwd-change":
          break;
        case "error":
          setError(event.message);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repoPath, terminalSession?.id]);

  useEffect(() => {
    const unsubscribe = window.gitObservatory.onRepoWatchEvent((event) => {
      if (!repoPath || event.repoPath !== repoPath) {
        return;
      }

      if (Date.now() < commandRefreshSuppressUntilRef.current) {
        return;
      }

      setLastExternalChange(event.changedPath ? `Detected external change: ${event.changedPath}` : "Detected external repository change.");
      scheduleRefresh(800);
    });

    return () => {
      unsubscribe();
    };
  }, [repoPath]);

  useEffect(() => {
    if (refreshTimeoutRef.current) {
      return () => {
        if (refreshTimeoutRef.current) {
          window.clearTimeout(refreshTimeoutRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!infoMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setInfoMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [infoMessage]);

  useEffect(() => {
    if (!lastExternalChange) {
      return;
    }

    const timeout = window.setTimeout(() => setLastExternalChange(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [lastExternalChange]);

  useEffect(() => {
    if (!repoPath) {
      terminalSessionIdRef.current = null;
      (window as typeof window & { __terminalSessionId?: string | null }).__terminalSessionId = null;
      setTerminalSession(null);
      setAttachingTerminal(false);
      setLastExternalChange("");
      void window.gitObservatory.stopWatchingRepo();
      return;
    }

    void window.gitObservatory.startWatchingRepo(repoPath);
  }, [repoPath]);

  useEffect(() => {
    if (!isResizingTerminal) {
      return;
    }

    function handleMove(event: MouseEvent) {
      if (!dragStartRef.current) {
        return;
      }

      const delta = dragStartRef.current.y - event.clientY;
      setTerminalHeight(Math.max(110, Math.min(260, dragStartRef.current.height + delta)));
    }

    function handleUp() {
      setIsResizingTerminal(false);
      dragStartRef.current = null;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizingTerminal]);

  useEffect(() => {
    if (!terminalSession || terminalCollapsed) {
      return;
    }

    window.requestAnimationFrame(() => {
      syncTerminalSize();
    });
  }, [terminalCollapsed, terminalHeight, terminalSession]);

  useEffect(() => {
    function handleResize() {
      syncTerminalSize();
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [terminalSession, terminalCollapsed]);

  useEffect(() => {
    return () => {
      if (terminalDebugFlushRef.current) {
        window.clearTimeout(terminalDebugFlushRef.current);
      }
      const sessionId = terminalSessionIdRef.current;
      if (sessionId) {
        void window.gitObservatory.closeTerminal(sessionId);
      }
    };
  }, []);

  async function refreshState(targetRepoPath = repoPath, silent = false) {
    if (!targetRepoPath) {
      return;
    }

    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    lastRefreshRepoRef.current = targetRepoPath;

    if (!silent) {
      setBusy(true);
    }

    try {
      const shouldReadWorkspace =
        !workspace ||
        composerOpen ||
        selection?.kind === "working-tree" ||
        selection?.kind === "staging";

      const nextSnapshotPromise = window.gitObservatory.inspectRepo(targetRepoPath);
      const nextWorkspacePromise = shouldReadWorkspace ? window.gitObservatory.readWorkspace(targetRepoPath) : Promise.resolve(workspace);
      const [nextSnapshot, nextWorkspace] = await Promise.all([nextSnapshotPromise, nextWorkspacePromise]);
      setSnapshot(nextSnapshot);
      if (nextWorkspace) {
        setWorkspace(nextWorkspace);
      }
      if (!silent) {
        setError("");
      }
    } catch (caught) {
      if (!silent) {
        setError(caught instanceof Error ? caught.message : "Failed to refresh repository state.");
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) {
        setBusy(false);
      }

      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshState(lastRefreshRepoRef.current || targetRepoPath, true);
      }
    }
  }

  async function attachTerminal(targetRepoPath: string) {
    setAttachingTerminal(true);
    setError("");

    try {
      const previousSessionId = terminalSessionIdRef.current;
      if (previousSessionId) {
        await window.gitObservatory.closeTerminal(previousSessionId);
      }

      terminalRef.current?.clear();
        const session = await window.gitObservatory.createTerminal(targetRepoPath);
        terminalSessionIdRef.current = session.id;
        (window as typeof window & { __terminalSessionId?: string | null }).__terminalSessionId = session.id;
        setTerminalSession(session);
        setTerminalHeight(Math.min(session.height, 220));
        setTerminalCollapsed(true);
        if (terminalDebugProbeRef.current) {
          terminalDebugProbeRef.current.textContent = "";
        }
        terminalDebugBufferRef.current = "";

        const bufferedOutput = await window.gitObservatory.readTerminalBuffer(session.id);
        if (bufferedOutput) {
          terminalRef.current?.write(bufferedOutput);
          terminalDebugBufferRef.current = bufferedOutput.slice(-12000);
          if (terminalDebugProbeRef.current) {
            terminalDebugProbeRef.current.textContent = terminalDebugBufferRef.current;
          }
        }

      window.requestAnimationFrame(() => {
        syncTerminalSize();
      });
      } catch (caught) {
        terminalSessionIdRef.current = null;
        (window as typeof window & { __terminalSessionId?: string | null }).__terminalSessionId = null;
        setTerminalSession(null);
      setError(caught instanceof Error ? caught.message : "Failed to attach the terminal session.");
      } finally {
      setAttachingTerminal(false);
    }
  }

  async function createPracticeRepo() {
    setBusy(true);
    setError("");
    setInfoMessage("");

    try {
      const result = await window.gitObservatory.createSandbox("practice", "git-observatory-practice");
      setMode("practice");
      setRepoPath(result.repoPath);
      setSandbox(result.sandbox);
      setSnapshot(result.snapshot);
      setWorkspace(await window.gitObservatory.readWorkspace(result.repoPath));
      setSelection(null);
      setInspectedObject(null);
      setTreeInspections({});
      setExpansionState(createDefaultGraphExpansionState());
      setLastExternalChange("");
      setInspectorCollapsed(false);
      setDetailPanel(null);
      setComposerOpen(false);
      await attachTerminal(result.repoPath);
      setInfoMessage("Practice sandbox created. Use the terminal below or create files from the inspector.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create a practice repository.");
    } finally {
      setBusy(false);
    }
  }

  async function openRepository() {
    setBusy(true);
    setError("");
    setInfoMessage("");

    try {
      const result = await window.gitObservatory.openRepo();
      if (!result) {
        return;
      }

      setMode("analyze");
      setRepoPath(result.repoPath);
      setSandbox(null);
      setSnapshot(result.snapshot);
      setWorkspace(await window.gitObservatory.readWorkspace(result.repoPath));
      setSelection(null);
      setInspectedObject(null);
      setTreeInspections({});
      setExpansionState(createDefaultGraphExpansionState());
      setLastExternalChange("");
      setInspectorCollapsed(false);
      setDetailPanel(null);
      setComposerOpen(false);
      await attachTerminal(result.repoPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to open repository.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEditorFile() {
    if (!repoPath || !editorPath.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const existing = workspace?.files.some((file) => file.path === editorPath.trim());
      const nextWorkspace = existing
        ? await window.gitObservatory.updateWorkspaceFile(repoPath, editorPath.trim(), editorContent)
        : await window.gitObservatory.createWorkspaceFile(repoPath, editorPath.trim(), editorContent);

      setWorkspace(nextWorkspace);
      await refreshState(repoPath, true);
      if (existing) {
        setComposerOpen(true);
        setSelection({ kind: "working-tree", path: editorPath.trim() });
      } else {
        setComposerOpen(false);
        setSelection(null);
        setEditorPath("README.md");
        setEditorContent("");
      }
      setInfoMessage(existing ? `${editorPath.trim()} saved.` : `${editorPath.trim()} created.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save the file.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEditorFile() {
    if (!repoPath || !editorPath.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const nextWorkspace = await window.gitObservatory.deleteWorkspaceFile(repoPath, editorPath.trim());
      setWorkspace(nextWorkspace);
      await refreshState(repoPath, true);
      setComposerOpen(false);
      setSelection(null);
      setEditorContent("");
      setInfoMessage(`${editorPath.trim()} deleted.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete the file.");
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(selectionValue: GraphSelection) {
    setSelection(selectionValue);
    setInspectorTab("what");
    setInspectorCollapsed(false);
    setComposerOpen(false);
    if (selectionValue.kind === "working-tree") {
      setDetailPanel("working");
      setComposerOpen(true);
    } else if (selectionValue.kind === "staging") {
      setDetailPanel("staging");
      setComposerOpen(true);
    }
    if (selectionValue.kind === "composer") {
      setComposerOpen(true);
      setEditorPath("README.md");
      setEditorContent("");
    }
  }

  function handleRunTeachingCommand(command: string) {
    const sessionId = terminalSession?.id ?? null;
      if (!sessionId) {
        setError("Open a repository or create a practice sandbox first.");
        return;
      }

      setTerminalCollapsed(false);
      writeToTerminalSession(`${command}\r`);
      scheduleCommandRefresh();
      focusTerminalInput();
  }

  async function handleOpenSystemTerminal() {
    if (!repoPath) {
      return;
    }

    try {
      await window.gitObservatory.openSystemTerminal(repoPath);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to open a system terminal.");
    }
  }

  function toggleFilter(key: keyof GraphVisibilityFilters) {
    setFilters((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  function toggleSelectedTreeExpansion() {
    if (selection?.kind !== "node" || !graph) {
      return;
    }

    const node = graph.nodes.find((item) => item.id === selection.id);
    if (!node || node.type !== "tree" || !node.oid) {
      return;
    }

    setExpansionState((current) => ({
      expandedTreeOids: current.expandedTreeOids.includes(node.oid!)
        ? current.expandedTreeOids.filter((oid) => oid !== node.oid)
        : [...current.expandedTreeOids, node.oid!]
    }));
  }

  const editorVisible =
    composerOpen ||
    selection?.kind === "working-tree" ||
    (selection?.kind === "staging" && Boolean(workspace?.files.some((file) => file.path === selection.path)));

  const selectedWorkspaceFilePath =
    selection?.kind === "working-tree" || selection?.kind === "staging" ? selection.path : null;

  const selectedTreeNode =
    selection?.kind === "node" ? graph?.nodes.find((node) => node.id === selection.id && node.type === "tree") ?? null : null;
  const selectedTreeExpanded = Boolean(selectedTreeNode?.oid && expansionState.expandedTreeOids.includes(selectedTreeNode.oid));
  const repoName = repoPath ? repoPath.split(/[\\/]/).at(-1) ?? repoPath : "No repo loaded";
  const workingCount = graph?.workingArea.length ?? 0;
  const stagingCount = graph?.stagingArea.length ?? 0;
  const workspaceCount = workspace?.files.length ?? 0;

  if (!repoPath) {
    return (
      <div className="graph-app graph-app--landing">
        <section className="landing-shell">
          <div className="landing-shell__hero">
            <span className="landing-shell__kicker">Git Internals Observatory</span>
            <h1>See how Git changes under the hood.</h1>
            <p>
              Open a repository or start a disposable practice repo. The graph becomes the primary surface once a repo is loaded.
            </p>
          </div>

          <div className="landing-shell__actions">
            <button disabled={busy} onClick={createPracticeRepo} type="button">
              Create Practice Repo
            </button>
            <button className="go-secondary" disabled={busy} onClick={openRepository} type="button">
              Open Repository
            </button>
          </div>

          <div className="landing-shell__cards">
            <article className="landing-card">
              <strong>Practice safely</strong>
              <p>Use a disposable sandbox. It is deleted automatically when the app closes.</p>
            </article>
            <article className="landing-card">
              <strong>Run real commands</strong>
              <p>Use the built-in terminal and watch refs, commits, trees, and blobs update in place.</p>
            </article>
            <article className="landing-card">
              <strong>Inspect any object</strong>
              <p>Click nodes to see what they represent, where they live in Git, and which commands expose them.</p>
            </article>
          </div>

          {error ? <section className="message-banner message-banner--error">{error}</section> : null}
          {infoMessage ? <section className="message-banner">{infoMessage}</section> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="graph-app">
      <header className="graph-topbar">
        <div className="graph-topbar__primary">
          <div className="graph-topbar__identity">
            <span className="graph-topbar__kicker">Git Internals Observatory</span>
            <h1>Git structure explorer</h1>
          </div>
          <div className="graph-topbar__actions">
            <button disabled={busy} onClick={createPracticeRepo} type="button">
              Create Practice Repo
            </button>
            <button className="go-secondary" disabled={busy} onClick={openRepository} type="button">
              Open Repository
            </button>
            <button
              className="go-secondary"
              disabled={!repoPath || busy}
              onClick={() => {
                setComposerOpen(true);
                setSelection(null);
                setInspectorCollapsed(false);
                setEditorPath("README.md");
                setEditorContent("");
              }}
              type="button"
            >
              New File
            </button>
            <button className="go-secondary" disabled={!repoPath || busy} onClick={() => void refreshState()} type="button">
              Refresh
            </button>
            <button className="go-secondary" disabled={!repoPath || busy} onClick={() => void handleOpenSystemTerminal()} type="button">
              System Terminal
            </button>
            <button
              className="go-secondary"
              disabled={!repoPath || attachingTerminal}
              onClick={() => {
                setTerminalCollapsed((value) => {
                  const next = !value;
                  if (!next) {
                    window.requestAnimationFrame(() => {
                      syncTerminalSize();
                      focusTerminalInput();
                    });
                  }
                  return next;
                });
              }}
              type="button"
            >
              {terminalCollapsed ? "Show Terminal" : "Hide Terminal"}
            </button>
            <button className="go-secondary" disabled={!selection && inspectorCollapsed} onClick={() => setInspectorCollapsed((value) => !value)} type="button">
              {inspectorCollapsed ? "Show Inspector" : "Hide Inspector"}
            </button>
          </div>
        </div>

        <div className="graph-topbar__secondary">
          <div className="graph-topbar__meta">
            <div className="graph-topbar__meta-pill">
              <span>{mode === "practice" ? "Practice" : "Repository"}</span>
              <strong>{repoName}</strong>
            </div>
            <div className="graph-topbar__meta-pill">
              <span>Lifecycle</span>
              <strong>{sandbox ? "Disposable" : "User-owned"}</strong>
            </div>
          </div>

          <div className="graph-topbar__filters">
            <label>
              <input checked={filters.showRefs} onChange={() => toggleFilter("showRefs")} type="checkbox" />
              Refs
            </label>
            <label>
              <input checked={filters.showTrees} onChange={() => toggleFilter("showTrees")} type="checkbox" />
              Trees
            </label>
            <label>
              <input checked={filters.showBlobs} onChange={() => toggleFilter("showBlobs")} type="checkbox" />
              Blobs
            </label>
            <label>
              <input checked={filters.showTags} onChange={() => toggleFilter("showTags")} type="checkbox" />
              Tags
            </label>
          </div>
        </div>
      </header>

      {error ? <section className="message-banner message-banner--error">{error}</section> : null}
      {infoMessage ? <section className="message-banner">{infoMessage}</section> : null}
      {lastExternalChange ? <section className="message-banner message-banner--subtle">{lastExternalChange}</section> : null}

      <div className={inspectorCollapsed ? "graph-layout graph-layout--full" : "graph-layout"}>
        <div className="graph-layout__main">
          {snapshot && graph ? (
            <GraphCanvas
              graph={graph}
              onSelectNode={handleSelect}
              subtitle="Run a command below and watch Git's saved structure change in the canvas."
              title={
                <span className="go-title-with-info">
                  History Graph
                  <InfoBadge
                    label="History Graph"
                    summary="This is the saved Git structure: HEAD, refs, commits, trees, and blobs."
                    details={
                      <ul className="go-info__list">
                        <li>HEAD shows what you currently have checked out.</li>
                        <li>Refs show branch or tag pointers.</li>
                        <li>Commits, trees, and blobs show Git's saved objects.</li>
                      </ul>
                    }
                  />
                </span>
              }
            />
          ) : (
            <Panel title="Git Structure" subtitle="The graph is the primary surface of the app.">
              <EmptyState message="Create a practice repo or open an existing repository to start visualizing Git internals." />
            </Panel>
          )}

          <div className={terminalCollapsed ? "graph-terminal-drawer is-collapsed" : "graph-terminal-drawer"}>
            <Panel
              actions={
                <div className="go-terminal-toolbar">
                  <button
                    className="go-secondary"
                    disabled={!terminalRef.current}
                    onClick={() => terminalRef.current?.clear()}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              }
              title="Terminal"
            >
              <div className={terminalCollapsed ? "go-terminal-shell is-collapsed" : "go-terminal-shell"}>
                <div
                  className="go-terminal-resize-handle"
                  onMouseDown={(event) => {
                    dragStartRef.current = { y: event.clientY, height: terminalHeight };
                    setIsResizingTerminal(true);
                  }}
                />
                <div
                  className={terminalCollapsed ? "go-terminal-host is-collapsed" : "go-terminal-host"}
                  onClick={() => {
                    if (!terminalCollapsed) {
                      focusTerminalInput();
                    }
                  }}
                  ref={terminalHostRef}
                  tabIndex={terminalCollapsed ? -1 : 0}
                >
                  <div
                    className="go-terminal-surface"
                    ref={terminalContainerRef}
                    style={{ height: terminalCollapsed ? "0px" : `${terminalHeight}px` }}
                  />
                </div>
                <pre aria-hidden="true" className="go-terminal-debug-probe" data-testid="terminal-output-probe" ref={terminalDebugProbeRef} />
              </div>
            </Panel>
          </div>

        </div>

        {!inspectorCollapsed ? (
          <div className="graph-layout__inspector">
            {editorVisible ? (
              <Panel
                actions={
                  <button
                    className="go-secondary"
                    onClick={() => {
                      setComposerOpen(false);
                      setSelection(null);
                      setEditorPath("README.md");
                      setEditorContent("");
                    }}
                    type="button"
                  >
                    Close
                  </button>
                }
                title="Workspace File"
                subtitle="Create or edit a file directly from the right rail."
              >
                <div className="graph-editor">
                  <div className="graph-editor__header">
                    <strong>{selectedWorkspaceFilePath ? "Edit file" : "Create a file"}</strong>
                    {selectedWorkspaceFilePath ? <span>{selectedWorkspaceFilePath}</span> : <span>New file</span>}
                  </div>
                  <input
                    onChange={(event) => setEditorPath(event.target.value)}
                    placeholder="README.md"
                    spellCheck={false}
                    value={editorPath}
                  />
                  <textarea
                    onChange={(event) => setEditorContent(event.target.value)}
                    placeholder="File content"
                    value={editorContent}
                  />
                  <div className="graph-editor__actions">
                    <button disabled={!repoPath || busy} onClick={() => void saveEditorFile()} type="button">
                      Save File
                    </button>
                    <button
                      className="go-secondary"
                      disabled={!repoPath || busy || !workspace?.files.some((file) => file.path === editorPath.trim())}
                      onClick={() => void deleteEditorFile()}
                      type="button"
                    >
                      Delete File
                    </button>
                  </div>
                </div>
              </Panel>
            ) : null}

            <Panel
              title={
                <span className="go-title-with-info">
                  What Changed
                  <InfoBadge
                    label="What Changed"
                    summary="These are the only two live areas that matter before the next commit: what changed on disk, and what Git has staged."
                  />
                </span>
              }
              subtitle="Open the list only when you want the file-level detail."
            >
              <div className="go-summary-chip-grid">
                <button
                  className={detailPanel === "working" ? "go-summary-chip is-active" : "go-summary-chip"}
                  onClick={() => setDetailPanel((current) => (current === "working" ? null : "working"))}
                  type="button"
                >
                  <strong>{workingCount}</strong>
                  <span>Working Tree</span>
                </button>
                <button
                  className={detailPanel === "staging" ? "go-summary-chip is-active" : "go-summary-chip"}
                  onClick={() => setDetailPanel((current) => (current === "staging" ? null : "staging"))}
                  type="button"
                >
                  <strong>{stagingCount}</strong>
                  <span>Index</span>
                </button>
                <div className="go-summary-chip">
                  <strong>{workspaceCount}</strong>
                  <span>Workspace Files</span>
                </div>
              </div>
            </Panel>

            {detailPanel === "working" ? (
              <StatusPanel
                items={graph?.workingArea ?? []}
                kind="working"
                onSelect={handleSelect}
                selection={selection}
                subtitle="Files currently different from Git's last committed or staged view."
                title="Working Tree Details"
              />
            ) : null}

            {detailPanel === "staging" ? (
              <StatusPanel
                items={graph?.stagingArea ?? []}
                kind="staging"
                onSelect={handleSelect}
                selection={selection}
                subtitle="Index entries that Git is prepared to turn into the next commit."
                title="Index Details"
              />
            ) : null}

            <div className="graph-inspector-panel">
              <InspectorPanel
                inspector={selection?.kind === "composer" ? null : inspector}
                onRunTeachingCommand={handleRunTeachingCommand}
                onSelectTab={setInspectorTab}
                selectedTab={inspectorTab}
              >
                {selectedTreeNode ? (
                  <div className="graph-inspector-actions">
                    <button className="go-secondary" onClick={toggleSelectedTreeExpansion} type="button">
                      {selectedTreeExpanded ? "Collapse Tree In Graph" : "Expand Tree In Graph"}
                    </button>
                  </div>
                ) : null}
              </InspectorPanel>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
