import {ControlMatrix} from "../ControlMatrix";
import {conditionBuilderControlMatrixVariants} from "./conditionBuilderControlMatrixData";

export default function ConditionBuilderControlMatrixPage() {
	return (
		<ControlMatrix
			title="Condition Builder Matrix"
			description="Visual condition editing for flag checks, counters, current room rules, and nested groups."
			controlType="condition-builder"
			variants={conditionBuilderControlMatrixVariants}
		/>
	);
}
