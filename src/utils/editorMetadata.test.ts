import {editor} from "@/schemas/editorSchemaHelpers";
import {ConditionalTextSchema, FlagConditionSchema} from "@/schemas/conditionSchema";
import {FlagEffectSchema} from "@/schemas/effectSchema";
import {createDefaultFieldObject} from "./createDefaultFieldObject";
import {getEditorMetadata} from "./editorMetadata";

describe("editor schema defaultFieldValue", () => {
	it("lets editor helpers define a generated field value as a separate parameter", () => {
		const schema = editor.input({title: "Name"}, "New entity");

		expect(createDefaultFieldObject(schema)).toBe("New entity");
	});

	it("keeps the generated value out of presentation metadata", () => {
		const schema = editor.input({}, "New entity");

		expect(getEditorMetadata(schema)).not.toHaveProperty("defaultFieldValue");
	});

	it("keeps the helper default through chained schema constraints", () => {
		const schema = editor.input({}, "New entity").min(1);

		expect(createDefaultFieldObject(schema)).toBe("New entity");
	});

	it("reads defaults declared on actual schemas", () => {
		expect(createDefaultFieldObject(ConditionalTextSchema)).toEqual({text: "", when: []});
		expect(createDefaultFieldObject(FlagConditionSchema)).toEqual({
			type: "flag",
			operation: "equals",
			flag: "",
			value: true,
		});
		expect(createDefaultFieldObject(FlagEffectSchema)).toEqual({
			type: "flag",
			operation: "set",
			flag: "",
			value: true,
		});
	});

	it("provides usable defaults for IDs and required references", () => {
		expect(createDefaultFieldObject(editor.id("room"))).toBe("");
		expect(createDefaultFieldObject(editor.reference("room"))).toEqual({
			type: "room",
			id: "",
		});
	});
});
