import {ControlMatrix} from "../ControlMatrix";
import {arrayControlMatrixVariants} from "./arrayControlMatrixData";

export default function ArrayControlMatrixPage() {
	return (
		<ControlMatrix
			title="Array Matrix"
			description="Repeatable item controls with add, remove, duplicate, reorder, collapse, and item title behavior."
			controlType="array"
			variants={arrayControlMatrixVariants}
		/>
	);
}
