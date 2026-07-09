import {ControlMatrix} from "../ControlMatrix";
import {conditionalTextControlMatrixVariants} from "../specializedControlMatrixData";

export default function ConditionalTextControlTestPage() {
	return (
		<ControlMatrix
			title="Conditional Text"
			description="Default prose with conditional variants composed from textarea, array, and condition controls."
			controlType="conditional-text"
			variants={conditionalTextControlMatrixVariants}
		/>
	);
}
