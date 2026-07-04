import type { RoomNode, Room, Direction } from "../../types/MapTypes";

type NodeProps = {
  room: Room;
  node: RoomNode;
  onNodeClick: (
      fromRoom?: Room,
      direction?: Direction,
    ) => void;
};

export function Node({ room, node, onNodeClick }: NodeProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${node.position.x}px)`,
        top: `calc(50% + ${node.position.y}px)`,
        transform: "translate(-50%, -50%)",
        width: 10,
        height: 10,
        borderRadius: "50%",
        border: "2px solid #2f2920",
        background: "#ffffff",
        pointerEvents: "auto",
        userSelect: "none",
        touchAction: "none",
        zIndex: 3,
        cursor: "pointer",
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onNodeClick(room, node.direction);
      }}
    />
  );
}
