import {ControlMatrix} from "../ControlMatrix";
import {diffPreviewControlMatrixVariants} from "../specializedControlMatrixData";

export default function DiffPreviewControlTestPage() {
	return (
		<ControlMatrix
			title="Diff Preview"
			description="Before and after previews for imports, templates, processors, and autofixes."
			controlType="diff-preview"
			variants={diffPreviewControlMatrixVariants}
		/>
	);
}
