// components/MapConnection.tsx

import type { Connection, Direction, Point, Room } from "../types/MapTypes";
import { DIRECTION_VECTORS, REVERSE_DIRECTION } from "../types/MapTypes";
import {
  addPoints,
  subtractPoints,
  getMidpoint,
  scalePoint,
} from "../utils/mapUtils";

type MapConnectionProps = {
  connection: Connection;
  fromRoom: Room;
  toRoom: Room;
};

function getPath(points: Point[]) {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const control1 = addPoints(p1, scalePoint(subtractPoints(p2, p0), 1 / 6));
    const control2 = subtractPoints(
      p2,
      scalePoint(subtractPoints(p3, p1), 1 / 6)
    );

    path += ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${p2.x} ${p2.y}`;
  }

  return path;
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

export function MapConnection({
  connection,
  fromRoom,
  toRoom,
}: MapConnectionProps) {
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
      d={getPath(pathPoints)}
      fill="none"
      stroke="#2f2920"
      strokeWidth="2"
    />
  );
}
