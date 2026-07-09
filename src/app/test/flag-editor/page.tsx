import {ControlMatrix} from "../ControlMatrix";
import {flagEditorControlMatrixVariants} from "../specializedControlMatrixData";

export default function FlagEditorControlTestPage() {
	return (
		<ControlMatrix
			title="Flag Editor"
			description="Flag registry editing with list-backed flag kinds."
			controlType="flag-editor"
			variants={flagEditorControlMatrixVariants}
		/>
	);
}
