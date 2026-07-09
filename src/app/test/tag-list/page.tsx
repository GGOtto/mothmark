import {ControlMatrix} from "../ControlMatrix";
import {tagListControlMatrixVariants} from "./tagListControlMatrixData";

export default function TagListControlMatrixPage() {
	return (
		<ControlMatrix
			title="Tag List Matrix"
			description="Compact string-array controls for aliases, tags, keywords, and command synonyms."
			controlType="tag-list"
			variants={tagListControlMatrixVariants}
		/>
	);
}
