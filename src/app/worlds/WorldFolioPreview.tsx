import {LayerPreview} from "@/components/map/LayerPreview";
import type {Layer, World} from "@/schemas/world/worldSchema";
import {findLayerForRoomId, getDefaultLayer} from "@/components/map/utils/layerUtils";

type WorldFolioPreviewProps = {
	world: World;
};

const MAX_VISIBLE_LAYERS = 3;

function getAuthoredLayers(world: World): Layer[] {
	if (world.metadata.layers.length) return [...world.metadata.layers];
	return world.rooms.length ? [getDefaultLayer(world, 0)] : [];
}

function getVisibleLayers(
	world: World,
): {active: Layer; supporting: Layer[]; total: number} | null {
	const layers = getAuthoredLayers(world);
	if (!layers.length) return null;

	const startLayer = findLayerForRoomId(world, world.startRoomId);
	const active = layers.find((layer) => layer.layer === startLayer.layer) ?? layers[0];
	const supporting = layers
		.filter((layer) => layer.layer !== active.layer)
		.sort((left, right) => Math.abs(left.layer - active.layer) - Math.abs(right.layer - active.layer))
		.slice(0, MAX_VISIBLE_LAYERS - 1);

	return {active, supporting, total: layers.length};
}

export function WorldFolioPreview({world}: WorldFolioPreviewProps) {
	const preview = getVisibleLayers(world);

	if (!preview) {
		return (
			<div className="worldFolio worldFolio--empty" aria-label="Blank map">
				<div className="worldFolioBlank">
					<span aria-hidden="true">+</span>
					<strong>Blank map</strong>
					<small>Add the first room in the editor</small>
				</div>
			</div>
		);
	}

	const visible = [...preview.supporting, preview.active];
	const hiddenCount = preview.total - visible.length;

	return (
		<div
			className={`worldFolio worldFolio--${visible.length}`}
			role="group"
			aria-label={`${preview.total} map ${preview.total === 1 ? "layer" : "layers"}`}
		>
			{preview.supporting.map((layer, index) => (
				<div
					className={`worldFolioSheet worldFolioSheet--${index === 0 ? "left" : "right"}`}
					key={layer.layer}
				>
					<LayerPreview world={world} layer={layer} isFramed mode="static" />
					<span className="worldFolioLabel" aria-hidden="true">
						{layer.name}
					</span>
				</div>
			))}
			<div className="worldFolioSheet worldFolioSheet--active" key={preview.active.layer}>
				<LayerPreview world={world} layer={preview.active} isFramed mode="static" />
				<span className="worldFolioLabel" aria-hidden="true">
					{preview.active.name}
				</span>
			</div>
			{hiddenCount > 0 ? <span className="worldFolioMore">+{hiddenCount} layers</span> : null}
		</div>
	);
}
