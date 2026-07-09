import {ControlMatrix} from "../ControlMatrix";
import {scopePickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function ScopePickerControlTestPage() {
	return (
		<ControlMatrix
			title="Scope Picker"
			description="Scope controls with described, list-backed options."
			controlType="scope-picker"
			variants={scopePickerControlMatrixVariants}
		/>
	);
}
