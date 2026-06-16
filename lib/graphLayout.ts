/** Dynamic vertical spacing for future branch nodes. */
export function computeBranchSpacing(count: number, baseGap = 72): number {
  if (count <= 1) return 0;
  if (count === 2) return baseGap * 1.15;
  // Expand spacing as branch count grows to prevent overlap
  return baseGap + Math.max(0, count - 3) * 14;
}

/** Y positions for N future branches, centered on the current node. */
export function computeFutureYPositions(count: number, baseGap = 72): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  const spacing = computeBranchSpacing(count, baseGap);
  return Array.from({ length: count }, (_, j) => (j - (count - 1) / 2) * spacing);
}

export type LabelCollisionEntry = {
  id: string;
  x: number;
  y: number;
  priority: number;
};

const LABEL_W = 128;
const LABEL_H = 48;
const NODE_BELOW = 28;

type Box = { left: number; right: number; top: number; bottom: number };

function labelBox(x: number, y: number, offsetY: number): Box {
  const top = y + NODE_BELOW + offsetY;
  return {
    left: x - LABEL_W / 2,
    right: x + LABEL_W / 2,
    top,
    bottom: top + LABEL_H,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Resolve vertical label offsets to reduce overlap. Higher priority wins. */
export function resolveLabelOffsets(
  entries: LabelCollisionEntry[],
): Record<string, number> {
  const offsets: Record<string, number> = {};
  for (const e of entries) offsets[e.id] = 0;

  const sorted = [...entries].sort((a, b) => b.priority - a.priority);
  const placed: Box[] = [];

  for (const entry of sorted) {
    let offset = 0;
    let box = labelBox(entry.x, entry.y, offset);
    let guard = 0;
    while (placed.some((p) => overlaps(p, box)) && guard < 24) {
      offset += 16;
      box = labelBox(entry.x, entry.y, offset);
      guard++;
    }
    offsets[entry.id] = offset;
    placed.push(box);
  }

  return offsets;
}

export function labelPriority(
  journeyPhase: "past" | "current" | "future" | undefined,
  role: string,
  isSelected: boolean,
): number {
  if (isSelected) return 100;
  if (journeyPhase === "current" || role === "focused") return 80;
  if (journeyPhase === "future") return 60;
  if (journeyPhase === "past") return 40;
  return 50;
}
