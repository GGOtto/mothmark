"use client";

import type React from "react";
import {useEffect, useRef, useState} from "react";

type AdjustableBoxEdge = "top" | "bottom" | "left" | "right";

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
}: AdjustableBoxProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);

	const [currentWidth, setCurrentWidth] = useState<AdjustableSize | undefined>(width);
	const [currentHeight, setCurrentHeight] = useState<AdjustableSize | undefined>(height);
	const [dragState, setDragState] = useState<DragState | null>(null);

	useEffect(() => {
		setCurrentWidth(width);
	}, [width]);

	useEffect(() => {
		setCurrentHeight(height);
	}, [height]);

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

	return (
		<div
			ref={containerRef}
			className={`relative box-border min-h-0 min-w-0 ${className}`}
			style={{
				width: toCssSize(currentWidth),
				height: toCssSize(currentHeight),
				minWidth: toCssSize(minWidth),
				minHeight: toCssSize(minHeight),
				maxWidth: toCssSize(maxWidth),
				maxHeight: toCssSize(maxHeight),
			}}
		>
			{adjustableEdges.includes("top") && (
				<div
					className="absolute left-0 top-0 z-10 w-full cursor-ns-resize touch-none"
					style={{
						height: HANDLE_SIZE,
						transform: "translateY(-50%)",
					}}
					onPointerDown={startDrag("top")}
				/>
			)}

			{adjustableEdges.includes("bottom") && (
				<div
					className="absolute bottom-0 left-0 z-10 w-full cursor-ns-resize touch-none"
					style={{
						height: HANDLE_SIZE,
						transform: "translateY(50%)",
					}}
					onPointerDown={startDrag("bottom")}
				/>
			)}

			{adjustableEdges.includes("left") && (
				<div
					className="absolute left-0 top-0 z-10 h-full cursor-ew-resize touch-none"
					style={{
						width: HANDLE_SIZE,
						transform: "translateX(-50%)",
					}}
					onPointerDown={startDrag("left")}
				/>
			)}

			{adjustableEdges.includes("right") && (
				<div
					className="absolute right-0 top-0 z-10 h-full cursor-ew-resize touch-none"
					style={{
						width: HANDLE_SIZE,
						transform: "translateX(50%)",
					}}
					onPointerDown={startDrag("right")}
				/>
			)}

			{children}
		</div>
	);
}
