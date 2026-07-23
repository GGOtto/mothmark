import {toID} from "@/utils/idUtils";
import {EffectUsageSchema, WorldEffectSchema} from "./effectSchema";

describe("effect storage schemas", () => {
	it("stores effect usages as references", () => {
		expect(
			EffectUsageSchema.parse({
				type: "effect-ref",
				effectId: toID("effect", "open-gate"),
			}),
		).toEqual({
			type: "effect-ref",
			effectId: {type: "effect", id: "open-gate"},
		});

		expect(() =>
			EffectUsageSchema.parse({
				type: "flag",
				operation: "set",
				flag: "gate.open",
				value: true,
			}),
		).toThrow();
	});

	it("rejects untyped ID references", () => {
		expect(EffectUsageSchema.safeParse({type: "effect-ref", effectId: "open-gate"}).success).toBe(
			false,
		);
	});

	it("stores world effect definitions with referenced children", () => {
		expect(
			WorldEffectSchema.parse({
				id: "open-gate-sequence",
				name: "Open gate sequence",
				type: "group",
				effects: [
					{
						type: "effect-ref",
						effectId: toID("effect", "set-gate-open"),
					},
				],
			}),
		).toMatchObject({
			id: {type: "effect", id: "open-gate-sequence"},
			name: "Open gate sequence",
			type: "group",
			effects: [
				{
					type: "effect-ref",
					effectId: {type: "effect", id: "set-gate-open"},
				},
			],
		});
	});

	it("accepts room and feature flag effects", () => {
		expect(
			WorldEffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "set",
				roomId: toID("room", "vault"),
				flag: "dark",
				value: true,
			}).success,
		).toBe(true);
		expect(
			WorldEffectSchema.safeParse({
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
			WorldEffectSchema.parse({type: "flag", operation: "set", flag: "gate.open", value: true}),
		).toMatchObject({"flag-type": "normal"});
	});

	it("rejects readonly edits and permanent deletion", () => {
		expect(
			WorldEffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "toggle",
				roomId: toID("room", "vault"),
				flag: "visited",
			}).success,
		).toBe(false);
		expect(
			WorldEffectSchema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "delete",
				roomId: toID("room", "vault"),
				flag: "active",
			}).success,
		).toBe(false);
	});
});
