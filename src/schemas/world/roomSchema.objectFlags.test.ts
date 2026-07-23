import type {ObjectFieldMetadata} from "@/components/universal-editor/ObjectEditor";
import {resolveEditorMetadata} from "@/components/universal-editor/utils/resolveEditorMetadata";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {RoomFeatureSchema, RoomSchema} from "./roomSchema";

function field(schema: typeof RoomSchema | typeof RoomFeatureSchema, key: string) {
	return (resolveEditorMetadata(schema).features?.fields as ObjectFieldMetadata[]).find(
		(candidate) => candidate.key === key,
	);
}

describe("room and feature object flags", () => {
	it("gives rooms a permanent visited flag defaulted to false", () => {
		const flags = field(RoomSchema, "flags");

		expect(flags?.metadata).toMatchObject({
			type: "object-flag-editor",
			features: {flags: {visited: {permanent: true, defaultReadonly: true}}},
		});
		expect(createDefaultFieldObject(RoomSchema).flags).toEqual({visited: false});
	});

	it("gives features a permanent examined flag defaulted to false", () => {
		const flags = field(RoomFeatureSchema, "flags");

		expect(flags?.metadata).toMatchObject({
			type: "object-flag-editor",
			features: {flags: {examined: {permanent: true, defaultReadonly: true}}},
		});
		expect(createDefaultFieldObject(RoomFeatureSchema).flags).toEqual({examined: false});
	});

	it("restores permanent flags when imported flag maps omit them", () => {
		const roomFlagsSchema = RoomSchema.shape.flags;
		const featureFlagsSchema = RoomFeatureSchema.shape.flags;

		expect(roomFlagsSchema.parse({custom: true})).toEqual({visited: false, custom: true});
		expect(featureFlagsSchema.parse({open: true})).toEqual({examined: false, open: true});
	});
});
