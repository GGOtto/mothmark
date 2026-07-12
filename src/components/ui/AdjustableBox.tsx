"use client";

import type React from "react";
import {useEffect, useRef, useState} from "react";
import "./AdjustableBox.scss";

type AdjustableBoxEdge = "top" | "bottom" | "left" | "right";
export type AdjustableBoxHandleStyle = "thin" | "hover" | "notch" | "double-dots";

type AdjustableSize = number | string;

type AdjustableBoxProps = {
	children: React.ReactNode;
	width?: AdjustableSize;
	height?: AdjustableSize;
	maxWidth?: AdjustableSize;
	maxHeight?: AdjustableSize;
	minWidth?: AdjustableSize;
	minHeight?: AdjustableSize;
	className?: string;
	adjustableEdges?: AdjustableBoxEdge[];
	resizeHandleStyle?: AdjustableBoxHandleStyle;
};

type DragState = {
	edge: AdjustableBoxEdge;
};

const HANDLE_SIZE = 8;

function toCssSize(size: AdjustableSize | undefined) {
	if (size === undefined) return undefined;
	if (typeof size === "number") return `${size}px`;
	return size;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getPixelValue(size: AdjustableSize | undefined, fallback: number) {
	if (typeof size === "number") return size;
	return fallback;
}

export function AdjustableBox({
	children,
	width,
	height,
	maxWidth,
	maxHeight,
	minWidth,
	minHeight,
	className = "",
	adjustableEdges = [],
	resizeHandleStyle = "notch",
}: AdjustableBoxProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);

	const [currentWidth, setCurrentWidth] = useState<AdjustableSize | undefined>(width);
	const [currentHeight, setCurrentHeight] = useState<AdjustableSize | undefined>(height);
	const [dragState, setDragState] = useState<DragState | null>(null);

	useEffect(() => {
		if (!dragState) return;

		function handlePointerMove(event: PointerEvent) {
			const box = containerRef.current;
			const parent = box?.parentElement;
			if (!box || !parent) return;

			const boxRect = box.getBoundingClientRect();
			const parentRect = parent.getBoundingClientRect();

			const resolvedMinWidth = getPixelValue(minWidth, 120);
			const resolvedMinHeight = getPixelValue(minHeight, 120);
			const resolvedMaxWidth = getPixelValue(maxWidth, parentRect.width);
			const resolvedMaxHeight = getPixelValue(maxHeight, parentRect.height);

			if (dragState?.edge === "top") {
				const nextHeight = boxRect.bottom - event.clientY;
				setCurrentHeight(clamp(nextHeight, resolvedMinHeight, resolvedMaxHeight));
			}

			if (dragState?.edge === "bottom") {
				const nextHeight = event.clientY - boxRect.top;
				setCurrentHeight(clamp(nextHeight, resolvedMinHeight, resolvedMaxHeight));
			}

			if (dragState?.edge === "left") {
				const nextWidth = boxRect.right - event.clientX;
				setCurrentWidth(clamp(nextWidth, resolvedMinWidth, resolvedMaxWidth));
			}

			if (dragState?.edge === "right") {
				const nextWidth = event.clientX - boxRect.left;
				setCurrentWidth(clamp(nextWidth, resolvedMinWidth, resolvedMaxWidth));
			}
		}

		function handlePointerUp() {
			setDragState(null);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [dragState, minWidth, minHeight, maxWidth, maxHeight]);

	function startDrag(edge: AdjustableBoxEdge) {
		return (event: React.PointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			setDragState({edge});
		};
	}

	const boxClassName = ["adjustableBox", dragState && "adjustableBox--resizing", className]
		.filter(Boolean)
		.join(" ");

	function handleProps(edge: AdjustableBoxEdge) {
		return {
			"aria-label": `Resize ${edge} edge`,
			"aria-orientation": (edge === "top" || edge === "bottom" ? "horizontal" : "vertical") as
				"horizontal" | "vertical",
			"data-active": dragState?.edge === edge || undefined,
			role: "separator",
			title: `Drag to resize ${edge} edge`,
		};
	}

	function renderHandle(edge: AdjustableBoxEdge) {
		const isHorizontal = edge === "top" || edge === "bottom";
		return (
			<div
				className={`adjustableBoxHandle adjustableBoxHandle${edge[0].toUpperCase()}${edge.slice(1)} adjustableBoxHandle--${resizeHandleStyle}`}
				style={isHorizontal ? {height: HANDLE_SIZE} : {width: HANDLE_SIZE}}
				onPointerDown={startDrag(edge)}
				{...handleProps(edge)}
			>
				<span className="adjustableBoxHandleIndicator" aria-hidden="true" />
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={boxClassName}
			style={{
				width: toCssSize(currentWidth),
				height: toCssSize(currentHeight),
				minWidth: toCssSize(minWidth),
				minHeight: toCssSize(minHeight),
				maxWidth: toCssSize(maxWidth),
				maxHeight: toCssSize(maxHeight),
			}}
		>
			{adjustableEdges.includes("top") && renderHandle("top")}
			{adjustableEdges.includes("bottom") && renderHandle("bottom")}
			{adjustableEdges.includes("left") && renderHandle("left")}
			{adjustableEdges.includes("right") && renderHandle("right")}

			{children}
		</div>
	);
}
