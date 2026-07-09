import {ControlMatrix} from "../ControlMatrix";
import {codePreviewControlMatrixVariants} from "./codePreviewControlMatrixData";

export default function CodePreviewControlMatrixPage() {
	return (
		<ControlMatrix
			title="Code Preview Matrix"
			description="Read-only generated code and structured data previews with copy and collapsible modes."
			controlType="code-preview"
			variants={codePreviewControlMatrixVariants}
		/>
	);
}
