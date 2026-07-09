import {ControlMatrix} from "../ControlMatrix";
import {selectControlMatrixVariants} from "./selectControlMatrixData";

export default function SelectControlMatrixPage() {
	return (
		<ControlMatrix
			title="Select Matrix"
			description="Single-choice controls across parent surfaces, appearance modes, validation states, placeholders, disabled options, and option descriptions."
			controlType="select"
			variants={selectControlMatrixVariants}
		/>
	);
}
