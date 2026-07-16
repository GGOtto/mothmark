import {World} from "@/schemas/worldSchema";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {getLayer} from "@/utils/layerUtils";

type LayerMenuProps = {
	world: World;
	setIsLayerMenuOpen: (value: boolean) => void;
};

export function LayerMenu({world, setIsLayerMenuOpen}: LayerMenuProps) {
	function exitMenu(event: React.PointerEvent<HTMLButtonElement>) {
		event.stopPropagation();
		setIsLayerMenuOpen(false);
	}
	return (
		<div className="layerMenu">
			<button onClick={exitMenu}>X</button>
			<LayerPreview world={world} layer={getLayer(world, 0)} isFramed={true} mode="static" />
		</div>
	);
}
