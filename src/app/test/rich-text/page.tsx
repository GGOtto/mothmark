import {ControlMatrix} from "../ControlMatrix";
import {richTextControlMatrixVariants} from "../specializedControlMatrixData";

export default function RichTextControlTestPage() {
	return (
		<ControlMatrix
			title="Rich Text"
			description="Player-facing prose controls with preview behavior and authoring affordances."
			controlType="rich-text"
			variants={richTextControlMatrixVariants}
		/>
	);
}
