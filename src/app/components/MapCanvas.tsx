"use client";

import { useState } from "react";
import type {Point, Room, Connection, Direction} from "../types/MapTypes";
import {DIRECTION_VECTORS, REVERSE_DIRECTION} from "../types/MapTypes";
import {addPoints, subtractPoints, getMidpoint, scalePoint} from "../utils/mapUtils";

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

const initialConnections: Connection[] = [
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

function getPath(points: Point[]) {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const control1 = addPoints(p1, scalePoint(subtractPoints(p2, p0), 1/6)); 
    const control2 = subtractPoints(p2, scalePoint(subtractPoints(p3, p1), 1/6));
    
    path += ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${p2.x} ${p2.y}`;
  }

  return path;
}

export function Map() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [connections] = useState<Connection[]>(initialConnections);
  const [dragState, setDragState] = useState<DragState | null>(null);

  function getRoom(roomId: string, direction?: Direction) {
    const room = rooms.find((room) => room.id === roomId);

    // adjust based on direction if provided
    if (room && direction) {
      const vector = DIRECTION_VECTORS[direction];
      const connectionPoint: Point = {
        x: (vector.x * ROOM_WIDTH) / 2.1,
        y: (vector.y * ROOM_HEIGHT) / 2.1,
      }
      return {
        ...room,
        position: addPoints(room.position, connectionPoint),
      };
    }

    return room;
  }

  function getControlPoints(
    startPoint: Point,
    endPoint: Point,
    startDirection?: Direction,
    endDirection?: Direction
  ): Point[] {
    // TODO: currently needs both start and return directions, change that
    if (!startDirection || !endDirection) {
      throw Error("needs both directions in a connectioin for now");
    }
    const startDirectionVector = DIRECTION_VECTORS[startDirection];
    const endDirectionVector = DIRECTION_VECTORS[REVERSE_DIRECTION[endDirection]];
    const handleLength = 15;

    // position of the start handle (relative to the start point)
    const startHandle: Point = scalePoint(startDirectionVector, handleLength);

    // position of the end handle (relative to the end point)
    const endHandle: Point = scalePoint(endDirectionVector, -handleLength);

    return [
      addPoints(startPoint, startHandle),
      addPoints(getMidpoint(startPoint, endPoint), addPoints(startHandle, endHandle)),
      addPoints(endPoint, endHandle),
    ];
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
          const toRoom = getRoom(connection.toRoomId, connection.returnDirection);

          if (!fromRoom || !toRoom) return null;

          const curvePoints = getControlPoints(
            fromRoom.position,
            toRoom.position,
            connection.direction,
            connection.returnDirection
          );

          const pathPoints = [
            fromRoom.position,
            ...curvePoints,
            // TODO: build control points in that also use curve points/
            // ...(connection.controlPoints ?? []),
            toRoom.position,
          ];

          return (
            <path
              key={connection.id}
              d={getPath(pathPoints)}
              fill="none"
              stroke="#2f2920"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          onPointerDown={(event) => handleRoomPointerDown(event, room)}
          style={{
            position: "absolute",
            left: room.position.x,
            top: room.position.y,
            transform: "translate(-50%, -50%)",
            width: ROOM_WIDTH,
            height: ROOM_HEIGHT,
            border: "1px solid #2f2920",
            background: "#d8ceb4",
            color: "#241f18",
            fontSize: 12,
            cursor: dragState?.roomId === room.id ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          {room.name}
        </button>
      ))}
    </div>
  );
}
