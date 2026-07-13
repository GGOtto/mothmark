import type {RoomNode} from "../../types/mapTypes";
import type {Room, Direction} from "../../schemas/roomSchema";
import {DIRECTION_VECTORS} from "../../types/mapTypes";
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
	armedDirection: Direction | null;
	pulseNodes: boolean;
	outgoingDirections: Direction[];
};

export function RoomCard({
	room,
	width,
	height,
	isDragging,
	isSelected,
	onPointerDown,
	onNodeClick,
	armedDirection,
	pulseNodes,
	outgoingDirections,
}: RoomProps) {
	function buildNode(direction: Direction): RoomNode {
		const vector = DIRECTION_VECTORS[direction];

		return {
			room,
			direction,
			position: {
				x: (vector.x * width) / 2,
				y: (vector.y * height) / 2,
			},
			isConnected: false,
		};
	}

	const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
	const nodes = directions.map((direction) => buildNode(direction));

	const className = [
		"roomCard",
		isSelected ? "roomCardSelected" : "",
		isDragging ? "roomCardDragging" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			type="button"
			className={className}
			title={room.name}
			onPointerDown={(event) => onPointerDown(event, room)}
			style={{
				left: room.position.x,
				top: room.position.y,
				width,
				height,
			}}
		>
			{nodes.map((node) => (
				<Node
					room={room}
					node={node}
					key={node.direction}
					onNodeClick={onNodeClick}
					status={armedDirection === node.direction ? "armed" : pulseNodes ? "pulse" : "idle"}
					hasOutgoingPath={outgoingDirections.includes(node.direction)}
				/>
			))}

			<span className="roomCardName">{room.name}</span>
		</button>
	);
}
