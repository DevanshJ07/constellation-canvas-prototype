/**
 * Ripple Effect Engine — response parser and validator (Phase 4.8).
 *
 * Safely converts raw LLM text into validated RippleEffectOutput.
 * Pure functions only — no API calls, no React, no canvas mutation.
 *
 * Flow: raw text → extract JSON → normalize → repair references → validate
 */

import { isValidCanonDecisionState } from "@/lib/worldBrain/buildUserDecisionEvent";
import {
  buildRippleOperationId,
  buildRippleWarningId,
  isValidConstellationRippleImpactType,
  isValidNodeRippleImpactType,
  isValidRippleAffectedScope,
  isValidRippleImpactLevel,
  isValidRippleOperationType,
  isValidRippleWarningType,
  validateRippleEffectOutput,
  type RippleEffectValidationResult,
} from "@/lib/worldBrain/buildRippleEffectPlan";
import type {
  CanonRippleImpact,
  CanonRippleImpactType,
  ConstellationRippleImpact,
  NodeImpactSeverity,
  NodeRippleImpact,
  NodeRippleImpactType,
  RippleAffectedScope,
  RippleEffectOutput,
  RippleImpactLevel,
  RippleOperationPriority,
  RippleOperationTarget,
  RippleOperationTargetType,
  RippleOperationType,
  RipplePreservedElement,
  RippleSuggestedOperation,
  RippleWarning,
  RippleWarningType,
  SuggestedCanonStateChange,
} from "@/lib/worldBrain/rippleEffectTypes";
import type { CanonDecisionState } from "@/lib/worldBrain/userDecisionTypes";

// ── Result types ──────────────────────────────────────────────────────────────────

export type ParseRippleEffectOutputOptions = {
  fallbackTriggerEventId?: string;
  /** If true, include normalized/failure output even when success is false. */
  allowPartial?: boolean;
  /** Coerce or drop invalid enum values with parser warnings. Default true. */
  repairInvalidEnums?: boolean;
};

export type ParseRippleEffectOutputResult = {
  success: boolean;
  output?: RippleEffectOutput;
  rawText: string;
  errors: string[];
  warnings: string[];
  validationResult?: RippleEffectValidationResult;
};

export type NormalizeRippleEffectOutputOptions = {
  fallbackTriggerEventId?: string;
  repairInvalidEnums?: boolean;
};

export type NormalizeRippleEffectOutputResult = {
  output: RippleEffectOutput;
  warnings: string[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────────

const VALID_TARGET_TYPES = new Set<RippleOperationTargetType>([
  "node",
  "constellation",
  "canon_item",
  "flow_item",
  "world",
]);

const VALID_PRIORITIES = new Set<RippleOperationPriority>(["low", "medium", "high"]);
const VALID_SEVERITIES = new Set<NodeImpactSeverity>(["low", "medium", "high"]);

const CANON_IMPACT_TYPES = new Set<CanonRippleImpactType>([
  "no_change",
  "possible_contradiction",
  "requires_reconciliation",
  "strengthens_theme",
  "weakens_theme",
  "changes_world_rule",
  "changes_tone",
  "changes_flow",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function boundConfidence(value: unknown, fallback = 0.5): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function optionalNumber(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item))
    .filter((item) => item.length > 0);
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── JSON extraction ───────────────────────────────────────────────────────────────

/**
 * Extracts a JSON object from raw LLM text.
 * Handles pure JSON, fenced blocks, and prose-wrapped objects. No eval.
 */
export function extractRippleEffectJson(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const direct = tryParseJson(trimmed);
  if (direct !== null) return direct;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const fenced = tryParseJson(fenceMatch[1].trim());
    if (fenced !== null) return fenced;
  }

  const objectText = extractFirstJsonObject(trimmed);
  if (objectText) {
    const extracted = tryParseJson(objectText);
    if (extracted !== null) return extracted;
  }

  return null;
}

// ── Target / operation normalization ──────────────────────────────────────────────

function normalizeTarget(
  value: unknown,
  warnings: string[],
  label: string,
): RippleOperationTarget | null {
  if (!isRecord(value)) {
    warnings.push(`${label}: invalid target object`);
    return null;
  }
  const targetType = str(value.targetType);
  const id = str(value.id);
  if (!VALID_TARGET_TYPES.has(targetType as RippleOperationTargetType)) {
    warnings.push(`${label}: invalid targetType "${targetType}"`);
    return null;
  }
  if (!id) {
    warnings.push(`${label}: missing target id`);
    return null;
  }
  return {
    targetType: targetType as RippleOperationTargetType,
    id,
    ...(str(value.constellationId)
      ? { constellationId: str(value.constellationId) }
      : {}),
    ...(str(value.parentNodeId) ? { parentNodeId: str(value.parentNodeId) } : {}),
  };
}

function normalizeSuggestedOperation(
  value: unknown,
  index: number,
  options: NormalizeRippleEffectOutputOptions,
  warnings: string[],
): RippleSuggestedOperation | null {
  if (!isRecord(value)) {
    warnings.push(`suggestedOperations[${index}]: not an object`);
    return null;
  }

  const operationTypeRaw = str(value.operationType);
  if (!isValidRippleOperationType(operationTypeRaw)) {
    warnings.push(
      `suggestedOperations[${index}]: dropped invalid operationType "${operationTypeRaw}"`,
    );
    return null;
  }
  const operationType = operationTypeRaw as RippleOperationType;

  const target = normalizeTarget(
    value.target,
    warnings,
    `suggestedOperations[${index}]`,
  );
  if (!target) return null;

  const id =
    str(value.id) ||
    buildRippleOperationId(operationType, target.id, index);

  const priorityRaw = str(value.priority, "medium");
  const priority = VALID_PRIORITIES.has(priorityRaw as RippleOperationPriority)
    ? (priorityRaw as RippleOperationPriority)
    : "medium";
  if (priorityRaw !== priority) {
    warnings.push(`suggestedOperations[${index}]: invalid priority → medium`);
  }

  const payload = isRecord(value.payload) ? { ...value.payload } : undefined;

  return {
    id,
    operationType,
    target,
    reason: str(value.reason, "No reason provided by model."),
    priority,
    requiresUserApproval:
      typeof value.requiresUserApproval === "boolean"
        ? value.requiresUserApproval
        : true,
    ...(payload !== undefined ? { payload } : {}),
  };
}

function normalizeNodeImpact(
  value: unknown,
  index: number,
  options: NormalizeRippleEffectOutputOptions,
  warnings: string[],
): NodeRippleImpact | null {
  if (!isRecord(value)) {
    warnings.push(`nodeImpacts[${index}]: not an object`);
    return null;
  }

  const nodeId = str(value.nodeId);
  if (!nodeId) {
    warnings.push(`nodeImpacts[${index}]: dropped — missing nodeId`);
    return null;
  }

  const impactTypeRaw = str(value.impactType, "needs_review");
  let impactType: NodeRippleImpactType;
  if (isValidNodeRippleImpactType(impactTypeRaw)) {
    impactType = impactTypeRaw;
  } else if (options.repairInvalidEnums !== false) {
    impactType = "needs_review";
    warnings.push(
      `nodeImpacts[${index}]: invalid impactType "${impactTypeRaw}" → needs_review`,
    );
  } else {
    warnings.push(`nodeImpacts[${index}]: dropped invalid impactType`);
    return null;
  }

  const severityRaw = str(value.severity, "medium");
  const severity = VALID_SEVERITIES.has(severityRaw as NodeImpactSeverity)
    ? (severityRaw as NodeImpactSeverity)
    : "medium";

  return {
    nodeId,
    impactType,
    reason: str(value.reason, "No reason provided by model."),
    severity,
    confidence: boundConfidence(value.confidence, 0.5),
    suggestedOperationIds: Array.isArray(value.suggestedOperationIds)
      ? value.suggestedOperationIds.map((id) => str(id)).filter(Boolean)
      : [],
    ...(str(value.constellationId)
      ? { constellationId: str(value.constellationId) }
      : {}),
    ...(str(value.relatedTriggerAnchor)
      ? { relatedTriggerAnchor: str(value.relatedTriggerAnchor) }
      : {}),
  };
}

function normalizeConstellationImpact(
  value: unknown,
  index: number,
  options: NormalizeRippleEffectOutputOptions,
  warnings: string[],
): ConstellationRippleImpact | null {
  if (!isRecord(value)) {
    warnings.push(`constellationImpacts[${index}]: not an object`);
    return null;
  }

  const constellationId = str(value.constellationId);
  if (!constellationId) {
    warnings.push(`constellationImpacts[${index}]: dropped — missing constellationId`);
    return null;
  }

  const impactTypeRaw = str(value.impactType, "needs_review");
  let impactType: ConstellationRippleImpact["impactType"];
  if (isValidConstellationRippleImpactType(impactTypeRaw)) {
    impactType = impactTypeRaw;
  } else if (options.repairInvalidEnums !== false) {
    impactType = "needs_review";
    warnings.push(
      `constellationImpacts[${index}]: invalid impactType "${impactTypeRaw}" → needs_review`,
    );
  } else {
    return null;
  }

  const countChange = optionalNumber(value.suggestedNodeCountChange);

  return {
    constellationId,
    impactType,
    reason: str(value.reason, "No reason provided by model."),
    confidence: boundConfidence(value.confidence, 0.5),
    ...(str(value.suggestedFocusShift)
      ? { suggestedFocusShift: str(value.suggestedFocusShift) }
      : {}),
    ...(countChange !== undefined ? { suggestedNodeCountChange: countChange } : {}),
  };
}

function normalizeCanonStateChange(
  value: unknown,
  index: number,
  warnings: string[],
): SuggestedCanonStateChange | null {
  if (!isRecord(value)) return null;
  const targetId = str(value.targetId);
  if (!targetId) {
    warnings.push(`suggestedCanonStateChanges[${index}]: dropped — missing targetId`);
    return null;
  }
  const toStateRaw = str(value.toState);
  if (!isValidCanonDecisionState(toStateRaw)) {
    warnings.push(`suggestedCanonStateChanges[${index}]: dropped invalid toState`);
    return null;
  }
  const fromStateRaw = str(value.fromState);
  const fromState = isValidCanonDecisionState(fromStateRaw)
    ? (fromStateRaw as CanonDecisionState)
    : undefined;

  return {
    targetId,
    toState: toStateRaw as CanonDecisionState,
    reason: str(value.reason, "No reason provided by model."),
    ...(fromState !== undefined ? { fromState } : {}),
  };
}

function normalizeCanonImpactType(
  raw: string,
  index: number,
  options: NormalizeRippleEffectOutputOptions,
  warnings: string[],
): CanonRippleImpactType {
  if (CANON_IMPACT_TYPES.has(raw as CanonRippleImpactType)) {
    return raw as CanonRippleImpactType;
  }
  if (options.repairInvalidEnums !== false) {
    warnings.push(
      `canonImpacts[${index}]: invalid impactType "${raw}" → requires_reconciliation`,
    );
    return "requires_reconciliation";
  }
  return "no_change";
}

function normalizeCanonImpact(
  value: unknown,
  index: number,
  options: NormalizeRippleEffectOutputOptions,
  warnings: string[],
): CanonRippleImpact | null {
  if (!isRecord(value)) {
    warnings.push(`canonImpacts[${index}]: not an object`);
    return null;
  }

  const impactType = normalizeCanonImpactType(
    str(value.impactType, "no_change"),
    index,
    options,
    warnings,
  );

  const changes: SuggestedCanonStateChange[] = [];
  if (Array.isArray(value.suggestedCanonStateChanges)) {
    value.suggestedCanonStateChanges.forEach((item, i) => {
      const change = normalizeCanonStateChange(item, i, warnings);
      if (change) changes.push(change);
    });
  }

  return {
    impactType,
    reason: str(value.reason, "No reason provided by model."),
    affectedCanonIds: stringArray(value.affectedCanonIds),
    suggestedCanonStateChanges: changes,
    confidence: boundConfidence(value.confidence, 0.5),
  };
}

function normalizeWarning(
  value: unknown,
  index: number,
  warnings: string[],
): RippleWarning | null {
  if (!isRecord(value)) {
    warnings.push(`warnings[${index}]: not an object`);
    return null;
  }

  const warningTypeRaw = str(value.warningType);
  if (!isValidRippleWarningType(warningTypeRaw)) {
    warnings.push(`warnings[${index}]: dropped invalid warningType "${warningTypeRaw}"`);
    return null;
  }
  const warningType = warningTypeRaw as RippleWarningType;

  const affectedTargets: RippleOperationTarget[] = [];
  if (Array.isArray(value.affectedTargets)) {
    value.affectedTargets.forEach((t, i) => {
      const target = normalizeTarget(t, warnings, `warnings[${index}].affectedTargets[${i}]`);
      if (target) affectedTargets.push(target);
    });
  }

  const primaryId = affectedTargets[0]?.id ?? "unknown";
  const id = str(value.id) || buildRippleWarningId(warningType, primaryId, index);

  const severityRaw = str(value.severity, "medium");
  const severity = VALID_SEVERITIES.has(severityRaw as NodeImpactSeverity)
    ? (severityRaw as NodeImpactSeverity)
    : "medium";

  return {
    id,
    warningType,
    message: str(value.message, "No message provided by model."),
    severity,
    affectedTargets,
    ...(str(value.suggestedResolution)
      ? { suggestedResolution: str(value.suggestedResolution) }
      : {}),
  };
}

function normalizePreservedElement(
  value: unknown,
  index: number,
  warnings: string[],
): RipplePreservedElement | null {
  if (!isRecord(value)) return null;
  const targetType = str(value.targetType);
  const id = str(value.id);
  if (!VALID_TARGET_TYPES.has(targetType as RippleOperationTargetType) || !id) {
    warnings.push(`preservedElements[${index}]: dropped invalid entry`);
    return null;
  }
  return {
    targetType: targetType as RippleOperationTargetType,
    id,
    reason: str(value.reason, "Preserve established canon unless user revises."),
  };
}

// ── Top-level normalization ───────────────────────────────────────────────────────

/** Normalizes unknown JSON value into RippleEffectOutput; does not invent fake impacts. */
export function normalizeRippleEffectOutput(
  value: unknown,
  options: NormalizeRippleEffectOutputOptions = {},
): NormalizeRippleEffectOutputResult {
  const warnings: string[] = [];
  const record = isRecord(value) ? value : {};

  const triggerEventId =
    str(record.triggerEventId) || str(options.fallbackTriggerEventId) || "unknown_trigger";

  const impactLevelRaw = str(record.impactLevel, "none");
  let impactLevel: RippleImpactLevel;
  if (isValidRippleImpactLevel(impactLevelRaw)) {
    impactLevel = impactLevelRaw;
  } else if (options.repairInvalidEnums !== false) {
    impactLevel = "none";
    warnings.push(`Invalid impactLevel "${impactLevelRaw}" → none`);
  } else {
    impactLevel = "none";
    warnings.push(`Invalid impactLevel "${impactLevelRaw}"`);
  }

  const affectedScopes: RippleAffectedScope[] = [];
  if (Array.isArray(record.affectedScopes)) {
    record.affectedScopes.forEach((scope, i) => {
      const s = str(scope);
      if (isValidRippleAffectedScope(s)) {
        affectedScopes.push(s);
      } else {
        warnings.push(`affectedScopes[${i}]: dropped invalid scope "${s}"`);
      }
    });
  }

  const suggestedOperations: RippleSuggestedOperation[] = [];
  if (Array.isArray(record.suggestedOperations)) {
    record.suggestedOperations.forEach((item, i) => {
      const op = normalizeSuggestedOperation(item, i, options, warnings);
      if (op) suggestedOperations.push(op);
    });
  }

  const nodeImpacts: NodeRippleImpact[] = [];
  if (Array.isArray(record.nodeImpacts)) {
    record.nodeImpacts.forEach((item, i) => {
      const impact = normalizeNodeImpact(item, i, options, warnings);
      if (impact) nodeImpacts.push(impact);
    });
  }

  const constellationImpacts: ConstellationRippleImpact[] = [];
  if (Array.isArray(record.constellationImpacts)) {
    record.constellationImpacts.forEach((item, i) => {
      const impact = normalizeConstellationImpact(item, i, options, warnings);
      if (impact) constellationImpacts.push(impact);
    });
  }

  const canonImpacts: CanonRippleImpact[] = [];
  if (Array.isArray(record.canonImpacts)) {
    record.canonImpacts.forEach((item, i) => {
      const impact = normalizeCanonImpact(item, i, options, warnings);
      if (impact) canonImpacts.push(impact);
    });
  }

  const rippleWarnings: RippleWarning[] = [];
  if (Array.isArray(record.warnings)) {
    record.warnings.forEach((item, i) => {
      const w = normalizeWarning(item, i, warnings);
      if (w) rippleWarnings.push(w);
    });
  }

  const preservedElements: RipplePreservedElement[] = [];
  if (Array.isArray(record.preservedElements)) {
    record.preservedElements.forEach((item, i) => {
      const el = normalizePreservedElement(item, i, warnings);
      if (el) preservedElements.push(el);
    });
  }

  const output: RippleEffectOutput = {
    triggerEventId,
    summary: str(record.summary, "Ripple analysis completed."),
    impactLevel,
    affectedScopes,
    nodeImpacts,
    constellationImpacts,
    canonImpacts,
    suggestedOperations,
    warnings: rippleWarnings,
    preservedElements,
    followUpQuestions: stringArray(record.followUpQuestions),
    confidence: boundConfidence(record.confidence, 0.5),
  };

  return { output, warnings };
}

// ── Reference repair ──────────────────────────────────────────────────────────────

/** Removes nodeImpact references to missing operation ids; adds parser warnings. */
export function repairMissingOperationReferences(
  output: RippleEffectOutput,
): { output: RippleEffectOutput; warnings: string[] } {
  const warnings: string[] = [];
  const operationIds = new Set(output.suggestedOperations.map((op) => op.id));

  const nodeImpacts = output.nodeImpacts.map((impact) => {
    const kept: string[] = [];
    const removed: string[] = [];
    for (const opId of impact.suggestedOperationIds) {
      if (operationIds.has(opId)) kept.push(opId);
      else removed.push(opId);
    }
    if (removed.length > 0) {
      warnings.push(
        `nodeImpact ${impact.nodeId}: removed missing operation refs: ${removed.join(", ")}`,
      );
    }
    return { ...impact, suggestedOperationIds: kept };
  });

  return {
    output: { ...output, nodeImpacts },
    warnings,
  };
}

// ── Parse failure fallback ────────────────────────────────────────────────────────

/** Safe no-impact output when parsing fails entirely. */
export function createRippleParseFailureOutput(
  triggerEventId: string,
  _rawText: string,
  _errors: string[],
): RippleEffectOutput {
  return {
    triggerEventId,
    summary: "Ripple analysis could not be parsed.",
    impactLevel: "none",
    affectedScopes: [],
    nodeImpacts: [],
    constellationImpacts: [],
    canonImpacts: [],
    suggestedOperations: [],
    warnings: [],
    preservedElements: [],
    followUpQuestions: [
      "The ripple analysis response could not be parsed. Would you like to retry?",
    ],
    confidence: 0,
  };
}

// ── Main parser ───────────────────────────────────────────────────────────────────

/** Parses raw LLM text into validated RippleEffectOutput; never throws. */
export function parseRippleEffectOutput(
  rawText: string,
  options: ParseRippleEffectOutputOptions = {},
): ParseRippleEffectOutputResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const extracted = extractRippleEffectJson(rawText);
  if (extracted === null) {
    errors.push("Could not extract valid JSON from raw text.");
    const failureOutput = options.fallbackTriggerEventId
      ? createRippleParseFailureOutput(
          options.fallbackTriggerEventId,
          rawText,
          errors,
        )
      : undefined;

    return {
      success: false,
      ...(options.allowPartial && failureOutput ? { output: failureOutput } : {}),
      rawText,
      errors,
      warnings,
    };
  }

  const normalized = normalizeRippleEffectOutput(extracted, {
    fallbackTriggerEventId: options.fallbackTriggerEventId,
    repairInvalidEnums: options.repairInvalidEnums ?? true,
  });
  warnings.push(...normalized.warnings);

  const repaired = repairMissingOperationReferences(normalized.output);
  warnings.push(...repaired.warnings);

  const validationResult = validateRippleEffectOutput(repaired.output);
  if (!validationResult.valid) {
    errors.push(...validationResult.errors);
  }
  warnings.push(...validationResult.warnings);

  if (validationResult.valid) {
    return {
      success: true,
      output: repaired.output,
      rawText,
      errors,
      warnings,
      validationResult,
    };
  }

  const failureOutput = options.fallbackTriggerEventId
    ? createRippleParseFailureOutput(options.fallbackTriggerEventId, rawText, errors)
    : repaired.output;

  return {
    success: false,
    ...(options.allowPartial ? { output: failureOutput } : {}),
    rawText,
    errors,
    warnings,
    validationResult,
  };
}
