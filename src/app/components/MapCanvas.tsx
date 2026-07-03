"use client";

import { useState } from "react";

type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
};

const REVERSE_DIRECTION: Record<Direction, Direction> = {
  n: "s",
  ne: "sw",
  e: "w",
  se: "nw",
  s: "n",
  sw: "ne",
  w: "e",
  nw: "se",
};

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
  direction?: Direction;
  returnDirection?: Direction;
  specialCommands?: string[];
  returnSpecialCommands?: string[];
};

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

    const control1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };

    const control2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };

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
      return {
        ...room,
        position: {
          x: room.position.x + (vector.x * ROOM_WIDTH) / 2.1,
          y: room.position.y + (vector.y * ROOM_HEIGHT) / 2.1,
        },
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
    const xDiff = endPoint.x - startPoint.x;
    const yDiff = endPoint.y - startPoint.y;

    // the shorter distance gets halved and the longer side gets divided into thirds
    let xChange, yChange;
    if (Math.abs(xDiff) < Math.abs(yDiff)) {
      xChange = xDiff / 2;
      yChange = yDiff / 3;
    } else {
      xChange = xDiff / 3;
      yChange = yDiff / 3;
    }
    // TODO: what happens if they're equal?

    // TODO: currently needs both start and return directions, change that
    if (!startDirection || !endDirection) {
      throw Error("needs both directions in a connectioin for now");
    }
    const startDirectionVector = DIRECTION_VECTORS[startDirection];
    const endDirectionVector = DIRECTION_VECTORS[REVERSE_DIRECTION[endDirection]];
    const handleLength = 15;

    // position of the start handle (relative to the start point)
    const startHandle: Point = {
        x: handleLength * startDirectionVector.x,
        y: handleLength * startDirectionVector.y,
    }

    // position of the end handle (relative to the end point)
    const endHandle: Point = {
        x: -handleLength * endDirectionVector.x,
        y: -handleLength * endDirectionVector.y,
    }

    return [
      {
        x: startPoint.x + startHandle.x,
        y: startPoint.y + startHandle.y,
      },
    //   {
    //     x: startPoint.x + xChange,
    //     y: startPoint.y + yChange,
    //   },
    //   {
    //     x: endPoint.x - xChange,
    //     y: endPoint.y - yChange,
    //   },
      {
        x: (startPoint.x + endPoint.x) / 2 + startHandle.x + endHandle.x,
        y: (startPoint.y + endPoint.y) / 2 + startHandle.y + endHandle.y,
      },
      {
        x: endPoint.x + endHandle.x,
        y: endPoint.y + endHandle.y,
      },
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
      offset: {
        x: pointer.x - room.position.x,
        y: pointer.y - room.position.y,
      },
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
          position: {
            x: pointer.x - dragState.offset.x,
            y: pointer.y - dragState.offset.y,
          },
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
