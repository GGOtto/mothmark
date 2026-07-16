import {World} from "@/schemas/worldSchema";
import "./LayerMenu.scss";

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
		</div>
	);
}
