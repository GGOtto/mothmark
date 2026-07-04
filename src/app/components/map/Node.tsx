import type { RoomNode } from "../../types/MapTypes";

type NodeProps = {
  node: RoomNode;
};

export function Node({ node }: NodeProps) {
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
        pointerEvents: "none",
        userSelect: "none",
        touchAction: "none",
        zIndex: 3,
      }}
    />
  );
}
