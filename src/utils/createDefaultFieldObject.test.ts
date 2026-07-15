import {z} from "zod";
import {createDefaultFieldObject} from "./createDefaultFieldObject";

describe("createDefaultFieldObject", () => {
	describe("primitive schemas", () => {
		it("creates defaults for strings", () => {
			expect(createDefaultFieldObject(z.string())).toBe("");
		});

		it("creates defaults for numbers", () => {
			expect(createDefaultFieldObject(z.number())).toBe(0);
		});

		it("creates defaults for ints", () => {
			expect(createDefaultFieldObject(z.int())).toBe(0);
		});

		it("creates defaults for booleans", () => {
			expect(createDefaultFieldObject(z.boolean())).toBe(false);
		});

		it("creates defaults for bigints", () => {
			expect(createDefaultFieldObject(z.bigint())).toBe(BigInt(0));
		});

		it("creates defaults for dates", () => {
			expect(createDefaultFieldObject(z.date())).toEqual(new Date(0));
		});

		it("creates defaults for literals", () => {
			expect(createDefaultFieldObject(z.literal("room"))).toBe("room");
			expect(createDefaultFieldObject(z.literal(12))).toBe(12);
			expect(createDefaultFieldObject(z.literal(false))).toBe(false);
		});

		it("creates defaults for enums using the first option", () => {
			expect(createDefaultFieldObject(z.enum(["draft", "published", "archived"]))).toBe("draft");
		});

		it("returns undefined for unknown-ish schemas", () => {
			expect(createDefaultFieldObject(z.any())).toBeUndefined();
			expect(createDefaultFieldObject(z.unknown())).toBeUndefined();
			expect(createDefaultFieldObject(z.undefined())).toBeUndefined();
			expect(createDefaultFieldObject(z.void())).toBeUndefined();
			expect(createDefaultFieldObject(z.never())).toBeUndefined();
		});

		it("creates null for z.null", () => {
			expect(createDefaultFieldObject(z.null())).toBeNull();
		});

		it("creates NaN for z.nan", () => {
			expect(Number.isNaN(createDefaultFieldObject(z.nan()))).toBe(true);
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

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(schema)).toEqual({
				id: "",
			});
		});

		it("does not include nullable fields because they are non-required", () => {
			const schema = z.object({
				id: z.string(),
				note: z.string().nullable(),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				id: "",
			});
		});

		it("does not include nullish fields", () => {
			const schema = z.object({
				id: z.string(),
				note: z.string().nullish(),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				id: "",
			});
		});

		it("does not include catch fields", () => {
			const schema = z.object({
				id: z.string(),
				count: z.number().catch(5),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				id: "",
			});
		});

		it("includes default fields when useZodDefaults is true", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string().default("Untitled"),
				count: z.number().default(7),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(schema, {useZodDefaults: false})).toEqual({
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

			expect(createDefaultFieldObject(schema)).toEqual({
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
		it("creates one default item for primitive arrays", () => {
			expect(createDefaultFieldObject(z.array(z.string()))).toEqual([""]);
			expect(createDefaultFieldObject(z.array(z.number()))).toEqual([0]);
			expect(createDefaultFieldObject(z.array(z.boolean()))).toEqual([false]);
		});

		it("creates one default item for object arrays", () => {
			const schema = z.array(
				z.object({
					id: z.string(),
					name: z.string(),
					hidden: z.boolean().optional(),
				}),
			);

			expect(createDefaultFieldObject(schema)).toEqual([
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

			expect(createDefaultFieldObject(schema)).toEqual([
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

			expect(createDefaultFieldObject(schema, {populateArrays: false})).toEqual({
				rooms: [],
			});
		});

		it("does not add an array item when item default resolves to undefined", () => {
			expect(createDefaultFieldObject(z.array(z.optional(z.string())))).toEqual([]);
			expect(createDefaultFieldObject(z.array(z.unknown()))).toEqual([]);
		});
	});

	describe("tuples", () => {
		it("creates defaults for tuple items", () => {
			const schema = z.tuple([z.string(), z.number(), z.boolean()]);

			expect(createDefaultFieldObject(schema)).toEqual(["", 0, false]);
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

			expect(createDefaultFieldObject(schema)).toEqual([
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
			expect(createDefaultFieldObject(z.record(z.string(), z.number()))).toEqual({});
		});

		it("creates empty maps", () => {
			const result = createDefaultFieldObject(z.map(z.string(), z.number()));

			expect(result).toBeInstanceOf(Map);
			expect(result.size).toBe(0);
		});

		it("creates empty sets", () => {
			const result = createDefaultFieldObject(z.set(z.string()));

			expect(result).toBeInstanceOf(Set);
			expect(result.size).toBe(0);
		});
	});

	describe("unions", () => {
		it("uses the first union option that can create a value", () => {
			const schema = z.union([z.string(), z.number()]);

			expect(createDefaultFieldObject(schema)).toBe("");
		});

		it("skips undefined-producing union options", () => {
			const schema = z.union([z.undefined(), z.object({id: z.string()})]);

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(schema)).toEqual({
				id: "",
				name: "",
				active: false,
				count: 0,
			});
		});

		it("prefers the right value for non-object intersections when available", () => {
			const schema = z.intersection(z.literal("left"), z.literal("right"));

			expect(createDefaultFieldObject(schema)).toBe("right");
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

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(TreeSchema, {maxDepth: 4})).toEqual({
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

			expect(createDefaultFieldObject(NodeSchema, {maxDepth: 1})).toEqual({});
		});
	});

	describe("metadata from .meta()", () => {
		it("copies concrete metadata values", () => {
			const schema = z.string().meta({
				title: "Name",
				description: "The display name.",
				control: "text",
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				title: "Name",
				description: "The display name.",
				control: "text",
			});
		});

		it("creates recursive defaults from metadata zod schemas", () => {
			const schema = z.string().meta({
				editor: z.object({
					title: z.string(),
					collapsed: z.boolean(),
					priority: z.number(),
				}),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					title: "",
					collapsed: false,
					priority: 0,
				},
			});
		});

		it("merges object schema defaults with metadata defaults", () => {
			const schema = z
				.object({
					id: z.string(),
					name: z.string(),
				})
				.meta({
					editor: z.object({
						title: z.string(),
						collapsed: z.boolean(),
					}),
				});

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					title: "",
					collapsed: false,
				},
				id: "",
				name: "",
			});
		});

		it("lets actual object fields win over metadata keys when keys collide", () => {
			const schema = z
				.object({
					title: z.string(),
				})
				.meta({
					title: "Metadata Title",
				});

			expect(createDefaultFieldObject(schema)).toEqual({
				title: "",
			});
		});

		it("skips optional fields inside metadata zod schemas", () => {
			const schema = z.string().meta({
				editor: z.object({
					title: z.string(),
					description: z.string().optional(),
					expanded: z.boolean().optional(),
				}),
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					title: "",
				},
			});
		});

		it("handles nested plain metadata objects containing zod schemas", () => {
			const schema = z.string().meta({
				editor: {
					header: {
						title: z.string(),
						count: z.number(),
						optionalNote: z.string().optional(),
					},
				},
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					header: {
						title: "",
						count: 0,
					},
				},
			});
		});

		it("handles arrays inside metadata", () => {
			const schema = z.string().meta({
				editor: {
					tabs: [
						z.object({
							label: z.string(),
							active: z.boolean(),
						}),
						"static-tab",
					],
				},
			});

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					tabs: [
						{
							label: "",
							active: false,
						},
						"static-tab",
					],
				},
			});
		});

		it("does not mutate metadata objects", () => {
			const meta = {
				editor: z.object({
					title: z.string(),
				}),
			};

			const schema = z.string().meta(meta);

			createDefaultFieldObject(schema);

			expect(meta).toEqual({
				editor: expect.any(z.ZodObject),
			});
		});
	});

	describe("effects, transforms, pipes, and readonly", () => {
		it("handles pipes by using the input schema", () => {
			const schema = z.string().pipe(z.string().min(1));

			expect(createDefaultFieldObject(schema)).toBe("");
		});

		it("returns undefined for transforms that cannot be safely defaulted", () => {
			const schema = z.string().transform((value) => value.length);

			expect(createDefaultFieldObject(schema)).toBeUndefined();
		});

		it("handles readonly by using the inner schema", () => {
			const schema = z.object({id: z.string()}).readonly();

			expect(createDefaultFieldObject(schema)).toEqual({
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

			expect(createDefaultFieldObject(WorldSchema)).toEqual({
				id: "",
				title: "",
				rooms: [
					{
						editor: {
							title: "",
							collapsible: false,
							priority: 0,
						},
						id: "",
						name: "",
						description: {
							editor: {
								title: "",
								icon: "",
								order: 0,
							},
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
							editor: {
								title: "",
								icon: "",
								order: 0,
							},
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

			expect(() => createDefaultFieldObject(schema)).not.toThrow();

			expect(createDefaultFieldObject(schema)).toEqual({
				editor: {
					control: "entity-editor",
					panel: {
						title: "",
						open: false,
					},
				},
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

			const value = createDefaultFieldObject(schema);

			expect(() => schema.parse(value)).not.toThrow();
		});

		it("does not guarantee parse success for schemas with impossible constraints", () => {
			const schema = z.object({
				name: z.string().min(1),
			});

			const value = createDefaultFieldObject(schema);

			expect(value).toEqual({
				name: "",
			});

			expect(() => schema.parse(value)).toThrow();
		});
	});
});
