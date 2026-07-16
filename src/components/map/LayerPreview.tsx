"use client";

// A preview of a map layer
// Either frames all rooms or shows the last view of a map (use world.metadata.layer.viewport)
// Can be static or zoomable/pannable

import type React from "react";
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import type {Layer, Viewport, World} from "@/schemas/worldSchema";
import {isRoomInLayer} from "@/utils/layerUtils";
import {MAP_ROOM_HEIGHT, MAP_ROOM_WIDTH, MapLayerContent} from "./MapLayerContent";
import {getConnectionVisualBounds} from "./Connection";
import type {MapTheme} from "./Map";
import "./Map.scss";
import "./LayerPreview.scss";

export type LayerPreviewProps = {
	world: World;
	layer: Layer;
	isFramed: boolean;
	mode: "static" | "zoom" | "pan" | "zoom-pan";
	onClick?: React.MouseEventHandler<HTMLDivElement>;
	selectedId?: string | null;
	isConnectionSelected?: boolean;
	theme?: MapTheme;
	className?: string;
	style?: React.CSSProperties;
};

const FRAME_PADDING = 28;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.5;

function getFramedViewport(world: World, layer: Layer, width: number, height: number): Viewport {
	const rooms = world.rooms.filter((room) => isRoomInLayer(layer, room.id));
	if (!rooms.length || width <= 0 || height <= 0) return layer.viewport;

	const connectionBounds = getConnectionVisualBounds(world, layer);
	const minX = Math.min(
		...rooms.map((room) => room.metadata.position.x - MAP_ROOM_WIDTH / 2),
		connectionBounds?.minX ?? Infinity,
	);
	const maxX = Math.max(
		...rooms.map((room) => room.metadata.position.x + MAP_ROOM_WIDTH / 2),
		connectionBounds?.maxX ?? -Infinity,
	);
	const minY = Math.min(
		...rooms.map((room) => room.metadata.position.y - MAP_ROOM_HEIGHT / 2),
		connectionBounds?.minY ?? Infinity,
	);
	const maxY = Math.max(
		...rooms.map((room) => room.metadata.position.y + MAP_ROOM_HEIGHT / 2),
		connectionBounds?.maxY ?? -Infinity,
	);
	const contentWidth = Math.max(1, maxX - minX);
	const contentHeight = Math.max(1, maxY - minY);
	const zoom = Math.max(
		MIN_ZOOM,
		Math.min(
			MAX_ZOOM,
			(width - FRAME_PADDING * 2) / contentWidth,
			(height - FRAME_PADDING * 2) / contentHeight,
		),
	);

	return {
		x: width / 2 - ((minX + maxX) / 2) * zoom,
		y: height / 2 - ((minY + maxY) / 2) * zoom,
		zoom,
	};
}

export function LayerPreview({
	world,
	layer,
	isFramed,
	mode,
	onClick,
	selectedId = null,
	isConnectionSelected = false,
	theme = "dark",
	className = "",
	style,
}: LayerPreviewProps) {
	const previewRef = useRef<HTMLDivElement | null>(null);
	const viewportRef = useRef<Viewport>(layer.viewport);
	const [viewport, setViewport] = useState<Viewport>(layer.viewport);
	const [isPanning, setIsPanning] = useState(false);
	const panState = useRef<{
		pointerId: number;
		startPointer: {x: number; y: number};
		startViewport: Viewport;
	} | null>(null);
	const didPan = useRef(false);
	const canPan = mode === "pan" || mode === "zoom-pan";
	const canZoom = mode === "zoom" || mode === "zoom-pan";

	const updateViewport = useCallback((next: Viewport) => {
		viewportRef.current = next;
		setViewport(next);
	}, []);

	const resetViewport = useCallback(() => {
		const element = previewRef.current;
		const next =
			isFramed && element
				? getFramedViewport(world, layer, element.clientWidth, element.clientHeight)
				: layer.viewport;
		updateViewport(next);
	}, [isFramed, layer, updateViewport, world]);

	useLayoutEffect(resetViewport, [resetViewport]);

	useEffect(() => {
		const element = previewRef.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(resetViewport);
		observer.observe(element);
		return () => observer.disconnect();
	}, [resetViewport]);

	function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (!canPan || event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		didPan.current = false;
		setIsPanning(true);
		panState.current = {
			pointerId: event.pointerId,
			startPointer: {x: event.clientX, y: event.clientY},
			startViewport: viewportRef.current,
		};
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		const pan = panState.current;
		if (!pan || pan.pointerId !== event.pointerId) return;
		const x = event.clientX - pan.startPointer.x;
		const y = event.clientY - pan.startPointer.y;
		if (Math.abs(x) + Math.abs(y) > 2) didPan.current = true;
		updateViewport({...pan.startViewport, x: pan.startViewport.x + x, y: pan.startViewport.y + y});
	}

	function stopPanning(event: React.PointerEvent<HTMLDivElement>) {
		if (panState.current?.pointerId !== event.pointerId) return;
		panState.current = null;
		setIsPanning(false);
	}

	function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
		if (!canZoom) return;
		event.preventDefault();
		event.stopPropagation();
		const bounds = event.currentTarget.getBoundingClientRect();
		const pointer = {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
		const current = viewportRef.current;
		const zoom = Math.min(
			MAX_ZOOM,
			Math.max(MIN_ZOOM, current.zoom * Math.exp(-event.deltaY * 0.0006)),
		);
		if (zoom === current.zoom) return;
		const mapPoint = {
			x: (pointer.x - current.x) / current.zoom,
			y: (pointer.y - current.y) / current.zoom,
		};
		updateViewport({
			x: pointer.x - mapPoint.x * zoom,
			y: pointer.y - mapPoint.y * zoom,
			zoom,
		});
	}

	function handleClick(event: React.MouseEvent<HTMLDivElement>) {
		if (didPan.current) {
			didPan.current = false;
			return;
		}
		onClick?.(event);
	}

	const classes = [
		"map",
		"layerPreview",
		`map--theme-${theme}`,
		onClick ? "layerPreview--clickable" : "",
		canPan ? "layerPreview--pannable" : "",
		isPanning ? "layerPreview--panning" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			ref={previewRef}
			className={classes}
			data-layer-preview
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			aria-label={onClick ? `Open ${layer.name}` : `${layer.name} preview`}
			style={{
				...style,
				backgroundPosition: `${viewport.x}px ${viewport.y}px`,
				backgroundSize: `auto, auto, ${48 * viewport.zoom}px ${48 * viewport.zoom}px, ${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={stopPanning}
			onPointerCancel={stopPanning}
			onWheel={handleWheel}
			onClick={handleClick}
			onKeyDown={(event) => {
				if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
				event.preventDefault();
				event.currentTarget.click();
			}}
		>
			<div
				className="mapViewport layerPreviewViewport"
				style={{transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`}}
			>
				<MapLayerContent
					world={world}
					layer={layer}
					selectedId={selectedId}
					isConnectionSelected={isConnectionSelected}
					isInteractive={false}
				/>
			</div>
			<div className="layerPreviewGlass" aria-hidden="true" />
		</div>
	);
}
