import {ControlMatrix} from "../ControlMatrix";
import {idControlMatrixVariants} from "../specializedControlMatrixData";

export default function IdControlTestPage() {
	return (
		<ControlMatrix
			title="ID Control"
			description="Canonical ID controls with normalization, uniqueness warnings, prefixes, and actions."
			controlType="id"
			variants={idControlMatrixVariants}
		/>
	);
}
