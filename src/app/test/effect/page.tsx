import {ControlMatrix} from "../ControlMatrix";
import {effectControlMatrixVariants} from "./effectControlMatrixData";

export default function EffectControlMatrixPage() {
	return (
		<ControlMatrix
			title="Effect Group Matrix"
			description="Complete effect groups with metadata-defined identity, reusable world storage, concrete child effects, and saved-group references."
			controlType="effect"
			variants={effectControlMatrixVariants}
		/>
	);
}
