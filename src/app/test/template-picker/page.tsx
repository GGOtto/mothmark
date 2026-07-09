import {ControlMatrix} from "../ControlMatrix";
import {templatePickerControlMatrixVariants} from "../specializedControlMatrixData";

export default function TemplatePickerControlTestPage() {
	return (
		<ControlMatrix
			title="Template Picker"
			description="Preset object creation controls for common authored structures."
			controlType="template-picker"
			variants={templatePickerControlMatrixVariants}
		/>
	);
}
