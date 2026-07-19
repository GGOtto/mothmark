/**
 * Normalizes indentation in a multiline string by removing the smallest common
 * leading whitespace shared by all non-empty lines.
 *
 * This is useful for writing readable template strings in source code while
 * keeping the rendered output aligned as intended.
 *
 * Blank lines are ignored when calculating the common indentation, so they do
 * not affect how much whitespace is removed from the rest of the text.
 * Relative indentation is preserved.
 */
export function docify(text: string): string {
	const lines = text.split("\n");

	const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

	if (nonEmptyLines.length === 0) {
		return lines.map(() => "").join("\n");
	}

	const indents = nonEmptyLines.map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);

	const minIndent = Math.min(...indents);

	return lines.map((line) => line.slice(minIndent)).join("\n");
}
