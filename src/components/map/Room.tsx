import type {RoomNode} from "../../types/mapTypes";
import type {Room, Direction} from "../../schemas/worldSchema";
import {DIRECTION_VECTORS} from "../../types/mapTypes";
import {Node} from "./Node";

type RoomProps = {
	room: Room;
	width: number;
	height: number;
	isDragging: boolean;
	onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, room: Room) => void;
	onNodeClick: (fromRoom: Room, direction: Direction) => void;
};

export function RoomCard({room, width, height, isDragging, onPointerDown, onNodeClick}: RoomProps) {
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

	return (
		<button
			type="button"
			onPointerDown={(event) => onPointerDown(event, room)}
			style={{
				position: "absolute",
				left: room.position.x,
				top: room.position.y,
				transform: "translate(-50%, -50%)",
				width,
				height,
				border: "2px solid #2f2920",
				background: "#d8ceb4",
				color: "#241f18",
				fontSize: 12,
				cursor: isDragging ? "grabbing" : "grab",
				userSelect: "none",
				touchAction: "none",
				zIndex: 1,
				overflow: "visible",
			}}
		>
			{nodes.map((node) => (
				<Node room={room} node={node} key={node.direction} onNodeClick={onNodeClick} />
			))}

			{room.name}
		</button>
	);
}
