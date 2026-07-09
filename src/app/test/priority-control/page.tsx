import {ControlMatrix} from "../ControlMatrix";
import {priorityControlMatrixVariants} from "../specializedControlMatrixData";

export default function PriorityControlTestPage() {
	return (
		<ControlMatrix
			title="Priority Control"
			description="Priority presets with a custom numeric fallback."
			controlType="priority-control"
			variants={priorityControlMatrixVariants}
		/>
	);
}
