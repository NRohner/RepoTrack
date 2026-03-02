import { useMemo } from "react";
import type { GitCommitInfo } from "@/lib/types";

const LANE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

const ROW_HEIGHT = 36;
const LANE_WIDTH = 20;
const NODE_RADIUS = 5;
const GRAPH_PADDING_LEFT = 16;
const GRAPH_PADDING_TOP = 18;

interface CommitPosition {
  row: number;
  col: number;
  commit: GitCommitInfo;
}

interface Edge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  color: string;
}

function buildGraph(commits: GitCommitInfo[]): {
  positions: CommitPosition[];
  edges: Edge[];
  maxCol: number;
} {
  const positions: CommitPosition[] = [];
  const hashToPos = new Map<string, { row: number; col: number }>();

  // Active lanes: each tracks which commit hash it's waiting for next
  const activeLanes: (string | null)[] = [];

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];

    // Find which lane(s) are expecting this commit
    const matchingLanes: number[] = [];
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === commit.hash) {
        matchingLanes.push(i);
      }
    }

    let col: number;
    if (matchingLanes.length > 0) {
      // Use the leftmost matching lane
      col = matchingLanes[0];
      // Free up other matching lanes (they converge here at a merge)
      for (let i = 1; i < matchingLanes.length; i++) {
        activeLanes[matchingLanes[i]] = null;
      }
    } else {
      // This commit wasn't expected by any lane — start of a new branch
      // Find the first empty lane or append
      const emptyIdx = activeLanes.indexOf(null);
      if (emptyIdx !== -1) {
        col = emptyIdx;
      } else {
        col = activeLanes.length;
        activeLanes.push(null);
      }
    }

    // Record position
    hashToPos.set(commit.hash, { row, col });
    positions.push({ row, col, commit });

    // Update active lanes for parents
    if (commit.parent_hashes.length === 0) {
      // Root commit — lane ends here
      activeLanes[col] = null;
    } else {
      // First parent continues in the same lane
      activeLanes[col] = commit.parent_hashes[0];

      // Additional parents (merge): each gets its own lane
      for (let pi = 1; pi < commit.parent_hashes.length; pi++) {
        const parentHash = commit.parent_hashes[pi];

        // Check if any existing lane is already tracking this parent
        // (can happen if another branch also points to same parent)
        const existingLane = activeLanes.indexOf(parentHash);
        if (existingLane === -1) {
          // Need a new lane for this parent
          const emptyIdx = activeLanes.indexOf(null);
          if (emptyIdx !== -1) {
            activeLanes[emptyIdx] = parentHash;
          } else {
            activeLanes.push(parentHash);
          }
        }
      }
    }
  }

  // Now build edges: for each commit, draw an edge to each parent.
  // Color edges by the SOURCE commit's lane — this makes merge curves
  // visually distinct from the lane they merge into.
  const edges: Edge[] = [];
  for (const pos of positions) {
    for (const parentHash of pos.commit.parent_hashes) {
      const parentPos = hashToPos.get(parentHash);
      if (parentPos) {
        edges.push({
          fromRow: pos.row,
          fromCol: pos.col,
          toRow: parentPos.row,
          toCol: parentPos.col,
          color: LANE_COLORS[pos.col % LANE_COLORS.length],
        });
      } else {
        // Parent not in visible commits — draw line going off bottom
        edges.push({
          fromRow: pos.row,
          fromCol: pos.col,
          toRow: positions.length, // off the bottom
          toCol: pos.col,
          color: LANE_COLORS[pos.col % LANE_COLORS.length],
        });
      }
    }
  }

  const maxCol = positions.reduce((max, p) => Math.max(max, p.col), 0);
  return { positions, edges, maxCol };
}


function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface GitGraphProps {
  commits: GitCommitInfo[];
  selectedHash: string | null;
  onSelectCommit: (commit: GitCommitInfo) => void;
  unpushedHashes: Set<string>;
}

export function GitGraph({ commits, selectedHash, onSelectCommit, unpushedHashes }: GitGraphProps) {
  const { positions, edges, maxCol } = useMemo(() => buildGraph(commits), [commits]);

  const graphWidth = GRAPH_PADDING_LEFT + (maxCol + 1) * LANE_WIDTH + 12;

  // Find the row index where unpushed ends and pushed begins (for the separator)
  const separatorAfterRow = useMemo(() => {
    if (unpushedHashes.size === 0) return -1;
    for (let i = 0; i < positions.length; i++) {
      if (!unpushedHashes.has(positions[i].commit.hash)) return i;
    }
    return positions.length; // all commits are unpushed
  }, [positions, unpushedHashes]);

  const hasSeparator = separatorAfterRow > 0 && separatorAfterRow < positions.length;
  const SEPARATOR_HEIGHT = hasSeparator ? 28 : 0;
  const totalHeight = commits.length * ROW_HEIGHT + GRAPH_PADDING_TOP * 2 + SEPARATOR_HEIGHT;

  // Helper: get the Y position accounting for the separator
  const getRowY = (row: number) => {
    const base = GRAPH_PADDING_TOP + row * ROW_HEIGHT;
    if (hasSeparator && row >= separatorAfterRow) return base + SEPARATOR_HEIGHT;
    return base;
  };

  // Recalculate edge paths with separator offset
  function renderEdgePathWithSep(edge: Edge): string {
    const x1 = GRAPH_PADDING_LEFT + edge.fromCol * LANE_WIDTH;
    const y1 = getRowY(edge.fromRow);
    const x2 = GRAPH_PADDING_LEFT + edge.toCol * LANE_WIDTH;
    const y2 = getRowY(edge.toRow);

    if (edge.fromCol === edge.toCol) {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const curveStartY = y1 + ROW_HEIGHT * 0.5;
    const curveEndY = y2 - ROW_HEIGHT * 0.5;

    if (edge.toRow - edge.fromRow === 1) {
      const midY = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }

    return `M ${x1} ${y1} L ${x1} ${curveStartY} C ${x1} ${(curveStartY + curveEndY) / 2}, ${x2} ${(curveStartY + curveEndY) / 2}, ${x2} ${curveEndY} L ${x2} ${y2}`;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minHeight: totalHeight }} className="relative">
        {/* Unpushed background band — full-width amber tint */}
        {unpushedHashes.size > 0 && separatorAfterRow > 0 && (
          <div
            className="absolute left-0 right-0 bg-amber-500/[0.07] dark:bg-amber-500/[0.05] border-l-[3px] border-amber-500"
            style={{
              top: 0,
              height: getRowY(separatorAfterRow) - ROW_HEIGHT / 2 + GRAPH_PADDING_TOP,
            }}
          />
        )}

        {/* Separator line between unpushed and pushed */}
        {hasSeparator && (
          <div
            className="absolute left-0 right-0 flex items-center px-3"
            style={{
              top: getRowY(separatorAfterRow) - SEPARATOR_HEIGHT - ROW_HEIGHT / 2 + GRAPH_PADDING_TOP,
              height: SEPARATOR_HEIGHT,
            }}
          >
            <div className="flex-1 border-t border-dashed border-amber-500/40" />
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500/70 shrink-0">
              pushed to remote
            </span>
            <div className="flex-1 border-t border-dashed border-amber-500/40" />
          </div>
        )}

        {/* SVG graph */}
        <svg
          className="absolute left-0 top-0 pointer-events-none"
          width={graphWidth}
          height={totalHeight}
        >
          {/* Edges (lines connecting commits to parents) */}
          {edges.map((edge, i) => (
            <path
              key={`edge-${i}`}
              d={renderEdgePathWithSep(edge)}
              stroke={edge.color}
              strokeWidth={2}
              fill="none"
              opacity={0.6}
            />
          ))}

          {/* Commit nodes (drawn on top of lines) */}
          {positions.map((pos, i) => {
            const x = GRAPH_PADDING_LEFT + pos.col * LANE_WIDTH;
            const y = getRowY(pos.row);
            const color = LANE_COLORS[pos.col % LANE_COLORS.length];
            const r = pos.commit.is_merge ? NODE_RADIUS + 1 : NODE_RADIUS;
            const isUnpushed = unpushedHashes.has(pos.commit.hash);
            const isSelected = selectedHash === pos.commit.hash;

            return isUnpushed ? (
              <g key={`node-${i}`} className="cursor-pointer" style={{ pointerEvents: "all" }} onClick={() => onSelectCommit(pos.commit)}>
                {/* Selection glow for unpushed */}
                {isSelected && (
                  <circle cx={x} cy={y} r={r + 6} fill={color} opacity={0.25} />
                )}
                {/* Outer ring for unpushed */}
                <circle cx={x} cy={y} r={r + 3} fill="none" stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} opacity={isSelected ? 0.9 : 0.4} />
                <circle cx={x} cy={y} r={r} fill={color} stroke={isSelected ? "white" : color} strokeWidth={2} />
                {/* Up-arrow inside the node */}
                <path
                  d={`M ${x} ${y - 2.5} l -2 2.5 h 1.3 v 2 h 1.4 v -2 h 1.3 z`}
                  fill="white"
                  opacity={0.9}
                />
              </g>
            ) : (
              <circle
                key={`node-${i}`}
                cx={x}
                cy={y}
                r={r}
                fill={isSelected ? color : "white"}
                stroke={color}
                strokeWidth={2}
                className="cursor-pointer"
                style={{ pointerEvents: "all" }}
                onClick={() => onSelectCommit(pos.commit)}
              />
            );
          })}
        </svg>

        {/* Commit info rows */}
        {positions.map((pos) => {
          const isUnpushed = unpushedHashes.has(pos.commit.hash);
          const rowY = getRowY(pos.row);
          return (
            <div
              key={pos.commit.hash}
              className={`absolute right-0 flex items-center cursor-pointer transition-colors ${
                selectedHash === pos.commit.hash
                  ? "bg-accent-600/20 ring-1 ring-inset ring-accent-500/30"
                  : "hover:bg-surface-100 dark:hover:bg-surface-800"
              }`}
              style={{
                height: ROW_HEIGHT,
                top: rowY - ROW_HEIGHT / 2,
                left: graphWidth,
                paddingLeft: 8,
              }}
              onClick={() => onSelectCommit(pos.commit)}
            >
              <span className="text-xs font-mono text-accent-500 w-16 shrink-0">
                {pos.commit.short_hash}
              </span>
              <span className="text-sm dark:text-white truncate flex-1 min-w-0 mx-2">
                {pos.commit.message}
                {isUnpushed && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-500">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    unpushed
                  </span>
                )}
                {pos.commit.refs.length > 0 &&
                  pos.commit.refs.map((r) => (
                    <span
                      key={r}
                      className="ml-1.5 inline-flex px-1.5 py-0 rounded text-[10px] font-medium bg-accent-600/15 text-accent-500"
                    >
                      {r}
                    </span>
                  ))}
              </span>
              <span className="text-xs text-surface-400 shrink-0 w-24 text-right">
                {pos.commit.author}
              </span>
              <span className="text-xs text-surface-400 shrink-0 w-20 text-right ml-2">
                {formatRelativeTime(pos.commit.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
