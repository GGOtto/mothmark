export const WORLD_EDITOR_SLUG_MAX_LENGTH = 64;

const FALLBACK_WORLD_SLUG = "untitled-world";
const UUID_SHAPED_SLUG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function worldSlugBase(name: string): string {
	const normalized = name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, WORLD_EDITOR_SLUG_MAX_LENGTH)
		.replace(/-+$/g, "");
	if (!normalized) return FALLBACK_WORLD_SLUG;
	return UUID_SHAPED_SLUG.test(normalized) ? `world-${normalized}` : normalized;
}

/** Creates a readable slug unique within one owner's private world collection. */
export function createUniqueWorldSlug(name: string, existingSlugs: Iterable<string>): string {
	const existing = new Set(existingSlugs);
	const base = worldSlugBase(name);
	if (!existing.has(base)) return base;

	let suffix = 2;
	while (true) {
		const suffixText = `-${suffix}`;
		const candidate = `${base.slice(0, WORLD_EDITOR_SLUG_MAX_LENGTH - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
		if (!existing.has(candidate)) return candidate;
		suffix += 1;
	}
}

export function isWorldEditorSlug(value: string): boolean {
	return (
		value.length > 0 &&
		value.length <= WORLD_EDITOR_SLUG_MAX_LENGTH &&
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
	);
}
