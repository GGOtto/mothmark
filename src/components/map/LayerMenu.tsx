import type {Layer, World} from "@/schemas/worldSchema";
import "./LayerMenu.scss";

export type LayerMenuProps = {
	world: World;
	currentLayer: Layer;
	setIsLayerMenuOpen: (value: boolean) => void;
	selectedId: string | null;
	isConnectionSelected: boolean;
	setCurrentLayer: (layer: Layer) => void;
};

export function LayerMenu({setIsLayerMenuOpen}: LayerMenuProps) {
	return (
		<div
			className="layerMenu"
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onPointerMove={(event) => event.stopPropagation()}
			onPointerUp={(event) => event.stopPropagation()}
			onPointerCancel={(event) => event.stopPropagation()}
			onWheel={(event) => event.stopPropagation()}
		>
			<button type="button" onClick={() => setIsLayerMenuOpen(false)}>
				Close layer menu
			</button>
		</div>
	);
}
