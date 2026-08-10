import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionalTextSchema, FlagConditionSchema} from "@/schemas/world/conditionSchema";
import {FlagEffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "./createDefaultFieldObject";
import {getEditorMetadata} from "./editorMetadata";

describe("editor schema defaultFieldValue", () => {
	it("lets setDefault add a generated field value to any schema", () => {
		const schema = editor.setDefault(z.object({name: z.string()}), {name: "New entity"});

		expect(schema.meta()).toHaveProperty("defaultFieldValue", {name: "New entity"});
		expect(createDefaultFieldObject(schema)).toEqual({name: "New entity"});
	});

	it("preserves existing schema and editor metadata when setting a default", () => {
		const schema = editor.setDefault(editor.input({title: "Name"}).meta({custom: true}), "Untitled");

		expect(schema.meta()).toMatchObject({
			custom: true,
			defaultFieldValue: "Untitled",
			editor: {control: "input", title: "Name"},
		});
	});

	it("can set an explicit undefined default", () => {
		const schema = editor.setDefault(z.string(), undefined);

		expect(schema.meta()).toHaveProperty("defaultFieldValue", undefined);
		expect(createDefaultFieldObject(schema)).toBeUndefined();
	});

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
		expect(createDefaultFieldObject(ConditionalTextSchema)).toEqual({
			text: "",
			when: {type: "group", operation: "all", conditions: []},
		});
		expect(createDefaultFieldObject(FlagConditionSchema)).toEqual({
			type: "flag",
			"flag-type": "normal",
			operation: "is",
			flag: "",
			value: true,
		});
		expect(createDefaultFieldObject(FlagEffectSchema)).toEqual({
			type: "flag",
			"flag-type": "normal",
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

	it("configures references through the metadata-driven entity picker", () => {
		const schema = editor.reference("room", {
			title: "Destination",
			picker: {
				presentation: "popup",
				searchPlaceholder: "Find a destination…",
				showTags: true,
				resultLimit: 40,
			},
		});

		expect(getEditorMetadata(schema)).toMatchObject({
			control: "entity-picker",
			entityType: "room",
			picker: {
				presentation: "popup",
				searchable: true,
				searchPlaceholder: "Find a destination…",
				showTags: true,
				resultLimit: 40,
			},
		});
	});

	it("configures a single effect control through schema metadata", () => {
		const schema = editor.effectControl(FlagEffectSchema, {
			title: "Outcome",
			childControls: {
				flag: {control: "flag-picker", title: "World flag"},
			},
		});

		expect(getEditorMetadata(schema)).toMatchObject({
			control: "effect",
			title: "Outcome",
			features: {
				effectSchema: FlagEffectSchema,
				showGeneratedSummary: true,
			},
			childControls: {
				flag: {control: "flag-picker", title: "World flag"},
			},
		});
	});
});
