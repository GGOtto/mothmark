import type {ObjectFieldMetadata} from "@/components/universal-editor/ObjectEditor";
import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {DescriptionSchema} from "@/schemas/world/descriptionSchema";
import {ConnectionSchema, RoomFeatureSchema, RoomSchema} from "@/schemas/world/roomSchema";
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

	it("exposes schema-defined children to specialized object-backed controls", () => {
		const metadata = resolveEditorMetadata(DescriptionSchema);

		expect(metadata.childControls?.default).toMatchObject({
			control: "rich-text",
			title: "Description",
			description: "A default description with optional conditional variants.",
		});
		expect(metadata.childControls?.variants).toMatchObject({
			control: "array",
			title: "Description Variants",
			appearance: {
				chrome: "collapse",
				defaultCollapsed: true,
			},
		});
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
			"shortDescription",
			"aliases",
			"tags",
			"features",
			"activeWhen",
			"metadata",
			"id",
		]);
		expect(fields.at(-1)?.metadata).toMatchObject({
			type: "hidden",
		});
	});

	it("exposes the room's schema-defined sections and field groups", () => {
		const metadata = resolveEditorMetadata(RoomSchema);

		expect(metadata.features?.groups).toEqual([
			expect.objectContaining({id: "details", title: "Presentation", order: 10}),
			expect.objectContaining({id: "features", title: "Features", order: 30}),
			expect.objectContaining({
				id: "availability",
				title: "Availability",
				order: 40,
				defaultCollapsed: true,
			}),
		]);
		expect(getFieldGroups(RoomSchema)).toMatchObject({
			id: "details",
			name: "details",
			description: "details",
			shortDescription: "details",
			aliases: "identify",
			tags: "identify",
			features: "features",
			activeWhen: "availability",
		});
	});

	it("exposes the connection's independently ordered sections and field groups", () => {
		const metadata = resolveEditorMetadata(ConnectionSchema);

		expect(metadata.features?.groups).toEqual([
			expect.objectContaining({id: "route", title: "Route", order: 10}),
			expect.objectContaining({id: "details", title: "Details", order: 20}),
			expect.objectContaining({id: "messages", title: "Messages", order: 30}),
			expect.objectContaining({id: "availability", title: "Availability", order: 40}),
			expect.objectContaining({id: "state", title: "State", order: 50}),
		]);
		expect(getFieldGroups(ConnectionSchema)).toMatchObject({
			id: "details",
			name: "details",
			fromRoomId: "route",
			toRoomId: "route",
			direction: "route",
			returnDirection: "route",
			pathway: "route",
			aliases: "details",
			description: "messages",
			blockedMessage: "messages",
			visibleWhen: "availability",
			travelAllowedWhen: "availability",
			lockedWhen: "availability",
			state: "state",
		});
	});

	it("renders room features through the link-list editor", () => {
		const featureField = getObjectFields(RoomSchema).find((field) => field.key === "features");

		expect(featureField?.metadata.type).toBe("link-list");
		expect(featureField?.metadata.features).toMatchObject({
			mode: "edit",
			linkType: "editor",
			editorTarget: {
				kind: "entity",
				entityType: "feature",
				path: ["{sourcePath}", "{id}"],
			},
		});
	});

	it("applies the recommended room feature authoring field order", () => {
		const fields = getObjectFields(RoomFeatureSchema);

		expect(fields.map((field) => field.key)).toEqual([
			"id",
			"name",
			"kind",
			"description",
			"aliases",
			"tags",
			"listedInRoom",
			"activeWhen",
			"visibleWhen",
			"usableWhen",
			"examineSetsFlag",
			"capacity",
			"initialItems",
			"state",
		]);
		expect(fields[0].metadata).toMatchObject({
			type: "hidden",
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
			"aliases",
			"description",
			"blockedMessage",
			"visibleWhen",
			"travelAllowedWhen",
			"lockedWhen",
			"state",
			"metadata",
		]);
		expect(fields[0].metadata).toMatchObject({
			type: "hidden",
		});
	});
});
