import {ControlMatrix} from "../ControlMatrix";
import {logicBranchListControlMatrixVariants} from "../specializedControlMatrixData";

export default function LogicBranchListControlTestPage() {
	return (
		<ControlMatrix
			title="Logic Branch List"
			description="Branching command behavior composed from list-backed branch selectors, conditions, messages, and effects."
			controlType="logic-branch-list"
			variants={logicBranchListControlMatrixVariants}
		/>
	);
}
