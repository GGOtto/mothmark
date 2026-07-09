import {useMemo} from "react";
import {RoomSchema, type Room, type World} from "../../../schemas/worldSchema";
import {UniversalEditor} from "../universal/UniversalEditor";

type RoomEditorProps = {
	selectedRoom: Room;
	rooms?: Pick<Room, "id">[];
	world?: World;
	onRoomChange: (room: Room) => void;
};

export function RoomEditor({selectedRoom, rooms = [], world, onRoomChange}: RoomEditorProps) {
	const duplicateRoomId = useMemo(() => {
		return rooms.filter((room) => room.id === selectedRoom.id).length > 1;
	}, [rooms, selectedRoom.id]);

	return (
		<div className="rightSideBarSection roomEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected Room</p>
				<h2 className="roomEditorTitle">{selectedRoom.name || "Unnamed Room"}</h2>
			</div>

			{duplicateRoomId ? (
				<p className="rightSideBarWarningText">This room ID is already being used.</p>
			) : null}

			<UniversalEditor
				schema={RoomSchema}
				value={selectedRoom}
				onChange={onRoomChange}
				world={world}
				appearance={{
					theme: "mothmark",
					scheme: "dark",
					chrome: "bare",
				}}
				className="roomEditorUniversal"
			/>
		</div>
	);
}
