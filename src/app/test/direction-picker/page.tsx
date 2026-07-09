import {ControlMatrix} from "../ControlMatrix";
import {directionPickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function DirectionPickerControlTestPage() {
	return (
		<ControlMatrix
			title="Direction Picker"
			description="Direction controls backed by world/schema direction lists."
			controlType="direction-picker"
			variants={directionPickerControlMatrixVariants}
		/>
	);
}
