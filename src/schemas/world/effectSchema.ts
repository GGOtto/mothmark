import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {entityFlagMutationError} from "./entityFlagDefinitions";
import {CompassDirectionSchema, DirectionSchema} from "./directionSchema";

export const EffectReferenceSchema = editor.object(
	{
		type: z.literal("effect-ref"),
		effectId: editor.reference("effect", {title: "Saved effect"}),
	},
	{title: "Use saved effect"},
);

export const MessageEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("message"),
			operation: z.literal("show"),
			message: editor.textarea({
				title: "Message",
				placeholder: "Enter the message shown to the player",
			}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("random"),
			messages: editor.stringList({title: "Messages"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("append-last-message"),
			message: editor.textarea({title: "Description text"}),
			format: editor.select(z.enum(["inline", "newline"]), {title: "Format"}, "newline"),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("current-room-description"),
			allowShorten: editor
				.boolean({
					title: "Allow shortened",
					description: "Allow the description to be shortened if the room is already visited.",
				})
				.default(true),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("list-available-exits"),
		}),
		z.object({
			type: z.literal("message"),
			operation: z.literal("show-command-help"),
		}),
	]),
	{
		title: "Message Effect",
		description: "Shows text, player guidance, or the current room description.",
	},
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
				value: editor
					.boolean({
						title: "Start value",
						commandVariableType: "boolean",
						features: {labels: {on: "True", off: "False"}},
					})
					.default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("normal").default("normal"),
				operation: z.literal("set"),
				flag: editor.flagKey({title: "Flag"}),
				value: editor
					.boolean({
						title: "Value",
						commandVariableType: "boolean",
						features: {labels: {on: "True", off: "False"}},
					})
					.default(true),
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
				value: editor
					.boolean({
						title: "Value",
						commandVariableType: "boolean",
						features: {labels: {on: "True", off: "False"}},
					})
					.default(true),
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
				"flag-type": z.literal("item"),
				operation: z.literal("set"),
				itemId: editor.reference("item", {title: "Item"}),
				flag: editor.string({title: "Flag"}).min(1),
				value: editor
					.boolean({
						title: "Value",
						commandVariableType: "boolean",
						features: {labels: {on: "True", off: "False"}},
					})
					.default(true),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("item"),
				operation: z.literal("toggle"),
				itemId: editor.reference("item", {title: "Item"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
			z.object({
				type: z.literal("flag"),
				"flag-type": z.literal("item"),
				operation: z.literal("delete"),
				itemId: editor.reference("item", {title: "Item"}),
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
		description: "Changes a boolean world, room, or item flag.",
	},
	{type: "flag", "flag-type": "normal", operation: "set", flag: "", value: true},
);

export const CounterEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter"),
			operation: z.literal("create"),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Start value", commandVariableType: "number"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("set"),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Value", commandVariableType: "number"}),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("increase"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount", commandVariableType: "number"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("decrease"),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount", commandVariableType: "number"}).default(1),
		}),
		z.object({
			type: z.literal("counter"),
			operation: z.literal("delete"),
			counter: editor.counterKey({title: "Counter"}),
		}),
	]),
	{title: "Counter Effect", description: "Changes a numeric world counter."},
);

export const TextEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("text"),
			operation: z.literal("create"),
			text: editor.textKey({title: "Text variable"}),
			value: editor.textarea({title: "Start value", commandVariableType: "string"}),
		}),
		z.object({
			type: z.literal("text"),
			operation: z.literal("set"),
			text: editor.textKey({title: "Text variable"}),
			value: editor.textarea({title: "Value", commandVariableType: "string"}),
		}),
		z.object({
			type: z.literal("text"),
			operation: z.literal("delete"),
			text: editor.textKey({title: "Text variable"}),
		}),
	]),
	{title: "Text effect", description: "Creates, changes, or deletes a saved text value."},
);

export const ItemEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("change-name"),
				value: editor.input({title: "Name"}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change name"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("change-examine-text"),
				value: editor.richText({title: "Examine text"}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change examine text"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("change-listing-text"),
				value: editor.textarea({title: "Room listing text"}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change room listing text"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.enum(["add-alias", "remove-alias", "add-tag", "remove-tag"]),
				value: editor.input({title: "Value"}).trim().min(1),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change alias or tag"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("move-to-room"),
				roomId: editor.reference("room", {title: "Room"}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Move to room"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.enum(["move-to-inventory", "drop-in-current-room"]),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Move to or from inventory"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("place-inside"),
				itemId: editor.reference("item", {title: "Item"}),
				containerId: editor.reference("item", {title: "Container"}),
			},
			{title: "Place inside item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("place-on"),
				itemId: editor.reference("item", {title: "Item"}),
				surfaceId: editor.reference("item", {title: "Surface"}),
			},
			{title: "Place on item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.enum(["hide", "reveal", "destroy", "restore-start-location"]),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change item location status"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.enum([
					"open",
					"close",
					"lock",
					"unlock",
					"mark-examined",
					"mark-unexamined",
					"list-in-room",
					"unlist-in-room",
				]),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Change item state"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.enum(["empty-into-room", "empty-into-inventory"]),
				itemId: editor.reference("item", {title: "Item"}),
				placement: editor.select(z.enum(["inside", "on", "both"]), {title: "Contents"}),
			},
			{title: "Empty contents"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: z.literal("move-contents"),
				itemId: editor.reference("item", {title: "Item"}),
				destinationItemId: editor.reference("item", {title: "Destination item"}),
				placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
			},
			{title: "Move contents"},
		),
	]),
	{title: "Item Effect", description: "Changes an item's runtime presentation, location, or state."},
);

export const ItemActionEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("action", [
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("take"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Take"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("drop"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Drop"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("examine"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Examine"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("open"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Open"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("close"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Close"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("lock"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Lock"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("put-inside"),
				itemId: editor.reference("item", {title: "Item"}),
				containerId: editor.reference("item", {title: "Container"}),
			},
			{title: "Put inside"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("put-on"),
				itemId: editor.reference("item", {title: "Item"}),
				surfaceId: editor.reference("item", {title: "Surface"}),
			},
			{title: "Put on"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("unlock"),
				itemId: editor.reference("item", {title: "Item"}),
				keyItemId: editor.reference("item", {title: "Key"}).optional(),
			},
			{title: "Unlock"},
		),
		editor.object(
			{
				type: z.literal("item-action"),
				action: z.literal("use"),
				itemId: editor.reference("item", {title: "Item"}),
				targetItemId: editor.reference("item", {title: "Target"}).optional(),
			},
			{title: "Use"},
		),
	]),
	{
		title: "Item action",
		description: "Performs a player-facing item action with eligibility, messages, and hooks.",
		picker: {showDescriptions: true},
	},
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
			direction: DirectionSchema,
		}),
		z.object({
			type: z.literal("room"),
			operation: z.literal("unlock-exit"),
			roomId: editor.reference("room", {title: "Room"}),
			direction: DirectionSchema,
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
			customDeathMessage: editor
				.input({title: "Death message", placeholder: "Use the default death message"})
				.optional(),
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
					title: "Freeze message",
					description: "The message given to the player when they input anything",
					placeholder: "Optional message while frozen",
				})
				.optional(),
			turns: editor
				.number({
					title: "Turns",
					description:
						"The number of turns the player is frozen for. If unset, the player will be frozen until an effect unfreezes them.",
					placeholder: "No turn limit",
				})
				.optional(),
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("unfreeze"),
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("move-in-direction"),
			direction: DirectionSchema,
		}),
		z.object({
			type: z.literal("player"),
			operation: z.literal("set-facing"),
			direction: CompassDirectionSchema,
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
export type TextEffect = z.infer<typeof TextEffectSchema>;
export type ItemEffect = z.infer<typeof ItemEffectSchema>;
export type ItemActionEffect = z.infer<typeof ItemActionEffectSchema>;
export type RoomEffect = z.infer<typeof RoomEffectSchema>;
export type PlayerEffect = z.infer<typeof PlayerEffectSchema>;
export type EffectReference = z.infer<typeof EffectReferenceSchema>;

export type Effect =
	| MessageEffect
	| FlagEffect
	| CounterEffect
	| TextEffect
	| ItemEffect
	| ItemActionEffect
	| RoomEffect
	| PlayerEffect
	| EffectReference;

function normalizeEffect(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const effect = value as Record<string, unknown>;
	if (effect.type === "flag" && !("flag-type" in effect)) {
		return {...effect, "flag-type": "normal"};
	}
	if (effect.type === "item") {
		const {operation, ...rest} = effect;
		switch (operation) {
			case "change-description":
				return {...rest, type: "item", operation: "change-examine-text"};
			case "move-to-room": {
				const {newRoomId, ...remaining} = rest;
				return newRoomId ? {...remaining, type: "item", operation, roomId: newRoomId} : effect;
			}
			case "place-inside-item":
				return {...rest, type: "item", operation: "place-inside"};
			case "place-on-item":
				return {...rest, type: "item", operation: "place-on"};
			case "hide-from-player":
				return {...rest, type: "item", operation: "hide"};
			case "show-to-player":
				return {...rest, type: "item", operation: "reveal"};
			case "show-in-room-description":
				return {...rest, type: "item", operation: "list-in-room"};
			case "hide-in-room-description":
				return {...rest, type: "item", operation: "unlist-in-room"};
			default:
				return effect;
		}
	}
	return value;
}

/**
 * A group contains concrete effects or references to other saved groups.
 * EffectGroupSchema is deliberately absent, preventing nested inline groups.
 */
export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z.preprocess(
		normalizeEffect,
		z.union([
			MessageEffectSchema,
			FlagEffectSchema,
			CounterEffectSchema,
			TextEffectSchema,
			ItemEffectSchema,
			ItemActionEffectSchema,
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

// TODO: Restore NPC, event, and flow effects when those domains return.
