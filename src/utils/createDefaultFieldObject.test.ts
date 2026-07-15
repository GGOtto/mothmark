import {z} from "zod";
import {createDefaultFieldObject} from "./createDefaultFieldObject";

function createDefaultFieldObjectWithLegacyDefaults<TSchema extends z.ZodType>(
	schema: TSchema,
	options: Parameters<typeof createDefaultFieldObject>[1] = {},
): z.infer<TSchema> {
	return createDefaultFieldObject(schema, {
		populateArrays: true,
		...options,
	});
}

describe("createDefaultFieldObject", () => {
	describe("default options", () => {
		it("does not populate arrays", () => {
			expect(createDefaultFieldObject(z.array(z.string()))).toEqual([]);
		});

		it("does not include ordinary schema metadata", () => {
			expect(createDefaultFieldObject(z.string().meta({title: "Name"}))).toBe("");
		});
	});

	describe("primitive schemas", () => {
		it("creates defaults for strings", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.string())).toBe("");
		});

		it("creates defaults for numbers", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.number())).toBe(0);
		});

		it("creates defaults for ints", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.int())).toBe(0);
		});

		it("creates defaults for booleans", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.boolean())).toBe(false);
		});

		it("creates defaults for bigints", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.bigint())).toBe(BigInt(0));
		});

		it("creates defaults for dates", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.date())).toEqual(new Date(0));
		});

		it("creates defaults for literals", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.literal("room"))).toBe("room");
			expect(createDefaultFieldObjectWithLegacyDefaults(z.literal(12))).toBe(12);
			expect(createDefaultFieldObjectWithLegacyDefaults(z.literal(false))).toBe(false);
		});

		it("creates defaults for enums using the first option", () => {
			expect(
				createDefaultFieldObjectWithLegacyDefaults(z.enum(["draft", "published", "archived"])),
			).toBe("draft");
		});

		it("returns undefined for unknown-ish schemas", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.any())).toBeUndefined();
			expect(createDefaultFieldObjectWithLegacyDefaults(z.unknown())).toBeUndefined();
			expect(createDefaultFieldObjectWithLegacyDefaults(z.undefined())).toBeUndefined();
			expect(createDefaultFieldObjectWithLegacyDefaults(z.void())).toBeUndefined();
			expect(createDefaultFieldObjectWithLegacyDefaults(z.never())).toBeUndefined();
		});

		it("creates null for z.null", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.null())).toBeNull();
		});

		it("creates NaN for z.nan", () => {
			expect(Number.isNaN(createDefaultFieldObjectWithLegacyDefaults(z.nan()))).toBe(true);
		});
	});

	describe("object schemas", () => {
		it("fills required object fields recursively", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string(),
				position: z.object({
					x: z.number(),
					y: z.number(),
				}),
				visible: z.boolean(),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
				name: "",
				position: {
					x: 0,
					y: 0,
				},
				visible: false,
			});
		});

		it("does not include optional fields", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string().optional(),
				description: z.string().optional(),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});

		it("does not include nullable fields because they are non-required", () => {
			const schema = z.object({
				id: z.string(),
				note: z.string().nullable(),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});

		it("does not include nullish fields", () => {
			const schema = z.object({
				id: z.string(),
				note: z.string().nullish(),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});

		it("does not include catch fields", () => {
			const schema = z.object({
				id: z.string(),
				count: z.number().catch(5),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});

		it("includes default fields when useZodDefaults is true", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string().default("Untitled"),
				count: z.number().default(7),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
				name: "Untitled",
				count: 7,
			});
		});

		it("skips default fields when useZodDefaults is false", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string().default("Untitled"),
				count: z.number().default(7),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema, {useZodDefaults: false})).toEqual({
				id: "",
			});
		});

		it("handles deeply nested required objects", () => {
			const schema = z.object({
				world: z.object({
					region: z.object({
						room: z.object({
							name: z.string(),
							state: z.object({
								visited: z.boolean(),
								lightLevel: z.number(),
							}),
						}),
					}),
				}),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				world: {
					region: {
						room: {
							name: "",
							state: {
								visited: false,
								lightLevel: 0,
							},
						},
					},
				},
			});
		});
	});

	describe("arrays", () => {
		it("populates an array through an empty Zod default when requested", () => {
			expect(
				createDefaultFieldObject(z.array(z.string()).default([]), {populateArrays: true}),
			).toEqual([""]);
		});

		it("preserves a non-empty Zod array default", () => {
			expect(
				createDefaultFieldObject(z.array(z.string()).default(["existing"]), {
					populateArrays: true,
				}),
			).toEqual(["existing"]);
		});

		it("creates one default item for primitive arrays", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.array(z.string()))).toEqual([""]);
			expect(createDefaultFieldObjectWithLegacyDefaults(z.array(z.number()))).toEqual([0]);
			expect(createDefaultFieldObjectWithLegacyDefaults(z.array(z.boolean()))).toEqual([false]);
		});

		it("creates one default item for object arrays", () => {
			const schema = z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					hidden: z.boolean().optional(),
				}),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual([
				{
					id: "",
					name: "",
				},
			]);
		});

		it("creates nested array defaults recursively", () => {
			const schema = z.array(
				z.array(
					z.object({
						value: z.number(),
					}),
				),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual([
				[
					{
						value: 0,
					},
				],
			]);
		});

		it("can disable array population", () => {
			const schema = z.object({
				rooms: z.array(
					z.object({
						id: z.string(),
					}),
				),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(schema, {populateArrays: false})).toEqual({
				rooms: [],
			});
		});

		it("does not add an array item when item default resolves to undefined", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.array(z.optional(z.string())))).toEqual([]);
			expect(createDefaultFieldObjectWithLegacyDefaults(z.array(z.unknown()))).toEqual([]);
		});
	});

	describe("tuples", () => {
		it("creates defaults for tuple items", () => {
			const schema = z.tuple([z.string(), z.number(), z.boolean()]);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual(["", 0, false]);
		});

		it("handles object tuple items", () => {
			const schema = z.tuple([
				z.object({
					id: z.string(),
				}),
				z.object({
					count: z.number(),
				}),
			]);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual([
				{
					id: "",
				},
				{
					count: 0,
				},
			]);
		});
	});

	describe("records, maps, and sets", () => {
		it("creates empty records", () => {
			expect(createDefaultFieldObjectWithLegacyDefaults(z.record(z.string(), z.number()))).toEqual({});
		});

		it("creates empty maps", () => {
			const result = createDefaultFieldObjectWithLegacyDefaults(z.map(z.string(), z.number()));

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(0);
		});

		it("creates empty sets", () => {
			const result = createDefaultFieldObjectWithLegacyDefaults(z.set(z.string()));

			expect(result).toBeInstanceOf(Set);
			expect(result.size).toBe(0);
		});
	});

	describe("unions", () => {
		it("uses the first union option that can create a value", () => {
			const schema = z.union([z.string(), z.number()]);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toBe("");
		});

		it("skips undefined-producing union options", () => {
			const schema = z.union([z.undefined(), z.object({id: z.string()})]);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});

		it("creates defaults for discriminated unions using the first object option", () => {
			const schema = z.discriminatedUnion("type", [
				z.object({
					type: z.literal("room"),
					id: z.string(),
					name: z.string(),
				}),
				z.object({
					type: z.literal("item"),
					id: z.string(),
					weight: z.number(),
				}),
			]);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				type: "room",
				id: "",
				name: "",
			});
		});
	});

	describe("intersections", () => {
		it("merges object intersections", () => {
			const schema = z.intersection(
				z.object({
					id: z.string(),
					name: z.string(),
				}),
				z.object({
					active: z.boolean(),
					count: z.number(),
				}),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
				name: "",
				active: false,
				count: 0,
			});
		});

		it("prefers the right value for non-object intersections when available", () => {
			const schema = z.intersection(z.literal("left"), z.literal("right"));

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toBe("right");
		});
	});

	describe("lazy and recursive schemas", () => {
		it("handles lazy schemas", () => {
			const schema = z.lazy(() =>
				z.object({
					id: z.string(),
					name: z.string(),
				}),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
				name: "",
			});
		});

		it("does not infinite-loop on recursive lazy schemas", () => {
			type Tree = {
				name: string;
				children: Tree[];
			};

			const TreeSchema: z.ZodType<Tree> = z.lazy(() =>
				z.object({
					name: z.string(),
					children: z.array(TreeSchema),
				}),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(TreeSchema, {maxDepth: 4})).toEqual({
				name: "",
				children: [
					{
						name: "",
						children: [],
					},
				],
			});
		});

		it("returns a shallower object when maxDepth is low", () => {
			type Node = {
				id: string;
				child?: Node;
			};

			const NodeSchema: z.ZodType<Node> = z.lazy(() =>
				z.object({
					id: z.string(),
					child: NodeSchema.optional(),
				}),
			);

			expect(createDefaultFieldObjectWithLegacyDefaults(NodeSchema, {maxDepth: 1})).toEqual({});
		});
	});

	describe("defaultFieldValue metadata", () => {
		it("uses a concrete defaultFieldValue value", () => {
			const schema = z.string().meta({defaultFieldValue: "New field"});

			expect(createDefaultFieldObject(schema)).toBe("New field");
		});

		it("creates a default from a defaultFieldValue schema", () => {
			const schema = z.string().meta({
				defaultFieldValue: z.object({title: z.string(), enabled: z.boolean()}),
			});

			expect(createDefaultFieldObject(schema)).toEqual({title: "", enabled: false});
		});

		it("allows defaultFieldValue to explicitly produce undefined", () => {
			const schema = z.string().meta({defaultFieldValue: undefined});

			expect(createDefaultFieldObject(schema)).toBeUndefined();
		});

		it("ignores all other metadata", () => {
			const schema = z.string().meta({title: "Name", editor: {control: "text"}});

			expect(createDefaultFieldObject(schema)).toBe("");
		});
	});

	describe("effects, transforms, pipes, and readonly", () => {
		it("handles pipes by using the input schema", () => {
			const schema = z.string().pipe(z.string().min(1));

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toBe("");
		});

		it("returns undefined for transforms that cannot be safely defaulted", () => {
			const schema = z.string().transform((value) => value.length);

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toBeUndefined();
		});

		it("handles readonly by using the inner schema", () => {
			const schema = z.object({id: z.string()}).readonly();

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
			});
		});
	});

	describe("realistic editor/world schema stress cases", () => {
		it("creates a default for a complex world-like schema", () => {
			const DirectionSchema = z.enum(["n", "s", "e", "w", "up", "down", "in", "out"]);

			const ConditionSchema = z.object({
				type: z.literal("flag"),
				flag: z.string(),
				operator: z.enum(["equals", "not-equals"]),
				value: z.boolean(),
			});

			const DescriptionSchema = z
				.object({
					text: z.string(),
					altText: z.string().optional(),
					when: z.array(ConditionSchema).optional(),
				})
				.meta({
					editor: z.object({
						title: z.string(),
						icon: z.string(),
						order: z.number(),
					}),
				});

			const ConnectionSchema = z.object({
				id: z.string(),
				fromRoomId: z.string(),
				toRoomId: z.string(),
				direction: DirectionSchema,
				locked: z.boolean(),
				description: DescriptionSchema,
			});

			const RoomSchema = z
				.object({
					id: z.string(),
					name: z.string(),
					description: DescriptionSchema,
					tags: z.array(z.string()),
					aliases: z.array(z.string()),
					position: z.object({
						x: z.number(),
						y: z.number(),
					}),
					internalNotes: z.string().optional(),
				})
				.meta({
					editor: z.object({
						title: z.string(),
						collapsible: z.boolean(),
						priority: z.number(),
					}),
				});

			const WorldSchema = z.object({
				id: z.string(),
				title: z.string(),
				rooms: z.array(RoomSchema),
				connections: z.array(ConnectionSchema),
				metadata: z.object({
					version: z.number(),
					draft: z.boolean(),
					author: z.string().optional(),
				}),
			});

			expect(createDefaultFieldObjectWithLegacyDefaults(WorldSchema)).toEqual({
				id: "",
				title: "",
				rooms: [
					{
						id: "",
						name: "",
						description: {
							text: "",
						},
						tags: [""],
						aliases: [""],
						position: {
							x: 0,
							y: 0,
						},
					},
				],
				connections: [
					{
						id: "",
						fromRoomId: "",
						toRoomId: "",
						direction: "n",
						locked: false,
						description: {
							text: "",
						},
					},
				],
				metadata: {
					version: 0,
					draft: false,
				},
			});
		});

		it("handles lots of schema features together without throwing", () => {
			const schema = z
				.object({
					id: z.string(),
					type: z.literal("entity"),
					status: z.enum(["draft", "ready", "archived"]),
					count: z.number().min(0).max(100),
					active: z.boolean(),
					tags: z.array(z.string()),
					position: z.tuple([z.number(), z.number()]),
					settings: z.object({
						visible: z.boolean(),
						label: z.string().optional(),
						retries: z.number().default(3),
					}),
					variant: z.union([
						z.object({
							kind: z.literal("a"),
							value: z.string(),
						}),
						z.object({
							kind: z.literal("b"),
							value: z.number(),
						}),
					]),
					extra: z.record(z.string(), z.unknown()),
					lookup: z.map(z.string(), z.number()),
					flags: z.set(z.string()),
				})
				.meta({
					editor: {
						control: "entity-editor",
						panel: z.object({
							title: z.string(),
							open: z.boolean(),
						}),
					},
				});

			expect(() => createDefaultFieldObjectWithLegacyDefaults(schema)).not.toThrow();

			expect(createDefaultFieldObjectWithLegacyDefaults(schema)).toEqual({
				id: "",
				type: "entity",
				status: "draft",
				count: 0,
				active: false,
				tags: [""],
				position: [0, 0],
				settings: {
					visible: false,
					retries: 3,
				},
				variant: {
					kind: "a",
					value: "",
				},
				extra: {},
				lookup: new Map(),
				flags: new Set(),
			});
		});
	});

	describe("schema result sanity", () => {
		it("creates a value that parses for normal required schemas", () => {
			const schema = z.object({
				id: z.string(),
				count: z.number(),
				active: z.boolean(),
				children: z.array(
					z.object({
						name: z.string(),
					}),
				),
			});

			const value = createDefaultFieldObjectWithLegacyDefaults(schema);

			expect(() => schema.parse(value)).not.toThrow();
		});

		it("does not guarantee parse success for schemas with impossible constraints", () => {
			const schema = z.object({
				name: z.string().min(1),
			});

			const value = createDefaultFieldObjectWithLegacyDefaults(schema);

			expect(value).toEqual({
				name: "",
			});

			expect(() => schema.parse(value)).toThrow();
		});
	});
});
