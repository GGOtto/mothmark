import {ControlMatrix} from "../ControlMatrix";
import {connectionPickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function ConnectionPickerControlTestPage() {
	return (
		<ControlMatrix
			title="Connection Picker"
			description="Room connection controls composed from room, direction, pathway, and condition controls."
			controlType="connection-picker"
			variants={connectionPickerControlMatrixVariants}
		/>
	);
}
