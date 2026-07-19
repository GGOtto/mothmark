import {DIRECTION_LABELS, type RoomNode} from "./utils/mapUtils";
import type {Room, Direction} from "../../schemas/world/roomSchema";
import type {UpdateStatus} from "../studio/ToolBar";
import "./Node.scss";

type NodeProps = {
	room: Room;
	node: RoomNode;
	onNodeClick: (fromRoom: Room, direction: Direction) => void;
	updateStatus: UpdateStatus;
	status: "armed" | "idle" | "pulse";
	hasOutgoingPath: boolean;
};

export function Node({room, node, onNodeClick, updateStatus, status, hasOutgoingPath}: NodeProps) {
	return (
		<div
			className={`node node--${status} ${hasOutgoingPath ? "node--outgoing" : ""}`}
			data-direction={node.direction}
			title={`${DIRECTION_LABELS[node.direction]} passage node`}
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
			onPointerEnter={() =>
				updateStatus({
					kind: "node",
					label: `${DIRECTION_LABELS[node.direction]} passage node · Click to connect`,
				})
			}
			onPointerLeave={() => updateStatus(null)}
			onClick={(event) => {
				event.stopPropagation();
				onNodeClick(room, node.direction);
			}}
		/>
	);
}
