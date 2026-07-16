import type {Layer, World} from "@/schemas/worldSchema";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {getLayer} from "@/utils/layerUtils";
import {Layers, X} from "lucide-react";

type LayerMenuProps = {
	world: World;
	setIsLayerMenuOpen: (value: boolean) => void;
	selectedId: string | null;
	isConnectionSelected: boolean;
	setCurrentLayer: (layer: Layer) => void;
};

export function LayerMenu({
	world,
	setIsLayerMenuOpen,
	selectedId,
	isConnectionSelected,
	setCurrentLayer,
}: LayerMenuProps) {
	function exitMenu(event: React.PointerEvent<HTMLButtonElement>) {
		event.stopPropagation();
		setIsLayerMenuOpen(false);
	}

	function selectLayer(layer: Layer) {
		setCurrentLayer(layer);
		setIsLayerMenuOpen(false);
	}

	const layers =
		world.metadata.layers.length > 0
			? [...world.metadata.layers].sort((left, right) => right.layer - left.layer)
			: [getLayer(world, 0)];

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
			<header className="layerMenuHeader">
				<div>
					<span className="layerMenuEyebrow">
						<Layers size={15} aria-hidden="true" />
						World layers
					</span>
					<h2>Choose a layer</h2>
				</div>
				<button
					type="button"
					className="layerMenuClose"
					onPointerDown={exitMenu}
					aria-label="Close layers"
				>
					<X aria-hidden="true" />
				</button>
			</header>

			<div className="layerMenuGrid">
				{layers.map((layer) => (
					<section className="layerMenuCard" key={layer.layer}>
						<div className="layerMenuCardHeader">
							<div>
								<span className="layerMenuLevel">
									{layer.layer === 0
										? "Ground"
										: layer.layer > 0
											? `Level +${layer.layer}`
											: `Level ${layer.layer}`}
								</span>
								<h3>{layer.name}</h3>
							</div>
							<span className="layerMenuRoomCount">
								{layer.rooms.length} {layer.rooms.length === 1 ? "room" : "rooms"}
							</span>
						</div>
						<LayerPreview
							world={world}
							layer={layer}
							isFramed
							mode="static"
							selectedId={selectedId}
							isConnectionSelected={isConnectionSelected}
							onClick={() => selectLayer(layer)}
							style={{height: 220}}
						/>
					</section>
				))}
			</div>
		</div>
	);
}
