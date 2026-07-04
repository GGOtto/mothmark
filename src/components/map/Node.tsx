import {useRef} from "react";
import type {RoomNode} from "../../types/mapTypes";
import type {Room, Direction, Point} from "../../schemas/worldSchema";

type NodeProps = {
	room: Room;
	node: RoomNode;
	onNodeClick: (fromRoom: Room, direction: Direction) => void;
	onConnectionDragStart: (
		event: React.PointerEvent<HTMLDivElement>,
		fromRoom: Room,
		direction: Direction,
	) => void;
	onConnectionDragMove: (event: React.PointerEvent<HTMLDivElement>) => void;
	onConnectionDragEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
	onConnectionDragCancel: () => void;
};

const DRAG_THRESHOLD = 5;

function getClientPoint(event: React.PointerEvent<HTMLDivElement>): Point {
	return {
		x: event.clientX,
		y: event.clientY,
	};
}

export function Node({
	room,
	node,
	onNodeClick,
	onConnectionDragStart,
	onConnectionDragMove,
	onConnectionDragEnd,
	onConnectionDragCancel,
}: NodeProps) {
	const startPointerRef = useRef<Point | null>(null);
	const hasDraggedRef = useRef(false);
	const pointerIdRef = useRef<number | null>(null);
	const buttonRef = useRef<number | null>(null);
	const suppressNextClickRef = useRef(false);

	return (
		<div
			style={{
				position: "absolute",
				left: `calc(50% + ${node.position.x}px)`,
				top: `calc(50% + ${node.position.y}px)`,
				transform: "translate(-50%, -50%)",
				width: 10,
				height: 10,
				borderRadius: "50%",
				border: "2px solid #2f2920",
				background: "#ffffff",
				pointerEvents: "auto",
				userSelect: "none",
				touchAction: "none",
				zIndex: 3,
				cursor: "pointer",
			}}
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onPointerDown={(event) => {
				const isLeftClick = event.button === 0;
				const isRightClick = event.button === 2;

				if (!isLeftClick && !isRightClick) return;

				event.stopPropagation();
				event.preventDefault();

				startPointerRef.current = getClientPoint(event);
				hasDraggedRef.current = false;
				pointerIdRef.current = event.pointerId;
				buttonRef.current = event.button;
				suppressNextClickRef.current = false;

				event.currentTarget.setPointerCapture(event.pointerId);

				onConnectionDragStart(event, room, node.direction);
			}}
			onPointerMove={(event) => {
				event.stopPropagation();
				event.preventDefault();

				if (pointerIdRef.current !== event.pointerId) return;

				const startPointer = startPointerRef.current;

				if (!startPointer) return;

				const pointer = getClientPoint(event);
				const distance = Math.hypot(pointer.x - startPointer.x, pointer.y - startPointer.y);

				if (distance < DRAG_THRESHOLD && !hasDraggedRef.current) {
					return;
				}

				hasDraggedRef.current = true;
				suppressNextClickRef.current = true;

				onConnectionDragMove(event);
			}}
			onPointerUp={(event) => {
				event.stopPropagation();
				event.preventDefault();

				if (pointerIdRef.current !== event.pointerId) return;

				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}

				if (hasDraggedRef.current) {
					suppressNextClickRef.current = true;
					onConnectionDragEnd(event);
				} else {
					onConnectionDragCancel();

					if (buttonRef.current === 0) {
						onNodeClick(room, node.direction);
					}
				}

				startPointerRef.current = null;
				hasDraggedRef.current = false;
				pointerIdRef.current = null;
				buttonRef.current = null;
			}}
			onPointerCancel={(event) => {
				event.stopPropagation();
				event.preventDefault();

				if (pointerIdRef.current !== event.pointerId) return;

				onConnectionDragCancel();

				startPointerRef.current = null;
				hasDraggedRef.current = false;
				pointerIdRef.current = null;
				buttonRef.current = null;
				suppressNextClickRef.current = true;
			}}
			onClick={(event) => {
				event.stopPropagation();

				if (suppressNextClickRef.current) {
					event.preventDefault();
					suppressNextClickRef.current = false;
				}
			}}
		/>
	);
}
