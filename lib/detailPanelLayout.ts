/** Shared layout constants for the right-side detail panel. */

export const SIDEBAR_WIDTH_PX = 176;
export const DETAIL_PANEL_WIDTH_RATIO = 3.5;

/** ~1/3.5 of the canvas area (viewport minus sidebar), clamped for readability. */
export function computeDetailPanelWidth(viewportWidth: number): number {
  const canvasWidth = Math.max(320, viewportWidth - SIDEBAR_WIDTH_PX);
  const target = Math.round(canvasWidth / DETAIL_PANEL_WIDTH_RATIO);
  return Math.max(280, Math.min(480, target));
}

export function computeDetailPanelInset(
  viewportWidth: number,
  panelOpen: boolean,
): number {
  return panelOpen ? computeDetailPanelWidth(viewportWidth) : 0;
}

/** Screen-space center of the usable canvas (excluding sidebar and detail panel). */
export function computeUsableCanvasCenter(
  viewportWidth: number,
  viewportHeight: number,
  panelInset: number,
): { x: number; y: number } {
  const left = SIDEBAR_WIDTH_PX;
  const right = Math.max(left + 320, viewportWidth - panelInset);
  return {
    x: left + (right - left) / 2,
    y: viewportHeight / 2,
  };
}
