export function normalizeSuggestionText(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/([\p{L}\p{N}])'s\b/gu, "$1")
		.replaceAll("'", "")
		.replace(/^(?:a|an|my|the)\s+/, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function normalizeSuggestedTag(value: string): string {
	return normalizeSuggestionText(value).replaceAll(" ", "-");
}
