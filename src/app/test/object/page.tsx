import {ControlMatrix} from "../ControlMatrix";
import {objectControlMatrixVariants} from "./objectControlMatrixData";

export default function ObjectControlMatrixPage() {
	return (
		<ControlMatrix
			title="Object Matrix"
			description="Nested object controls with stack, grid, section, count, and collapsible layouts."
			controlType="object"
			variants={objectControlMatrixVariants}
		/>
	);
}
