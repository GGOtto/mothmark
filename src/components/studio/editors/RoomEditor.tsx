import {useMemo} from "react";
import {type World} from "../../../schemas/world/worldSchema";
import {RoomSchema, type Room} from "../../../schemas/world/roomSchema";
import {UniversalEditor} from "../../universal-editor/UniversalEditor";
import {compareIds} from "@/utils/idUtils";
import {useTheme} from "@/components/theme/ThemeProvider";

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
	const {theme} = useTheme();
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
					scheme: theme,
				}}
				className="roomEditorUniversal"
				allowDelete={true}
			/>
		</div>
	);
}
