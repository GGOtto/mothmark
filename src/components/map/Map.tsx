"use client";

import {useState} from "react";
import type {Point, Room, Connection as ConnectionType, Direction} from "../../schemas/worldSchema";
import {DIRECTION_VECTORS, REVERSE_DIRECTION} from "../../types/mapTypes";
import {addPoints, subtractPoints} from "../../utils/pointUtils";
import {RoomCard} from "./Room";
import {Connection} from "./Connection";
import {world} from "../../data/worlds/exampleWorld";
import {isConnectionFromRoom} from "../../utils/connectionUtils";
import {buildAddConnectionResult} from "../../utils/connectionUtils";

type DragState = {
	roomId: string;
	offset: Point;
};

const GRID_SIZE = 48;
const ROOM_WIDTH = 72;
const ROOM_HEIGHT = 40;

export function Map() {
	const [rooms, setRooms] = useState<Room[]>(world.rooms);
	const [connections, setConnections] = useState<ConnectionType[]>(world.connections);
	const [dragState, setDragState] = useState<DragState | null>(null);

	function getRoom(roomId: string, direction?: Direction) {
		const room = rooms.find((room) => room.id === roomId);

		// adjust based on direction if provided
		if (room && direction) {
			const vector = DIRECTION_VECTORS[direction];
			const connectionPoint: Point = {
				x: (vector.x * ROOM_WIDTH) / 2.1,
				y: (vector.y * ROOM_HEIGHT) / 2.1,
			};

			return {
				...room,
				position: addPoints(room.position, connectionPoint),
			};
		}

		return room;
	}

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
			setRooms([...rooms, result.roomToAdd]);
		}

		setConnections((connections) => [...connections, result.connection]);
	}

	function handleRoomPointerDown(event: React.PointerEvent<HTMLButtonElement>, room: Room) {
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
		});
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (!dragState) return;

		const bounds = event.currentTarget.getBoundingClientRect();

		const pointer = {
			x: event.clientX - bounds.left,
			y: event.clientY - bounds.top,
		};

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
		setDragState(null);
	}

	return (
		<div
			data-map
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			style={{
				position: "relative",
				width: 720,
				height: 420,
				border: "1px solid #2f2920",
				backgroundColor: "#c9bea3",
				backgroundImage: `
          linear-gradient(rgba(47, 41, 32, 0.18) 1px, transparent 1px),
          linear-gradient(90deg, rgba(47, 41, 32, 0.18) 1px, transparent 1px)
        `,
				backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
				overflow: "hidden",
				touchAction: "none",
			}}
		>
			<svg
				width="100%"
				height="100%"
				style={{
					position: "absolute",
					inset: 0,
					pointerEvents: "none",
				}}
			>
				{connections.map((connection) => {
					const fromRoom = getRoom(connection.fromRoomId, connection.direction);
					const toRoom = getRoom(connection.toRoomId, connection.returnDirection);

					if (!fromRoom || !toRoom) return null;

					return (
						<Connection key={connection.id} connection={connection} fromRoom={fromRoom} toRoom={toRoom} />
					);
				})}
			</svg>

			{rooms.map((room) => (
				<RoomCard
					key={room.id}
					room={room}
					width={ROOM_WIDTH}
					height={ROOM_HEIGHT}
					isDragging={dragState?.roomId === room.id}
					onPointerDown={handleRoomPointerDown}
					onNodeClick={addConnection}
				/>
			))}
		</div>
	);
}
