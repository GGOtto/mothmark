"use client";

import { useState } from "react";
import type { Point, Room, Connection as ConnectionType, Direction } from "../../types/MapTypes";
import { DIRECTION_VECTORS, REVERSE_DIRECTION } from "../../types/MapTypes";
import { addPoints, subtractPoints } from "../../utils/MapUtils";
import { RoomCard } from "./Room";
import { Connection } from "./Connection";

type DragState = {
  roomId: string;
  offset: Point;
};

const GRID_SIZE = 48;
const ROOM_WIDTH = 72;
const ROOM_HEIGHT = 40;

const initialRooms: Room[] = [
  {
    id: "room-1",
    name: "Room 1",
    position: { x: 180, y: 160 },
  },
  {
    id: "room-2",
    name: "Room 2",
    position: { x: 340, y: 160 },
  },
  {
    id: "room-3",
    name: "Room 3",
    position: { x: 460, y: 260 },
  },
  {
    id: "room-4",
    name: "Room 4",
    position: { x: 340, y: 60 },
  },
  {
    id: "room-5",
    name: "Room 5",
    position: { x: 340, y: 260 },
  },
  {
    id: "room-6",
    name: "Room 6",
    position: { x: 340 + ROOM_WIDTH / 2 + 100, y: 160 },
  },
];

const initialConnections: ConnectionType[] = [
  {
    id: "connection-1",
    fromRoomId: "room-1",
    toRoomId: "room-2",
    direction: "e",
    returnDirection: "w",
  },
  {
    id: "connection-2",
    fromRoomId: "room-2",
    toRoomId: "room-3",
    controlPoints: [{ x: 500, y: 220 }],
    direction: "s",
    returnDirection: "n",
  },
  {
    id: "connection-3",
    fromRoomId: "room-1",
    toRoomId: "room-4",
    direction: "ne",
    returnDirection: "sw",
  },
  {
    id: "connection-4",
    fromRoomId: "room-2",
    toRoomId: "room-4",
    direction: "n",
    returnDirection: "s",
  },
  {
    id: "connection-5",
    fromRoomId: "room-1",
    toRoomId: "room-5",
    direction: "s",
    returnDirection: "nw",
  },
  {
    id: "connection-6",
    fromRoomId: "room-5",
    toRoomId: "room-3",
    direction: "se",
    returnDirection: "sw",
  },
  {
    id: "connection-7",
    fromRoomId: "room-4",
    toRoomId: "room-6",
    direction: "e",
    returnDirection: "n",
  },
  {
    id: "connection-8",
    fromRoomId: "room-4",
    toRoomId: "room-6",
    direction: "se",
    returnDirection: "nw",
  },
];

export function Map() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [connections, setConnections] = useState<ConnectionType[]>(initialConnections);
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

  function addRoom(fromRoom?: Room, direction?: Direction) {
    if (!fromRoom || !direction) return;

    const sourceRoom = fromRoom;
    const sourceDirection = direction;

    const vector = DIRECTION_VECTORS[sourceDirection];

    const connectorLength = 40;
    const minConnectorLength = 12;
    const connectorStep = 4;

    function getTargetPosition(length: number): Point {
      return {
        x: sourceRoom.position.x + vector.x * (length + ROOM_WIDTH),
        y: sourceRoom.position.y + vector.y * (length + ROOM_HEIGHT),
      };
    }

    function getOverlappingRoom(position: Point) {
      return rooms.find((room) => {
        if (room.id === sourceRoom.id) return false;

        const dx = Math.abs(room.position.x - position.x);
        const dy = Math.abs(room.position.y - position.y);

        return (
          dx < ROOM_WIDTH + minConnectorLength &&
          dy < ROOM_HEIGHT + minConnectorLength
        );
      });
    }

    let targetPosition = getTargetPosition(connectorLength);
    let overlappingRoom = getOverlappingRoom(targetPosition);

    for (
      let length = connectorLength;
      length >= minConnectorLength;
      length -= connectorStep
    ) {
      const position = getTargetPosition(length);
      const overlap = getOverlappingRoom(position);

      if (!overlap) {
        targetPosition = position;
        overlappingRoom = undefined;
        break;
      }

      targetPosition = position;
      overlappingRoom = overlap;
    }

    const toRoom = overlappingRoom ?? {
      id: `room-${rooms.length + 1}`,
      name: `Room ${rooms.length + 1}`,
      position: targetPosition,
    };

    const newConnection: ConnectionType = {
      id: `connection-${connections.length + 1}`,
      fromRoomId: sourceRoom.id,
      toRoomId: toRoom.id,
      direction,
      returnDirection: REVERSE_DIRECTION[sourceDirection],
    };

    if (!overlappingRoom) {
      setRooms((rooms) => [...rooms, toRoom]);
    }

    setConnections((connections) => {
      const connectionAlreadyExists = connections.some(
        (connection) =>
          connection.fromRoomId === newConnection.fromRoomId &&
          connection.toRoomId === newConnection.toRoomId &&
          connection.direction === newConnection.direction
      );

      if (connectionAlreadyExists) return connections;

      return [...connections, newConnection];
    });
  }

  function handleRoomPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    room: Room
  ) {
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
      })
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
          const toRoom = getRoom(
            connection.toRoomId,
            connection.returnDirection
          );

          if (!fromRoom || !toRoom) return null;

          return (
            <Connection
              key={connection.id}
              connection={connection}
              fromRoom={fromRoom}
              toRoom={toRoom}
            />
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
          onNodeClick={addRoom}
        />
      ))}
    </div>
  );
}
