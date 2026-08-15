import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {docify} from "@/schemas/utils/docify";
import {getEditorMetadata, withEditorMetadata} from "@/utils/editorMetadata";
import {ConditionSchema, ConditionalTextSchema} from "./conditionSchema";
import {EffectGroupSchema} from "./effectSchema";
import {ITEM_FLAG_DEFINITIONS} from "./entityFlagDefinitions";

export const ItemSizeSchema = editor.select(
	z.enum(["tiny", "small", "medium", "large", "huge"]).default("small"),
	{
		title: "Size",
		description:
			"The item's combined carrying and placement size. Size does not change when a container or surface is full.",
		options: [
			{label: "Tiny", value: "tiny", description: "1 size unit."},
			{label: "Small", value: "small", description: "2 size units."},
			{label: "Medium", value: "medium", description: "4 size units."},
			{label: "Large", value: "large", description: "8 size units."},
			{label: "Huge", value: "huge", description: "16 size units."},
		],
	},
);

export const ITEM_SIZE_UNITS = {
	tiny: 1,
	small: 2,
	medium: 4,
	large: 8,
	huge: 16,
} as const satisfies Record<z.infer<typeof ItemSizeSchema>, number>;

export const ItemCapacitySchema = editor.object(
	{
		capacity: editor
			.positiveInteger({
				title: "Total capacity",
				description: "The total size units this item can hold.",
			})
			.default(8),
		maximumItemSize: ItemSizeSchema.default("medium").describe(
			"The largest single item that can be placed here.",
		),
	},
	{
		title: "Capacity",
		description: "Limits placement using the same size scale used by takeable items.",
		features: {layout: "grid"},
	},
);

export const ItemContentsListingTextSchema = editor
	.textarea(
		{
			title: "Contents lead-in",
			description: "Optional text shown before visible items inside or on this item.",
			placeholder: "Inside the chest:",
		},
		"",
	)
	.optional();

export const ItemTakeAllowedWhenSchema = editor
	.conditionControl(ConditionSchema, {
		title: "Take when",
		description: "Optional additional condition for taking this item.",
	})
	.optional();

export const TakeableBehaviorSchema = editor.object(
	{
		type: z.literal("takeable"),
		size: ItemSizeSchema,
		allowedWhen: ItemTakeAllowedWhenSchema,
		blockedMessage: editor
			.message({title: "Blocked message"})
			.default("You can't take that right now."),
		afterTake: EffectGroupSchema.optional(),
		afterDrop: EffectGroupSchema.optional(),
	},
	{
		title: "Takeable",
		description: "Lets the player take, carry, place, and drop this item.",
		childControls: {
			afterTake: {title: "After take"},
			afterDrop: {title: "After drop"},
		},
	},
);

export const ContainerBehaviorSchema = editor.object(
	{
		type: z.literal("container"),
		capacity: ItemCapacitySchema,
		contentsListingText: ItemContentsListingTextSchema,
	},
	{
		title: "Container",
		description: "Lets other takeable items be placed inside this item.",
	},
);

export const SurfaceBehaviorSchema = editor.object(
	{
		type: z.literal("surface"),
		capacity: ItemCapacitySchema,
		contentsListingText: ItemContentsListingTextSchema,
	},
	{
		title: "Surface",
		description: "Lets other takeable items be placed on this item.",
	},
);

export const OpenableBehaviorSchema = editor.object(
	{
		type: z.literal("openable"),
		openMessage: editor.message({title: "Open message"}).default("You open it."),
		closeMessage: editor.message({title: "Close message"}).default("You close it."),
		blockedMessage: editor
			.message({title: "Blocked message"})
			.default("You can't open that right now."),
		afterOpen: EffectGroupSchema.optional(),
		afterClose: EffectGroupSchema.optional(),
	},
	{
		title: "Openable",
		description: "Gives this item an open or closed state.",
		childControls: {
			afterOpen: {title: "After open"},
			afterClose: {title: "After close"},
		},
	},
);

export const UnlockRequirementSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		editor.object(
			{
				type: z.literal("item"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Specific item", description: "Only this item can satisfy the lock."},
		),
		editor.object(
			{
				type: z.literal("tag"),
				tag: editor.input({title: "Item tag"}).trim().min(1),
			},
			{title: "Item tag", description: "Any item with this tag can satisfy the lock."},
		),
	]),
	{title: "Unlock with"},
);

export const LockableBehaviorSchema = editor.object(
	{
		type: z.literal("lockable"),
		unlockWith: editor.array(UnlockRequirementSchema, {
			title: "Unlock with",
			description: "Specific items or item tags accepted by this lock.",
			emptyState: {
				emptyTitle: "No key configured",
				emptyDescription: "Add a specific item or an item tag that can unlock this item.",
				emptyActionLabel: "Add key",
			},
		}),
		consumesKey: editor
			.boolean({
				title: "Consume key",
				description: "Destroy the matching item after it unlocks this item.",
			})
			.default(false),
		unlockMessage: editor.message({title: "Unlock message"}).default("You unlock it."),
		wrongKeyMessage: editor.message({title: "Wrong key message"}).default("That doesn't unlock it."),
		afterUnlock: EffectGroupSchema.optional(),
		afterLock: EffectGroupSchema.optional(),
	},
	{
		title: "Lockable",
		description: "Lets matching items or item tags unlock this openable item.",
		discovery: {requires: ["openable"]},
		childControls: {
			afterUnlock: {title: "After unlock"},
			afterLock: {title: "After lock"},
		},
	},
);

export const DoorBehaviorSchema = editor.object(
	{
		type: z.literal("door"),
		connectionId: editor.reference("connection", {title: "Connection"}),
		controls: editor
			.select(z.enum(["both-directions", "forward", "backward"]), {
				title: "Controls",
				description: "The direction blocked while this door is closed.",
				options: [
					{label: "Both directions", value: "both-directions"},
					{label: "Forward", value: "forward"},
					{label: "Backward", value: "backward"},
				],
			})
			.default("both-directions"),
	},
	{
		title: "Door",
		description: "Makes this openable item block a connection while closed.",
		discovery: {requires: ["openable"]},
	},
);

export const UseTargetSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		editor.object({type: z.literal("none")}, {title: "No target"}),
		editor.object({type: z.literal("any")}, {title: "Any reachable target"}),
		editor.object(
			{
				type: z.literal("item"),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Specific item"},
		),
		editor.object(
			{
				type: z.literal("tag"),
				tag: editor.input({title: "Target tag"}).trim().min(1),
			},
			{title: "Item tag"},
		),
	]),
	{title: "Use target"},
);

export const UseRecipeSchema = editor.object(
	{
		id: editor.id("condition-branch", {title: "Recipe ID", hidden: true}),
		target: UseTargetSchema,
		when: editor.conditionControl(ConditionSchema, {title: "When"}).optional(),
		outcome: EffectGroupSchema,
	},
	{
		title: "Use recipe",
		description: "Runs when this item is used with a matching target and optional condition.",
		childControls: {outcome: {title: "Outcome"}},
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "use-recipe",
		},
	},
);

export const ItemParentConditionalTextSchema = editor
	.array(ConditionalTextSchema, {
		title: "Conditional parent-listing text",
		description: "Extra listing text shown whenever its condition passes.",
	})
	.default([]);

export const ItemExamineConditionalTextSchema = editor
	.array(ConditionalTextSchema, {
		title: "Conditional examine text",
		description: "Extra examine text shown whenever its condition passes.",
	})
	.default([]);

export const UsableBehaviorSchema = editor.object(
	{
		type: z.literal("usable"),
		recipes: editor.array(UseRecipeSchema, {
			title: "Use recipes",
			description: "The first matching recipe supplies the result.",
			emptyState: {
				emptyTitle: "No use recipes",
				emptyDescription: "Add an outcome for using this item alone or on a target.",
				emptyActionLabel: "Add recipe",
			},
		}),
		fallbackMessage: editor
			.message({title: "Fallback message"})
			.default("You can't find a useful way to use that here."),
	},
	{
		title: "Usable",
		description: "Adds manageable use recipes for this item and optional targets.",
	},
);

export const ITEM_BEHAVIOR_SCHEMAS = [
	TakeableBehaviorSchema,
	ContainerBehaviorSchema,
	SurfaceBehaviorSchema,
	OpenableBehaviorSchema,
	LockableBehaviorSchema,
	DoorBehaviorSchema,
	UsableBehaviorSchema,
] as const;

export const ItemBehaviorSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", ITEM_BEHAVIOR_SCHEMAS),
	{
		title: "Behavior",
		description: "A player-facing capability added to this item.",
		picker: {showDescriptions: true},
	},
);

export const ItemLocationSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		editor.object(
			{
				type: z.literal("room"),
				roomId: editor.reference("room", {title: "Room"}),
			},
			{title: "In a room"},
		),
		editor.object({type: z.literal("inventory")}, {title: "Player inventory"}),
		editor.object(
			{
				type: z.literal("item"),
				itemId: editor.reference("item", {title: "Containing item"}),
				placement: editor.select(z.enum(["inside", "on"]), {
					title: "Placement",
					options: [
						{label: "Inside", value: "inside"},
						{label: "On", value: "on"},
					],
				}),
			},
			{title: "In or on an item"},
		),
		editor.object(
			{
				type: z.literal("hidden"),
				roomId: editor.reference("room", {title: "Associated room"}).optional(),
			},
			{title: "Hidden"},
		),
		editor.object({type: z.literal("destroyed")}, {title: "Destroyed"}),
	]),
	{
		title: "Starting location",
		description: "The single authoritative place where this item begins.",
	},
);

export const ItemExamineSchema = editor.object(
	{
		text: editor.richText({
			title: "Examine text",
			description: "The description shown by the standard examine action.",
			placeholder: "Describe what the player notices...",
		}),
		conditionalText: ItemExamineConditionalTextSchema,
		afterExamine: EffectGroupSchema.optional(),
	},
	{
		title: "Examine",
		description: "Every item can be examined without authoring a custom command.",
		childControls: {afterExamine: {title: "After examine"}},
		layout: {group: "presentation", width: "full", order: 2},
	},
);

export const ItemInitialStateSchema = editor.object(
	{
		location: withEditorMetadata(ItemLocationSchema, {
			...getEditorMetadata(ItemLocationSchema)!,
			layout: {group: "placement", width: "full", order: 1},
		}),
		open: editor.hidden(z.boolean().default(false)),
		locked: editor.hidden(z.boolean().default(false)),
		flags: editor
			.objectFlags({
				title: "Flags",
				description: "Item state used by conditions and effects, with its initial values.",
				layout: {group: "flags", width: "full", order: 1},
				features: {
					flags: ITEM_FLAG_DEFINITIONS,
					linkedFlags: [
						{
							name: "open",
							valueField: "open",
							sourceArrayField: "behaviors",
							sourceValue: "openable",
							description: "Whether this openable item starts open.",
						},
						{
							name: "locked",
							valueField: "locked",
							sourceArrayField: "behaviors",
							sourceValue: "lockable",
							description: "Whether this lockable item starts locked.",
						},
					],
				},
			})
			.default({examined: false}),
	},
	{
		title: "Start state",
		description: "Initial placement, open and locked state, and item flags.",
		layout: {group: "placement", width: "full", order: 1},
		features: {
			layout: "section",
			groups: [
				{
					id: "placement",
					title: "Starting position",
					description: "Choose the single authoritative place where this item begins.",
					order: 10,
				},
				{
					id: "flags",
					title: "Flags",
					description: "Define item state used by conditions and effects.",
					order: 20,
				},
			],
		},
	},
);

export const ItemSchema = editor
	.object(
		{
			id: editor.id("item", {
				title: "Item ID",
				description: "The unique id used to identify this item.",
				required: true,
				layout: {group: "identity", width: "half", order: 1},
			}),
			name: editor
				.input({
					title: "Name",
					description: "The player-facing name of the item.",
					placeholder: "Brass key",
					required: true,
					layout: {group: "identity", width: "half", order: 2},
				})
				.min(1),
			aliases: editor.aliasList({
				title: "Aliases",
				description: "Alternative names the player can use for this item.",
				features: {
					autoSuggestFrom: "title",
					suggestionFields: undefined,
					suggestArticleless: true,
				},
				layout: {group: "identity", width: "full", order: 3},
			}),
			tags: editor.tagList("items", {
				title: "Tags",
				description: "Author-defined tags used for grouping, targeting, and logic.",
				features: {suggestionFields: []},
				layout: {group: "identity", width: "full", order: 4},
			}),
			presentation: editor.object(
				{
					listedInRoom: editor
						.boolean({
							title: "List in parent",
							description: "Include this item's listing text beneath its room or visible containing item.",
						})
						.default(false),
					listingText: editor
						.textarea({
							title: "Parent listing text",
							description:
								"Optional shorter text shown beneath the item's room or containing item instead of examine text.",
						})
						.default(""),
					conditionalText: ItemParentConditionalTextSchema,
				},
				{
					title: "Presentation",
					layout: {group: "presentation", width: "full", order: 1},
				},
			),
			examine: ItemExamineSchema,
			behaviors: editor.array(ItemBehaviorSchema, {
				title: "Behaviors",
				description: "Standard capabilities available to the player for this item.",
				features: {
					selectionControl: "multi-select",
					selectionTitle: "Available behaviors",
					reorderable: false,
					duplicateable: false,
				},
				emptyState: {
					emptyTitle: "Fixed item",
					emptyDescription: "This item can be examined but has no additional standard behavior.",
					emptyActionLabel: "Add behavior",
				},
				layout: {group: "behavior", width: "full", order: 1},
			}),
			initialState: ItemInitialStateSchema,
		},
		{
			title: "Item",
			description: docify(`
				A player-targetable object. Fixed scenery, containers, surfaces, doors,
				hazards, tools, and portable objects are all items. Behaviors add
				standard capabilities without requiring custom commands.
			`),
			features: {
				layout: "section",
				groups: [
					{
						id: "identity",
						title: "Identity",
						description: "Name the item and add the words authors can use to target and organize it.",
						order: 10,
					},
					{
						id: "presentation",
						title: "Player-facing text",
						description: "Control how the item appears in its parent and when examined.",
						order: 20,
					},
					{
						id: "behavior",
						title: "Behaviors",
						description: "Add standard capabilities without writing a custom command.",
						order: 30,
					},
					{
						id: "placement",
						title: "Where it begins",
						description: "Set the item's initial location, containment, and state.",
						order: 40,
					},
				],
			},
			duplicate: {
				duplicateBehavior: "with-new-id",
				idField: "id",
				idPrefix: "item",
			},
		},
	)
	.superRefine((item, ctx) => {
		const behaviorTypes = new Set<string>();
		item.behaviors.forEach((behavior, index) => {
			if (behaviorTypes.has(behavior.type)) {
				ctx.addIssue({
					code: "custom",
					message: `The ${behavior.type} behavior can only be added once.`,
					path: ["behaviors", index, "type"],
				});
			}
			behaviorTypes.add(behavior.type);
		});

		for (const requiredBy of ["lockable", "door"] as const) {
			if (behaviorTypes.has(requiredBy) && !behaviorTypes.has("openable")) {
				ctx.addIssue({
					code: "custom",
					message: `${requiredBy} items must also have the openable behavior.`,
					path: ["behaviors"],
				});
			}
		}

		if (item.initialState.open && !behaviorTypes.has("openable")) {
			ctx.addIssue({
				code: "custom",
				message: "Only openable items can start open.",
				path: ["initialState", "open"],
			});
		}
		if (item.initialState.locked && !behaviorTypes.has("lockable")) {
			ctx.addIssue({
				code: "custom",
				message: "Only lockable items can start locked.",
				path: ["initialState", "locked"],
			});
		}
		if (item.initialState.open && item.initialState.locked) {
			ctx.addIssue({
				code: "custom",
				message: "An item cannot start both open and locked.",
				path: ["initialState", "locked"],
			});
		}
	});

export type ItemSize = z.infer<typeof ItemSizeSchema>;
export type ItemCapacity = z.infer<typeof ItemCapacitySchema>;
export type UseTarget = z.infer<typeof UseTargetSchema>;
export type ItemBehavior = z.infer<typeof ItemBehaviorSchema>;
export type ItemLocation = z.infer<typeof ItemLocationSchema>;
export type ItemInitialState = z.infer<typeof ItemInitialStateSchema>;
export type Item = z.infer<typeof ItemSchema>;
