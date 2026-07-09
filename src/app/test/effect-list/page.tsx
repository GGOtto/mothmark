import {ControlMatrix} from "../ControlMatrix";
import {effectListControlMatrixVariants} from "./effectListControlMatrixData";

export default function EffectListControlMatrixPage() {
	return (
		<ControlMatrix
			title="Effect List Matrix"
			description="Ordered gameplay effect editing with effect type changes, field editing, duplicate, reorder, and remove behavior."
			controlType="effect-list"
			variants={effectListControlMatrixVariants}
		/>
	);
}
