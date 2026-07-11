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
			"position",
			"visitedFlag",
			"viewedFlag",
			"activeWhen",
			"id",
		]);
		expect(fields.at(-1)?.metadata).toMatchObject({
			type: "id",
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
			type: "id",
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
		]);
		expect(fields[0].metadata).toMatchObject({
			type: "id",
		});
	});
});
