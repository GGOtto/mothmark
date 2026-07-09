import {ControlMatrix} from "../ControlMatrix";
import {aliasSuggestionsControlMatrixVariants} from "../specializedControlMatrixData";

export default function AliasSuggestionsControlTestPage() {
	return (
		<ControlMatrix
			title="Alias Suggestions"
			description="Guided alias generation with pluralization and collision warnings."
			controlType="alias-suggestions"
			variants={aliasSuggestionsControlMatrixVariants}
		/>
	);
}
