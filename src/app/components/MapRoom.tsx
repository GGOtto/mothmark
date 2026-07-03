import type { Room } from "../types/MapTypes";

type MapRoomProps = {
  room: Room;
  width: number;
  height: number;
  isDragging: boolean;
  onPointerDown: (
    event: React.PointerEvent<HTMLButtonElement>,
    room: Room
  ) => void;
};

export function MapRoom({
  room,
  width,
  height,
  isDragging,
  onPointerDown,
}: MapRoomProps) {
  return (
    <button
      key={room.id}
      type="button"
      onPointerDown={(event) => onPointerDown(event, room)}
      style={{
        position: "absolute",
        left: room.position.x,
        top: room.position.y,
        transform: "translate(-50%, -50%)",
        width,
        height,
        border: "1px solid #2f2920",
        background: "#d8ceb4",
        color: "#241f18",
        fontSize: 12,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {room.name}
    </button>
  );
}
