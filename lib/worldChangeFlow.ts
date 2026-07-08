/**
 * World change accept flow (Phase 6C).
 * Uses existing ripple approval + evolution dry-run + apply pipeline.
 */

import { approveSafeRippleOperations, canOpenWorldEvolutionPreview } from "@/lib/rippleUserFlow";
import { buildWorldEvolutionPlanFromRipplePreview } from "@/lib/worldBrain/buildWorldEvolutionFromRipple";
import { buildWorldEvolutionApplyDryRun } from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import type { RipplePreviewModel } from "@/lib/worldBrain/ripplePreviewModel";
import type { WorldEvolutionApplyDryRunResult } from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import type { WorldEvolutionPlan } from "@/lib/worldBrain/worldEvolutionPlan";
import type { DecisionEventLog } from "@/lib/worldBrain/userDecisionTypes";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { summarizeCanonStateFromEventLog } from "@/lib/worldBrain/decisionEventLog";

export type WorldChangeDryRunBundle = {
  approvedPreview: RipplePreviewModel;
  plan: WorldEvolutionPlan | null;
  dryRun: WorldEvolutionApplyDryRunResult | null;
  readyPatchIds: string[];
};

export type BuildWorldChangeDryRunArgs = {
  preview: RipplePreviewModel;
  canvasModel: CanvasWorldModel | null;
  decisionEventLog: DecisionEventLog;
  nodeTitleById: Record<string, string>;
  nodeConstellationMap: Record<string, string>;
};

export function buildWorldChangeDryRunBundle(
  args: BuildWorldChangeDryRunArgs,
): WorldChangeDryRunBundle {
  const approvedPreview = approveSafeRippleOperations(args.preview);

  if (!canOpenWorldEvolutionPreview(approvedPreview) || !args.canvasModel) {
    return {
      approvedPreview,
      plan: null,
      dryRun: null,
      readyPatchIds: [],
    };
  }

  const plan = buildWorldEvolutionPlanFromRipplePreview({
    preview: approvedPreview,
    canvasModel: args.canvasModel,
    canonState: summarizeCanonStateFromEventLog(args.decisionEventLog),
    nodeTitleById: args.nodeTitleById,
    nodeConstellationMap: args.nodeConstellationMap,
    decisionEventLog: args.decisionEventLog,
  });

  const existingNodeIds = args.canvasModel.nodes.map((node) => node.id);
  const existingConstellationIds = args.canvasModel.constellations.map(
    (constellation) => constellation.id,
  );

  const dryRun = buildWorldEvolutionApplyDryRun({
    plan,
    canvasModel: args.canvasModel,
    canonState: summarizeCanonStateFromEventLog(args.decisionEventLog),
    nodeConstellationMap: args.nodeConstellationMap,
    nodeTitleById: args.nodeTitleById,
    existingNodeIds,
    existingConstellationIds,
  });

  const readyPatchIds =
    dryRun.status === "ready_for_confirmation"
      ? dryRun.patchCandidates
          .filter((patch) => patch.status === "ready" && patch.patchType !== "no_op")
          .map((patch) => patch.id)
      : [];

  return { approvedPreview, plan, dryRun, readyPatchIds };
}

export function canAutoApplyWorldChange(bundle: WorldChangeDryRunBundle): boolean {
  return (
    bundle.dryRun?.status === "ready_for_confirmation" && bundle.readyPatchIds.length > 0
  );
}

export function isRipplePreviewEmpty(preview: RipplePreviewModel): boolean {
  return (
    preview.operationPreviews.filter((op) => op.approvalState !== "rejected").length ===
      0 && preview.counts.operationCount === 0
  );
}
