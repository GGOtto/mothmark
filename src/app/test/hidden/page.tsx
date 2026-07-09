import {ControlMatrix} from "../ControlMatrix";
import {hiddenControlMatrixVariants} from "./hiddenControlMatrixData";

export default function HiddenControlMatrixPage() {
	return (
		<ControlMatrix
			title="Hidden Matrix"
			description="Explicit non-rendering controls for data fields suppressed by editor metadata."
			controlType="hidden"
			variants={hiddenControlMatrixVariants}
		/>
	);
}
