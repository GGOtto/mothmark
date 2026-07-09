import {ControlMatrix} from "../ControlMatrix";
import {validationSummaryControlMatrixVariants} from "../specializedControlMatrixData";

export default function ValidationSummaryControlTestPage() {
	return (
		<ControlMatrix
			title="Validation Summary"
			description="Read-only scoped issue summaries for editor validation."
			controlType="validation-summary"
			variants={validationSummaryControlMatrixVariants}
		/>
	);
}
