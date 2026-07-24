import type {Layer, World} from "@/schemas/world/worldSchema";
import {getLayerNavigationDirection} from "./utils/layerNavigation";
import {getLayer} from "./utils/layerUtils";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {X} from "lucide-react";
import {CenteredScrollSelector} from "../ui/CenteredScrollSelector";

export const LAYER_MENU_SCROLL_BUFFER_ROWS = 50;

export type LayerMenuButtonProps = {
	layer: Layer;
	layerIndex: number;
	displayedLayer: Layer;
	centerLayer: (button: HTMLButtonElement, layer: Layer) => void;
};

export function LayerMenuButton({
	layer,
	layerIndex,
	displayedLayer,
	centerLayer,
}: LayerMenuButtonProps) {
	const isSelected = displayedLayer.layer === layer.layer;

	return (
		<button
			data-layer-index={layerIndex}
			data-layer-value={layer.layer}
			aria-pressed={isSelected}
			className={`layerMenu--left__button${isSelected ? " layerMenu--left__selected" : ""}`}
			onClick={(event) => centerLayer(event.currentTarget, layer)}
		>
			{layer.name}
		</button>
	);
}

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
	const layerListRef = useRef<HTMLDivElement | null>(null);
	const displayedLayers = useMemo(() => {
		return Array.from({length: LAYER_MENU_SCROLL_BUFFER_ROWS * 2 + 1}, (_, index) =>
			getLayer(world, currentLayer.layer + LAYER_MENU_SCROLL_BUFFER_ROWS - index),
		);
	}, [currentLayer.layer, world]);

	const showLayer = useCallback((layer: Layer) => {
		displayedLayerRef.current = layer;
		setDisplayedLayer(layer);
	}, []);

	const centerLayer = useCallback(
		(button: HTMLButtonElement, layer: Layer, behavior: ScrollBehavior = "smooth") => {
			if (typeof button.scrollIntoView === "function") {
				button.scrollIntoView({behavior, block: "center", inline: "nearest"});
				return;
			}
			showLayer(layer);
		},
		[showLayer],
	);

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
			const targetLayer = getLayer(world, displayedLayerRef.current.layer + direction);
			const targetButton = Array.from(
				layerListRef.current?.querySelectorAll<HTMLButtonElement>("[data-layer-value]") ?? [],
			).find((button) => Number(button.dataset.layerValue) === targetLayer.layer);
			if (targetButton) centerLayer(targetButton, targetLayer);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [centerLayer, world]);

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
			<CenteredScrollSelector
				items={displayedLayers}
				activeId={String(displayedLayer.layer)}
				onActiveChange={showLayer}
				getId={(layer) => String(layer.layer)}
				renderLabel={(layer) => layer.name}
				ariaLabel="Layers"
				className="layerMenu--leftShell"
				listClassName="layerMenu--left"
				indicatorClassName="layerMenu--left__centerIndicator"
				itemClassName={(_, isActive) =>
					isActive ? "layerMenu--left__button layerMenu--left__selected" : "layerMenu--left__button"
				}
				getItemProps={(layer, index) => ({
					"data-layer-index": index,
					"data-layer-value": layer.layer,
				})}
				deferClickActivationUntilScroll={true}
				listRef={layerListRef}
			/>
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
