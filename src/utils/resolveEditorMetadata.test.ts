import {z} from "zod";
import type {ObjectFieldMetadata} from "@/components/editor/universal/ObjectEditor";
import {editor} from "@/schemas/editorSchemaHelpers";
import {ConnectionSchema, RoomFeatureSchema, RoomSchema} from "@/schemas/roomSchema";
import {resolveEditorMetadata} from "./resolveEditorMetadata";

function getObjectFields(schema: z.ZodTypeAny) {
	const metadata = resolveEditorMetadata(schema);
	return metadata.features?.fields as ObjectFieldMetadata[];
}

describe("resolveEditorMetadata object fields", () => {
	it("merges childControls before sorting object fields", () => {
		const schema = editor.object(
			z.object({
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
			}),
			{
				childControls: {
					a: {
						layout: {
							order: 2,
							pinned: true,
						},
					},
				},
			},
		);

		const fields = getObjectFields(schema);

		expect(fields.map((field) => field.key)).toEqual(["a", "b", "c"]);
		expect(fields[0].metadata.layout).toEqual({
			width: "half",
			order: 2,
			pinned: true,
		});
	});

	it("applies the recommended room authoring field order", () => {
		expect(getObjectFields(RoomSchema).map((field) => field.key)).toEqual([
			"id",
			"name",
			"description",
			"shortDescription",
			"aliases",
			"tags",
			"features",
			"position",
			"visitedFlag",
			"viewedFlag",
			"activeWhen",
			"visibleWhen",
		]);
	});

	it("applies the recommended room feature authoring field order", () => {
		expect(getObjectFields(RoomFeatureSchema).map((field) => field.key)).toEqual([
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
	});

	it("applies the recommended connection authoring field order", () => {
		expect(getObjectFields(ConnectionSchema).map((field) => field.key)).toEqual([
			"id",
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
		]);
	});
});
