import {useMemo} from "react";
import {type World} from "../../../schemas/worldSchema";
import {RoomSchema, type Room} from "../../../schemas/roomSchema";
import {UniversalEditor} from "../universal/UniversalEditor";
import {compareIds} from "@/utils/idUtils";

type RoomEditorProps = {
	selectedRoom: Room;
	rooms?: Pick<Room, "id">[];
	world?: World;
	onWorldChange?: (world: World) => void;
	onRoomChange: (room: Room) => void;
};

export function RoomEditor({
	selectedRoom,
	rooms = [],
	world,
	onWorldChange,
	onRoomChange,
}: RoomEditorProps) {
	const duplicateRoomId = useMemo(() => {
		return rooms.filter((room) => compareIds(room.id, selectedRoom.id)).length > 1;
	}, [rooms, selectedRoom.id]);

	return (
		<div className="rightSideBarSection roomEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected Room</p>
				<h2 className="roomEditorTitle">{selectedRoom.name || "Unnamed Room"}</h2>
			</div>

			{duplicateRoomId ? (
				<p className="rightSideBarWarningText">
					This room is already using the same internal identifier.
				</p>
			) : null}

			<UniversalEditor
				schema={RoomSchema}
				value={selectedRoom}
				onChange={onRoomChange}
				world={world}
				onWorldChange={onWorldChange}
				appearance={{
					theme: "auto",
					scheme: "dark",
					chrome: "field", // TODO: maybe an auto mode that adjusts based on the available space
				}}
				className="roomEditorUniversal"
			/>
		</div>
	);
}
