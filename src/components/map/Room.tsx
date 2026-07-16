import type {RoomNode} from "../../utils/mapUtils";
import type {Room, Direction} from "../../schemas/roomSchema";
import {getRoomNodePosition, ROOM_DIRECTIONS} from "../../utils/mapUtils";
import type {UpdateStatus} from "../studio/ToolBar";
import {Node} from "./Node";
import "./Room.scss";

type RoomProps = {
	room: Room;
	width: number;
	height: number;
	isDragging: boolean;
	isSelected: boolean;
	onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, room: Room) => void;
	onNodeClick: (fromRoom: Room, direction: Direction) => void;
	updateStatus: UpdateStatus;
	armedDirection: Direction | null;
	pulseNodes: boolean;
	outgoingDirections: Direction[];
	isInteractive?: boolean;
};

export function RoomCard({
	room,
	width,
	height,
	isDragging,
	isSelected,
	onPointerDown,
	onNodeClick,
	updateStatus,
	armedDirection,
	pulseNodes,
	outgoingDirections,
	isInteractive = true,
}: RoomProps) {
	function buildNode(direction: Direction): RoomNode {
		return {
			room,
			direction,
			position: getRoomNodePosition(direction, width, height),
			isConnected: false,
		};
	}

	const nodes = ROOM_DIRECTIONS.map((direction) => buildNode(direction));

	const className = [
		"roomCard",
		isSelected ? "roomCardSelected" : "",
		isDragging ? "roomCardDragging" : "",
	]
		.filter(Boolean)
		.join(" ");

	const contents = (
		<>
			{isInteractive
				? nodes.map((node) => (
						<Node
							room={room}
							node={node}
							key={node.direction}
							onNodeClick={onNodeClick}
							updateStatus={updateStatus}
							status={armedDirection === node.direction ? "armed" : pulseNodes ? "pulse" : "idle"}
							hasOutgoingPath={outgoingDirections.includes(node.direction)}
						/>
					))
				: null}
			<span className="roomCardName">{room.name}</span>
		</>
	);
	const style = {
		left: room.metadata.position.x,
		top: room.metadata.position.y,
		width,
		height,
	};

	return isInteractive ? (
		<button
			type="button"
			className={className}
			title={room.name}
			onPointerDown={(event) => onPointerDown(event, room)}
			style={style}
		>
			{contents}
		</button>
	) : (
		<div className={`${className} roomCardPreview`} title={room.name} style={style}>
			{contents}
		</div>
	);
}
