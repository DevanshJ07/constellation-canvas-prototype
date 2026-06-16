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

export type PanelItem =
  | { kind: "discovery"; discovery: Discovery }
  | { kind: "consequence"; consequence: WorldConsequence };

export type NavState =
  | { mode: "overview" }
  | { mode: "constellation"; regionId: ConstellationRegionId }
  | {
      mode: "discovery";
      discoveryId: string;
      regionId: ConstellationRegionId;
      discoveryTitle: string;
    }
  | { mode: "canon" };
