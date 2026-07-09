import {ControlMatrix} from "../ControlMatrix";
import {stringListControlMatrixVariants} from "./stringListControlMatrixData";

export default function StringListControlMatrixPage() {
	return (
		<ControlMatrix
			title="String List Matrix"
			description="Editable longer string arrays for examples, notes, and alternate messages."
			controlType="string-list"
			variants={stringListControlMatrixVariants}
		/>
	);
}
