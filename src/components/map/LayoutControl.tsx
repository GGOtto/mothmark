import {Layer, World} from "@/schemas/worldSchema";
import {Layers, ArrowDown, ArrowUp} from "lucide-react";
import "./LayoutControl.scss";
import {getLayer} from "@/utils/layerUtils";

type LayoutControlProps = {
	world: World;
	setCurrentLayer: (layer: Layer) => void;
	currentLayer: Layer;
	openLayerMenu: () => void;
};

export function LayoutControl({
	world,
	setCurrentLayer,
	currentLayer,
	openLayerMenu,
}: LayoutControlProps) {
	function moveUpLayer(event: React.PointerEvent<HTMLButtonElement>) {
		event.stopPropagation();
		const newLayer = getLayer(world, currentLayer.layer + 1);
		setCurrentLayer(newLayer);
	}

	function openMenu(event: React.PointerEvent<HTMLButtonElement>) {
		event.stopPropagation();
		openLayerMenu();
	}

	function moveDownLayer(event: React.PointerEvent<HTMLButtonElement>) {
		event.stopPropagation();
		const newLayer = getLayer(world, currentLayer.layer - 1);
		setCurrentLayer(newLayer);
	}

	return (
		<div className="layoutControl">
			<button className="layoutControl--up" onClick={moveUpLayer}>
				<ArrowUp size={23} strokeWidth={1.8} />
			</button>
			<button className="layoutControl--menu" onClick={openMenu}>
				<Layers size={23} strokeWidth={1.8} />
			</button>
			<button className="layoutControl--down" onClick={moveDownLayer}>
				<ArrowDown size={23} strokeWidth={1.8} />
			</button>
		</div>
	);
}
