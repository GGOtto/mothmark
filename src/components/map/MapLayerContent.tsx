import type React from "react";
import type {Connection as ConnectionType, Direction, Point, Room} from "../../schemas/roomSchema";
import type {Layer, World} from "../../schemas/worldSchema";
import {isConnectionFromRoom} from "../../utils/connectionUtils";
import {idValue} from "../../utils/idUtils";
import {isRoomInLayer} from "../../utils/layerUtils";
import {ROOM_DIRECTIONS} from "../../utils/mapUtils";
import type {UpdateStatus} from "../studio/ToolBar";
import {Connection} from "./Connection";
import {RoomCard} from "./Room";

export const MAP_ROOM_WIDTH = 128;
export const MAP_ROOM_HEIGHT = 80;

type MapLayerContentProps = {
	world: World;
	layer: Layer;
	selectedId?: string | null;
	isConnectionSelected?: boolean;
	isInteractive?: boolean;
	onRoomPointerDown?: (event: React.PointerEvent<HTMLButtonElement>, room: Room) => void;
	onNodeClick?: (room: Room, direction: Direction) => void;
	selectConnection?: (connection?: ConnectionType) => void;
	changePathway?: (connection: ConnectionType) => ConnectionType["pathway"];
	onStubPointChange?: (connection: ConnectionType, point: Point) => void;
	updateStatus?: UpdateStatus;
	isRoomDragging?: (room: Room) => boolean;
	getArmedDirection?: (room: Room) => Direction | null;
	shouldPulseNodes?: (room: Room) => boolean;
};

const noopStatus: UpdateStatus = () => {};

/** The shared visual scene used by both the editable map and read-only layer previews. */
export function MapLayerContent({
	world,
	layer,
	selectedId = null,
	isConnectionSelected = false,
	isInteractive = true,
	onRoomPointerDown,
	onNodeClick,
	selectConnection,
	changePathway,
	onStubPointChange,
	updateStatus = noopStatus,
	isRoomDragging,
	getArmedDirection,
	shouldPulseNodes,
}: MapLayerContentProps) {
	function getRoom(roomReference: ConnectionType["fromRoomId"]) {
		const roomId = idValue(roomReference);
		return world.rooms.find((room) => idValue(room.id) === roomId);
	}

	const selectedConnection = isConnectionSelected
		? world.connections.find((connection) => idValue(connection.id) === selectedId)
		: undefined;
	const connections = selectedConnection
		? [
				...world.connections.filter(
					(connection) => idValue(connection.id) !== idValue(selectedConnection.id),
				),
				selectedConnection,
			]
		: world.connections;

	return (
		<>
			<svg className="mapSvg" width="100%" height="100%">
				{connections.map((connection) => {
					const fromRoom = getRoom(connection.fromRoomId);
					const toRoom = getRoom(connection.toRoomId);
					if (!fromRoom || !toRoom) return null;

					const isSelected = isConnectionSelected && idValue(connection.id) === selectedId;
					return (
						<Connection
							key={idValue(connection.id)}
							world={world}
							connection={connection}
							fromRoom={fromRoom}
							toRoom={toRoom}
							selectConnection={selectConnection ?? (() => {})}
							changePathway={changePathway ?? ((item) => item.pathway)}
							updateStatus={updateStatus}
							isEditing={isInteractive && isSelected}
							isSelected={isSelected}
							currentLayer={layer}
							onStubPointChange={onStubPointChange ?? (() => {})}
							isInteractive={isInteractive}
						/>
					);
				})}
			</svg>

			{world.rooms.map((room) =>
				isRoomInLayer(layer, room.id) ? (
					<RoomCard
						key={idValue(room.id)}
						room={room}
						width={MAP_ROOM_WIDTH}
						height={MAP_ROOM_HEIGHT}
						isSelected={!isConnectionSelected && selectedId === idValue(room.id)}
						isDragging={isRoomDragging?.(room) ?? false}
						armedDirection={getArmedDirection?.(room) ?? null}
						pulseNodes={shouldPulseNodes?.(room) ?? false}
						outgoingDirections={ROOM_DIRECTIONS.filter((direction) =>
							isConnectionFromRoom(idValue(room.id), direction, world.connections),
						)}
						onPointerDown={onRoomPointerDown ?? (() => {})}
						onNodeClick={onNodeClick ?? (() => {})}
						updateStatus={updateStatus}
						isInteractive={isInteractive}
					/>
				) : null,
			)}
		</>
	);
}
