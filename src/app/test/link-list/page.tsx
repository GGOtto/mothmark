import {ControlMatrix} from "../ControlMatrix";
import {linkListControlMatrixVariants} from "./linkListControlMatrixData";

export default function LinkListControlMatrixPage() {
	return (
		<ControlMatrix
			title="Link List Matrix"
			description="Clickable tag-like controls for internal routes, external references, and editor targets."
			controlType="link-list"
			variants={linkListControlMatrixVariants}
		/>
	);
}
