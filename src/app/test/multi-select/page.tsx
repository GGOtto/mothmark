import {ControlMatrix} from "../ControlMatrix";
import {multiSelectControlMatrixVariants} from "./multiSelectControlMatrixData";

export default function MultiSelectControlMatrixPage() {
	return (
		<ControlMatrix
			title="Multi-Select Matrix"
			description="Multiple-choice controls across parent surfaces, appearance modes, validation states, max-selected behavior, disabled options, and clearing."
			controlType="multi-select"
			variants={multiSelectControlMatrixVariants}
		/>
	);
}
