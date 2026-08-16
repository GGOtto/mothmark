import {ControlMatrix} from "../ControlMatrix";
import {directionMultiPickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function DirectionMultiPickerControlTestPage() {
	return (
		<ControlMatrix
			title="Direction Multi Picker"
			description="Compact multiple-direction controls used by command direction blocks."
			controlType="direction-multi-picker"
			variants={directionMultiPickerControlMatrixVariants}
		/>
	);
}
