import {Layer, World} from "@/schemas/world/worldSchema";
import {Layers, ArrowDown, ArrowUp} from "lucide-react";
import "./LayoutControl.scss";
import {getLayer} from "./utils/layerUtils";
import {LAYER_SCROLL_END_DELAY, LAYER_SCROLL_STEP_DELAY} from "./utils/layerNavigation";
import {useEffect, useRef, useState} from "react";

type LayoutControlProps = {
	world: World;
	setCurrentLayer: (layer: Layer) => void;
	currentLayer: Layer;
	isLayerMenuOpen: boolean;
	setIsLayerMenuOpen: (value: boolean) => void;
};

export function LayoutControl({
	world,
	setCurrentLayer,
	currentLayer,
	isLayerMenuOpen,
	setIsLayerMenuOpen,
}: LayoutControlProps) {
	const [pendingLayer, setPendingLayer] = useState<Layer | null>(null);
	const [scrollDirection, setScrollDirection] = useState<1 | -1 | null>(null);
	const pendingLayerRef = useRef<Layer | null>(null);
	const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastScrollStepAt = useRef(0);

	function clearPendingLayer() {
		pendingLayerRef.current = null;
		lastScrollStepAt.current = 0;
		setPendingLayer(null);
		setScrollDirection(null);
		scrollEndTimer.current = null;
	}

	function cancelPendingScroll() {
		if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
		clearPendingLayer();
	}

	function schedulePendingLayerClear() {
		if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
		scrollEndTimer.current = setTimeout(clearPendingLayer, LAYER_SCROLL_END_DELAY);
	}

	function showPendingLayer(layer: Layer, direction: 1 | -1) {
		pendingLayerRef.current = layer;
		setPendingLayer(layer);
		setScrollDirection(direction);
		schedulePendingLayerClear();
	}

	function moveUpLayer(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation();
		cancelPendingScroll();
		const newLayer = getLayer(world, currentLayer.layer + 1);
		setCurrentLayer(newLayer);
		showPendingLayer(newLayer, 1);
	}

	function openMenu(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation();
		cancelPendingScroll();
		setIsLayerMenuOpen(!isLayerMenuOpen);
	}

	function moveDownLayer(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation();
		cancelPendingScroll();
		const newLayer = getLayer(world, currentLayer.layer - 1);
		setCurrentLayer(newLayer);
		showPendingLayer(newLayer, -1);
	}

	function switchLayerOnScroll(event: React.WheelEvent<HTMLDivElement>) {
		event.stopPropagation();
		if (event.deltaY === 0) return;

		const now = Date.now();
		if (!pendingLayerRef.current || now - lastScrollStepAt.current >= LAYER_SCROLL_STEP_DELAY) {
			const direction = event.deltaY < 0 ? 1 : -1;
			const startingLayer = pendingLayerRef.current ?? currentLayer;
			const targetLayer = getLayer(world, startingLayer.layer + direction);
			pendingLayerRef.current = targetLayer;
			lastScrollStepAt.current = now;
			setPendingLayer(targetLayer);
			setScrollDirection(direction);
			setCurrentLayer(targetLayer);
		}

		schedulePendingLayerClear();
	}

	useEffect(
		() => () => {
			if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
		},
		[],
	);

	const upperLayer = getLayer(world, currentLayer.layer + 1);
	const lowerLayer = getLayer(world, currentLayer.layer - 1);

	return (
		<div
			className="layoutControl"
			role="group"
			aria-label="Layer navigation"
			onPointerDown={(event) => event.stopPropagation()}
			onWheel={switchLayerOnScroll}
		>
			{pendingLayer ? (
				<div className="layoutControl--scrollIndicator" role="status" aria-atomic="true">
					{scrollDirection === 1 ? (
						<ArrowUp className="pendingLayerIcon" size={15} strokeWidth={3} />
					) : (
						<ArrowDown className="pendingLayerIcon" size={15} strokeWidth={3} />
					)}
					{pendingLayer.name}
				</div>
			) : null}
			<button
				type="button"
				className="layoutControl--up"
				onClick={moveUpLayer}
				title={`Switch to ${upperLayer.name}`}
				aria-label={`Switch to ${upperLayer.name}`}
			>
				<ArrowUp />
			</button>
			<button
				type="button"
				className="layoutControl--menu"
				onClick={openMenu}
				title={`Layers · ${currentLayer.name}`}
				aria-label={`Layers · ${currentLayer.name}`}
				aria-expanded={isLayerMenuOpen}
			>
				<Layers />
			</button>
			<button
				type="button"
				className="layoutControl--down"
				onClick={moveDownLayer}
				title={`Switch to ${lowerLayer.name}`}
				aria-label={`Switch to ${lowerLayer.name}`}
			>
				<ArrowDown />
			</button>
		</div>
	);
}
