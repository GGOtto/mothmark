"use client";

import type React from "react";
import {useState} from "react";
import type {Point, Room, Connection as ConnectionType, Direction} from "../../schemas/worldSchema";
import {DIRECTION_VECTORS} from "../../types/mapTypes";
import {addPoints, subtractPoints, getDistance} from "../../utils/pointUtils";
import {RoomCard} from "./Room";
import {Connection} from "./Connection";
import {buildAddConnectionResult} from "../../utils/connectionUtils";
import {useConnectionDrag} from "./useConnectionDrag";
import "./Map.scss";

type DragState = {
	roomId: string;
	offset: Point;
	startPointer: Point;
	hasDragged: boolean;
};

type MapProps = {
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: ConnectionType[];
	setConnections: React.Dispatch<React.SetStateAction<ConnectionType[]>>;
	selectedId: string | null;
	setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
	isConnectionSelected: boolean;
	setIsConnectionSelected: React.Dispatch<React.SetStateAction<boolean>>;
};

const ROOM_WIDTH = 72;
const ROOM_HEIGHT = 40;
const ROOM_DRAG_THRESHOLD = 2;

export function Map({
	rooms,
	setRooms,
	connections,
	setConnections,
	selectedId,
	setSelectedId,
	isConnectionSelected,
	setIsConnectionSelected,
}: MapProps) {
	const [dragState, setDragState] = useState<DragState | null>(null);

	function selectRoom(room?: Room) {
		setSelectedId(room ? room.id : null);
		setIsConnectionSelected(false);
	}

	function selectConnection(connection?: ConnectionType) {
		setSelectedId(connection ? connection.id : null);
		setIsConnectionSelected(true);
	}

	function getRoomConnectionPoint(room: Room, direction: Direction): Point {
		const vector = DIRECTION_VECTORS[direction];

		return addPoints(room.position, {
			x: (vector.x * ROOM_WIDTH) / 2.1,
			y: (vector.y * ROOM_HEIGHT) / 2.1,
		});
	}

	function getRoom(roomId: string, direction?: Direction) {
		const room = rooms.find((room) => room.id === roomId);

		if (room && direction) {
			return {
				...room,
				position: getRoomConnectionPoint(room, direction),
			};
		}

		return room;
	}

	const {
		mapRef,
		connectionDragState,
		editedConnectionId,
		addOrUpdateConnectionByShape,
		handleConnectionDragStart,
		handleConnectionDragMove,
		handleConnectionDragEnd,
		handleConnectionDragCancel,
	} = useConnectionDrag({
		rooms,
		connections,
		setConnections,
		getRoomConnectionPoint,
	});

	function addConnection(fromRoom: Room, direction: Direction) {
		const result = buildAddConnectionResult({
			fromRoom,
			direction,
			rooms,
			connections,
			roomWidth: ROOM_WIDTH,
			roomHeight: ROOM_HEIGHT,
			connectorLength: 40,
			minConnectorLength: 12,
			connectorStep: 4,
		});

		if (!result) {
			return;
		}

		if (result.roomToAdd) {
			const roomToAdd = result.roomToAdd;
			setSelectedId(roomToAdd.id);
			setRooms((rooms) => [...rooms, roomToAdd]);
		}

		addOrUpdateConnectionByShape(result.connection);
	}

	function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
		if (event.target !== event.currentTarget) return;
		selectRoom();
	}

	function handleRoomPointerDown(event: React.PointerEvent<HTMLButtonElement>, room: Room) {
		if (event.button !== 0) return;

		const mapElement = event.currentTarget.closest("[data-map]");

		if (!mapElement) return;

		const bounds = mapElement.getBoundingClientRect();

		const pointer = {
			x: event.clientX - bounds.left,
			y: event.clientY - bounds.top,
		};

		event.currentTarget.setPointerCapture(event.pointerId);

		setDragState({
			roomId: room.id,
			offset: subtractPoints(pointer, room.position),
			startPointer: pointer,
			hasDragged: false,
		});
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (!dragState) return;

		const bounds = event.currentTarget.getBoundingClientRect();

		const pointer = {
			x: event.clientX - bounds.left,
			y: event.clientY - bounds.top,
		};

		const hasDragged =
			dragState.hasDragged || getDistance(pointer, dragState.startPointer) >= ROOM_DRAG_THRESHOLD;

		if (!hasDragged) return;

		setDragState({
			...dragState,
			hasDragged,
		});

		setRooms((rooms) =>
			rooms.map((room) => {
				if (room.id !== dragState.roomId) return room;

				return {
					...room,
					position: subtractPoints(pointer, dragState.offset),
				};
			}),
		);
	}

	function handlePointerUp() {
		if (!dragState) return;

		const selectedRoom = rooms.find((room) => room.id === dragState.roomId);

		if (selectedRoom && !dragState.hasDragged) {
			selectRoom(selectedRoom);
		}

		setDragState(null);
	}

	function handlePointerCancel() {
		setDragState(null);
	}

	return (
		<div
			ref={mapRef}
			data-map
			className="map"
			onClick={handleMapClick}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onContextMenu={(event) => event.preventDefault()}
		>
			<svg className="mapSvg" width="100%" height="100%">
				{connections.map((connection) => {
					const fromRoom = getRoom(connection.fromRoomId, connection.direction);
					const toRoom = getRoom(connection.toRoomId, connection.returnDirection);

					if (!fromRoom || !toRoom) return null;

					return (
						<Connection
							key={connection.id}
							connection={connection}
							fromRoom={fromRoom}
							toRoom={toRoom}
							selectConnection={selectConnection}
							isEditing={editedConnectionId === connection.id}
							isSelected={isConnectionSelected && connection.id === selectedId}
						/>
					);
				})}

				{connectionDragState?.hasDragged ? (
					<path
						className="mapConnectionDragPath"
						d={`M ${connectionDragState.startPoint.x} ${connectionDragState.startPoint.y} L ${connectionDragState.currentPoint.x} ${connectionDragState.currentPoint.y}`}
						fill="none"
						strokeLinecap="round"
					/>
				) : null}

				{connectionDragState?.snapTarget ? (
					<circle
						className="mapSnapTarget"
						cx={connectionDragState.snapTarget.point.x}
						cy={connectionDragState.snapTarget.point.y}
						r={8}
						fill="none"
					/>
				) : null}
			</svg>

			{rooms.map((room) => (
				<RoomCard
					key={room.id}
					room={room}
					width={ROOM_WIDTH}
					height={ROOM_HEIGHT}
					isSelected={!isConnectionSelected && selectedId === room.id}
					isDragging={dragState?.roomId === room.id && dragState.hasDragged}
					onPointerDown={handleRoomPointerDown}
					onNodeClick={addConnection}
					onConnectionDragStart={handleConnectionDragStart}
					onConnectionDragMove={handleConnectionDragMove}
					onConnectionDragEnd={handleConnectionDragEnd}
					onConnectionDragCancel={handleConnectionDragCancel}
				/>
			))}
		</div>
	);
}
