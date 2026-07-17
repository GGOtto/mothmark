import type {Layer, World} from "@/schemas/worldSchema";
import {
	getLayerNavigationDirection,
	LAYER_SCROLL_END_DELAY,
	LAYER_SCROLL_STEP_DELAY,
} from "@/utils/layerNavigation";
import {getLayer} from "@/utils/layerUtils";
import "./LayerMenu.scss";
import {LayerPreview} from "./LayerPreview";
import {useCallback, useEffect, useRef, useState} from "react";
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
	const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollSequenceActive = useRef(false);
	const lastScrollStepAt = useRef(0);

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

	function clearScrollSequence() {
		scrollSequenceActive.current = false;
		lastScrollStepAt.current = 0;
		scrollEndTimer.current = null;
	}

	function scheduleScrollSequenceClear() {
		if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
		scrollEndTimer.current = setTimeout(clearScrollSequence, LAYER_SCROLL_END_DELAY);
	}

	function handleLayerMenuWheel(event: React.WheelEvent<HTMLDivElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (event.deltaY === 0) return;

		const now = Date.now();
		if (!scrollSequenceActive.current || now - lastScrollStepAt.current >= LAYER_SCROLL_STEP_DELAY) {
			moveDisplayedLayer(event.deltaY < 0 ? 1 : -1);
			scrollSequenceActive.current = true;
			lastScrollStepAt.current = now;
		}

		scheduleScrollSequenceClear();
	}

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
			if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
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
			onWheel={handleLayerMenuWheel}
		>
			<button type="button" onClick={() => setIsLayerMenuOpen(false)} aria-label="Close layer menu">
				<X aria-hidden="true" />
			</button>
			<div className="layerMenu--left">
				{world.metadata.layers.map((layer) => (
					<button
						key={layer.layer}
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
						mode="pan"
						selectedId={selectedId}
						isConnectionSelected={isConnectionSelected}
						theme="light"
						className="layerMenu--preview__card"
					/>
				</div>
				<div className="layerMenu--controls">
					<div className="layerMenu--info">Drag to pan · Scroll to change layer</div>
					<button className="layerMenu--open" onClick={handleOpenLayer}>
						Open Layer
					</button>
				</div>
			</div>
		</div>
	);
}
