import type { CanonStructure } from "@/lib/canonStructure";
import { resolveNodeMeta } from "@/lib/worldNodes";
import type { ConstellationRegionId } from "@/lib/regions";

export type CanonLayer =
  | "origin"
  | "domain_truth"
  | "consequence"
  | "potential_future"
  | "unresolved";

export type LoreTreeNode = {
  id: string;
  flowId: string;
  position: { x: number; y: number };
  parentFlowId: string | null;
  canonLayer: CanonLayer;
  sectionLabel?: string;
  domainId?: ConstellationRegionId;
};

export type CanonLoreTree = {
  seedFlowId: string;
  seedPosition: { x: number; y: number };
  nodes: LoreTreeNode[];
};

const ROW_H = 72;
const COL_GAP = 240;
const SECTION_GAP = 48;

/** Structured canon graph — secondary visual aligned to bible sections. */
export function buildCanonStructuredTree(
  structure: CanonStructure,
): CanonLoreTree | null {
  if (
    structure.domains.length === 0 &&
    structure.unresolvedThreads.length === 0 &&
    structure.rippleConsequences.length === 0
  ) {
    return null;
  }

  const seedFlowId = "canon-seed";
  const nodes: LoreTreeNode[] = [];
  let yAcc = ROW_H + 20;

  const activeDomains = structure.domains;
  const colCount = Math.max(activeDomains.length, 1);
  const colOffset = ((colCount - 1) * COL_GAP) / 2;

  activeDomains.forEach((domain, colIndex) => {
    const colX = colIndex * COL_GAP - colOffset;
    let colY = yAcc;

    domain.truths.forEach((truth, i) => {
      nodes.push({
        id: truth.id,
        flowId: `domain-${domain.id}-${truth.id}`,
        position: { x: colX, y: colY },
        parentFlowId:
          i === 0 ? seedFlowId : `domain-${domain.id}-${domain.truths[i - 1].id}`,
        canonLayer: "domain_truth",
        domainId: domain.id,
      });
      colY += ROW_H;
    });
  });

  yAcc += ROW_H * 2 + SECTION_GAP;

  structure.unresolvedThreads.forEach((t, i) => {
    nodes.push({
      id: t.id,
      flowId: `unresolved-${t.id}`,
      position: { x: 0, y: yAcc + i * ROW_H },
      parentFlowId: seedFlowId,
      canonLayer: "unresolved",
    });
  });

  if (structure.unresolvedThreads.length > 0) {
    yAcc += structure.unresolvedThreads.length * ROW_H + SECTION_GAP;
  }

  const consSlice = structure.rippleConsequences.slice(0, 6);
  consSlice.forEach((c, i) => {
    const gap = 180;
    const offset = ((consSlice.length - 1) * gap) / 2;
    nodes.push({
      id: c.id,
      flowId: `consequence-${c.id}`,
      position: { x: i * gap - offset, y: yAcc },
      parentFlowId: seedFlowId,
      canonLayer: "consequence",
      sectionLabel: c.causedBy,
    });
  });

  if (consSlice.length > 0) {
    yAcc += ROW_H + SECTION_GAP;
  }

  structure.potentialFutures.forEach((future, i) => {
    const count = structure.potentialFutures.length;
    const gap = 200;
    const offset = ((count - 1) * gap) / 2;
    nodes.push({
      id: `future-${i}`,
      flowId: `future-${i}`,
      position: { x: i * gap - offset, y: yAcc },
      parentFlowId: seedFlowId,
      canonLayer: "potential_future",
      sectionLabel: future,
    });
  });

  return {
    seedFlowId,
    seedPosition: { x: 0, y: 0 },
    nodes,
  };
}

export function getCanonNodeTitle(id: string, worldSeedLabel: string): string {
  if (id.startsWith("future-")) return id;
  return resolveNodeMeta(id)?.title ?? worldSeedLabel;
}

export function buildCanonLoreTree(
  acceptedIds: string[],
  worldSeedLabel: string,
): CanonLoreTree | null {
  return null;
}

export function buildCanonEvolutionTree(
  _acceptedIds: string[],
  _worldSeedLabel: string,
  _themes: string[],
  _triggeredEvolutionIds: string[],
  _potentialFutures: string[],
): CanonLoreTree | null {
  return null;
}

export function buildCanonTimeline(
  acceptedIds: string[],
  worldSeedLabel: string,
): { seedPosition: { x: number; y: number }; routes: unknown[] } | null {
  const tree = buildCanonLoreTree(acceptedIds, worldSeedLabel);
  if (!tree) return null;
  return { seedPosition: tree.seedPosition, routes: [] };
}

export function resolveCanonLayer(_nodeId: string, _depth: number): CanonLayer {
  return "domain_truth";
}

export function canonRowHeight(_title: string): number {
  return ROW_H;
}
