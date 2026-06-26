import type { ConstellationRegionId } from "@/lib/regions";

export type Discovery = {
  id: string;
  title: string;
  description: string;
  category: string;
  whyItMatters: string;
};

export type DiscoveryDecision = "pending" | "accepted" | "saved" | "rejected";

export type DiscoveryAction = "accept" | "save" | "reject" | "unaccept";

export type WorldConsequence = {
  id: string;
  title: string;
  description: string;
  category: string;
  whyItMatters?: string;
  parentId: string;
};

export type WorldRelationship = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
};

export type AiDiscovery = Discovery & {
  /** present only on AI-generated nodes */
  sourceAgent?: string;
  rippleHint?: string;
  generated?: true;
};

export type PanelItem =
  | { kind: "discovery"; discovery: Discovery }
  | { kind: "ai-discovery"; discovery: AiDiscovery }
  | { kind: "consequence"; consequence: WorldConsequence };

export type HistoryEvent =
  | { kind: "established"; id: string; title: string }
  | { kind: "emerged"; id: string; title: string; causedById: string }
  | { kind: "removed"; id: string; title: string };

export type NavState =
  | { mode: "overview" }
  | { mode: "constellation"; regionId: ConstellationRegionId }
  | {
      mode: "discovery";
      discoveryId: string;
      regionId: ConstellationRegionId;
      discoveryTitle: string;
      trail: string[];
    }
  | { mode: "canon" };
