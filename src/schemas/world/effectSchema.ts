import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {entityFlagMutationError} from "./entityFlagDefinitions";

export const EffectReferenceSchema = editor.object(
	{type: z.literal("effect-ref"), effectId: editor.reference("effect", {title: "Effect"})},
	{title: "Effect Reference"},
);

export const MessageEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("message"),
			operation: z.literal("show"),
			message: editor.message({title: "Message"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("random"),
			messages: editor.stringList({title: "Messages"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("append-last-message"),
			message: editor.message({title: "Description Text"}),
			format: editor.select(z.enum(["inline", "newline"]), {title: "Format"}, "newline"),
		}),
	]),
	{title: "Message Effect", description: "Shows text or augments the current room description."},
);

const FlagEffectValueSchema = z
	.discriminatedUnion("flag-type", [
		z.discriminatedUnion("operation", [
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("normal").default("normal"),
				operation: z.literal("create"),
				flag: editor.string({
					title: "Flag",
					description: "The name of the new flag. Will overwrite the flag if it already exists.",
				}),
				value: editor.boolean({title: "Start Value"}).default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("normal").default("normal"),
				operation: z.literal("set"),
				flag: editor.flagKey({title: "Flag"}),
				value: editor.boolean({title: "Value"}).default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("normal").default("normal"),
				operation: z.literal("toggle"),
				flag: editor.flagKey({title: "Flag"}),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("normal").default("normal"),
				operation: z.literal("delete"),
				flag: editor.flagKey({title: "Flag"}),
			}),
		]),
		z.discriminatedUnion("operation", [
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("room"),
				operation: z.literal("set"),
				roomId: editor.reference("room", {title: "Room"}),
				flag: editor.string({title: "Flag"}).min(1),
				value: editor.boolean({title: "Value"}).default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("room"),
				operation: z.literal("toggle"),
				roomId: editor.reference("room", {title: "Room"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("room"),
				operation: z.literal("delete"),
				roomId: editor.reference("room", {title: "Room"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
		]),
		z.discriminatedUnion("operation", [
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("feature"),
				operation: z.literal("set"),
				roomId: editor.reference("room", {title: "Room"}),
				featureId: editor.reference("feature", {title: "Feature"}),
				flag: editor.string({title: "Flag"}).min(1),
				value: editor.boolean({title: "Value"}).default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("feature"),
				operation: z.literal("toggle"),
				roomId: editor.reference("room", {title: "Room"}),
				featureId: editor.reference("feature", {title: "Feature"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("feature"),
				operation: z.literal("delete"),
				roomId: editor.reference("room", {title: "Room"}),
				featureId: editor.reference("feature", {title: "Feature"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
		]),
	])
	.superRefine((effect, ctx) => {
		if (effect["flag-type"] === "normal") return;
		const message = entityFlagMutationError(effect["flag-type"], effect.flag, effect.operation);
		if (message) ctx.addIssue({code: "custom", message, path: ["flag"]});
	});

export const FlagEffectSchema = editor.discriminatedUnion(
	FlagEffectValueSchema,
	{
		title: "Flag Effect",
		description: "Changes a boolean world, room, or feature flag.",
	},
	{type: "flag", "flag-type": "normal", operation: "set", flag: "", value: true},
);

export const CounterEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter"),
			operation: z.literal("create"),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Start Value"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("set"),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Value"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("increase"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("decrease"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("delete"),
			counter: editor.counterKey({title: "Counter"}),
		}),
	]),
	{title: "Counter Effect", description: "Changes a numeric world counter."},
);

export const FeatureEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("feature"),
			operation: z.literal("change-name"),
			value: editor.input(),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("change-description"),
			value: editor.richText(),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("move-to-room"),
			roomId: editor.reference("room", {title: "Room"}),
			newRoomId: editor.reference("room", {title: "New Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("hide-from-player"),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("show-to-player"),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("show-in-room-description"),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("hide-in-room-description"),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
		z.object({
			type: z.literal("feature"),
			operation: z.literal("destroy"),
			roomId: editor.reference("room", {title: "Room"}),
			featureId: editor.reference("feature", {title: "Feature"}),
		}),
	]),
	{title: "Feature Effect", description: "Changes a room feature and its runtime flags."},
);

export const RoomEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("room"),
			operation: z.literal("move-player-to"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-name"),
			roomId: editor.reference("room", {title: "Room"}),
			variantId: editor.input({title: "Variant ID"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-description"),
			roomId: editor.reference("room", {title: "Room"}),
			variantId: editor.input({title: "Variant ID"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-short-description"),
			roomId: editor.reference("room", {title: "Room"}),
			variantId: editor.input({title: "Variant ID"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("lock-exit"),
			roomId: editor.reference("room", {title: "Room"}),
			direction: editor.direction({title: "Direction"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("unlock-exit"),
			roomId: editor.reference("room", {title: "Room"}),
			direction: editor.direction({title: "Direction"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("lock-all-exits"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("unlock-all-exits"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("add-tag"),
			roomId: editor.reference("room", {title: "Room"}),
			tag: editor.input({title: "Tag"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("remove-tag"),
			roomId: editor.reference("room", {title: "Room"}),
			tag: editor.input({title: "Tag"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-active"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("set-inactive"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
	]),
	{title: "Room Effect", description: "Moves the player or changes room and exit state."},
);

export const PlayerEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("player"),
			operation: z.literal("kill"),
			customDeathMessage: editor.input().optional(),
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("teleport"),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("freeze"),
			freezeMessage: editor
				.input({
					title: "Freeze Message",
					description: "The message given to the player when they input anything",
				})
				.optional(),
			turns: editor
				.number({
					title: "Turns",
					description:
						"The number of turns the player is frozen for. If unset, the player will be frozen until an effect unfreezes them.",
				})
				.optional(),
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("unfreeze"),
		}),
	]),
	{title: "Player Effect", description: "Perform any effect directly on the player."},
);

export const GameEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operations", [z.object({})]),
	{title: "Game Effect", description: "Perform any effect that changes the game state."},
);

export type MessageEffect = z.infer<typeof MessageEffectSchema>;
export type FlagEffect = z.infer<typeof FlagEffectSchema>;
export type CounterEffect = z.infer<typeof CounterEffectSchema>;
export type FeatureEffect = z.infer<typeof FeatureEffectSchema>;
export type RoomEffect = z.infer<typeof RoomEffectSchema>;
export type PlayerEffect = z.infer<typeof PlayerEffectSchema>;
export type EffectReference = z.infer<typeof EffectReferenceSchema>;

export type Effect =
	| MessageEffect
	| FlagEffect
	| CounterEffect
	| FeatureEffect
	| RoomEffect
	| PlayerEffect
	| EffectReference;

function normalizeFlagEffect(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const effect = value as Record<string, unknown>;
	if (effect.type === "flag" && !("flag-type" in effect)) {
		return {...effect, "flag-type": "normal"};
	}
	return value;
}

/**
 * A group contains concrete effects or references to other saved groups.
 * EffectGroupSchema is deliberately absent, preventing nested inline groups.
 */
export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z.preprocess(
		normalizeFlagEffect,
		z.union([
			MessageEffectSchema,
			FlagEffectSchema,
			CounterEffectSchema,
			FeatureEffectSchema,
			RoomEffectSchema,
			PlayerEffectSchema,
			EffectReferenceSchema,
		]),
	),
);

export const EffectGroupSchema = editor.effectControl(
	z
		.object({
			name: editor.input({
				title: "Group name",
				description:
					"Generated from the group's effects until you choose a custom name. Use Clear to return to the generated name.",
			}),
			id: editor.id("effect", {title: "Group ID", hidden: true}),
			type: z.literal("group"),
			effects: editor.effects(EffectSchema, {
				title: "Effects",
				description: "Run concrete effects or reference another saved effect group.",
				features: {
					allowedEffectTypes: ["message", "flag", "counter", "feature", "room", "player", "effect-ref"],
				},
			}),
			allowMultipleUsesInWorld: editor.hidden(z.literal(true).default(true), {
				title: "Stored in world effects",
			}),
		})
		.superRefine((group, ctx) => {
			const selfId =
				typeof group.id === "object" && group.id !== null && "id" in group.id
					? String(group.id.id)
					: String(group.id);
			group.effects.forEach((effect, index) => {
				if (
					effect.type === "effect-ref" &&
					typeof effect.effectId === "object" &&
					effect.effectId !== null &&
					"id" in effect.effectId &&
					String(effect.effectId.id) === selfId
				) {
					ctx.addIssue({
						code: "custom",
						message: "An effect group cannot reference itself.",
						path: ["effects", index, "effectId"],
					});
				}
			});
		}),
	{
		title: "Effect group",
		description: "Configure a sequence of effects as one reusable outcome.",
	},
	{
		name: "",
		id: "",
		type: "group",
		effects: [],
		allowMultipleUsesInWorld: true,
	},
);

export type EffectGroup = z.infer<typeof EffectGroupSchema>;

/** Saved world effects are always complete groups. */
export const WorldEffectSchema = EffectGroupSchema;
export const EffectUsageSchema = EffectGroupSchema;

// TODO: Restore item, inventory, NPC, event, and flow effects when their domains return.
