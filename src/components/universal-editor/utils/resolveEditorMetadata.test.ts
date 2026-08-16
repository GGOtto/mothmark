import type {ObjectFieldMetadata} from "@/components/universal-editor/ObjectEditor";
import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ItemLocationSchema, ItemSchema} from "@/schemas/world/itemSchema";
import {ConnectionSchema, RoomSchema} from "@/schemas/world/roomSchema";
import {CompassDirectionSchema, DirectionSchema} from "@/schemas/world/directionSchema";
import {DirectionBlockSchema} from "@/schemas/world/commandSchemas";
import {resolveEditorMetadata} from "./resolveEditorMetadata";

function getObjectFields(schema: z.ZodTypeAny) {
	const metadata = resolveEditorMetadata(schema);
	return metadata.features?.fields as ObjectFieldMetadata[];
}

function getFieldGroups(schema: z.ZodTypeAny) {
	return Object.fromEntries(
		getObjectFields(schema).map((field) => [field.key, field.metadata.layout?.group]),
	);
}

describe("resolveEditorMetadata object fields", () => {
	it("uses purpose-built controls for single and multiple direction fields", () => {
		const fullDirection = resolveEditorMetadata(DirectionSchema);
		const compassDirection = resolveEditorMetadata(CompassDirectionSchema);
		const allowedDirections = getObjectFields(DirectionBlockSchema).find(
			(field) => field.key === "allowed",
		);

		expect(fullDirection).toMatchObject({
			type: "direction-picker",
			features: {options: expect.arrayContaining([expect.objectContaining({value: "out"})])},
		});
		expect(compassDirection).toMatchObject({
			type: "direction-picker",
			features: {options: expect.not.arrayContaining([expect.objectContaining({value: "out"})])},
		});
		expect(allowedDirections?.metadata).toMatchObject({
			type: "direction-multi-picker",
			features: {
				options: expect.arrayContaining([
					expect.objectContaining({value: "n"}),
					expect.objectContaining({value: "out"}),
				]),
			},
		});
	});

	it("treats fields without explicit control metadata as hidden", () => {
		const fields = getObjectFields(z.object({plainField: z.string()}));

		expect(fields[0].metadata.title).toBeUndefined();
		expect(fields[0].metadata.description).toBeUndefined();
		expect(fields[0].metadata.type).toBe("hidden");
	});

	it("renders a field when its control is supplied by parent metadata", () => {
		const schema = editor.object(
			{plainField: z.string()},
			{
				childControls: {plainField: {control: "text"}},
			},
		);

		expect(getObjectFields(schema)[0].metadata.type).toBe("text");
	});

	it("does not expose Zod describe blocks as control descriptions", () => {
		const described = resolveEditorMetadata(z.string().describe("Schema documentation only"));
		const editorDescribed = resolveEditorMetadata(
			editor.input({description: "Explicit editor help text"}).describe("Schema documentation only"),
		);

		expect(described.description).toBeUndefined();
		expect(editorDescribed.description).toBe("Explicit editor help text");
	});

	it("merges childControls before sorting object fields", () => {
		const schema = editor.object(
			{
				a: editor.input({
					title: "A",
					layout: {
						width: "half",
					},
				}),
				b: editor.input({
					title: "B",
					layout: {
						order: 1,
					},
				}),
				c: editor.input({
					title: "C",
				}),
			},
			{
				childControls: {
					a: {
						layout: {
							order: 2,
						},
					},
				},
			},
		);

		const fields = getObjectFields(schema);

		expect(fields.map((field) => field.key)).toEqual(["b", "a", "c"]);
		expect(fields[1].metadata.layout).toEqual({
			width: "half",
			order: 2,
		});
	});

	it("applies the recommended room authoring field order", () => {
		const fields = getObjectFields(RoomSchema);

		expect(fields.map((field) => field.key)).toEqual([
			"name",
			"description",
			"descriptionFragments",
			"shortDescription",
			"aliases",
			"tags",
			"flags",
			"id",
			"metadata",
		]);
		expect(fields.at(-1)?.metadata).toMatchObject({
			type: "hidden",
		});
	});

	it("exposes the room's schema-defined sections and field groups", () => {
		const metadata = resolveEditorMetadata(RoomSchema);

		expect(metadata.features?.groups).toEqual([
			expect.objectContaining({id: "details", title: "Player-facing text", order: 10}),
			expect.objectContaining({id: "state", title: "State", order: 30}),
			expect.objectContaining({
				id: "advanced",
				title: "Advanced",
				order: 100,
				importance: "internal",
			}),
		]);
		expect(getFieldGroups(RoomSchema)).toMatchObject({
			id: "advanced",
			name: "details",
			description: "details",
			shortDescription: "details",
			aliases: "identify",
			tags: "identify",
			flags: "state",
		});
	});

	it("exposes the connection's independently ordered sections and field groups", () => {
		const metadata = resolveEditorMetadata(ConnectionSchema);
		const direction = getObjectFields(ConnectionSchema).find((field) => field.key === "direction");
		const returnDirection = getObjectFields(ConnectionSchema).find(
			(field) => field.key === "returnDirection",
		);

		expect(metadata.features?.layout).toBe("section");
		expect(direction?.metadata).toMatchObject({
			type: "direction-picker",
			features: {
				options: expect.arrayContaining([
					expect.objectContaining({label: "North", value: "n"}),
					expect.objectContaining({label: "In", value: "in"}),
					expect.objectContaining({label: "Out", value: "out"}),
				]),
			},
		});
		expect(returnDirection?.metadata.type).toBe("direction-picker");
		expect(getFieldGroups(ConnectionSchema)).toMatchObject({
			id: "details",
			name: "details",
			fromRoomId: "route",
			toRoomId: "route",
			direction: "route",
			returnDirection: "route",
			pathway: "route",
		});
	});

	it("applies the item authoring field order", () => {
		const fields = getObjectFields(ItemSchema);

		expect(fields.map((field) => field.key)).toEqual([
			"id",
			"presentation",
			"behaviors",
			"initialState",
			"name",
			"examine",
			"aliases",
			"tags",
		]);
		expect(fields[0].metadata).toMatchObject({
			type: "hidden",
		});
	});

	it("derives discriminated-union branches from the item location schema", () => {
		const metadata = resolveEditorMetadata(ItemLocationSchema);
		expect(metadata.features).toMatchObject({
			discriminator: "type",
			options: expect.arrayContaining([
				expect.objectContaining({label: "In a room", value: "room"}),
				expect.objectContaining({label: "In or on an item", value: "item"}),
			]),
		});
	});

	it("applies the recommended connection authoring field order", () => {
		const fields = getObjectFields(ConnectionSchema);

		expect(fields.map((field) => field.key)).toEqual([
			"id",
			"name",
			"fromRoomId",
			"toRoomId",
			"direction",
			"returnDirection",
			"pathway",
			"metadata",
		]);
		expect(fields[0].metadata).toMatchObject({
			type: "hidden",
		});
	});
});
