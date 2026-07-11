import {z} from "zod";
import {editor} from "@/schemas/editorSchemaHelpers";
import {getSchemaAtPath} from "./schemaIntrospection";
import {resolveEditorMetadata} from "./resolveEditorMetadata";

describe("getSchemaAtPath", () => {
	it("resolves object properties through wrapped schemas", () => {
		const schema = editor.object(
			z.object({
				title: editor.input({title: "Title"}).default("Untitled"),
			}),
		);

		const childSchema = getSchemaAtPath(schema, ["title"]);

		expect(childSchema).toBeDefined();
		expect(resolveEditorMetadata(childSchema!).title).toBe("Title");
	});

	it("resolves array element properties by numeric path segment", () => {
		const schema = editor.object(
			z.object({
				rooms: z.array(
					editor.object(
						z.object({
							id: editor.id("room", {title: "Room ID"}),
							name: editor.input({title: "Room Name"}),
						}),
					),
				),
			}),
		);

		const childSchema = getSchemaAtPath(schema, ["rooms", 0, "name"]);

		expect(childSchema).toBeDefined();
		expect(resolveEditorMetadata(childSchema!).title).toBe("Room Name");
	});

	it("returns undefined for unsupported paths", () => {
		const schema = z.array(z.string());

		expect(getSchemaAtPath(schema, ["not-an-object"])).toBeUndefined();
	});
});
