import {ControlMatrix} from "../ControlMatrix";
import {textareaControlMatrixVariants} from "./textareaControlMatrixData";

export default function TextareaControlMatrixPage() {
	return (
		<ControlMatrix
			title="Textarea Matrix"
			description="Long-form string controls across parent surfaces, appearance modes, validation states, and textarea-specific features."
			controlType="textarea"
			variants={textareaControlMatrixVariants}
		/>
	);
}
