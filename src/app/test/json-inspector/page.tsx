import {ControlMatrix} from "../ControlMatrix";
import {jsonInspectorControlMatrixVariants} from "../specializedControlMatrixData";

export default function JsonInspectorControlTestPage() {
	return (
		<ControlMatrix
			title="JSON Inspector"
			description="Structured JSON inspection controls with copy and collapse behavior."
			controlType="json-inspector"
			variants={jsonInspectorControlMatrixVariants}
		/>
	);
}
