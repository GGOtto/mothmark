import type {RoomNode} from "../../types/mapTypes";
import type {Room, Direction} from "../../schemas/roomSchema";
import "./Node.scss";

type NodeProps = {
	room: Room;
	node: RoomNode;
	onNodeClick: (fromRoom: Room, direction: Direction) => void;
	status: "armed" | "idle" | "pulse";
	hasOutgoingPath: boolean;
};

export function Node({room, node, onNodeClick, status, hasOutgoingPath}: NodeProps) {
	return (
		<div
			className={`node node--${status} ${hasOutgoingPath ? "node--outgoing" : ""}`}
			style={{
				left: `calc(50% + ${node.position.x}px)`,
				top: `calc(50% + ${node.position.y}px)`,
			}}
			onPointerDown={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onClick={(event) => {
				event.stopPropagation();
				onNodeClick(room, node.direction);
			}}
		/>
	);
}
