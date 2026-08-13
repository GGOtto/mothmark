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
import {DIRECTIONS} from "@/schemas/world/directionSchema";
import {getRoomNodePosition} from "./utils/mapUtils";
import {getLayer, isRoomInLayer} from "./utils/layerUtils";
import {addPoints, subtractPoints, getDistance} from "./utils/pointUtils";
import {getLayerNavigationDirection} from "./utils/layerNavigation";
import {
	getNextAvailablePathway,
	getPathwayForNewDrop,
	isConnectionFromRoom,
} from "./utils/connectionUtils";
import {deleteWorldEntity, generateUniqueId, idValue, toID} from "../../utils/idUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import type {UpdateStatus} from "../studio/ToolBar";
import "./Map.scss";
import {LayoutControl} from "./LayoutControl";
import {LayerMenu} from "./LayerMenu";
import {MAP_ROOM_HEIGHT, MAP_ROOM_WIDTH, MapLayerContent} from "./MapLayerContent";
import {initializeConnectionStubPoints, type ConnectionStubPointField} from "./Connection";
import {Trash} from "lucide-react";
import {usePopup} from "../popup/Popup";

type DragState = {
	roomId: string;
	offset: Point;
	startPointer: Point;
	hasDragged: boolean;
};

type MapProps = {
	world: World;
	isLoading?: boolean;
	readOnly?: boolean;
	ariaLabel?: string;
	isAddingRoom?: boolean;
	onAddingRoomChange?: (isAddingRoom: boolean) => void;
	onZoomChange?: (zoom: number) => void;
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
	hasDragged: boolean;
};

type PinchState = {
	pointerIds: [number, number];
	startDistance: number;
	startMapPoint: Point;
	startViewport: Viewport;
};

const ROOM_DRAG_THRESHOLD = 2;
const MAP_PAN_THRESHOLD = 2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

export function Map({
	world,
	isLoading = false,
	readOnly = false,
	ariaLabel = "World map",
	isAddingRoom = false,
	onAddingRoomChange,
	onZoomChange,
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
	const popup = usePopup();
	const [dragState, setDragState] = useState<DragState | null>(null);
	const initialLayer = useRef(getLayer(world, 0));
	const [viewport, setViewport] = useState<Viewport>(initialLayer.current.viewport);
	const [panState, setPanState] = useState<PanState | null>(null);
	const pinchStateRef = useRef<PinchState | null>(null);
	const activePointersRef = useRef(new globalThis.Map<number, Point>());
	const [isSpacePanActive, setIsSpacePanActive] = useState(false);
	const isSpacePanActiveRef = useRef(false);
	const isMapPointerDownRef = useRef(false);
	const suppressNextMapClickRef = useRef(false);
	const [roomPlacementPreview, setRoomPlacementPreview] = useState<Point | null>(null);
	const viewportRef = useRef(viewport);
	const lastRecenterRequest = useRef(recenterRequest);
	const mapRef = useRef<HTMLDivElement | null>(null);
	const cancelConnectionDraft = useCallback(() => {
		setConnectionDraft({state: "idle"});
		updateStatus({kind: "cancelled", label: "Cancelled"}, {channel: "notice"});
	}, [setConnectionDraft, updateStatus]);
	const [currentLayer, setCurrentLayer] = useState<Layer>(initialLayer.current);
	const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);
	const renameLayer = useCallback(
		(renamedLayer: Layer) => {
			setCurrentLayer((layer) => (layer.layer === renamedLayer.layer ? renamedLayer : layer));
			updateWorld((world) => {
				upsertLayerDraft(world, renamedLayer);
			});
		},
		[updateWorld],
	);

	const updateViewport = useCallback(
		(nextViewport: Viewport) => {
			viewportRef.current = nextViewport;
			setViewport(nextViewport);
			setCurrentLayer((layer) => ({...layer, viewport: nextViewport}));
			if (!readOnly) {
				updateWorld((world) => {
					if (!setLayerViewportDraft(world, currentLayer.layer, nextViewport)) {
						upsertLayerDraft(world, {...currentLayer, viewport: nextViewport});
					}
				});
			}
		},
		[currentLayer, readOnly, updateWorld],
	);

	const changeCurrentLayer = useCallback(
		(layer: Layer) => {
			onAddingRoomChange?.(false);
			setRoomPlacementPreview(null);
			setCurrentLayer(layer);
			viewportRef.current = layer.viewport;
			setViewport(layer.viewport);
		},
		[onAddingRoomChange],
	);

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
		if (isLoading || readOnly) return;

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
	}, [isLoading, readOnly, updateWorld, world]);

	useEffect(() => {
		if (isLoading || readOnly) return;

		function isTextEntryTarget(target: EventTarget | null) {
			return (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			);
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && isAddingRoom) {
				onAddingRoomChange?.(false);
				setRoomPlacementPreview(null);
				updateStatus({kind: "cancelled", label: "Room placement cancelled"}, {channel: "notice"});
				return;
			}
			if (event.key === "Escape" && connectionDraft.state !== "idle") {
				cancelConnectionDraft();
				return;
			}
			if (isTextEntryTarget(event.target)) return;
			if (event.code === "Space") {
				event.preventDefault();
				if (event.repeat) return;
				isSpacePanActiveRef.current = true;
				setIsSpacePanActive(true);
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
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.code !== "Space") return;
			event.preventDefault();
			if (isMapPointerDownRef.current) suppressNextMapClickRef.current = true;
			isSpacePanActiveRef.current = false;
			setIsSpacePanActive(false);
			setDragState(null);
			setPanState(null);
		}

		function handleWindowBlur() {
			if (isMapPointerDownRef.current) suppressNextMapClickRef.current = true;
			isSpacePanActiveRef.current = false;
			setIsSpacePanActive(false);
			setDragState(null);
			setPanState(null);
		}

		function handleFocusIn(event: FocusEvent) {
			if (!isSpacePanActiveRef.current) return;
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
		isAddingRoom,
		isLoading,
		isLayerMenuOpen,
		onAddingRoomChange,
		readOnly,
		updateStatus,
		world,
	]);

	useEffect(() => {
		const mapElement = mapRef.current;
		if (!mapElement) return;

		function preventPageNavigation(event: WheelEvent) {
			event.preventDefault();
		}

		mapElement.addEventListener("wheel", preventPageNavigation, {passive: false});
		return () => mapElement.removeEventListener("wheel", preventPageNavigation);
	}, [isLoading]);

	if (isLoading) {
		return (
			<div data-map className="map map--loading" aria-busy="true">
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
		const point = {
			x: (clientX - bounds.left - currentViewport.x) / currentViewport.zoom,
			y: (clientY - bounds.top - currentViewport.y) / currentViewport.zoom,
		};
		return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
	}

	function isMapEntityTarget(target: EventTarget | null) {
		return (
			target instanceof Element &&
			Boolean(
				target.closest(
					"button, [role='button'], .roomCard, .node, .connectionClickTarget, .connectionLayerTag",
				),
			)
		);
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
			fromRoomId: toID("room", draft.fromRoomId),
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
		const returnDirection = DIRECTIONS.reduce((closestDirection, direction) => {
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
		if (event.button !== 0 || readOnly || isAddingRoom || isSpacePanActiveRef.current) return;

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
		if (activePointersRef.current.has(event.pointerId)) {
			activePointersRef.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
		}

		const pinchState = pinchStateRef.current;
		if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
			suppressNextMapClickRef.current = true;
			setRoomPlacementPreview(null);
			const [first, second] = pinchState.pointerIds.map((pointerId) =>
				activePointersRef.current.get(pointerId),
			);
			const mapElement = mapRef.current;
			if (!first || !second || !mapElement) return;

			const bounds = mapElement.getBoundingClientRect();
			const center = {
				x: (first.x + second.x) / 2 - bounds.left,
				y: (first.y + second.y) / 2 - bounds.top,
			};
			const zoom = Math.min(
				MAX_ZOOM,
				Math.max(
					MIN_ZOOM,
					pinchState.startViewport.zoom * (getDistance(first, second) / pinchState.startDistance),
				),
			);
			updateViewport({
				x: center.x - pinchState.startMapPoint.x * zoom,
				y: center.y - pinchState.startMapPoint.y * zoom,
				zoom,
			});
			return;
		}

		if (panState && panState.pointerId === event.pointerId) {
			const hasDragged =
				panState.hasDragged ||
				getDistance(panState.startPointer, {x: event.clientX, y: event.clientY}) >= MAP_PAN_THRESHOLD;
			if (!hasDragged) return;
			if (!panState.hasDragged) {
				setPanState((current) => (current ? {...current, hasDragged: true} : current));
			}
			suppressNextMapClickRef.current = true;
			setRoomPlacementPreview(null);
			updateViewport({
				...viewportRef.current,
				x: panState.startViewport.x + event.clientX - panState.startPointer.x,
				y: panState.startViewport.y + event.clientY - panState.startPointer.y,
			});
			return;
		}

		if (!dragState) {
			if (isAddingRoom) {
				setRoomPlacementPreview(
					isMapEntityTarget(event.target) ? null : clientToMapPoint(event.clientX, event.clientY),
				);
			}
			return;
		}

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
		activePointersRef.current.delete(event.pointerId);
		if (pinchStateRef.current?.pointerIds.includes(event.pointerId)) {
			pinchStateRef.current = null;
			const remainingPointer = activePointersRef.current.entries().next().value as
				[number, Point] | undefined;
			setPanState(
				remainingPointer
					? {
							pointerId: remainingPointer[0],
							startPointer: remainingPointer[1],
							startViewport: {x: viewportRef.current.x, y: viewportRef.current.y},
							hasDragged: true,
						}
					: null,
			);
			return;
		}
		if (panState && panState.pointerId === event.pointerId) {
			if (panState.hasDragged) suppressNextMapClickRef.current = true;
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
		activePointersRef.current.clear();
		pinchStateRef.current = null;
		setDragState(null);
		setPanState(null);
	}

	function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (event.button !== 0) return;
		const startedOnMapEntity = isMapEntityTarget(event.target);
		const tracksTouchForPinch = event.pointerType === "touch";
		if (!readOnly && !isSpacePanActiveRef.current && startedOnMapEntity && !tracksTouchForPinch)
			return;
		if (!startedOnMapEntity || readOnly || isSpacePanActiveRef.current) {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		activePointersRef.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
		if (isAddingRoom && !startedOnMapEntity) {
			setRoomPlacementPreview(clientToMapPoint(event.clientX, event.clientY));
		}

		const pointers = Array.from(activePointersRef.current.entries());
		if (pointers.length >= 2) {
			const [[firstId, first], [secondId, second]] = pointers;
			const bounds = event.currentTarget.getBoundingClientRect();
			const center = {
				x: (first.x + second.x) / 2 - bounds.left,
				y: (first.y + second.y) / 2 - bounds.top,
			};
			const current = viewportRef.current;
			pinchStateRef.current = {
				pointerIds: [firstId, secondId],
				startDistance: Math.max(1, getDistance(first, second)),
				startMapPoint: {
					x: (center.x - current.x) / current.zoom,
					y: (center.y - current.y) / current.zoom,
				},
				startViewport: current,
			};
			setDragState(null);
			setPanState(null);
			return;
		}
		if (startedOnMapEntity && tracksTouchForPinch) return;

		setPanState({
			pointerId: event.pointerId,
			startPointer: {x: event.clientX, y: event.clientY},
			startViewport: {x: viewport.x, y: viewport.y},
			hasDragged: false,
		});
	}

	function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
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
		if (readOnly || isMapEntityTarget(event.target)) return;
		const position = clientToMapPoint(event.clientX, event.clientY);
		if (!position) {
			updateStatus({kind: "cancelled", label: "Choose a valid map position"}, {channel: "notice"});
			return;
		}
		if (!isAddingRoom) {
			if (connectionDraft.state === "choosing-return") cancelConnectionDraft();
			if (connectionDraft.state === "idle") selectRoom();
			return;
		}
		if (connectionDraft.state === "choosing-return") {
			return;
		}
		const room = addRoomAt(position);
		onAddingRoomChange?.(false);
		setRoomPlacementPreview(null);
		if (connectionDraft.state === "idle") {
			return;
		}
		setConnectionDraft({...connectionDraft, state: "choosing-return", toRoomId: idValue(room.id)});
	}

	async function handleLayerClear(event: React.MouseEvent<HTMLButtonElement>) {
		event.stopPropagation();

		const userResponse = await popup.confirm({
			title: `Clear ${currentLayer.name}?`,
			message: "Delete every room on this layer? This action cannot be undone.",
			confirmLabel: "Clear layer",
			danger: true,
		});

		if (userResponse) {
			let updatedWorld = world;
			for (const room of world.rooms) {
				if (isRoomInLayer(currentLayer, room.id)) {
					updatedWorld = deleteWorldEntity(updatedWorld, room.id);
				}
			}
			updateWorld(updatedWorld);
		}
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
			renameLayer={renameLayer}
		/>
	);

	return (
		<div
			ref={mapRef}
			data-map
			aria-label={ariaLabel}
			className={`map ${readOnly ? "map--read-only" : ""} ${isAddingRoom ? "map--placing-room" : ""} ${isSpacePanActive ? "map--space-pan" : ""} ${panState?.hasDragged ? "map--panning" : ""}`}
			style={{
				backgroundPosition: `${viewport.x}px ${viewport.y}px`,
				backgroundSize: `auto, auto, ${48 * viewport.zoom}px ${48 * viewport.zoom}px, ${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
			}}
			onPointerDown={handleMapPointerDown}
			onPointerDownCapture={(event) => {
				isMapPointerDownRef.current = true;
				if (isSpacePanActiveRef.current) event.preventDefault();
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
			onPointerLeave={() => {
				if (!isMapPointerDownRef.current) setRoomPlacementPreview(null);
			}}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onWheel={handleWheel}
			onClick={handleBlankMapClick}
			onContextMenu={(event) => event.preventDefault()}
		>
			{!readOnly && isLayerMenuOpen ? (
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
							isInteractive={!readOnly && !isAddingRoom && !isSpacePanActive}
							selectedId={selectedId}
							isConnectionSelected={isConnectionSelected}
							onRoomPointerDown={handleRoomPointerDown}
							onNodeClick={addConnection}
							selectConnection={handleConnectionSelect}
							changePathway={handleConnectionPathwayChange}
							onStubPointChange={handleConnectionStubPointChange}
							canMoveStubs={!isAddingRoom && !isSpacePanActive}
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
						{isAddingRoom && roomPlacementPreview ? (
							<div
								className="mapRoomPlacementPreview"
								aria-hidden="true"
								style={{
									left: roomPlacementPreview.x,
									top: roomPlacementPreview.y,
									width: MAP_ROOM_WIDTH,
									height: MAP_ROOM_HEIGHT,
								}}
							>
								New room
							</div>
						) : null}
					</div>
					{readOnly ? null : (
						<>
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
				</>
			)}
		</div>
	);
}
