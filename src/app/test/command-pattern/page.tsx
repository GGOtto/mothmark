import {ControlMatrix} from "../ControlMatrix";
import {commandPatternControlMatrixVariants} from "../specializedControlMatrixData";

export default function CommandPatternControlTestPage() {
	return (
		<ControlMatrix
			title="Command Pattern"
			description="Authored command pattern controls with list-backed match and target modes."
			controlType="command-pattern"
			variants={commandPatternControlMatrixVariants}
		/>
	);
}
