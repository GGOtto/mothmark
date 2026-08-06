import type {ObjectFieldMetadata} from "@/components/universal-editor/ObjectEditor";
import {resolveEditorMetadata} from "@/components/universal-editor/utils/resolveEditorMetadata";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {ItemInitialStateSchema} from "./itemSchema";
import {RoomSchema} from "./roomSchema";

function field(schema: typeof RoomSchema | typeof ItemInitialStateSchema, key: string) {
	return (resolveEditorMetadata(schema).features?.fields as ObjectFieldMetadata[]).find(
		(candidate) => candidate.key === key,
	);
}

describe("room and item object flags", () => {
	it("gives rooms permanent visited and active flags", () => {
		const flags = field(RoomSchema, "flags");

		expect(flags?.metadata).toMatchObject({
			type: "object-flag-editor",
			features: {
				flags: {
					visited: {permanent: true, defaultReadonly: true},
					active: {permanent: true, defaultValue: true},
				},
			},
		});
		expect(createDefaultFieldObject(RoomSchema).flags).toEqual({visited: false, active: true});
	});

	it("gives items a permanent examined flag defaulted to false", () => {
		const flags = field(ItemInitialStateSchema, "flags");

		expect(flags?.metadata).toMatchObject({
			type: "object-flag-editor",
			features: {flags: {examined: {permanent: true, defaultReadonly: true}}},
		});
		expect(createDefaultFieldObject(ItemInitialStateSchema).flags).toEqual({examined: false});
	});

	it("restores permanent flags when imported flag maps omit them", () => {
		const roomFlagsSchema = RoomSchema.shape.flags;
		const itemFlagsSchema = ItemInitialStateSchema.shape.flags;

		expect(roomFlagsSchema.parse({custom: true})).toEqual({
			visited: false,
			active: true,
			custom: true,
		});
		expect(itemFlagsSchema.parse({custom: true})).toEqual({examined: false, custom: true});
	});
});
