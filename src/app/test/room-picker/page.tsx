import {ControlMatrix} from "../ControlMatrix";
import {roomPickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function RoomPickerControlTestPage() {
	return (
		<ControlMatrix
			title="Room Picker"
			description="Registry-backed room selection with preview and badges."
			controlType="room-picker"
			variants={roomPickerControlMatrixVariants}
		/>
	);
}
