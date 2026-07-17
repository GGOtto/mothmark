export type LayerNavigationDirection = 1 | -1;

export const LAYER_SCROLL_STEP_DELAY = 500;
export const LAYER_SCROLL_END_DELAY = 500;

export function getLayerNavigationDirection(key: string): LayerNavigationDirection | null {
	if (key === "ArrowDown" || key === "PageUp") return 1;
	if (key === "ArrowUp" || key === "PageDown") return -1;
	return null;
}
