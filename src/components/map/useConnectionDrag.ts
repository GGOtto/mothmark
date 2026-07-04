import {useEffect, useRef, useState} from "react";
import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/worldSchema";
import {
	getConnectionSide,
	getConnectionsOnNode,
	getDuplicateConnectionByShape,
	getNearestNodeInRadius,
	getNodeSelectionKey,
	getPathwayForNewDrop,
	type MovingConnectionSide,
	type SnapTarget,
} from "../../utils/connectionUtils";

type ConnectionDragMode = "create" | "edit";

export type ConnectionDragState = {
	mode: ConnectionDragMode;
	fromRoomId: string;
	fromDirection: Direction;
	startPointer: Point;
	startPoint: Point;
	currentPoint: Point;
	hasDragged: boolean;
	snapTarget: SnapTarget | null;
	connectionId?: string;
	movingSide?: MovingConnectionSide;
	lockedRoomId?: string;
};

type UseConnectionDragParams = {
	rooms: Room[];
	connections: ConnectionType[];
	setConnections: React.Dispatch<React.SetStateAction<ConnectionType[]>>;
	getRoomConnectionPoint: (room: Room, direction: Direction) => Point;
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
}: UseConnectionDragParams) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const connectionDragStateRef = useRef<ConnectionDragState | null>(null);
	const connectionPointerIdRef = useRef<number | null>(null);

	const editSelectionKeyRef = useRef<string | null>(null);
	const editSelectionIndexRef = useRef(0);
	const selectedConnectionIdRef = useRef<string | null>(null);

	const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
	const [selectedConnectionId, setSelectedConnectionIdState] = useState<string | null>(null);

	function setSelectedConnection(connectionId: string | null) {
		selectedConnectionIdRef.current = connectionId;
		setSelectedConnectionIdState(connectionId);
	}

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

	function addOrUpdateConnectionByShape(connection: ConnectionType) {
		setConnections((connections) => {
			const existingConnection = getDuplicateConnectionByShape(connections, connection);

			if (existingConnection) {
				return connections.map((currentConnection) => {
					if (currentConnection.id !== existingConnection.id) return currentConnection;

					return {
						...currentConnection,
						pathway: connection.pathway,
					};
				});
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
			lockedRoomId?: string;
		} = {},
	) {
		return getNearestNodeInRadius({
			pointer,
			rooms,
			getRoomConnectionPoint,
			snapDistance: SNAP_DISTANCE,
			ignoredRoomId: options.ignoredRoomId,
			lockedRoomId: options.lockedRoomId,
		});
	}

	function getEditableConnectionOnNode(roomId: string, direction: Direction) {
		const nodeConnections = getConnectionsOnNode(connections, roomId, direction);

		if (nodeConnections.length === 0) {
			return null;
		}

		// TODO: Replace this cycling behavior with path selection.
		// Ideally, SVG connections should be pointer-interactive with pointerEvents="stroke",
		// so the user can select the exact path they want to edit before redrawing it.
		const selectionKey = getNodeSelectionKey(roomId, direction);
		const selectedConnectionIndex = nodeConnections.findIndex(
			(connection) => connection.id === selectedConnectionIdRef.current,
		);

		if (editSelectionKeyRef.current !== selectionKey) {
			editSelectionKeyRef.current = selectionKey;
			editSelectionIndexRef.current = 0;
		} else if (selectedConnectionIndex >= 0) {
			editSelectionIndexRef.current = (selectedConnectionIndex + 1) % nodeConnections.length;
		} else {
			editSelectionIndexRef.current = (editSelectionIndexRef.current + 1) % nodeConnections.length;
		}

		const selectedConnection = nodeConnections[editSelectionIndexRef.current];

		setSelectedConnection(selectedConnection.id);

		return selectedConnection;
	}

	function addDraggedConnection(
		fromRoomId: string,
		fromDirection: Direction,
		toRoom: Room,
		toDirection: Direction,
	) {
		if (fromRoomId === toRoom.id) return;

		setConnections((connections) => {
			const pathway = getPathwayForNewDrop(
				fromRoomId,
				fromDirection,
				toRoom.id,
				toDirection,
				connections,
			);

			const connection: ConnectionType = {
				id: createConnectionId(),
				fromRoomId,
				toRoomId: toRoom.id,
				direction: fromDirection,
				returnDirection: toDirection,
				pathway,
			};

			const existingConnection = getDuplicateConnectionByShape(connections, connection);

			if (existingConnection) {
				return connections.map((currentConnection) => {
					if (currentConnection.id !== existingConnection.id) return currentConnection;

					return {
						...currentConnection,
						pathway,
					};
				});
			}

			return [...connections, connection];
		});
	}

	function redrawDraggedConnection(
		connectionId: string,
		sideToRedraw: MovingConnectionSide,
		targetRoom: Room,
		targetDirection: Direction,
	) {
		setConnections((connections) => {
			const connectionToRedraw = connections.find((connection) => connection.id === connectionId);

			if (!connectionToRedraw) return connections;

			if (sideToRedraw === "from" && targetRoom.id === connectionToRedraw.toRoomId) {
				return connections;
			}

			if (sideToRedraw === "to" && targetRoom.id === connectionToRedraw.fromRoomId) {
				return connections;
			}

			const connectionsWithoutRedrawnConnection = connections.filter(
				(connection) => connection.id !== connectionId,
			);

			const redrawnConnectionWithoutPathway: ConnectionType =
				sideToRedraw === "from"
					? {
							...connectionToRedraw,
							id: createConnectionId(),
							fromRoomId: targetRoom.id,
							direction: targetDirection,
						}
					: {
							...connectionToRedraw,
							id: createConnectionId(),
							toRoomId: targetRoom.id,
							returnDirection: targetDirection,
						};

			const pathway = getPathwayForNewDrop(
				redrawnConnectionWithoutPathway.fromRoomId,
				redrawnConnectionWithoutPathway.direction,
				redrawnConnectionWithoutPathway.toRoomId,
				redrawnConnectionWithoutPathway.returnDirection,
				connectionsWithoutRedrawnConnection,
			);

			const redrawnConnection: ConnectionType = {
				...redrawnConnectionWithoutPathway,
				pathway,
			};

			const duplicateConnection = getDuplicateConnectionByShape(
				connectionsWithoutRedrawnConnection,
				redrawnConnection,
			);

			if (duplicateConnection) {
				return connectionsWithoutRedrawnConnection.map((connection) => {
					if (connection.id !== duplicateConnection.id) return connection;

					return {
						...connection,
						pathway,
					};
				});
			}

			return [...connectionsWithoutRedrawnConnection, redrawnConnection];
		});
	}

	function cancelConnectionDrag() {
		setSyncedConnectionDragState(null);
		connectionPointerIdRef.current = null;
	}

	function finishConnectionDrag() {
		cancelConnectionDrag();
		setSelectedConnection(null);
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
				ignoredRoomId:
					connectionDragState.mode === "create" ? connectionDragState.fromRoomId : undefined,
				lockedRoomId: connectionDragState.lockedRoomId,
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
			ignoredRoomId:
				activeConnectionDragState.mode === "create" ? activeConnectionDragState.fromRoomId : undefined,
			lockedRoomId: activeConnectionDragState.lockedRoomId,
		});

		if (!snapTarget) {
			finishConnectionDrag();
			return;
		}

		if (activeConnectionDragState.mode === "edit") {
			if (!activeConnectionDragState.connectionId || !activeConnectionDragState.movingSide) {
				finishConnectionDrag();
				return;
			}

			redrawDraggedConnection(
				activeConnectionDragState.connectionId,
				activeConnectionDragState.movingSide,
				snapTarget.room,
				snapTarget.direction,
			);

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
		const isLeftClick = event.button === 0;
		const isRightClick = event.button === 2;

		if (!isLeftClick && !isRightClick) return;

		connectionPointerIdRef.current = event.pointerId;

		const pointer = getMapPointer(event);
		const sourcePoint = getRoomConnectionPoint(fromRoom, fromDirection);
		const startPointer = pointer ?? sourcePoint;

		if (isLeftClick) {
			setSelectedConnection(null);

			setSyncedConnectionDragState({
				mode: "create",
				fromRoomId: fromRoom.id,
				fromDirection,
				startPointer,
				startPoint: sourcePoint,
				currentPoint: startPointer,
				hasDragged: false,
				snapTarget: null,
			});

			return;
		}

		const existingConnection = getEditableConnectionOnNode(fromRoom.id, fromDirection);

		if (!existingConnection) {
			cancelConnectionDrag();
			return;
		}

		const clickedSide = getConnectionSide(existingConnection, fromRoom.id, fromDirection);

		if (!clickedSide) {
			cancelConnectionDrag();
			return;
		}

		const sideToRedraw: MovingConnectionSide = clickedSide === "from" ? "to" : "from";

		setSyncedConnectionDragState({
			mode: "edit",
			fromRoomId: fromRoom.id,
			fromDirection,
			startPointer,
			startPoint: sourcePoint,
			currentPoint: startPointer,
			hasDragged: false,
			snapTarget: null,
			connectionId: existingConnection.id,
			movingSide: sideToRedraw,
			lockedRoomId: fromRoom.id,
		});
	}

	function handleConnectionDragMove(event: React.PointerEvent<HTMLDivElement>) {
		if (connectionPointerIdRef.current !== event.pointerId) return;

		moveConnectionDragToClientPoint(event.clientX, event.clientY);
	}

	function handleConnectionDragEnd(event: React.PointerEvent<HTMLDivElement>) {
		if (connectionPointerIdRef.current !== event.pointerId) return;

		endConnectionDragAtClientPoint(event.clientX, event.clientY);
	}

	return {
		mapRef,
		connectionDragState,
		editedConnectionId: connectionDragState?.connectionId ?? selectedConnectionId,
		addOrUpdateConnectionByShape,
		handleConnectionDragStart,
		handleConnectionDragMove,
		handleConnectionDragEnd,
		handleConnectionDragCancel: finishConnectionDrag,
	};
}
