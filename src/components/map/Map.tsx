"use client";

import type React from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {
	RoomSchema,
	ConnectionSchema,
	type Point,
	type Room,
	type Connection as ConnectionType,
	type Direction,
} from "../../schemas/world/roomSchema";
import {
	DefaultViewport,
	type Layer,
	type World,
	type Viewport,
} from "../../schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {
	addConnectionDraft,
	addRoomDraft,
	findRoomDraft,
	setLayerViewportDraft,
	updateConnectionDraft,
	updateRoomDraft,
	upsertLayerDraft,
} from "@/app/editor/utils/worldDraftUtils";
import {getRoomNodePosition, ROOM_DIRECTIONS} from "./utils/mapUtils";
import {getLayer, isRoomInLayer} from "./utils/layerUtils";
import {addPoints, subtractPoints, getDistance} from "./utils/pointUtils";
import {getLayerNavigationDirection} from "./utils/layerNavigation";
import {
	getNextAvailablePathway,
	getPathwayForNewDrop,
	isConnectionFromRoom,
} from "./utils/connectionUtils";
import {deleteWorldEntity, generateUniqueId, idValue} from "../../utils/idUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import type {UpdateStatus} from "../studio/ToolBar";
import "./Map.scss";
import {LayoutControl} from "./LayoutControl";
import {LayerMenu} from "./LayerMenu";
import {MAP_ROOM_HEIGHT, MAP_ROOM_WIDTH, MapLayerContent} from "./MapLayerContent";
import {initializeConnectionStubPoints, type ConnectionStubPointField} from "./Connection";
import {Trash} from "lucide-react";

type DragState = {
	roomId: string;
	offset: Point;
	startPointer: Point;
	hasDragged: boolean;
};

type MapProps = {
	world: World;
	isLoading?: boolean;
	tool: MapTool;
	onToolChange: (tool: MapTool) => void;
	onTemporaryToolChange?: (tool: MapTool | null) => void;
	onZoomChange?: (zoom: number) => void;
	theme?: MapTheme;
	updateWorld: UpdateWorld;
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
	isLoading = false,
	tool,
	onToolChange,
	onTemporaryToolChange,
	onZoomChange,
	theme = "dark",
	updateWorld,
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
	const [isSpaceToolActive, setIsSpaceToolActive] = useState(false);
	const isSpaceToolActiveRef = useRef(false);
	const isMapPointerDownRef = useRef(false);
	const suppressNextMapClickRef = useRef(false);
	const effectiveTool: MapTool = isSpaceToolActive ? (tool === "edit" ? "pan" : "edit") : tool;
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
			updateWorld((world) => {
				if (!setLayerViewportDraft(world, currentLayer.layer, nextViewport)) {
					upsertLayerDraft(world, {...currentLayer, viewport: nextViewport});
				}
			});
		},
		[currentLayer, updateWorld],
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
	useEffect(
		() => () => {
			onTemporaryToolChange?.(null);
		},
		[onTemporaryToolChange],
	);

	useEffect(() => {
		if (isLoading) return;

		const initializedById = new globalThis.Map<string, ConnectionType>();
		for (const connection of world.connections) {
			const initialized = initializeConnectionStubPoints(world, connection);
			if (initialized !== connection) initializedById.set(idValue(connection.id), initialized);
		}

		if (initializedById.size === 0) return;
		updateWorld((world) => {
			for (const [connectionId, initialized] of initializedById) {
				updateConnectionDraft(world, connectionId, (connection) => {
					connection.metadata.fromLayerStubPoint ??= initialized.metadata.fromLayerStubPoint;
					connection.metadata.toLayerStubPoint ??= initialized.metadata.toLayerStubPoint;
				});
			}
		});
	}, [isLoading, updateWorld, world]);

	useEffect(() => {
		if (isLoading) return;

		function isTextEntryTarget(target: EventTarget | null) {
			return (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			);
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && connectionDraft.state !== "idle") {
				cancelConnectionDraft();
				return;
			}
			if (isTextEntryTarget(event.target)) return;
			if (event.code === "Space") {
				event.preventDefault();
				if (event.repeat) return;
				const temporaryTool = tool === "edit" ? "pan" : "edit";
				isSpaceToolActiveRef.current = true;
				setIsSpaceToolActive(true);
				onTemporaryToolChange?.(temporaryTool);
				setDragState(null);
				setPanState(null);
				const activeElement = document.activeElement as (Element & {blur?: () => void}) | null;
				activeElement?.blur?.();
				return;
			}
			if (isLayerMenuOpen) return;

			const layerDirection = getLayerNavigationDirection(event.key);
			if (layerDirection) {
				event.preventDefault();
				mapRef.current
					?.querySelector<HTMLButtonElement>(
						layerDirection === 1 ? ".layoutControl--up" : ".layoutControl--down",
					)
					?.click();
				return;
			}
			if (event.key.toLowerCase() === "v" || event.key === "ArrowLeft") {
				event.preventDefault();
				onToolChange("edit");
			}
			if (event.key.toLowerCase() === "h" || event.key === "ArrowRight") {
				event.preventDefault();
				onToolChange("pan");
			}
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.code !== "Space") return;
			event.preventDefault();
			if (isMapPointerDownRef.current) suppressNextMapClickRef.current = true;
			isSpaceToolActiveRef.current = false;
			setIsSpaceToolActive(false);
			onTemporaryToolChange?.(null);
			setDragState(null);
			setPanState(null);
		}

		function handleWindowBlur() {
			if (isMapPointerDownRef.current) suppressNextMapClickRef.current = true;
			isSpaceToolActiveRef.current = false;
			setIsSpaceToolActive(false);
			onTemporaryToolChange?.(null);
			setDragState(null);
			setPanState(null);
		}

		function handleFocusIn(event: FocusEvent) {
			if (!isSpaceToolActiveRef.current) return;
			const focusTarget = event.target as (Element & {blur?: () => void}) | null;
			focusTarget?.blur?.();
		}

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleWindowBlur);
		document.addEventListener("focusin", handleFocusIn, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleWindowBlur);
			document.removeEventListener("focusin", handleFocusIn, true);
		};
	}, [
		cancelConnectionDraft,
		changeCurrentLayer,
		connectionDraft,
		currentLayer.layer,
		isLoading,
		isLayerMenuOpen,
		onToolChange,
		onTemporaryToolChange,
		tool,
		world,
	]);

	useEffect(() => {
		if (effectiveTool !== "edit" && connectionDraft.state !== "idle") cancelConnectionDraft();
	}, [effectiveTool, cancelConnectionDraft, connectionDraft]);

	useEffect(() => {
		const mapElement = mapRef.current;
		if (!mapElement) return;

		function preventHorizontalNavigation(event: WheelEvent) {
			if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) event.preventDefault();
		}

		mapElement.addEventListener("wheel", preventHorizontalNavigation, {passive: false});
		return () => mapElement.removeEventListener("wheel", preventHorizontalNavigation);
	}, [isLoading]);

	if (isLoading) {
		return (
			<div data-map className={`map map--theme-${theme} map--loading`} aria-busy="true">
				<div className="mapLoadingState" role="status">
					<span className="mapLoadingMark" aria-hidden="true" />
					<span>Loading world…</span>
				</div>
			</div>
		);
	}

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
		updateWorld((world) => {
			updateConnectionDraft(world, connection.id, (draft) => {
				draft.pathway = pathway;
			});
		});
		return pathway;
	}

	function handleConnectionStubPointChange(
		connection: ConnectionType,
		stubPoint: Point,
		field: ConnectionStubPointField,
	) {
		updateWorld((world) => {
			updateConnectionDraft(world, connection.id, (draft) => {
				draft.metadata[field] = stubPoint;
			});
		});
	}

	function addRoomAt(position: Point) {
		const room = RoomSchema.parse({
			...createDefaultFieldObject(RoomSchema),
			id: generateUniqueId("room", world.rooms),
			name: `Room ${world.rooms.length + 1}`,
			metadata: {position},
		});
		const nextLayer = {
			...currentLayer,
			rooms: [room.id, ...currentLayer.rooms],
		};
		setCurrentLayer(nextLayer);
		updateWorld((world) => {
			const isFirstRoom = world.rooms.length === 0;
			if (addRoomDraft(world, room) && isFirstRoom) world.startRoomId = room.id;
			upsertLayerDraft(world, nextLayer);
		});
		selectRoom(room);

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
		const parsedConnection = ConnectionSchema.parse({
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
		const connection = initializeConnectionStubPoints(
			{...world, connections: [...world.connections, parsedConnection]},
			parsedConnection,
		);
		updateWorld((world) => {
			addConnectionDraft(world, connection);
		});
		selectConnection(connection);
		setConnectionDraft({state: "idle"});
	}

	function connectDraftToRoom(toRoom: Room) {
		if (connectionDraft.state !== "choosing-destination") return false;
		if (connectionDraft.fromRoomId === idValue(toRoom.id)) return false;

		const fromRoom = findRoomDraft(world, connectionDraft.fromRoomId);
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
		if (event.button !== 0 || effectiveTool !== "edit") return;

		const pointer = clientToMapPoint(event.clientX, event.clientY);
		if (!pointer) return;

		event.currentTarget.setPointerCapture(event.pointerId);

		setDragState({
			roomId: idValue(room.id),
			offset: subtractPoints(pointer, room.metadata.position),
			startPointer: pointer,
			hasDragged: false,
		});
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (panState && panState.pointerId === event.pointerId) {
			updateViewport({
				...viewportRef.current,
				x: panState.startViewport.x + event.clientX - panState.startPointer.x,
				y: panState.startViewport.y + event.clientY - panState.startPointer.y,
			});
			return;
		}

		if (!dragState || effectiveTool !== "edit") return;

		const pointer = clientToMapPoint(event.clientX, event.clientY);
		if (!pointer) return;

		const hasDragged =
			dragState.hasDragged || getDistance(pointer, dragState.startPointer) >= ROOM_DRAG_THRESHOLD;

		if (!hasDragged) return;

		if (!dragState.hasDragged) {
			setDragState((current) => (current ? {...current, hasDragged: true} : current));
		}

		const nextPosition = subtractPoints(pointer, dragState.offset);
		updateWorld((world) => {
			updateRoomDraft(world, dragState.roomId, (room) => {
				room.metadata.position = nextPosition;
			});
		});
	}

	function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
		if (panState && panState.pointerId === event.pointerId) {
			setPanState(null);
			return;
		}
		if (!dragState) return;

		const selectedRoom = findRoomDraft(world, dragState.roomId);

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
		if (event.button !== 0 || effectiveTool !== "pan") return;
		event.currentTarget.setPointerCapture(event.pointerId);
		setPanState({
			pointerId: event.pointerId,
			startPointer: {x: event.clientX, y: event.clientY},
			startViewport: {x: viewport.x, y: viewport.y},
		});
	}

	function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
		event.preventDefault();
		if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
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
		if (effectiveTool !== "edit") return;
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

	function handleLayerClear(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation();
		let updatedWorld = world;
		for (const room of world.rooms) {
			if (isRoomInLayer(currentLayer, room.id)) {
				updatedWorld = deleteWorldEntity(updatedWorld, room.id);
			}
		}
		updateWorld(updatedWorld);
	}

	const layerMenuHost = mapRef.current?.closest<HTMLElement>(".editorMapArea") ?? null;
	const layerMenu = (
		<LayerMenu
			world={world}
			currentLayer={currentLayer}
			setIsLayerMenuOpen={setIsLayerMenuOpen}
			selectedId={selectedId}
			isConnectionSelected={isConnectionSelected}
			setCurrentLayer={changeCurrentLayer}
		/>
	);

	return (
		<div
			ref={mapRef}
			data-map
			className={`map map--theme-${theme} map--tool-${effectiveTool} ${panState ? "map--panning" : ""}`}
			style={{
				backgroundPosition: `${viewport.x}px ${viewport.y}px`,
				backgroundSize: `auto, auto, ${48 * viewport.zoom}px ${48 * viewport.zoom}px, ${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
			}}
			onPointerDown={handleMapPointerDown}
			onPointerDownCapture={(event) => {
				isMapPointerDownRef.current = true;
				if (isSpaceToolActiveRef.current) event.preventDefault();
			}}
			onPointerUpCapture={() => {
				isMapPointerDownRef.current = false;
			}}
			onPointerCancelCapture={() => {
				isMapPointerDownRef.current = false;
				suppressNextMapClickRef.current = false;
			}}
			onClickCapture={(event) => {
				if (!suppressNextMapClickRef.current) return;
				suppressNextMapClickRef.current = false;
				event.preventDefault();
				event.stopPropagation();
			}}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onWheel={handleWheel}
			onClick={handleBlankMapClick}
			onContextMenu={(event) => event.preventDefault()}
		>
			{isLayerMenuOpen ? (
				layerMenuHost ? (
					createPortal(layerMenu, layerMenuHost)
				) : (
					layerMenu
				)
			) : (
				<>
					<div
						className="mapViewport"
						style={{transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`}}
					>
						<MapLayerContent
							world={world}
							layer={currentLayer}
							isInteractive={effectiveTool === "edit"}
							selectedId={selectedId}
							isConnectionSelected={isConnectionSelected}
							onRoomPointerDown={handleRoomPointerDown}
							onNodeClick={addConnection}
							selectConnection={handleConnectionSelect}
							changePathway={handleConnectionPathwayChange}
							onStubPointChange={handleConnectionStubPointChange}
							canMoveStubs={effectiveTool === "edit"}
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
					<button
						type="button"
						className="layerClearButton"
						onClick={handleLayerClear}
						aria-label={`Clear ${currentLayer.name} layer`}
					>
						<Trash className="layerClearButton--icon" />
					</button>
				</>
			)}
		</div>
	);
}
