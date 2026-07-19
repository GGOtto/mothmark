import type {Layer, World} from "@/schemas/world/worldSchema";
import {getLayerNavigationDirection} from "./utils/layerNavigation";
import {getLayer} from "./utils/layerUtils";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {X} from "lucide-react";

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
	const hasCenteredInitialLayer = useRef(false);
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

	function handleLayerListScroll(event: React.UIEvent<HTMLDivElement>) {
		const list = event.currentTarget;
		const listRect = list.getBoundingClientRect();
		const listCenter = listRect.top + listRect.height / 2;
		let closestButton: HTMLButtonElement | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;

		for (const button of list.querySelectorAll<HTMLButtonElement>("[data-layer-value]")) {
			const buttonRect = button.getBoundingClientRect();
			const distance = Math.abs(buttonRect.top + buttonRect.height / 2 - listCenter);
			if (distance < closestDistance) {
				closestButton = button;
				closestDistance = distance;
			}
		}

		if (!closestButton) return;
		const layerValue = Number(closestButton.dataset.layerValue);
		if (layerValue !== displayedLayerRef.current.layer) showLayer(getLayer(world, layerValue));
	}

	useLayoutEffect(() => {
		if (hasCenteredInitialLayer.current) return;
		const layerList = layerListRef.current;
		if (!layerList) return;
		const selectedButton = layerList.querySelector<HTMLButtonElement>(
			`[data-layer-value="${currentLayer.layer}"]`,
		);
		if (selectedButton) {
			hasCenteredInitialLayer.current = true;
			centerLayer(selectedButton, currentLayer, "auto");
		}
	}, [centerLayer, currentLayer]);

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
			const targetButton = layerListRef.current?.querySelector<HTMLButtonElement>(
				`[data-layer-value="${targetLayer.layer}"]`,
			);
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
			<div className="layerMenu--leftShell">
				<div
					ref={layerListRef}
					className="layerMenu--left"
					aria-label="Layers"
					onScroll={handleLayerListScroll}
				>
					{displayedLayers.map((layer, index) => (
						<LayerMenuButton
							key={layer.layer}
							layer={layer}
							layerIndex={index}
							displayedLayer={displayedLayer}
							centerLayer={centerLayer}
						/>
					))}
				</div>
				<div className="layerMenu--left__centerIndicator" aria-hidden="true" />
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
