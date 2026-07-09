/**
 * Galaxy orbital scene model — shared between mock prototype and main canvas.
 */

export type GalaxyNodeDecision = "pending" | "accepted" | "rejected" | "inactive";

export type GalaxyOrbitNode = {
  id: string;
  title: string;
  decision: GalaxyNodeDecision;
};

export type GalaxyScene = {
  /** Constellation / region identity for theming */
  constellationId: string;
  constellationTitle: string;
  /** Central sun node */
  centerId: string;
  centerTitle: string;
  /** Primary orbit discovery nodes */
  primaryNodes: GalaxyOrbitNode[];
  /** Parent of the active moon ring (null = no moons) */
  moonParentId: string | null;
  /** Secondary orbit nodes around moonParentId */
  moonNodes: GalaxyOrbitNode[];
  /** Panel / selection highlight */
  selectedNodeId: string | null;
  /** Nodes receiving ripple pulse animation */
  ripplePulseIds: string[];
  /** World-change ripple dims non-pulse nodes */
  worldRippleActive: boolean;
};
