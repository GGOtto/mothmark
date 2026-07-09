import {ControlMatrix} from "../ControlMatrix";
import {flagPickerControlMatrixVariants} from "./flagPickerControlMatrixData";

export default function FlagPickerControlMatrixPage() {
	return (
		<ControlMatrix
			title="Flag Picker Matrix"
			description="Registry-aware flag pickers with usage counts, clear action, filtering, and create states."
			controlType="flag-picker"
			variants={flagPickerControlMatrixVariants}
		/>
	);
}
