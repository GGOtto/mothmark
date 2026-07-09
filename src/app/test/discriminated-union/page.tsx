import {ControlMatrix} from "../ControlMatrix";
import {discriminatedUnionControlMatrixVariants} from "./discriminatedUnionControlMatrixData";

export default function DiscriminatedUnionControlMatrixPage() {
	return (
		<ControlMatrix
			title="Discriminated Union Matrix"
			description="Branching object controls where a discriminator selects the active shape."
			controlType="discriminated-union"
			variants={discriminatedUnionControlMatrixVariants}
		/>
	);
}
