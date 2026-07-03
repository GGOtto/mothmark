"use client";

import { useState } from "react";

type Point = {
  x: number;
  y: number;
};

type Room = {
  id: string;
  name: string;
  position: Point;
};

type Connection = {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  controlPoints?: Point[];
};

const GRID_SIZE = 48;

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
];

const initialConnections: Connection[] = [
  {
    id: "connection-1",
    fromRoomId: "room-1",
    toRoomId: "room-2",
  },
  {
    id: "connection-2",
    fromRoomId: "room-2",
    toRoomId: "room-3",
    controlPoints: [{ x: 400, y: 220 }],
  },
];

function getPath(points: Point[]) {
  if (points.length < 2) return "";

  const [start, ...rest] = points;

  return [
    `M ${start.x} ${start.y}`,
    ...rest.map((point) => `L ${point.x} ${point.y}`),
  ].join(" ");
}

export function Map() {
  const [rooms] = useState<Room[]>(initialRooms);
  const [connections] = useState<Connection[]>(initialConnections);

  function getRoom(roomId: string) {
    return rooms.find((room) => room.id === roomId);
  }

  return (
    <div
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
          const fromRoom = getRoom(connection.fromRoomId);
          const toRoom = getRoom(connection.toRoomId);

          if (!fromRoom || !toRoom) return null;

          const pathPoints = [
            fromRoom.position,
            ...(connection.controlPoints ?? []),
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
          style={{
            position: "absolute",
            left: room.position.x,
            top: room.position.y,
            transform: "translate(-50%, -50%)",
            width: 72,
            height: 40,
            border: "1px solid #2f2920",
            background: "#d8ceb4",
            color: "#241f18",
            fontSize: 12,
          }}
        >
          {room.name}
        </button>
      ))}
    </div>
  );
}
