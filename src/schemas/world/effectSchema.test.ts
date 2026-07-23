import {toID} from "@/utils/idUtils";
import {
	EffectGroupSchema,
	EffectSchema,
	EffectUsageSchema,
	WorldEffectSchema,
} from "./effectSchema";

describe("effect storage schemas", () => {
	it("accepts player effects with unset optional freeze fields", () => {
		expect(
			EffectSchema.parse({
				type: "player",
				operation: "freeze",
			}),
		).toEqual({
			type: "player",
			operation: "freeze",
		});
	});

	it("uses a complete EffectGroup for effect controls and world storage", () => {
		const group = {
			id: "open-gate-sequence",
			name: "Open gate sequence",
			type: "group" as const,
			effects: [
				{type: "message" as const, operation: "show" as const, message: "The gate opens."},
				{type: "effect-ref" as const, effectId: toID("effect", "ring-bell")},
			],
			allowMultipleUsesInWorld: true,
		};

		expect(EffectGroupSchema.parse(group)).toEqual(WorldEffectSchema.parse(group));
		expect(EffectUsageSchema.parse(group)).toMatchObject({
			id: {type: "effect", id: "open-gate-sequence"},
			type: "group",
			effects: [
				{type: "message", operation: "show"},
				{type: "effect-ref", effectId: {type: "effect", id: "ring-bell"}},
			],
		});
	});

	it("allows references to saved groups but rejects nested inline groups", () => {
		expect(
			EffectSchema.safeParse({
				type: "effect-ref",
				effectId: toID("effect", "open-gate"),
			}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({
				type: "group",
				name: "Nested",
				id: "nested",
				effects: [],
				allowMultipleUsesInWorld: false,
			}).success,
		).toBe(false);
	});

	it("rejects a group that references itself", () => {
		expect(
			EffectGroupSchema.safeParse({
				type: "group",
				id: "open-gate",
				name: "Open gate",
				effects: [{type: "effect-ref", effectId: toID("effect", "open-gate")}],
				allowMultipleUsesInWorld: true,
			}).success,
		).toBe(false);
	});

	it("rejects untyped ID references", () => {
		expect(EffectSchema.safeParse({type: "effect-ref", effectId: "open-gate"}).success).toBe(false);
	});

	it("accepts room and feature flag effects", () => {
		expect(
			EffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "set",
				roomId: toID("room", "vault"),
				flag: "dark",
				value: true,
			}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({
				type: "flag",
				"flag-type": "feature",
				operation: "toggle",
				roomId: toID("room", "vault"),
				featureId: toID("feature", "door"),
				flag: "locked",
			}).success,
		).toBe(true);
	});

	it("defaults legacy flag effects to normal flags", () => {
		expect(
			EffectSchema.parse({type: "flag", operation: "set", flag: "gate.open", value: true}),
		).toMatchObject({"flag-type": "normal"});
	});

	it("rejects readonly edits and permanent deletion", () => {
		expect(
			EffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "toggle",
				roomId: toID("room", "vault"),
				flag: "visited",
			}).success,
		).toBe(false);
		expect(
			EffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "delete",
				roomId: toID("room", "vault"),
				flag: "active",
			}).success,
		).toBe(false);
	});
});
