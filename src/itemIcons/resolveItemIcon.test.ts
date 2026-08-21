import {ITEM_ICON_CATALOG, ITEM_ICON_CATEGORIES} from "./itemIconCatalog";
import {
	normalizeItemIconTerm,
	resolveItemIcon,
	resolveItemIconWithInferredTags,
} from "./resolveItemIcon";

describe("corroborating item icon resolver", () => {
	it("uses independent name, alias, and tag support instead of trusting one field", () => {
		const result = resolveItemIcon({
			name: "rope toy",
			aliases: ["toy", "rope"],
			tags: ["toy"],
		});

		expect(result.category).toBe("toy-and-game");
		expect(result.reason).toBe("corroborated-match");
		expect(result.evidence.map((entry) => entry.source)).toEqual(["name", "aliases", "tags"]);
		expect(result.alternatives[0]).toMatchObject({
			category: "rope",
			supportingFields: ["name", "aliases"],
		});
	});

	it("allows corroborated aliases and tags to outweigh an isolated name", () => {
		expect(resolveItemIcon({name: "rope", aliases: ["toy"], tags: ["toy"]}).category).toBe(
			"toy-and-game",
		);
	});

	it("uses inferred classification tags as cosmetic evidence without requiring authored tags", () => {
		expect(
			resolveItemIconWithInferredTags({name: "Toast", aliases: [], tags: []}, ["food"]),
		).toMatchObject({category: "food", reason: "single-field-match"});
		expect(
			resolveItemIconWithInferredTags({name: "Sardines", aliases: [], tags: []}, ["fish", "food"]),
		).toMatchObject({category: "meal", reason: "single-field-match"});
	});

	it("does not let inferred classifications act as icon overrides", () => {
		expect(
			resolveItemIconWithInferredTags({name: "Odd thing", tags: []}, ["icon:coin", "food"]),
		).toMatchObject({category: "food", reason: "single-field-match"});
		expect(
			resolveItemIconWithInferredTags({name: "Odd thing", tags: ["icon:coin"]}, ["food"]),
		).toMatchObject({category: "coin", reason: "manual-override"});
	});

	it("counts an alias collection once rather than treating repetition as votes", () => {
		const result = resolveItemIcon({
			name: "rope",
			aliases: ["toy", "toy", "toy"],
			tags: [],
		});

		expect(result.category).toBe("rope");
		expect(result.evidence).toHaveLength(1);
	});

	it("lets compatible parent evidence corroborate an explicitly discovered child", () => {
		const result = resolveItemIcon({
			name: "Ancient spellbook",
			aliases: ["old book"],
			tags: ["magic"],
		});

		expect(result.category).toBe("spellbook");
		expect(result.evidence).toEqual([
			expect.objectContaining({source: "name", relationship: "direct", term: "spellbook"}),
			expect.objectContaining({source: "aliases", relationship: "ancestor", term: "book"}),
			expect.objectContaining({source: "tags", relationship: "ancestor", term: "magic"}),
		]);
	});

	it("prefers a more specific physical category when corroboration is tied", () => {
		const result = resolveItemIcon({
			name: "Golden treasure chest",
			aliases: [],
			tags: ["container", "treasure"],
		});

		expect(result.category).toBe("chest");
	});

	it("ignores non-visual behavior tags and falls back to generic", () => {
		const result = resolveItemIcon({
			name: "Odd brass object",
			aliases: [],
			tags: ["takeable", "openable", "surface", "goal-item"],
		});

		expect(result).toMatchObject({category: "generic", reason: "fallback", evidence: []});
	});

	it.each(["royal", "precious", "magical", "decorative", "natural", "dead", "glow", "offensive"])(
		"does not let the descriptor %s create an icon by itself",
		(descriptor) => {
			expect(
				resolveItemIcon({name: descriptor, aliases: [descriptor], tags: [descriptor]}),
			).toMatchObject({category: "generic", reason: "fallback"});
		},
	);

	it("uses descriptors to corroborate an identity that was discovered elsewhere", () => {
		const result = resolveItemIcon({name: "crown", aliases: ["royal"], tags: ["wearable"]});

		expect(result.category).toBe("regalia");
		expect(result.reason).toBe("corroborated-match");
		expect(result.evidence).toEqual([
			expect.objectContaining({source: "name", termKind: "identity"}),
			expect.objectContaining({source: "aliases", termKind: "descriptor"}),
			expect.objectContaining({source: "tags", relationship: "ancestor"}),
		]);
	});

	it("never lets any catalog descriptor initiate a candidate", () => {
		for (const definition of ITEM_ICON_CATALOG) {
			for (const descriptor of definition.descriptorTerms ?? []) {
				expect(
					resolveItemIcon({name: descriptor, aliases: [descriptor], tags: [descriptor]}),
				).toMatchObject({category: "generic", reason: "fallback"});
			}
		}
	});

	it("matches whole words and phrases rather than substrings", () => {
		expect(resolveItemIcon({name: "A delicate bookend"}).category).toBe("generic");
		expect(resolveItemIcon({name: "A book of maps"}).category).toBe("book");
	});

	it("uses a valid dedicated override before automatic evidence", () => {
		const result = resolveItemIcon({
			name: "Iron sword",
			aliases: ["blade"],
			tags: ["weapon"],
			iconCategory: "coin",
		});

		expect(result).toMatchObject({category: "coin", reason: "manual-override", warnings: []});
	});

	it("supports legacy icon tags and reports conflicting overrides", () => {
		const result = resolveItemIcon({
			name: "Iron sword",
			tags: ["icon:knife", "icon:coin"],
		});

		expect(result.category).toBe("knife");
		expect(result.warnings).toContainEqual({
			code: "multiple-overrides",
			value: "knife, coin",
		});
	});

	it("reports an invalid override and continues automatic matching", () => {
		const result = resolveItemIcon({name: "Iron sword", tags: ["icon:not-real", "weapon"]});

		expect(result.category).toBe("blade");
		expect(result.warnings).toContainEqual({code: "invalid-override", value: "not-real"});
	});

	it("gives the dedicated override precedence over a conflicting compatibility tag", () => {
		const result = resolveItemIcon({
			name: "Iron sword",
			iconCategory: "treasure",
			tags: ["icon:knife"],
		});

		expect(result.category).toBe("treasure");
		expect(result.warnings).toContainEqual({
			code: "multiple-overrides",
			value: "treasure, knife",
		});
	});

	it("normalizes override spelling and does not warn for repeated equivalent overrides", () => {
		const result = resolveItemIcon({
			iconCategory: "Thread_and Sewing",
			tags: ["icon:thread-and-sewing"],
		});

		expect(result).toMatchObject({
			category: "thread-and-sewing",
			reason: "manual-override",
			warnings: [],
		});
	});

	it("reports an empty compatibility override", () => {
		const result = resolveItemIcon({name: "iron sword", tags: ["icon:"]});

		expect(result.category).toBe("blade");
		expect(result.warnings).toContainEqual({code: "invalid-override", value: ""});
	});

	it("accepts absent, null, empty, and whitespace-only fields", () => {
		for (const input of [
			{},
			{name: null, aliases: null, tags: null},
			{name: "", aliases: [], tags: []},
			{name: "   ", aliases: [""], tags: ["   "]},
		]) {
			expect(resolveItemIcon(input)).toMatchObject({category: "generic", reason: "fallback"});
		}
	});

	it("does not let parent evidence invent a child category", () => {
		const result = resolveItemIcon({name: "book", aliases: ["magic"], tags: ["magic"]});

		expect(result.category).toBe("magic");
		expect(result.alternatives.map((candidate) => candidate.category)).not.toContain("spellbook");
	});

	it("is independent of alias and tag order", () => {
		const forward = resolveItemIcon({
			name: "rope toy",
			aliases: ["rope", "toy", "plaything"],
			tags: ["tool", "toy"],
		});
		const reversed = resolveItemIcon({
			name: "rope toy",
			aliases: ["plaything", "toy", "rope"],
			tags: ["toy", "tool"],
		});

		expect(reversed.category).toBe(forward.category);
		expect(reversed.reason).toBe(forward.reason);
		expect(reversed.evidence.map((entry) => entry.source)).toEqual(
			forward.evidence.map((entry) => entry.source),
		);
	});

	it.each([
		["royal scroll", "document"],
		["stone idol", "shrine-and-altar"],
		["oil drum", "barrel"],
		["hand drum", "percussion"],
		["animal pen", "cage"],
		["fountain pen", "writing-tool"],
		["magic sword", "blade"],
		["treasure chest", "chest"],
		["gold ring", "jewelry"],
		["ritual knife", "knife"],
		["crystal ball", "orb"],
		["alarm bell", "bell-and-chime"],
	] as const)("resolves ambiguous physical language in %s", (name, category) => {
		expect(resolveItemIcon({name}).category).toBe(category);
	});

	it.each([
		["rusted halberd", "weapon"],
		["wax candle", "light"],
		["royal scroll", "document"],
		["wrapped corpse", "remains"],
		["stone idol", "shrine-and-altar"],
		["cut gem", "treasure"],
		["carved rune", "magic"],
	] as const)("keeps folded vocabulary available for %s", (name, category) => {
		expect(resolveItemIcon({name}).category).toBe(category);
	});

	it("normalizes accents, punctuation, and hyphens consistently", () => {
		expect(normalizeItemIconTerm("  ÉGG—and-Nest  ")).toBe("egg and nest");
		expect(resolveItemIcon({name: "A MORNING-STAR"}).category).toBe("blunt-weapon");
	});
});

describe("item icon catalog invariants", () => {
	it("contains exactly 100 unique categories with valid parents", () => {
		expect(ITEM_ICON_CATEGORIES).toHaveLength(100);
		expect(new Set(ITEM_ICON_CATEGORIES).size).toBe(100);
		const categories = new Set(ITEM_ICON_CATEGORIES);
		for (const definition of ITEM_ICON_CATALOG) {
			for (const parent of definition.parents) expect(categories.has(parent)).toBe(true);
		}
	});

	it("contains no duplicate term within one category and no parent cycles", () => {
		const definitions = new Map(ITEM_ICON_CATALOG.map((entry) => [entry.id, entry] as const));
		for (const definition of ITEM_ICON_CATALOG) {
			const normalizedTerms = [
				...definition.identityTerms,
				...definition.categoryTerms,
				...(definition.descriptorTerms ?? []),
			].map(normalizeItemIconTerm);
			expect(normalizedTerms).not.toContain("");
			expect(new Set(normalizedTerms).size).toBe(normalizedTerms.length);

			const visit = (category: string, path: Set<string>) => {
				expect(path.has(category)).toBe(false);
				const nextPath = new Set(path).add(category);
				for (const parent of definitions.get(category as never)?.parents ?? []) {
					visit(parent, nextPath);
				}
			};
			visit(definition.id, new Set());
		}
	});

	it("keeps every non-generic category automatically reachable through its primary term", () => {
		for (const definition of ITEM_ICON_CATALOG) {
			if (definition.id === "generic") continue;
			const primaryTerm = definition.identityTerms[0] ?? definition.categoryTerms[0];
			expect(primaryTerm).toBeDefined();
			expect(
				resolveItemIcon({name: primaryTerm, aliases: [primaryTerm], tags: [primaryTerm]}).category,
			).toBe(definition.id);
		}
	});

	it("resolves every primary term from each evidence field independently", () => {
		for (const definition of ITEM_ICON_CATALOG) {
			if (definition.id === "generic") continue;
			const primaryTerm = definition.identityTerms[0] ?? definition.categoryTerms[0];
			for (const input of [{name: primaryTerm}, {aliases: [primaryTerm]}, {tags: [primaryTerm]}]) {
				expect(resolveItemIcon(input).category).toBe(definition.id);
			}
		}
	});

	it("lets every child use its parent fields as corroboration without losing its identity", () => {
		const definitions = new Map(ITEM_ICON_CATALOG.map((entry) => [entry.id, entry] as const));
		for (const definition of ITEM_ICON_CATALOG) {
			const parentId = definition.parents[0];
			if (!parentId) continue;
			const parent = definitions.get(parentId);
			if (!parent) continue;
			const childTerm = definition.identityTerms[0] ?? definition.categoryTerms[0];
			const parentTerm = parent.identityTerms[0] ?? parent.categoryTerms[0];
			const result = resolveItemIcon({
				name: childTerm,
				aliases: [parentTerm],
				tags: [parentTerm],
			});
			expect(result.category).toBe(definition.id);
			expect(result.reason).toBe("corroborated-match");
		}
	});

	it("never returns more than one piece of evidence per independent field", () => {
		for (const definition of ITEM_ICON_CATALOG) {
			const term = definition.identityTerms[0] ?? definition.categoryTerms[0] ?? "unknown";
			const result = resolveItemIcon({
				name: `${term} ${term}`,
				aliases: [term, term, term],
				tags: [term, term, term],
			});
			expect(result.evidence.length).toBeLessThanOrEqual(3);
			expect(new Set(result.evidence.map((entry) => entry.source)).size).toBe(result.evidence.length);
		}
	});
});
