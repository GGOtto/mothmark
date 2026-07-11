import {EffectUsageSchema, WorldEffectSchema} from "./effectSchema";

describe("effect storage schemas", () => {
	it("stores effect usages as references", () => {
		expect(
			EffectUsageSchema.parse({
				type: "effect-ref",
				effectId: "open-gate",
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

	it("stores world effect definitions with referenced children", () => {
		expect(
			WorldEffectSchema.parse({
				id: "open-gate-sequence",
				name: "Open gate sequence",
				type: "group",
				effects: [
					{
						type: "effect-ref",
						effectId: "set-gate-open",
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
});
