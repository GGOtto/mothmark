import {toID} from "@/utils/idUtils";
import {
	EffectGroupSchema,
	EffectSchema,
	EffectUsageSchema,
	SavedEffectSchema,
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

	it("accepts current-room descriptions and directional movement effects", () => {
		expect(
			EffectSchema.safeParse({type: "message", operation: "describe-current-room"}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({
				type: "navigation",
				operation: "move-in-direction",
				direction: "e",
			}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({type: "navigation", operation: "set-facing", direction: "sw"}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({type: "navigation", operation: "set-facing", direction: "up"}).success,
		).toBe(false);
	});

	it("accepts reusable player-guidance message effects", () => {
		expect(EffectSchema.safeParse({type: "message", operation: "list-available-exits"}).success).toBe(
			true,
		);
		expect(EffectSchema.safeParse({type: "message", operation: "show-command-help"}).success).toBe(
			true,
		);
	});

	it("accepts saved text create, set, and delete effects", () => {
		for (const effect of [
			{type: "world", operation: "set-text", text: "answer", value: "moth"},
			{type: "world", operation: "set-text", text: "answer", value: "mark"},
			{type: "world", operation: "delete-text", text: "answer"},
		]) {
			expect(EffectSchema.safeParse(effect).success).toBe(true);
		}
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

		expect(EffectGroupSchema.parse(group)).toEqual(SavedEffectSchema.parse(group));
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
				type: "room",
				operation: "set-flag",
				roomId: toID("room", "vault"),
				flag: "dark",
				value: true,
			}).success,
		).toBe(true);
		expect(
			EffectSchema.safeParse({
				type: "item",
				operation: "toggle-flag",
				roomId: toID("room", "vault"),
				itemId: toID("item", "door"),
				flag: "locked",
			}).success,
		).toBe(true);
	});

	it("accepts canonical world flag effects", () => {
		expect(
			EffectSchema.parse({type: "world", operation: "set-flag", flag: "gate.open", value: true}),
		).toEqual({type: "world", operation: "set-flag", flag: "gate.open", value: true});
	});

	it.each([
		{type: "item", operation: "set-listing-text", itemId: toID("item", "item"), value: "Here."},
		{
			type: "item",
			operation: "place-inside",
			itemId: toID("item", "item"),
			containerId: toID("item", "box"),
		},
		{type: "item", operation: "empty-into-room", itemId: toID("item", "item"), placement: "both"},
		{
			type: "item",
			operation: "move-contents",
			itemId: toID("item", "item"),
			destinationItemId: toID("item", "table"),
			placement: "on",
		},
		{
			type: "player",
			operation: "take",
			itemId: toID("item", "item"),
		},
		{
			type: "player",
			operation: "unlock",
			itemId: toID("item", "item"),
			keyItemId: toID("item", "key"),
		},
		{
			type: "player",
			operation: "put-on",
			itemId: toID("item", "item"),
			surfaceId: toID("item", "table"),
		},
		{type: "player", operation: "use", itemId: toID("item", "item")},
	])("accepts item effect %#", (effect) => {
		expect(EffectSchema.safeParse(effect).success).toBe(true);
	});

	it("rejects legacy direct item effects", () => {
		expect(
			EffectSchema.safeParse({
				type: "item",
				operation: "change-description",
				itemId: toID("item", "door"),
				value: "Changed.",
			}).success,
		).toBe(false);
	});

	it("rejects readonly edits and permanent deletion", () => {
		expect(
			EffectSchema.safeParse({
				type: "room",
				operation: "toggle-flag",
				roomId: toID("room", "vault"),
				flag: "visited",
			}).success,
		).toBe(false);
		expect(
			EffectSchema.safeParse({
				type: "room",
				operation: "delete-flag",
				roomId: toID("room", "vault"),
				flag: "active",
			}).success,
		).toBe(false);
	});
});
