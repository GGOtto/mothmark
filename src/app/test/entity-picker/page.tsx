import {ControlMatrix} from "../ControlMatrix";
import {entityPickerControlMatrixVariants} from "./entityPickerControlMatrixData";

export default function EntityPickerControlMatrixPage() {
	return (
		<ControlMatrix
			title="Entity Picker Matrix"
			description="Registry-aware entity ID pickers with preview, clear, and create affordances."
			controlType="entity-picker"
			variants={entityPickerControlMatrixVariants}
		/>
	);
}
