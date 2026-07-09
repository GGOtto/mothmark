import {ControlMatrix} from "../ControlMatrix";
import {messageControlMatrixVariants} from "./messageControlMatrixData";

export default function MessageControlMatrixPage() {
	return (
		<ControlMatrix
			title="Message Matrix"
			description="Read-only message controls across parent surfaces, appearance modes, semantic variants, and collapsible summaries."
			controlType="message"
			variants={messageControlMatrixVariants}
		/>
	);
}
