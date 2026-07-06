import type {Room} from "../../../schemas/worldSchema";
import {FieldLabel} from "./FieldLabel";

type RoomEditorProps = {
	selectedRoom: Room;
	onRoomChange: (room: Room) => void;
};

export function RoomEditor({selectedRoom, onRoomChange}: RoomEditorProps) {
	return (
		<div className="rightSideBarSection">
			<FieldLabel>Room Name</FieldLabel>

			<input
				className="rightSideBarInput"
				value={selectedRoom.name}
				onChange={(event) =>
					onRoomChange({
						...selectedRoom,
						name: event.target.value,
					})
				}
			/>
		</div>
	);
}
