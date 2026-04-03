import { ReactNode } from "react";
import {
  GraphSelection,
  GraphViewModel,
  InspectorModel,
  InspectorTab,
  TerminalSessionModel
} from "@git-observatory/core-domain";

function truncate(value: string, length = 12): string {
  return value.length <= length ? value : `${value.slice(0, length)}...`;
}

function statusLabel(indexStatus: string, workTreeStatus: string): string {
  if (indexStatus === "?" && workTreeStatus === "?") {
    return "untracked";
  }
  const left = indexStatus.trim() || "-";
  const right = workTreeStatus.trim() || "-";
  return `${left}/${right}`;
}

export function InfoBadge(props: { label: string; summary: string; details?: ReactNode }) {
  return (
    <details className="go-info">
      <summary aria-label={`About ${props.label}`} title={`About ${props.label}`}>
        i
      </summary>
      <div className="go-info__popover">
        <strong>{props.label}</strong>
        <p>{props.summary}</p>
        {props.details ? <div className="go-info__details">{props.details}</div> : null}
      </div>
    </details>
  );
}

export function Panel(props: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="go-panel">
      <div className="go-panel__header">
        <div>
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>
        {props.actions ? <div className="go-panel__actions">{props.actions}</div> : null}
      </div>
      <div className="go-panel__body">{props.children}</div>
    </section>
  );
}

export function EmptyState(props: { message: string; action?: ReactNode }) {
  return (
    <div className="go-empty">
      <p>{props.message}</p>
      {props.action ? <div className="go-empty__action">{props.action}</div> : null}
    </div>
  );
}

function nodeSize(type: GraphViewModel["nodes"][number]["type"]) {
  switch (type) {
    case "head":
      return 72;
    case "ref":
      return 84;
    case "commit":
      return 110;
    case "tree":
      return 84;
    case "blob":
      return 88;
    default:
      return 88;
  }
}

function nodeCaption(type: GraphViewModel["nodes"][number]["type"]) {
  switch (type) {
    case "head":
      return "HEAD";
    case "ref":
      return "REF";
    case "commit":
      return "COMMIT";
    case "tree":
      return "TREE";
    case "blob":
      return "BLOB";
    default:
      return "";
  }
}

function selectionMatches(selection: GraphSelection | null, target: GraphSelection): boolean {
  if (!selection) {
    return false;
  }

  return JSON.stringify(selection) === JSON.stringify(target);
}

function edgeLabel(relationship: GraphViewModel["edges"][number]["relationship"]): string {
  switch (relationship) {
    case "parent":
      return "parent";
    case "contains":
      return "contains";
    case "points-to":
      return "points to";
    case "symbolic":
      return "symbolic";
    default:
      return relationship;
  }
}

function shouldRenderEdgeLabel(relationship: GraphViewModel["edges"][number]["relationship"]): boolean {
  return relationship !== "contains";
}

export function GraphCanvas(props: {
  graph?: GraphViewModel | null;
  onSelectNode: (selection: GraphSelection) => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const graph = props.graph;

  if (!graph || graph.nodes.length === 0) {
    return (
      <Panel title="Git Structure" subtitle="Open a repository or create a practice sandbox to render the live Git graph.">
        <EmptyState message="No repository loaded yet." />
      </Panel>
    );
  }

  const width = Math.max(...graph.nodes.map((node) => node.position.x + nodeSize(node.type) + 120), 880);
  const height = Math.max(...graph.nodes.map((node) => node.position.y + nodeSize(node.type) + 120), 560);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const visibleTypes = new Set(graph.nodes.map((node) => node.type));

  return (
    <Panel
      title={props.title ?? "Git Structure"}
      subtitle={props.subtitle ?? "HEAD, refs, commits, trees, and blobs update after every command or refresh."}
      actions={
        <div className="go-graph-canvas-actions">
          <div className="go-legend">
            {visibleTypes.has("head") ? <span className="go-legend__item go-legend__item--head">HEAD</span> : null}
            {visibleTypes.has("ref") ? <span className="go-legend__item go-legend__item--ref">Refs</span> : null}
            {visibleTypes.has("commit") ? <span className="go-legend__item go-legend__item--commit">Commits</span> : null}
            {visibleTypes.has("tree") ? <span className="go-legend__item go-legend__item--tree">Trees</span> : null}
            {visibleTypes.has("blob") ? <span className="go-legend__item go-legend__item--blob">Blobs</span> : null}
            <span className="go-legend__edge go-legend__edge--parent">parent</span>
            <span className="go-legend__edge go-legend__edge--contains">contains</span>
            <span className="go-legend__edge go-legend__edge--points">points to</span>
          </div>
          {props.actions}
        </div>
      }
    >
      <div className="go-graph-scroll">
        <div className="go-graph-stage" style={{ width, height }}>
          <svg className="go-graph-svg" height={height} width={width}>
            {graph.edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) {
                return null;
              }

              const sourceRadius = nodeSize(source.type) / 2;
              const targetRadius = nodeSize(target.type) / 2;
              const x1 = source.position.x + sourceRadius;
              const y1 = source.position.y + sourceRadius;
              const x2 = target.position.x + targetRadius;
              const y2 = target.position.y + targetRadius;

              return (
                <g key={edge.id}>
                  <line
                    className={`go-graph-edge go-graph-edge--${edge.relationship} ${edge.emphasis && edge.emphasis !== "default" ? `is-${edge.emphasis}` : ""}`}
                    x1={x1}
                    x2={x2}
                    y1={y1}
                    y2={y2}
                  />
                  {shouldRenderEdgeLabel(edge.relationship) ? (
                    <text
                      className={`go-graph-edge-label go-graph-edge-label--${edge.relationship}`}
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                    >
                      {edgeLabel(edge.relationship)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {graph.nodes.map((node) => {
            const size = nodeSize(node.type);
            const selection: GraphSelection = { kind: "node", id: node.id };
            const selected = selectionMatches(graph.selection, selection);

            return (
              <button
                className={`go-node go-node--${node.type} ${selected ? "is-selected" : ""} ${node.emphasis && node.emphasis !== "default" ? `is-${node.emphasis}` : ""}`}
                key={node.id}
                onClick={() => props.onSelectNode(selection)}
                style={{
                  width: size,
                  height: size,
                  left: node.position.x,
                  top: node.position.y
                }}
                type="button"
              >
                <span className="go-node__type">{nodeCaption(node.type)}</span>
                {node.type === "blob" ? (
                  <span className="go-node__badges">
                    {Boolean(node.metadata.staged) ? (
                      <span className="go-node__badge go-node__badge--staged">staged</span>
                    ) : null}
                    {typeof node.metadata.pathCount === "number" && node.metadata.pathCount > 1 ? (
                      <span className="go-node__badge go-node__badge--reused">{node.metadata.pathCount} paths</span>
                    ) : null}
                  </span>
                ) : null}
                <strong>{node.label}</strong>
                {node.oid ? <code>{truncate(node.oid, 7)}</code> : node.target ? <code>{node.target}</code> : null}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export function StatusPanel(props: {
  title: string;
  subtitle: string;
  kind: "working" | "staging";
  items: GraphViewModel["workingArea"] | GraphViewModel["stagingArea"];
  selection: GraphSelection | null;
  onSelect: (selection: GraphSelection) => void;
  actions?: ReactNode;
}) {
  return (
    <Panel actions={props.actions} title={props.title} subtitle={props.subtitle}>
      {props.items.length === 0 ? (
        <EmptyState message={props.kind === "working" ? "No working tree changes." : "No staged paths in the index."} />
      ) : (
        <div className="go-status-list">
          {props.kind === "working"
            ? (props.items as GraphViewModel["workingArea"]).map((item) => {
                const selection: GraphSelection = { kind: "working-tree", path: item.path };
                return (
                  <button
                    className={`go-status-item ${selectionMatches(props.selection, selection) ? "is-selected" : ""} ${item.emphasis && item.emphasis !== "default" ? `is-${item.emphasis}` : ""}`}
                    key={item.id}
                    onClick={() => props.onSelect(selection)}
                    type="button"
                  >
                    <span>{item.path}</span>
                    <strong>{statusLabel(item.indexStatus, item.workTreeStatus)}</strong>
                  </button>
                );
              })
            : (props.items as GraphViewModel["stagingArea"]).map((item) => {
                const selection: GraphSelection = { kind: "staging", path: item.path, stage: item.stage };
                return (
                  <button
                    className={`go-status-item ${selectionMatches(props.selection, selection) ? "is-selected" : ""} ${item.emphasis && item.emphasis !== "default" ? `is-${item.emphasis}` : ""}`}
                    key={item.id}
                    onClick={() => props.onSelect(selection)}
                    type="button"
                  >
                    <span>{item.path}</span>
                    <code>{truncate(item.oid, 7)}</code>
                  </button>
                );
              })}
        </div>
      )}
    </Panel>
  );
}

export function InspectorPanel(props: {
  inspector?: InspectorModel | null;
  selectedTab: InspectorTab;
  onSelectTab: (tab: InspectorTab) => void;
  onRunTeachingCommand?: (command: string) => void;
  children?: ReactNode;
}) {
  return (
    <Panel title="Inspector" subtitle="Click any node or file to inspect it in depth.">
      {!props.inspector ? (
        <EmptyState message="Select a node, working file, staged entry, or create a file to populate the inspector." action={props.children} />
      ) : (
        <div className="go-inspector">
          <div className="go-inspector__heading">
            <span>{props.inspector.kind}</span>
            <h3>{props.inspector.title}</h3>
            <p>{props.inspector.summary}</p>
          </div>

          <div className="go-tabs">
            {(["what", "internals", "mapping", "raw"] as InspectorTab[]).map((tab) => (
              <button
                className={props.selectedTab === tab ? "go-tab is-active" : "go-tab"}
                key={tab}
                onClick={() => props.onSelectTab(tab)}
                type="button"
              >
                {tab === "what"
                  ? "What this is"
                  : tab === "internals"
                    ? "Under the hood"
                    : tab === "mapping"
                      ? "How to inspect this"
                      : "Raw"}
              </button>
            ))}
          </div>

          {props.selectedTab === "what" ? (
            <div className="go-inspector-grid">
              <article className="go-inspector-card">
                <span>What this is</span>
                <p>{props.inspector.whatThisIs}</p>
              </article>
              <article className="go-inspector-card">
                <span>Why it matters</span>
                <p>{props.inspector.summary}</p>
              </article>
            </div>
          ) : null}
          {props.selectedTab === "internals" ? (
            <div className="go-inspector-grid">
              <article className="go-inspector-card">
                <span>Under the hood</span>
                <p>{props.inspector.underTheHood}</p>
              </article>
              <article className="go-inspector-card">
                <span>Key facts</span>
                <div className="go-field-list">
                  {props.inspector.fields.slice(0, 4).map((field) => (
                    <div className="go-field" key={`${field.label}:${field.value}`}>
                      <span>{field.label}</span>
                      {field.monospace ? <code>{field.value}</code> : <strong>{field.value}</strong>}
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
          {props.selectedTab === "mapping" ? (
            <div className="go-mapping">
              <div className="go-mapping__section">
                <span>Represents</span>
                <p>{props.inspector.teaching.represents}</p>
              </div>
              <div className="go-mapping__section">
                <span>Lives in</span>
                <ul className="go-mapping__list">
                  {props.inspector.teaching.locations.map((location) => (
                    <li key={location}>
                      <code>{location}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="go-mapping__section">
                <span>Commands to inspect</span>
                <div className="go-mapping__commands">
                  {props.inspector.teaching.commands.map((command) => (
                    <article className="go-mapping__command" key={`${command.label}:${command.command}`}>
                      <div className="go-mapping__command-header">
                        <strong>{command.label}</strong>
                        {props.onRunTeachingCommand ? (
                          <button className="go-secondary" onClick={() => props.onRunTeachingCommand?.(command.command)} type="button">
                            Run
                          </button>
                        ) : null}
                      </div>
                      <code>{command.command}</code>
                      <p>{command.description}</p>
                    </article>
                  ))}
                </div>
              </div>
              <div className="go-mapping__section">
                <span>Why this matters</span>
                <ul className="go-mapping__list">
                  {props.inspector.teaching.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {props.selectedTab === "raw" ? (
            <pre className="go-inspector__raw">{props.inspector.rawLines.join("\n") || "No raw payload available."}</pre>
          ) : null}

          {props.selectedTab === "mapping" || props.selectedTab === "raw" ? (
            <div className="go-field-list">
              {props.inspector.fields.map((field) => (
                <div className="go-field" key={`${field.label}:${field.value}`}>
                  <span>{field.label}</span>
                  {field.monospace ? <code>{field.value}</code> : <strong>{field.value}</strong>}
                </div>
              ))}
            </div>
          ) : null}

          {props.children ? <div className="go-inspector__footer">{props.children}</div> : null}
        </div>
      )}
    </Panel>
  );
}

export function TerminalDock(props: {
  terminal: TerminalSessionModel;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onReuseHistory: (command: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
  summary?: string;
}) {
  return (
    <Panel
      title="Terminal"
      subtitle={props.terminal.activeRepoPath ?? "Select a repo to run Git commands here."}
      actions={
        <div className="go-terminal-actions">
          {props.summary ? <span className="go-terminal-summary">{props.summary}</span> : null}
          <button className="go-secondary" disabled={props.disabled} onClick={props.onRefresh} type="button">
            Refresh
          </button>
        </div>
      }
    >
      <div className="go-terminal">
        <div className="go-terminal__history">
          {props.terminal.entries.length === 0 ? (
            <EmptyState message="Run a Git command to see stdout, stderr, and exit status here." />
          ) : (
            props.terminal.entries.map((entry) => (
              <article className="go-terminal-entry" key={entry.id}>
                <div className="go-terminal-entry__header">
                  <code>{entry.command}</code>
                  <span className={entry.exitCode === 0 ? "go-exit go-exit--ok" : "go-exit go-exit--fail"}>
                    exit {entry.exitCode}
                  </span>
                </div>
                {entry.stdout ? <pre>{entry.stdout}</pre> : null}
                {entry.stderr ? <pre className="go-terminal-entry__stderr">{entry.stderr}</pre> : null}
              </article>
            ))
          )}
        </div>

        <div className="go-terminal__footer">
          {props.terminal.history.length > 0 ? (
            <div className="go-history-chips">
              {props.terminal.history.slice(0, 6).map((command) => (
                <button className="go-history-chip" key={command} onClick={() => props.onReuseHistory(command)} type="button">
                  {command}
                </button>
              ))}
            </div>
          ) : null}

          <div className="go-command-row">
            <span className="go-command-row__prompt">git</span>
            <input
              disabled={props.disabled}
              onChange={(event) => props.onInputChange(event.target.value)}
              placeholder="status"
              spellCheck={false}
              value={props.terminal.currentInput}
            />
            <button disabled={props.disabled || props.terminal.pending} onClick={props.onRun} type="button">
              {props.terminal.pending ? "Running..." : "Run"}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
