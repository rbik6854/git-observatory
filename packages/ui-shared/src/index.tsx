import { ReactNode } from "react";
import {
  GraphSelection,
  GraphViewModel,
  InspectorModel,
  InspectorTab
} from "@git-observatory/core-domain";

function truncate(value: string, length = 12): string {
  return value.length <= length ? value : `${value.slice(0, length)}...`;
}

function statusName(status: string): string {
  switch (status) {
    case "A":
      return "new file";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "U":
      return "unmerged";
    case "?":
      return "untracked";
    case "!":
      return "ignored";
    default:
      return status.trim() ? `status ${status}` : "clean";
  }
}

function workingTreeStatusLabel(indexStatus: string, workTreeStatus: string): string {
  if (indexStatus === "?" && workTreeStatus === "?") {
    return "untracked";
  }

  if (workTreeStatus === "U" || indexStatus === "U") {
    return "conflicted";
  }

  return statusName(workTreeStatus);
}

function indexStatusLabel(stage: number, indexStatus: string): string {
  if (stage !== 0) {
    return `unmerged stage ${stage}`;
  }

  switch (indexStatus) {
    case "A":
      return "staged new file";
    case "M":
      return "staged modified";
    case "D":
      return "staged delete";
    case "R":
      return "staged rename";
    case "C":
      return "staged copy";
    case "U":
      return "unmerged conflict";
    default:
      return "staged";
  }
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

function nodeDimensions(type: GraphViewModel["nodes"][number]["type"]) {
  switch (type) {
    case "head":
      return { width: 70, height: 34 };
    case "ref":
      return { width: 96, height: 34 };
    case "commit":
      return { width: 118, height: 78 };
    case "tree":
      return { width: 86, height: 64 };
    case "blob":
      return { width: 90, height: 64 };
    default:
      return { width: 90, height: 64 };
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
  return false;
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

  const width = Math.max(...graph.nodes.map((node) => node.position.x + nodeDimensions(node.type).width + 120), 880);
  const height = Math.max(...graph.nodes.map((node) => node.position.y + nodeDimensions(node.type).height + 120), 560);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const visibleTypes = new Set(graph.nodes.map((node) => node.type));
  const renderedNodes = graph.nodes.filter((node) => node.type !== "head" && node.type !== "ref");
  const renderedNodeIds = new Set(renderedNodes.map((node) => node.id));
  const commitBadges = new Map<string, string[]>();

  function addCommitBadge(commitId: string | null | undefined, label: string): void {
    if (!commitId || !renderedNodeIds.has(commitId)) {
      return;
    }

    const labels = commitBadges.get(commitId) ?? [];
    if (!labels.includes(label)) {
      labels.push(label);
    }
    commitBadges.set(commitId, labels);
  }

  const headNode = graph.nodes.find((node) => node.type === "head");
  graph.nodes.forEach((node) => {
    if (node.type === "ref" && node.oid) {
      const activeSuffix = node.target && headNode?.target === node.target ? " *" : "";
      addCommitBadge(`commit:${node.oid}`, `${node.label}${activeSuffix}`);
    }
  });

  if (headNode?.oid) {
    addCommitBadge(`commit:${headNode.oid}`, "HEAD");
  }

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
            {graph.edges.filter((edge) => renderedNodeIds.has(edge.source) && renderedNodeIds.has(edge.target)).map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) {
                return null;
              }

              const sourceDimensions = nodeDimensions(source.type);
              const targetDimensions = nodeDimensions(target.type);
              const x1 = source.position.x + sourceDimensions.width / 2;
              const y1 = source.position.y + sourceDimensions.height / 2;
              const x2 = target.position.x + targetDimensions.width / 2;
              const y2 = target.position.y + targetDimensions.height / 2;

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

          {renderedNodes.map((node) => {
            const dimensions = nodeDimensions(node.type);
            const selection: GraphSelection = { kind: "node", id: node.id };
            const selected = selectionMatches(graph.selection, selection);
            const compactLabel = node.type === "head" || node.type === "ref";
            const refBadges = commitBadges.get(node.id) ?? [];

            return (
              <button
                className={`go-node go-node--${node.type} ${compactLabel ? "go-node--compact" : ""} ${selected ? "is-selected" : ""} ${node.emphasis && node.emphasis !== "default" ? `is-${node.emphasis}` : ""}`}
                key={node.id}
                onClick={() => props.onSelectNode(selection)}
                style={{
                  width: dimensions.width,
                  height: dimensions.height,
                  left: node.position.x,
                  top: node.position.y
                }}
                type="button"
              >
                {refBadges.length > 0 ? (
                  <span className="go-node__ref-badges">
                    {refBadges.map((label) => (
                      <span className={`go-node__ref-badge ${label === "HEAD" ? "go-node__ref-badge--head" : ""}`} key={label}>
                        {label}
                      </span>
                    ))}
                  </span>
                ) : null}
                {!compactLabel ? <span className="go-node__type">{nodeCaption(node.type)}</span> : null}
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
                {!compactLabel && node.oid ? <code>{truncate(node.oid, 7)}</code> : !compactLabel && node.target ? <code>{node.target}</code> : null}
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
                    <strong>{workingTreeStatusLabel(item.indexStatus, item.workTreeStatus)}</strong>
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
                    <strong>{indexStatusLabel(item.stage, item.indexStatus)}</strong>
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
