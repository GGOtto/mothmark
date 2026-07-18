import type {Layer, World} from "@/schemas/worldSchema";
import {getLayerNavigationDirection} from "@/utils/layerNavigation";
import {getLayer} from "@/utils/layerUtils";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {X} from "lucide-react";

export type LayerMenuProps = {
	world: World;
	currentLayer: Layer;
	setIsLayerMenuOpen: (value: boolean) => void;
	selectedId: string | null;
	isConnectionSelected: boolean;
	setCurrentLayer: (layer: Layer) => void;
};

export function LayerMenu({
	world,
	currentLayer,
	setIsLayerMenuOpen,
	selectedId,
	isConnectionSelected,
	setCurrentLayer,
}: LayerMenuProps) {
	const [displayedLayer, setDisplayedLayer] = useState<Layer>(currentLayer);
	const displayedLayerRef = useRef(displayedLayer);
	const selectedLayerButtonRef = useRef<HTMLButtonElement | null>(null);
	const shouldCenterSelection = useRef(true);

	const showLayer = useCallback((layer: Layer) => {
		displayedLayerRef.current = layer;
		setDisplayedLayer(layer);
	}, []);

	const moveDisplayedLayer = useCallback(
		(direction: 1 | -1) => {
			showLayer(getLayer(world, displayedLayerRef.current.layer + direction));
		},
		[showLayer, world],
	);

	function handleLayerListScroll(event: React.UIEvent<HTMLDivElement>) {
		const list = event.currentTarget;
		const listRect = list.getBoundingClientRect();
		const listCenter = listRect.top + listRect.height / 2;
		let closestButton: HTMLButtonElement | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;

		for (const button of list.querySelectorAll<HTMLButtonElement>("[data-layer-index]")) {
			const buttonRect = button.getBoundingClientRect();
			const distance = Math.abs(buttonRect.top + buttonRect.height / 2 - listCenter);
			if (distance < closestDistance) {
				closestButton = button;
				closestDistance = distance;
			}
		}

		if (!closestButton) return;
		const index = Number(closestButton.dataset.layerIndex);
		const layer = world.metadata.layers[index];
		if (layer && layer.layer !== displayedLayerRef.current.layer) {
			shouldCenterSelection.current = false;
			showLayer(layer);
		}
	}

	useLayoutEffect(() => {
		if (shouldCenterSelection.current) {
			selectedLayerButtonRef.current?.scrollIntoView?.({block: "center", inline: "nearest"});
		}
		shouldCenterSelection.current = true;
	}, [displayedLayer.layer]);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement ||
				(event.target instanceof HTMLElement && event.target.isContentEditable)
			)
				return;

			const direction = getLayerNavigationDirection(event.key);
			if (!direction) return;
			event.preventDefault();
			moveDisplayedLayer(direction);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [moveDisplayedLayer]);

	function handleOpenLayer() {
		setCurrentLayer(displayedLayer);
		setIsLayerMenuOpen(false);
	}

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
			<button type="button" onClick={() => setIsLayerMenuOpen(false)} aria-label="Close layer menu">
				<X aria-hidden="true" />
			</button>
			<div className="layerMenu--left" aria-label="Layers" onScroll={handleLayerListScroll}>
				{world.metadata.layers.map((layer, index) => (
					<button
						key={layer.layer}
						data-layer-index={index}
						ref={displayedLayer.layer === layer.layer ? selectedLayerButtonRef : undefined}
						aria-pressed={displayedLayer.layer === layer.layer}
						className={`layerMenu--left__button${
							displayedLayer.layer === layer.layer ? " layerMenu--left__selected" : ""
						}`}
						onClick={() => showLayer(layer)}
					>
						{layer.name}
					</button>
				))}
			</div>
			<div className="layerMenu--right">
				<div className="layerMenu--header">
					<div className="layerMenu--header__name">Layer Name</div>
					<div className="layerMenu--header__info">{currentLayer.layer}</div>
				</div>
				<div className="layerMenu--preview">
					<LayerPreview
						world={world}
						layer={displayedLayer}
						isFramed={true}
						mode="zoom-pan"
						selectedId={selectedId}
						isConnectionSelected={isConnectionSelected}
						theme="light"
						className="layerMenu--preview__card"
					/>
				</div>
				<div className="layerMenu--controls">
					<div className="layerMenu--info">Drag to pan · Scroll to zoom</div>
					<button className="layerMenu--open" onClick={handleOpenLayer}>
						Open Layer
					</button>
				</div>
			</div>
		</div>
	);
}
