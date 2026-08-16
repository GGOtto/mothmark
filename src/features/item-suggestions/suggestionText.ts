export function normalizeSuggestionText(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/^(?:a|an|my|the)\s+/, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function normalizeSuggestedTag(value: string): string {
	return normalizeSuggestionText(value).replaceAll(" ", "-");
}
