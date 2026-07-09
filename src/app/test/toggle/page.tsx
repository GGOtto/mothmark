import {ControlMatrix} from "../ControlMatrix";
import {toggleControlMatrixVariants} from "./toggleControlMatrixData";

export default function ToggleControlMatrixPage() {
	return (
		<ControlMatrix
			title="Toggle Matrix"
			description="Boolean controls across parent surfaces, appearance modes, validation states, switch/checkbox/button displays, and custom labels."
			controlType="toggle"
			variants={toggleControlMatrixVariants}
		/>
	);
}
