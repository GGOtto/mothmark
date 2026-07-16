"use client";

import type React from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {
	RoomSchema,
	ConnectionSchema,
	type Point,
	type Room,
	type Connection as ConnectionType,
	type Direction,
} from "../../schemas/roomSchema";
import {DefaultViewport, type Layer, type World, type Viewport} from "../../schemas/worldSchema";
import {getRoomNodePosition, ROOM_DIRECTIONS} from "../../utils/mapUtils";
import {getLayer, upsertLayer} from "../../utils/layerUtils";
import {addPoints, subtractPoints, getDistance} from "../../utils/pointUtils";
import {
	getNextAvailablePathway,
	getPathwayForNewDrop,
	isConnectionFromRoom,
} from "../../utils/connectionUtils";
import {generateUniqueId, idValue} from "../../utils/idUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import type {UpdateStatus} from "../studio/ToolBar";
import "./Map.scss";
import {LayoutControl} from "./LayoutControl";
import {LayerMenu} from "./LayerMenu";
import {MAP_ROOM_HEIGHT, MAP_ROOM_WIDTH, MapLayerContent} from "./MapLayerContent";

type DragState = {
	roomId: string;
	offset: Point;
	startPointer: Point;
	startRoomPosition: Point;
	stubPoints: Record<string, Point>;
	hasDragged: boolean;
};

type MapProps = {
	world: World;
	tool: MapTool;
	onZoomChange?: (zoom: number) => void;
	theme?: MapTheme;
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	setConnections: React.Dispatch<React.SetStateAction<ConnectionType[]>>;
	setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
	selectedId: string | null;
	setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
	isConnectionSelected: boolean;
	setIsConnectionSelected: React.Dispatch<React.SetStateAction<boolean>>;
	connectionDraft: ConnectionDraft;
	setConnectionDraft: React.Dispatch<React.SetStateAction<ConnectionDraft>>;
	updateStatus: UpdateStatus;
	recenterRequest: number;
};

export type MapTheme = "light" | "dark";
export type MapTool = "edit" | "pan";
export type ConnectionDraft =
	| {state: "idle"}
	| {state: "choosing-destination"; fromRoomId: string; fromDirection: Direction}
	| {
			state: "choosing-return";
			fromRoomId: string;
			fromDirection: Direction;
			toRoomId: string;
	  };

type PanState = {
	pointerId: number;
	startPointer: Point;
	startViewport: Point;
};

const ROOM_DRAG_THRESHOLD = 2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

export function Map({
	world,
	tool,
	onZoomChange,
	theme = "dark",
	setRooms,
	setConnections,
	setLayers,
	selectedId,
	setSelectedId,
	isConnectionSelected,
	setIsConnectionSelected,
	connectionDraft,
	setConnectionDraft,
	updateStatus,
	recenterRequest,
}: MapProps) {
	const [dragState, setDragState] = useState<DragState | null>(null);
	const initialLayer = useRef(getLayer(world, 0));
	const [viewport, setViewport] = useState<Viewport>(initialLayer.current.viewport);
	const [panState, setPanState] = useState<PanState | null>(null);
	const viewportRef = useRef(viewport);
	const lastRecenterRequest = useRef(recenterRequest);
	const mapRef = useRef<HTMLDivElement | null>(null);
	const cancelConnectionDraft = useCallback(() => {
		setConnectionDraft({state: "idle"});
		updateStatus({kind: "cancelled", label: "Cancelled"}, {channel: "notice"});
	}, [setConnectionDraft, updateStatus]);
	const [currentLayer, setCurrentLayer] = useState<Layer>(initialLayer.current);
	const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);

	const updateViewport = useCallback(
		(nextViewport: Viewport) => {
			viewportRef.current = nextViewport;
			setViewport(nextViewport);
			setCurrentLayer((layer) => ({...layer, viewport: nextViewport}));
			setLayers((layers) => {
				const persistedLayer = layers.find((layer) => layer.layer === currentLayer.layer);
				return upsertLayer(layers, {
					...(persistedLayer ?? currentLayer),
					viewport: nextViewport,
				});
			});
		},
		[currentLayer, setLayers],
	);

	const changeCurrentLayer = useCallback((layer: Layer) => {
		setCurrentLayer(layer);
		viewportRef.current = layer.viewport;
		setViewport(layer.viewport);
	}, []);

	useEffect(() => {
		viewportRef.current = viewport;
		onZoomChange?.(viewport.zoom);
	}, [onZoomChange, viewport]);

	useEffect(() => {
		if (lastRecenterRequest.current === recenterRequest) return;
		lastRecenterRequest.current = recenterRequest;
		updateViewport({...DefaultViewport});
	}, [recenterRequest, updateViewport]);

	useEffect(() => () => updateStatus(null), [updateStatus]);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && connectionDraft.state !== "idle") {
				cancelConnectionDraft();
				return;
			}
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
				return;
			if (event.key.toLowerCase() === "v")
				document.querySelector<HTMLButtonElement>('[title="Edit map (V)"]')?.click();
			if (event.key.toLowerCase() === "h")
				document.querySelector<HTMLButtonElement>('[title="Pan map (H)"]')?.click();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cancelConnectionDraft, connectionDraft]);

	useEffect(() => {
		if (tool !== "edit" && connectionDraft.state !== "idle") cancelConnectionDraft();
	}, [tool, cancelConnectionDraft, connectionDraft]);

	function clientToMapPoint(clientX: number, clientY: number): Point | null {
		const mapElement = mapRef.current;
		if (!mapElement) return null;
		const bounds = mapElement.getBoundingClientRect();
		const currentViewport = viewportRef.current;
		return {
			x: (clientX - bounds.left - currentViewport.x) / currentViewport.zoom,
			y: (clientY - bounds.top - currentViewport.y) / currentViewport.zoom,
		};
	}

	function selectRoom(room?: Room) {
		setSelectedId(room ? idValue(room.id) : null);
		setIsConnectionSelected(false);
	}

	function selectConnection(connection?: ConnectionType) {
		setSelectedId(connection ? idValue(connection.id) : null);
		setIsConnectionSelected(true);
	}

	function handleConnectionSelect(connection?: ConnectionType) {
		if (connectionDraft.state === "choosing-return") cancelConnectionDraft();
		selectConnection(connection);
	}

	function handleConnectionPathwayChange(connection: ConnectionType) {
		const pathway = getNextAvailablePathway(connection, world.connections);
		setConnections((currentConnections) =>
			currentConnections.map((currentConnection) => {
				if (idValue(currentConnection.id) !== idValue(connection.id)) return currentConnection;

				return {
					...currentConnection,
					pathway,
				};
			}),
		);
		return pathway;
	}

	function handleConnectionStubPointChange(connection: ConnectionType, stubPoint: Point) {
		setConnections((currentConnections) =>
			currentConnections.map((currentConnection) =>
				idValue(currentConnection.id) === idValue(connection.id)
					? {
							...currentConnection,
							metadata: {...currentConnection.metadata, stubPoint},
						}
					: currentConnection,
			),
		);
	}

	function addRoomAt(position: Point) {
		const room = RoomSchema.parse({
			...createDefaultFieldObject(RoomSchema),
			id: generateUniqueId("room", world.rooms),
			name: `Room ${world.rooms.length + 1}`,
			metadata: {position},
		});
		setRooms((currentRooms) => [...currentRooms, room]);
		selectRoom(room);

		const nextLayer = {
			...currentLayer,
			rooms: [room.id, ...currentLayer.rooms],
		};
		setCurrentLayer(nextLayer);
		setLayers((layers) => upsertLayer(layers, nextLayer));

		return room;
	}

	function getRoomConnectionPoint(room: Room, direction: Direction): Point {
		return addPoints(
			room.metadata.position,
			getRoomNodePosition(direction, MAP_ROOM_WIDTH, MAP_ROOM_HEIGHT),
		);
	}

	function addConnection(fromRoom: Room, direction: Direction) {
		const roomId = idValue(fromRoom.id);
		if (connectionDraft.state === "idle") {
			setConnectionDraft({
				state: "choosing-destination",
				fromRoomId: roomId,
				fromDirection: direction,
			});
			return;
		}
		if (connectionDraft.state === "choosing-destination") {
			if (connectionDraft.fromRoomId === roomId && connectionDraft.fromDirection === direction) {
				cancelConnectionDraft();
				return;
			}
			if (connectionDraft.fromRoomId === roomId) return;
			createDraftConnection(connectionDraft, fromRoom, direction);
			return;
		}
		if (connectionDraft.toRoomId === roomId) {
			createDraftConnection(connectionDraft, fromRoom, direction);
			return;
		}
		if (connectionDraft.fromRoomId === roomId && connectionDraft.fromDirection === direction) {
			cancelConnectionDraft();
			return;
		}
		setConnectionDraft({
			state: "choosing-destination",
			fromRoomId: roomId,
			fromDirection: direction,
		});
	}

	function createDraftConnection(
		draft: Exclude<ConnectionDraft, {state: "idle"}>,
		toRoom: Room,
		returnDirection: Direction,
		pathway?: ConnectionType["pathway"],
	) {
		const connection = ConnectionSchema.parse({
			...createDefaultFieldObject(ConnectionSchema),
			id: generateUniqueId("connection", world.connections),
			fromRoomId: draft.fromRoomId,
			toRoomId: toRoom.id,
			direction: draft.fromDirection,
			returnDirection,
			pathway:
				pathway ??
				getPathwayForNewDrop(
					draft.fromRoomId,
					draft.fromDirection,
					idValue(toRoom.id),
					returnDirection,
					world.connections,
				),
		});
		setConnections((current) => [...current, connection]);
		selectConnection(connection);
		setConnectionDraft({state: "idle"});
	}

	function connectDraftToRoom(toRoom: Room) {
		if (connectionDraft.state !== "choosing-destination") return false;
		if (connectionDraft.fromRoomId === idValue(toRoom.id)) return false;

		const fromRoom = world.rooms.find((room) => idValue(room.id) === connectionDraft.fromRoomId);
		if (!fromRoom) return false;

		const sourcePoint = getRoomConnectionPoint(fromRoom, connectionDraft.fromDirection);
		const returnDirection = ROOM_DIRECTIONS.reduce((closestDirection, direction) => {
			const closestPoint = getRoomConnectionPoint(toRoom, closestDirection);
			const candidatePoint = getRoomConnectionPoint(toRoom, direction);
			return getDistance(sourcePoint, candidatePoint) < getDistance(sourcePoint, closestPoint)
				? direction
				: closestDirection;
		});
		const pathway = isConnectionFromRoom(
			connectionDraft.fromRoomId,
			connectionDraft.fromDirection,
			world.connections,
		)
			? "no-way"
			: "forwards";

		createDraftConnection(connectionDraft, toRoom, returnDirection, pathway);
		return true;
	}

	function handleRoomPointerDown(event: React.PointerEvent<HTMLButtonElement>, room: Room) {
		if (event.button !== 0 || tool !== "edit") return;

		const pointer = clientToMapPoint(event.clientX, event.clientY);
		if (!pointer) return;

		event.currentTarget.setPointerCapture(event.pointerId);

		setDragState({
			roomId: idValue(room.id),
			offset: subtractPoints(pointer, room.metadata.position),
			startPointer: pointer,
			startRoomPosition: room.metadata.position,
			stubPoints: Object.fromEntries(
				world.connections.flatMap((connection) => {
					const isIncident =
						idValue(connection.fromRoomId) === idValue(room.id) ||
						idValue(connection.toRoomId) === idValue(room.id);
					return isIncident && connection.metadata.stubPoint
						? [[idValue(connection.id), connection.metadata.stubPoint]]
						: [];
				}),
			),
			hasDragged: false,
		});
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (panState?.pointerId === event.pointerId) {
			updateViewport({
				...viewportRef.current,
				x: panState.startViewport.x + event.clientX - panState.startPointer.x,
				y: panState.startViewport.y + event.clientY - panState.startPointer.y,
			});
			return;
		}

		if (!dragState) return;

		const pointer = clientToMapPoint(event.clientX, event.clientY);
		if (!pointer) return;

		const hasDragged =
			dragState.hasDragged || getDistance(pointer, dragState.startPointer) >= ROOM_DRAG_THRESHOLD;

		if (!hasDragged) return;

		setDragState({
			...dragState,
			hasDragged,
		});

		const nextPosition = subtractPoints(pointer, dragState.offset);
		const delta = subtractPoints(nextPosition, dragState.startRoomPosition);
		setConnections((connections) =>
			connections.map((connection) => {
				const startStubPoint = dragState.stubPoints[idValue(connection.id)];
				if (!startStubPoint) return connection;
				return {
					...connection,
					metadata: {
						...connection.metadata,
						stubPoint: addPoints(startStubPoint, delta),
					},
				};
			}),
		);

		setRooms((rooms) =>
			rooms.map((room) => {
				if (idValue(room.id) !== dragState.roomId) return room;

				return {
					...room,
					metadata: {
						...room.metadata,
						position: nextPosition,
					},
				};
			}),
		);
	}

	function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
		if (panState?.pointerId === event.pointerId) {
			setPanState(null);
			return;
		}
		if (!dragState) return;

		const selectedRoom = world.rooms.find((room) => idValue(room.id) === dragState.roomId);

		if (selectedRoom && !dragState.hasDragged) {
			if (connectionDraft.state === "choosing-return") {
				cancelConnectionDraft();
				selectRoom(selectedRoom);
			} else if (!connectDraftToRoom(selectedRoom)) selectRoom(selectedRoom);
		}

		setDragState(null);
	}

	function handlePointerCancel() {
		setDragState(null);
		setPanState(null);
	}

	function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (event.button !== 0 || tool !== "pan") return;
		event.currentTarget.setPointerCapture(event.pointerId);
		setPanState({
			pointerId: event.pointerId,
			startPointer: {x: event.clientX, y: event.clientY},
			startViewport: {x: viewport.x, y: viewport.y},
		});
	}

	function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
		event.preventDefault();
		const bounds = event.currentTarget.getBoundingClientRect();
		const pointer = {x: event.clientX - bounds.left, y: event.clientY - bounds.top};
		const current = viewportRef.current;
		const nextZoom = Math.min(
			MAX_ZOOM,
			Math.max(MIN_ZOOM, current.zoom * Math.exp(-event.deltaY * 0.0006)),
		);
		if (nextZoom === current.zoom) return;

		const mapPoint = {
			x: (pointer.x - current.x) / current.zoom,
			y: (pointer.y - current.y) / current.zoom,
		};
		const next = {
			x: pointer.x - mapPoint.x * nextZoom,
			y: pointer.y - mapPoint.y * nextZoom,
			zoom: nextZoom,
		};
		viewportRef.current = next;
		updateViewport(next);
	}

	function handleBlankMapClick(event: React.MouseEvent<HTMLDivElement>) {
		if (tool !== "edit") return;
		if (
			event.target instanceof Element &&
			event.target.closest(".roomCard, .node, .connectionClickTarget")
		)
			return;
		const position = clientToMapPoint(event.clientX, event.clientY);
		if (!position) return;
		if (connectionDraft.state === "choosing-return") {
			cancelConnectionDraft();
			addRoomAt(position);
			return;
		}
		if (connectionDraft.state === "idle") {
			addRoomAt(position);
			return;
		}
		const room = addRoomAt(position);
		setConnectionDraft({...connectionDraft, state: "choosing-return", toRoomId: idValue(room.id)});
	}

	return (
		<div
			ref={mapRef}
			data-map
			className={`map map--theme-${theme} map--tool-${tool} ${panState ? "map--panning" : ""}`}
			style={{
				backgroundPosition: `${viewport.x}px ${viewport.y}px`,
				backgroundSize: `auto, auto, ${48 * viewport.zoom}px ${48 * viewport.zoom}px, ${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
			}}
			onPointerDown={handleMapPointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onWheel={handleWheel}
			onClick={handleBlankMapClick}
			onContextMenu={(event) => event.preventDefault()}
		>
			{isLayerMenuOpen ? (
				<LayerMenu
					world={world}
					setIsLayerMenuOpen={setIsLayerMenuOpen}
					selectedId={selectedId}
					isConnectionSelected={isConnectionSelected}
					setCurrentLayer={changeCurrentLayer}
				/>
			) : (
				<>
					<div
						className="mapViewport"
						style={{transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`}}
					>
						<MapLayerContent
							world={world}
							layer={currentLayer}
							selectedId={selectedId}
							isConnectionSelected={isConnectionSelected}
							onRoomPointerDown={handleRoomPointerDown}
							onNodeClick={addConnection}
							selectConnection={handleConnectionSelect}
							changePathway={handleConnectionPathwayChange}
							onStubPointChange={handleConnectionStubPointChange}
							updateStatus={updateStatus}
							isRoomDragging={(room) => dragState?.roomId === idValue(room.id) && dragState.hasDragged}
							getArmedDirection={(room) =>
								connectionDraft.state !== "idle" && connectionDraft.fromRoomId === idValue(room.id)
									? connectionDraft.fromDirection
									: null
							}
							shouldPulseNodes={(room) =>
								connectionDraft.state === "choosing-return" && connectionDraft.toRoomId === idValue(room.id)
							}
						/>
					</div>
					<LayoutControl
						world={world}
						setCurrentLayer={changeCurrentLayer}
						currentLayer={currentLayer}
						isLayerMenuOpen={isLayerMenuOpen}
						setIsLayerMenuOpen={setIsLayerMenuOpen}
					/>
				</>
			)}
		</div>
	);
}
