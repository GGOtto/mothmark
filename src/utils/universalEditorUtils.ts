import {TextFieldControlMetadata} from "@/components/editor/universal/TextFieldEditor";

export function applyTextTransform(
	value: string,
	transform?: TextFieldControlMetadata["transform"],
) {
	if (!transform || transform === "none") return value;

	if (transform === "lowercase") return value.toLowerCase();
	if (transform === "uppercase") return value.toUpperCase();

	if (transform === "slug") {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	if (transform === "id") {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9_/-]+/g, "-")
			.replace(/^-+|-+$/g, "");
	}

	return value;
}
