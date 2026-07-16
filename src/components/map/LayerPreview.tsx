// A preview of a map layer
// Either frames all rooms or shows the last view of a map (use world.metadata.layer.lastView)
// Can be static or zoomable/pannable

import {Layer, World} from "@/schemas/worldSchema";

type LayerPreviewProp = {
	world: World;
	layer: Layer;
	isFramed: boolean;
	mode: "static" | "pannable";
};

export function LayerPreview({world, layer, isFramed, mode}: LayerPreviewProp) {
	return <div></div>;
}
