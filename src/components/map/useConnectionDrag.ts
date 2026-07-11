import {useEffect, useRef, useState} from "react";
import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/roomSchema";
import {
	getDuplicateConnectionByShape,
	getNearestNodeInRadius,
	getPathwayForNewDrop,
	type SnapTarget,
} from "../../utils/connectionUtils";
import {createDefaultConnection} from "../../utils/createDefaultWorld";
import {compareIds, idValue} from "../../utils/idUtils";

export type ConnectionDragState = {
	fromRoomId: string;
	fromDirection: Direction;
	startPointer: Point;
	startPoint: Point;
	currentPoint: Point;
	hasDragged: boolean;
	snapTarget: SnapTarget | null;
};

type UseConnectionDragParams = {
	rooms: Room[];
	connections: ConnectionType[];
	setConnections: React.Dispatch<React.SetStateAction<ConnectionType[]>>;
	getRoomConnectionPoint: (room: Room, direction: Direction) => Point;
	onConnectionSelectionRequested?: (connectionId: string) => void;
};

const DRAG_THRESHOLD = 5;
const SNAP_DISTANCE = 24;

function createConnectionId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `connection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useConnectionDrag({
	rooms,
	connections,
	setConnections,
	getRoomConnectionPoint,
	onConnectionSelectionRequested,
}: UseConnectionDragParams) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const connectionDragStateRef = useRef<ConnectionDragState | null>(null);
	const connectionPointerIdRef = useRef<number | null>(null);

	const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);

	function setSyncedConnectionDragState(state: ConnectionDragState | null) {
		connectionDragStateRef.current = state;
		setConnectionDragState(state);
	}

	function updateSyncedConnectionDragState(
		update: (state: ConnectionDragState | null) => ConnectionDragState | null,
	) {
		setConnectionDragState((state) => {
			const nextState = update(state);
			connectionDragStateRef.current = nextState;
			return nextState;
		});
	}

	function addOrUpdateConnectionByShape(
		connection: ConnectionType,
		options: {selectConnection?: boolean} = {},
	) {
		const shouldSelectConnection = options.selectConnection ?? true;

		setConnections((connections) => {
			const existingConnection = getDuplicateConnectionByShape(connections, connection);

			if (existingConnection) {
				if (shouldSelectConnection) {
					onConnectionSelectionRequested?.(idValue(existingConnection.id));
				}

				return connections.map((currentConnection) => {
					if (!compareIds(currentConnection.id, existingConnection.id)) return currentConnection;

					return {
						...currentConnection,
						pathway: connection.pathway,
					};
				});
			}

			if (shouldSelectConnection) {
				onConnectionSelectionRequested?.(idValue(connection.id));
			}

			return [...connections, connection];
		});
	}

	function getMapPointerFromClient(clientX: number, clientY: number): Point | null {
		const mapElement = mapRef.current;

		if (!mapElement) return null;

		const bounds = mapElement.getBoundingClientRect();

		return {
			x: clientX - bounds.left,
			y: clientY - bounds.top,
		};
	}

	function getMapPointer(event: React.PointerEvent<HTMLElement>): Point | null {
		return getMapPointerFromClient(event.clientX, event.clientY);
	}

	function getNearestConnectionNode(
		pointer: Point,
		options: {
			ignoredRoomId?: string;
		} = {},
	) {
		return getNearestNodeInRadius({
			pointer,
			rooms,
			getRoomConnectionPoint,
			snapDistance: SNAP_DISTANCE,
			ignoredRoomId: options.ignoredRoomId,
		});
	}

	function addDraggedConnection(
		fromRoomId: string,
		fromDirection: Direction,
		toRoom: Room,
		toDirection: Direction,
	) {
		if (fromRoomId === idValue(toRoom.id)) return;

		const pathway = getPathwayForNewDrop(
			fromRoomId,
			fromDirection,
			idValue(toRoom.id),
			toDirection,
			connections,
		);

		const connection: ConnectionType = createDefaultConnection({
			id: createConnectionId(),
			fromRoomId,
			toRoomId: toRoom.id,
			direction: fromDirection,
			returnDirection: toDirection,
			pathway,
		});

		const existingConnection = getDuplicateConnectionByShape(connections, connection);
		const connectionToSelect = existingConnection ?? connection;

		onConnectionSelectionRequested?.(idValue(connectionToSelect.id));

		setConnections((currentConnections) => {
			if (!existingConnection) return [...currentConnections, connection];

			return currentConnections.map((currentConnection) => {
				if (!compareIds(currentConnection.id, existingConnection.id)) return currentConnection;

				return {
					...currentConnection,
					pathway,
				};
			});
		});
	}

	function cancelConnectionDrag() {
		setSyncedConnectionDragState(null);
		connectionPointerIdRef.current = null;
	}

	function finishConnectionDrag() {
		cancelConnectionDrag();
	}

	function moveConnectionDragToClientPoint(clientX: number, clientY: number) {
		const pointer = getMapPointerFromClient(clientX, clientY);

		if (!pointer) return;

		updateSyncedConnectionDragState((connectionDragState) => {
			if (!connectionDragState) return null;

			const distanceFromStart = Math.hypot(
				pointer.x - connectionDragState.startPointer.x,
				pointer.y - connectionDragState.startPointer.y,
			);

			const hasDragged = connectionDragState.hasDragged || distanceFromStart >= DRAG_THRESHOLD;

			if (!hasDragged) {
				return {
					...connectionDragState,
					currentPoint: pointer,
					hasDragged: false,
					snapTarget: null,
				};
			}

			const snapTarget = getNearestConnectionNode(pointer, {
				ignoredRoomId: connectionDragState.fromRoomId,
			});

			return {
				...connectionDragState,
				currentPoint: snapTarget?.point ?? pointer,
				hasDragged,
				snapTarget,
			};
		});
	}

	function endConnectionDragAtClientPoint(clientX: number, clientY: number) {
		const activeConnectionDragState = connectionDragStateRef.current;
		const pointer = getMapPointerFromClient(clientX, clientY);

		if (!activeConnectionDragState || !pointer) {
			cancelConnectionDrag();
			return;
		}

		if (!activeConnectionDragState.hasDragged) {
			cancelConnectionDrag();
			return;
		}

		const snapTarget = getNearestConnectionNode(pointer, {
			ignoredRoomId: activeConnectionDragState.fromRoomId,
		});

		if (!snapTarget) {
			finishConnectionDrag();
			return;
		}

		addDraggedConnection(
			activeConnectionDragState.fromRoomId,
			activeConnectionDragState.fromDirection,
			snapTarget.room,
			snapTarget.direction,
		);

		finishConnectionDrag();
	}

	useEffect(() => {
		function handleWindowPointerMove(event: PointerEvent) {
			if (connectionPointerIdRef.current !== event.pointerId) return;
			if (!connectionDragStateRef.current) return;

			moveConnectionDragToClientPoint(event.clientX, event.clientY);
		}

		function handleWindowPointerUp(event: PointerEvent) {
			if (connectionPointerIdRef.current !== event.pointerId) return;

			endConnectionDragAtClientPoint(event.clientX, event.clientY);
		}

		function handleWindowPointerCancel(event: PointerEvent) {
			if (connectionPointerIdRef.current !== event.pointerId) return;

			finishConnectionDrag();
		}

		function handleWindowBlur() {
			finishConnectionDrag();
		}

		window.addEventListener("pointermove", handleWindowPointerMove);
		window.addEventListener("pointerup", handleWindowPointerUp);
		window.addEventListener("pointercancel", handleWindowPointerCancel);
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			window.removeEventListener("pointermove", handleWindowPointerMove);
			window.removeEventListener("pointerup", handleWindowPointerUp);
			window.removeEventListener("pointercancel", handleWindowPointerCancel);
			window.removeEventListener("blur", handleWindowBlur);
		};
	});

	function handleConnectionDragStart(
		event: React.PointerEvent<HTMLDivElement>,
		fromRoom: Room,
		fromDirection: Direction,
	) {
		event.stopPropagation();

		if (event.button !== 0) return;

		connectionPointerIdRef.current = event.pointerId;

		const pointer = getMapPointer(event);
		const sourcePoint = getRoomConnectionPoint(fromRoom, fromDirection);
		const startPointer = pointer ?? sourcePoint;

		setSyncedConnectionDragState({
			fromRoomId: idValue(fromRoom.id),
			fromDirection,
			startPointer,
			startPoint: sourcePoint,
			currentPoint: startPointer,
			hasDragged: false,
			snapTarget: null,
		});
	}

	function handleConnectionDragMove(event: React.PointerEvent<HTMLDivElement>) {
		event.stopPropagation();

		if (connectionPointerIdRef.current !== event.pointerId) return;

		moveConnectionDragToClientPoint(event.clientX, event.clientY);
	}

	function handleConnectionDragEnd(event: React.PointerEvent<HTMLDivElement>) {
		event.stopPropagation();

		if (connectionPointerIdRef.current !== event.pointerId) return;

		endConnectionDragAtClientPoint(event.clientX, event.clientY);
	}

	return {
		mapRef,
		connectionDragState,
		addOrUpdateConnectionByShape,
		handleConnectionDragStart,
		handleConnectionDragMove,
		handleConnectionDragEnd,
		handleConnectionDragCancel: finishConnectionDrag,
	};
}
