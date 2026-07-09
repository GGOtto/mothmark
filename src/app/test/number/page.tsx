import {ControlMatrix} from "../ControlMatrix";
import {numberControlMatrixVariants} from "./numberControlMatrixData";

export default function NumberControlMatrixPage() {
	return (
		<ControlMatrix
			title="Number Matrix"
			description="Numeric controls across parent surfaces, appearance modes, validation states, range sliders, affixes, and clamping behavior."
			controlType="number"
			variants={numberControlMatrixVariants}
		/>
	);
}
