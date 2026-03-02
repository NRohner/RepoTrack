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

function renderEdgePath(edge: Edge): string {
  const x1 = GRAPH_PADDING_LEFT + edge.fromCol * LANE_WIDTH;
  const y1 = GRAPH_PADDING_TOP + edge.fromRow * ROW_HEIGHT;
  const x2 = GRAPH_PADDING_LEFT + edge.toCol * LANE_WIDTH;
  const y2 = GRAPH_PADDING_TOP + edge.toRow * ROW_HEIGHT;

  if (edge.fromCol === edge.toCol) {
    // Same column: straight vertical line
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // Different columns: curve from commit down, then over to parent's column
  // Go straight down one half-row, curve to the target column, then go straight down
  const curveStartY = y1 + ROW_HEIGHT * 0.5;
  const curveEndY = y2 - ROW_HEIGHT * 0.5;

  if (edge.toRow - edge.fromRow === 1) {
    // Adjacent rows: simple S-curve
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  // Multi-row gap: go down, curve over, then go down to parent
  return `M ${x1} ${y1} L ${x1} ${curveStartY} C ${x1} ${(curveStartY + curveEndY) / 2}, ${x2} ${(curveStartY + curveEndY) / 2}, ${x2} ${curveEndY} L ${x2} ${y2}`;
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
}

export function GitGraph({ commits, selectedHash, onSelectCommit }: GitGraphProps) {
  const { positions, edges, maxCol } = useMemo(() => buildGraph(commits), [commits]);

  const graphWidth = GRAPH_PADDING_LEFT + (maxCol + 1) * LANE_WIDTH + 12;
  const totalHeight = commits.length * ROW_HEIGHT + GRAPH_PADDING_TOP * 2;

  return (
    <div className="flex-1 overflow-auto">
      <div style={{ minHeight: totalHeight }} className="relative">
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
              d={renderEdgePath(edge)}
              stroke={edge.color}
              strokeWidth={2}
              fill="none"
              opacity={0.6}
            />
          ))}

          {/* Commit nodes (drawn on top of lines) */}
          {positions.map((pos, i) => {
            const x = GRAPH_PADDING_LEFT + pos.col * LANE_WIDTH;
            const y = GRAPH_PADDING_TOP + pos.row * ROW_HEIGHT;
            const color = LANE_COLORS[pos.col % LANE_COLORS.length];
            const r = pos.commit.is_merge ? NODE_RADIUS + 1 : NODE_RADIUS;

            return (
              <circle
                key={`node-${i}`}
                cx={x}
                cy={y}
                r={r}
                fill={selectedHash === pos.commit.hash ? color : "white"}
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
        {positions.map((pos) => (
          <div
            key={pos.commit.hash}
            className={`flex items-center cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors ${
              selectedHash === pos.commit.hash ? "bg-accent-600/10" : ""
            }`}
            style={{
              height: ROW_HEIGHT,
              paddingLeft: graphWidth + 8,
              marginTop: pos.row === 0 ? GRAPH_PADDING_TOP - ROW_HEIGHT / 2 : 0,
            }}
            onClick={() => onSelectCommit(pos.commit)}
          >
            <span className="text-xs font-mono text-accent-500 w-16 shrink-0">
              {pos.commit.short_hash}
            </span>
            <span className="text-sm dark:text-white truncate flex-1 min-w-0 mx-2">
              {pos.commit.message}
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
        ))}
      </div>
    </div>
  );
}
