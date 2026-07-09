import {ControlMatrix} from "../ControlMatrix";
import {textControlMatrixVariants} from "./textControlMatrixData";

export default function TextControlMatrixPage() {
	return (
		<ControlMatrix
			title="Text Field Matrix"
			description="Each row renders one text-field variant across ten parent surfaces. Most variants use the auto theme so they inherit from the cards. Only theme-test variants render every explicit theme."
			controlType="input"
			variants={textControlMatrixVariants}
		/>
	);
}
