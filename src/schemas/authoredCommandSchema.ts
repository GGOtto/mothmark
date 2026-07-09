import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {EffectSchema} from "./effectSchema";
import {docify} from "../utils/docify";
import {
	editorAliasList,
	editorArray,
	editorBoolean,
	editorCondition,
	editorDiscriminatedUnion,
	editorEffects,
	editorEntityId,
	editorId,
	editorInput,
	editorMessage,
	editorObject,
	editorOptionalFlagKey,
	editorOptionalRoomId,
	editorPriority,
	editorScope,
	editorSelect,
	editorStringList,
	editorTagList,
	editorTextarea,
} from "./editorSchemaHelpers";

export const DefaultEmptyCondition = {
	type: "group" as const,
	operator: "all" as const,
	conditions: [],
};

export const DEFAULT_COMMAND_CONNECTORS = [
	"on",
	"onto",
	"in",
	"into",
	"inside",
	"with",
	"using",
	"to",
	"at",
	"through",
	"under",
	"beneath",
	"behind",
	"beside",
	"near",
	"against",
	"from",
	"out of",
	"off",
	"over",
	"across",
	"between",
	"about",
] as const;

export const DEFAULT_SPEECH_VERBS = [
	"say",
	"speak",
	"whisper",
	"shout",
	"yell",
	"tell",
	"ask",
] as const;

export const CommandFallbackBehaviorSchema = editorSelect(
	z.enum([
		"stop",
		"continue-authored",
		"run-generic",
		"run-generic-after-effects",
		"unknown-command",
	]),
	{
		title: "Fallback Behavior",
		description: docify(`
			Controls what happens after this authored command matches.

			stop:
			The authored command fully handles the input and no other command runs.

			continue-authored:
			The engine may continue checking lower-priority authored commands.

			run-generic:
			Skip authored effects and let the normal coded command handle the input.

			run-generic-after-effects:
			Run authored effects first, then run the normal coded command.

			unknown-command:
			Treat the input as unhandled if this command does not successfully resolve.
		`),
		options: [
			{
				label: "Stop",
				value: "stop",
				description: "The authored command fully handles the input and no other command runs.",
				tone: "success",
			},
			{
				label: "Continue Authored",
				value: "continue-authored",
				description: "The engine may continue checking lower-priority authored commands.",
			},
			{
				label: "Run Generic",
				value: "run-generic",
				description: "Skip authored effects and let the normal coded command handle the input.",
			},
			{
				label: "Run Generic After Effects",
				value: "run-generic-after-effects",
				description: "Run authored effects first, then run the normal coded command.",
			},
			{
				label: "Unknown Command",
				value: "unknown-command",
				description: "Treat the input as unhandled if this command does not successfully resolve.",
				tone: "warning",
			},
		],
	},
);

export const CommandTurnBehaviorSchema = editorSelect(
	z.enum(["default", "consume", "do-not-consume"]).default("default"),
	{
		title: "Turn Behavior",
		description: docify(`
			Controls whether this command consumes a turn.

			default:
			The engine decides based on the matched command and effects.

			consume:
			This command always consumes a turn when a success branch runs.

			do-not-consume:
			This command does not consume a turn unless an effect explicitly consumes one.
		`),
		options: [
			{
				label: "Default",
				value: "default",
				description: "The engine decides based on the matched command and effects.",
			},
			{
				label: "Consume",
				value: "consume",
				description: "This command always consumes a turn when a success branch runs.",
			},
			{
				label: "Do Not Consume",
				value: "do-not-consume",
				description: "This command does not consume a turn unless an effect explicitly consumes one.",
			},
		],
	},
);

export const CommandProtectedModeSchema = editorSelect(
	z.enum(["normal", "protected", "allow-override-protected"]).default("normal"),
	{
		title: "Protected Mode",
		description: docify(`
			Controls how this command interacts with protected developer commands.

			normal:
			Regular authored command behavior.

			protected:
			This command is treated as protected and should generally win against authored overrides.

			allow-override-protected:
			This authored command is explicitly allowed to override protected coded commands.
			Use carefully for commands like help, inventory, save, load, or debug behavior.
		`),
		options: [
			{
				label: "Normal",
				value: "normal",
				description: "Regular authored command behavior.",
			},
			{
				label: "Protected",
				value: "protected",
				description:
					"This command is treated as protected and should generally win against authored overrides.",
				tone: "warning",
			},
			{
				label: "Allow Override Protected",
				value: "allow-override-protected",
				description:
					"This authored command is explicitly allowed to override protected coded commands. Use carefully.",
				tone: "danger",
			},
		],
	},
);

export const CommandScopeSchema = editorScope(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("global").describe("This command can match anywhere in the world."),
		}),

		z.object({
			type: z.literal("room").describe("This command can only match in a specific room."),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The id of the room where this command is available.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("room-tag")
				.describe("This command can only match in rooms with a specific tag."),
			tag: editorInput({
				title: "Room Tag",
				description: "The room tag required for this command to be available.",
				placeholder: "indoors",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("item").describe("This command is attached to a specific item."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The id of the item this command is attached to.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-tag").describe("This command applies to items with a specific tag."),
			tag: editorInput({
				title: "Item Tag",
				description: "The item tag required for this command to apply.",
				placeholder: "food",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("feature").describe("This command is attached to a specific room feature."),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The id of the room containing the feature.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			featureId: editorEntityId("feature", {
				title: "Feature",
				description: "The id of the feature this command is attached to.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("feature-tag")
				.describe("This command applies to room features with a specific tag."),
			tag: editorInput({
				title: "Feature Tag",
				description: "The feature tag required for this command to apply.",
				placeholder: "door",
				required: true,
				layout: {
					width: "half",
					order: 1,
				},
			}).min(1),
			roomId: editorOptionalRoomId({
				title: "Room",
				description: "Optional room id. If provided, only features in this room are considered.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("This command is attached to a specific NPC."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The id of the NPC this command is attached to.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("npc-tag").describe("This command applies to NPCs with a specific tag."),
			tag: editorInput({
				title: "NPC Tag",
				description: "The NPC tag required for this command to apply.",
				placeholder: "guard",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("quest").describe("This command is available during a specific quest context."),
			questId: editorEntityId("quest", {
				title: "Quest",
				description: "The quest id this command belongs to.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Command Scope",
		description: docify(`
			Defines where an authored command is available.

			Scopes keep the editor manageable and help resolve conflicts.

			Common examples:
			- global: listen
			- room: touch mural only in chapel
			- feature: clean kitchen table
			- item: eat apple
			- npc: ask cook about rats
			- quest: report back to captain
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ResolvableEntityTypeSchema = editorSelect(
	z.enum([
		"room",
		"exit",
		"item",
		"feature",
		"container",
		"surface",
		"npc",
		"topic",
		"direction",
		"object",
		"any",
	]),
	{
		title: "Resolvable Entity Type",
		description: docify(`
			The kind of world entity that command text should resolve to.

			Use this to tell the parser whether text like "apple", "table", "north",
			or "rats" should be interpreted as an item, feature, direction, topic, NPC,
			or another world entity.
		`),
		options: [
			{
				label: "Room",
				value: "room",
				description: "A room or location.",
			},
			{
				label: "Exit",
				value: "exit",
				description: "An exit, connection, direction, or passage.",
			},
			{
				label: "Item",
				value: "item",
				description: "A portable or world-placed item.",
			},
			{
				label: "Feature",
				value: "feature",
				description: "A room feature or interactable room object.",
			},
			{
				label: "Container",
				value: "container",
				description: "A container that can hold items.",
			},
			{
				label: "Surface",
				value: "surface",
				description: "A surface that can have items placed on it.",
			},
			{
				label: "NPC",
				value: "npc",
				description: "A non-player character.",
			},
			{
				label: "Topic",
				value: "topic",
				description: "A conversation or knowledge topic.",
			},
			{
				label: "Direction",
				value: "direction",
				description: "A direction such as north, south, up, or out.",
			},
			{
				label: "Object",
				value: "object",
				description: "Any stateful object, including items and features.",
			},
			{
				label: "Any",
				value: "any",
				description: "Any resolvable entity type.",
			},
		],
	},
);

export const CommandTargetRequirementSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("exact").describe("The command target must resolve to one specific entity id."),
			entityId: editorInput({
				title: "Entity ID",
				description:
					"The exact entity id required for this target. This stays as a flexible id field because the entity type can vary.",
				placeholder: "apple",
				required: true,
				layout: {
					width: "half",
					order: 1,
				},
			}).min(1),
			entityType: ResolvableEntityTypeSchema.default("any").describe("The kind of entity expected."),
		}),

		z.object({
			type: z
				.literal("tag")
				.describe("The command target must resolve to an entity with a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The tag required on the resolved entity.",
				placeholder: "food",
				required: true,
				layout: {
					width: "half",
					order: 1,
				},
			}).min(1),
			entityType: ResolvableEntityTypeSchema.default("any").describe("The kind of entity expected."),
		}),

		z.object({
			type: z
				.literal("entity-type")
				.describe("The command target may be any entity of a specific type."),
			entityType: ResolvableEntityTypeSchema.describe(
				"The kind of entity this target must resolve to.",
			),
		}),

		z.object({
			type: z
				.literal("one-of")
				.describe("The command target must resolve to one of several specific entity ids."),
			entityIds: editorStringList(
				{
					title: "Allowed Entity IDs",
					description:
						"Allowed entity ids for this target. This stays as a flexible id list because the entity type can vary.",
					emptyState: {
						emptyTitle: "No allowed entities",
						emptyDescription: "Add one or more entity ids this target may resolve to.",
						emptyActionLabel: "Add entity id",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			entityType: ResolvableEntityTypeSchema.default("any").describe("The kind of entity expected."),
		}),

		z.object({
			type: z
				.literal("raw-text")
				.describe(
					"The command target is matched against raw normalized text instead of a resolved entity.",
				),
			text: editorInput({
				title: "Raw Text",
				description: "The normalized text that must appear in the command.",
				placeholder: "mothmark",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
			match: editorSelect(z.enum(["exact", "includes", "starts-with", "ends-with"]).default("exact"), {
				title: "Match Mode",
				description: "How the raw command text should be compared.",
				options: [
					{
						label: "Exact",
						value: "exact",
						description: "The raw text must exactly match.",
					},
					{
						label: "Includes",
						value: "includes",
						description: "The raw text may appear anywhere in the command.",
					},
					{
						label: "Starts With",
						value: "starts-with",
						description: "The command must start with this raw text.",
					},
					{
						label: "Ends With",
						value: "ends-with",
						description: "The command must end with this raw text.",
					},
				],
			}),
		}),

		z.object({
			type: z.literal("any").describe("Any resolved target is allowed."),
			entityType: ResolvableEntityTypeSchema.default("any").describe(
				"Optional entity type filter for the allowed target.",
			),
		}),
	]),
	{
		title: "Target Requirement",
		description: docify(`
			Describes what an object, target, NPC, topic, direction, or other command part
			must resolve to.

			Examples:
			- exact item apple
			- any item with tag food
			- any NPC
			- topic rats
			- raw phrase mothmark
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CommandPatternSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("verb-only").describe("Matches commands made of only a verb or verb alias."),
			verbs: editorStringList(
				{
					title: "Verbs",
					description:
						"Verb aliases that can trigger this command, such as listen, wait, pray, or sleep.",
					emptyState: {
						emptyTitle: "No verbs",
						emptyDescription: "Add at least one verb that triggers this pattern.",
						emptyActionLabel: "Add verb",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
		}),

		z.object({
			type: z.literal("verb-target").describe("Matches commands shaped like verb + target."),
			verbs: editorStringList(
				{
					title: "Verbs",
					description:
						"Verb aliases that can trigger this command, such as examine, read, touch, eat, or take.",
					emptyState: {
						emptyTitle: "No verbs",
						emptyDescription: "Add at least one verb that triggers this pattern.",
						emptyActionLabel: "Add verb",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			target: CommandTargetRequirementSchema.describe("The required target for this command."),
		}),

		z.object({
			type: z
				.literal("verb-object-connector-target")
				.describe("Matches commands shaped like verb + object + connector + target."),
			verbs: editorStringList(
				{
					title: "Verbs",
					description:
						"Verb aliases that can trigger this command, such as put, place, use, unlock, give, throw, or hide.",
					emptyState: {
						emptyTitle: "No verbs",
						emptyDescription: "Add at least one verb that triggers this pattern.",
						emptyActionLabel: "Add verb",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			object: CommandTargetRequirementSchema.describe(
				"The left-side object, such as apple in 'put apple on table'.",
			),
			connectors: editorStringList(
				{
					title: "Connectors",
					description:
						"Connector words that split the object and target, such as on, in, with, to, under, or about.",
					emptyState: {
						emptyTitle: "No connectors",
						emptyDescription: "Add at least one connector.",
						emptyActionLabel: "Add connector",
					},
					layout: {
						width: "full",
						order: 3,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			target: CommandTargetRequirementSchema.describe(
				"The right-side target, such as table in 'put apple on table'.",
			),
		}),

		z.object({
			type: z
				.literal("speech-phrase")
				.describe("Matches speech commands shaped like say/speak/whisper + phrase."),
			verbs: editorStringList({
				title: "Speech Verbs",
				description: "Speech verbs that can trigger this pattern.",
				emptyState: {
					emptyTitle: "No speech verbs",
					emptyDescription: "Add at least one speech verb.",
					emptyActionLabel: "Add speech verb",
				},
				layout: {
					width: "full",
					order: 1,
				},
			}).default([...DEFAULT_SPEECH_VERBS]),
			phrase: z
				.union([
					editorInput({
						title: "Phrase",
						description: "The required spoken phrase.",
						placeholder: "mothmark",
						required: true,
					}).min(1),
					CommandTargetRequirementSchema,
				])
				.describe("The required spoken phrase or topic-like phrase requirement."),
		}),

		z.object({
			type: z
				.literal("speech-npc-topic")
				.describe("Matches speech commands shaped like ask/tell + npc + about + topic."),
			verbs: editorStringList({
				title: "Speech Verbs",
				description: "Speech verbs that can trigger this pattern.",
				emptyState: {
					emptyTitle: "No speech verbs",
					emptyDescription: "Add at least one speech verb.",
					emptyActionLabel: "Add speech verb",
				},
				layout: {
					width: "full",
					order: 1,
				},
			}).default(["ask", "tell"]),
			npc: CommandTargetRequirementSchema.describe("The NPC being asked or told."),
			connectors: editorStringList({
				title: "Topic Connectors",
				description: "Topic connectors, usually about.",
				emptyState: {
					emptyTitle: "No topic connectors",
					emptyDescription: "Add at least one topic connector.",
					emptyActionLabel: "Add connector",
				},
				layout: {
					width: "full",
					order: 3,
				},
			}).default(["about"]),
			topic: CommandTargetRequirementSchema.describe("The topic being discussed."),
		}),

		z.object({
			type: z
				.literal("direction-only")
				.describe("Matches a bare direction command, such as north, south, up, or out."),
			directions: editorStringList(
				{
					title: "Directions",
					description: "Direction aliases that can trigger this command.",
					emptyState: {
						emptyTitle: "No directions",
						emptyDescription: "Add at least one direction alias.",
						emptyActionLabel: "Add direction",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
		}),

		z.object({
			type: z
				.literal("verb-direction")
				.describe("Matches movement-like commands shaped like verb + direction or verb + destination."),
			verbs: editorStringList(
				{
					title: "Movement Verbs",
					description: "Movement verbs such as go, enter, climb, crawl, cross, descend, or ascend.",
					emptyState: {
						emptyTitle: "No movement verbs",
						emptyDescription: "Add at least one movement verb.",
						emptyActionLabel: "Add verb",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			direction: CommandTargetRequirementSchema.describe(
				"The direction, exit, room, or destination to resolve.",
			),
		}),

		z.object({
			type: z
				.literal("raw-phrase")
				.describe("Matches one or more exact or fuzzy raw command phrases."),
			phrases: editorStringList(
				{
					title: "Raw Phrases",
					description: "Raw normalized phrases that can trigger this command.",
					emptyState: {
						emptyTitle: "No raw phrases",
						emptyDescription: "Add at least one raw phrase.",
						emptyActionLabel: "Add phrase",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			match: editorSelect(z.enum(["exact", "includes", "starts-with", "ends-with"]).default("exact"), {
				title: "Match Mode",
				description: "How the raw phrase should be matched against player input.",
				options: [
					{
						label: "Exact",
						value: "exact",
						description: "The raw phrase must exactly match the player input.",
					},
					{
						label: "Includes",
						value: "includes",
						description: "The raw phrase may appear anywhere inside the player input.",
					},
					{
						label: "Starts With",
						value: "starts-with",
						description: "The player input must start with the raw phrase.",
					},
					{
						label: "Ends With",
						value: "ends-with",
						description: "The player input must end with the raw phrase.",
					},
				],
			}),
		}),
	]),
	{
		title: "Command Pattern",
		description: docify(`
			A structured command matching pattern.

			Authors should choose from pattern types rather than writing grammar code.

			Supported examples:
			- listen
			- examine apple
			- put apple on table
			- use key with lock
			- give apple to cook
			- say mothmark
			- ask cook about rats
			- north
			- climb ladder
			- crawl through tunnel
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CommandResolutionSchema = editorObject(
	z.object({
		stripLeadingArticles: editorBoolean({
			title: "Strip Leading Articles",
			description: "If true, target resolution ignores leading articles like a, an, and the.",
			layout: {
				width: "half",
				order: 1,
			},
		}).default(true),

		preferInventory: editorBoolean({
			title: "Prefer Inventory",
			description: "If true, inventory items are preferred when resolving ambiguous targets.",
			layout: {
				width: "half",
				order: 2,
			},
		}).default(true),

		preferCurrentRoom: editorBoolean({
			title: "Prefer Current Room",
			description:
				"If true, visible entities in the current room are preferred when resolving ambiguous targets.",
			layout: {
				width: "half",
				order: 3,
			},
		}).default(true),

		allowInvisibleTargets: editorBoolean({
			title: "Allow Invisible Targets",
			description: "If true, this command can resolve targets that are not currently visible.",
			layout: {
				width: "half",
				order: 4,
			},
		}).default(false),

		allowUnreachableTargets: editorBoolean({
			title: "Allow Unreachable Targets",
			description: "If true, this command can resolve targets that are visible but not reachable.",
			layout: {
				width: "half",
				order: 5,
			},
		}).default(false),

		allowAmbiguousTargets: editorBoolean({
			title: "Allow Ambiguous Targets",
			description: "If true, the command may proceed even if multiple targets match.",
			layout: {
				width: "half",
				order: 6,
			},
		}).default(false),

		ambiguousTargetMessage: editorMessage({
			title: "Ambiguous Target Message",
			description:
				"Optional message to show when multiple targets match and the engine needs clarification.",
			placeholder: "Which one do you mean?",
			layout: {
				width: "full",
				order: 7,
			},
		}).default(""),
	}),
	{
		title: "Command Resolution",
		description: docify(`
			Configures how this authored command resolves player text into world entities.

			The first version can use a simple priority:
			1. Inventory item
			2. Current room visible item
			3. Current room feature
			4. NPC in current room
			5. Global known topic
		`),
	},
);

export const DefaultCommandResolution = {
	stripLeadingArticles: true,
	preferInventory: true,
	preferCurrentRoom: true,
	allowInvisibleTargets: false,
	allowUnreachableTargets: false,
	allowAmbiguousTargets: false,
	ambiguousTargetMessage: "",
} as const;

export const CommandBranchKindSchema = editorSelect(
	z.enum(["success", "failure", "before", "after"]),
	{
		title: "Branch Kind",
		description: docify(`
			Describes when a branch should be considered.

			success:
			A normal branch that handles a valid command.

			failure:
			A branch that handles a matched command whose requirements are not met.

			before:
			Runs before the primary success behavior when conditions pass.

			after:
			Runs after the primary success behavior when conditions pass.
		`),
		options: [
			{
				label: "Success",
				value: "success",
				description: "A normal branch that handles a valid command.",
				tone: "success",
			},
			{
				label: "Failure",
				value: "failure",
				description: "A branch that handles a matched command whose requirements are not met.",
				tone: "warning",
			},
			{
				label: "Before",
				value: "before",
				description: "Runs before the primary success behavior when conditions pass.",
			},
			{
				label: "After",
				value: "after",
				description: "Runs after the primary success behavior when conditions pass.",
			},
		],
	},
);

export const CommandBranchSchema = editorObject(
	z.object({
		id: editorId({
			title: "Branch ID",
			description: "Stable unique id for this command branch.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "Human-readable editor label for this branch.",
			placeholder: "Success with key",
			layout: {
				width: "half",
				order: 2,
			},
		}).default(""),

		kind: CommandBranchKindSchema.default("success").describe(
			"Whether this branch is success, failure, before, or after behavior.",
		),

		priority: editorPriority({
			title: "Priority",
			description: "Branch priority. Higher-priority matching branches should be considered first.",
			layout: {
				width: "half",
				order: 4,
			},
		}),

		conditions: editorCondition(ConditionSchema, {
			title: "Conditions",
			description: "Conditions that must pass for this branch to run.",
			layout: {
				width: "full",
				order: 5,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		}).default(DefaultEmptyCondition),

		effects: editorEffects(EffectSchema, {
			title: "Effects",
			description: "Effects to run when this branch is selected.",
			layout: {
				width: "full",
				order: 6,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		}),

		fallbackBehavior: CommandFallbackBehaviorSchema.default("stop").describe(
			"What command processing should do after this branch runs.",
		),

		consumeTurn: CommandTurnBehaviorSchema.describe("Whether this branch consumes a turn."),

		once: editorBoolean({
			title: "Run Once",
			description: "If true, this branch should only be allowed to run once per playthrough.",
			layout: {
				width: "half",
				order: 9,
			},
		}).default(false),

		setOnceFlag: editorOptionalFlagKey({
			title: "Set Once Flag",
			description:
				"Optional flag key to set after this branch runs, used to enforce once-only behavior.",
			layout: {
				width: "half",
				order: 10,
			},
		}),
	}),
	{
		title: "Command Branch",
		description: docify(`
			A conditional rule inside an authored command.

			Branches let one command handle multiple outcomes without creating separate commands.

			Example:
			Command: unlock cellar door with brass key

			Success branch:
			If player has brass key and door is locked:
			- unlock door
			- show success message

			Failure branch:
			If player does not have brass key:
			- show "You do not have the brass key."

			Failure branch:
			If door is already unlocked:
			- show "The cellar door is already unlocked."
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "branch",
		},
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CommandMessageVariableSchema = editorObject(
	z.object({
		key: editorInput({
			title: "Variable Key",
			description:
				"The variable token available in messages, such as object.theName or target.displayName.",
			placeholder: "object.theName",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}).min(1),

		description: editorTextarea({
			title: "Description",
			description: "Editor-facing explanation of what this variable inserts.",
			layout: {
				width: "full",
				order: 2,
			},
		}).default(""),

		example: editorInput({
			title: "Example",
			description: "Example rendered value for this variable.",
			placeholder: "the brass key",
			layout: {
				width: "half",
				order: 3,
			},
		}).default(""),
	}),
	{
		title: "Message Variable",
		description: docify(`
			Documents a message variable supported by this command.

			Useful variables include:
			- object.name
			- object.displayName
			- object.theName
			- object.aName
			- target.name
			- target.displayName
			- target.theName
			- target.aName
			- npc.name
			- room.name
			- connector
			- rawCommand
			- counter.someCounterId
		`),
	},
);

export const AuthorCommandSchema = editorObject(
	z.object({
		id: editorId({
			title: "Command ID",
			description: "Stable unique id for this authored command.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "Human-readable editor name for this authored command.",
			placeholder: "Unlock Cellar Door",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		description: editorTextarea({
			title: "Description",
			description: "Editor-facing notes explaining what this command does and when it should be used.",
			placeholder: "Handles unlocking the cellar door with the brass key.",
			layout: {
				width: "full",
				order: 3,
			},
		}).default(""),

		enabled: editorBoolean({
			title: "Enabled",
			description: "If false, this command is ignored without deleting it from the world.",
			layout: {
				width: "half",
				order: 4,
			},
		}).default(true),

		priority: editorPriority({
			title: "Priority",
			description:
				"Command priority. Higher-priority authored commands should match before lower-priority ones.",
			layout: {
				width: "half",
				order: 5,
			},
		}),

		protectedMode: CommandProtectedModeSchema.describe(
			"Controls whether this command can interact with protected developer commands.",
		),

		scope: CommandScopeSchema.default({type: "global"}).describe("Where this command is available."),

		tags: editorTagList("commands", {
			title: "Tags",
			description: "Editor and runtime tags used to organize, filter, or batch commands.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		aliases: editorAliasList({
			title: "Aliases",
			description:
				"Optional top-level verb aliases. Prefer putting verbs on patterns unless the command shares aliases across many patterns.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		connectors: editorStringList({
			title: "Connectors",
			description:
				"Connector words this command can use. These should be sorted longest-first by the parser before matching.",
			emptyState: {
				emptyTitle: "No connectors",
				emptyDescription: "Add connector words such as on, in, with, to, or about.",
				emptyActionLabel: "Add connector",
			},
			layout: {
				width: "full",
				order: 10,
			},
		}).default([...DEFAULT_COMMAND_CONNECTORS]),

		patterns: editorArray(CommandPatternSchema, {
			title: "Patterns",
			description: "Structured command patterns that can trigger this authored command.",
			emptyState: {
				emptyTitle: "No command patterns",
				emptyDescription: "Add at least one pattern so this command can match player input.",
				emptyActionLabel: "Add pattern",
			},
			duplicate: {
				duplicateBehavior: "exact",
			},
			layout: {
				width: "full",
				order: 11,
			},
		}).min(1),

		resolution: CommandResolutionSchema.default(DefaultCommandResolution).describe(
			"Target resolution behavior for this command.",
		),

		conditions: editorCondition(ConditionSchema, {
			title: "Conditions",
			description: "Top-level conditions that must pass before success branches are considered.",
			layout: {
				width: "full",
				order: 13,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		}).default(DefaultEmptyCondition),

		effects: editorEffects(EffectSchema, {
			title: "Effects",
			description:
				"Default success effects for this command. Prefer branches for complex commands with multiple outcomes.",
			layout: {
				width: "full",
				order: 14,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		}),

		elseEffects: editorEffects(EffectSchema, {
			title: "Else Effects",
			description:
				"Default effects to run when the command matches but top-level conditions fail and no failure branch handles it.",
			layout: {
				width: "full",
				order: 15,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		}),

		branches: editorArray(CommandBranchSchema, {
			title: "Branches",
			description: "Conditional success, failure, before, or after branches for this command.",
			emptyState: {
				emptyTitle: "No branches",
				emptyDescription: "Add branches for multiple success/failure outcomes.",
				emptyActionLabel: "Add branch",
			},
			duplicate: {
				duplicateBehavior: "with-new-id",
				idField: "id",
				idPrefix: "branch",
			},
			layout: {
				width: "full",
				order: 16,
			},
		}),

		failureMessage: editorMessage({
			title: "Failure Message",
			description:
				"Default fallback message when the command matches but cannot run and no failure branch handles it.",
			placeholder: "You cannot do that right now.",
			layout: {
				width: "full",
				order: 17,
			},
		}).default(""),

		noMatchMessage: editorMessage({
			title: "No Match Message",
			description:
				"Optional message for editor/debug use when this command does not match. Usually not shown to players.",
			placeholder: "This command did not match.",
			advanced: true,
			layout: {
				width: "full",
				order: 18,
			},
		}).default(""),

		consumeTurn: CommandTurnBehaviorSchema.describe(
			"Default turn consumption behavior for this command.",
		),

		fallbackBehavior: CommandFallbackBehaviorSchema.default("stop").describe(
			"Default command processing behavior after this command runs.",
		),

		stopProcessing: editorBoolean({
			title: "Stop Processing",
			description:
				"Legacy convenience field. If true, this command usually prevents lower-priority authored commands and generic coded commands from running.",
			advanced: true,
			layout: {
				width: "half",
				order: 21,
			},
		}).default(true),

		allowRepeat: editorBoolean({
			title: "Allow Repeat",
			description: "If false, this command should only succeed once unless reset by other state.",
			layout: {
				width: "half",
				order: 22,
			},
		}).default(true),

		onceFlag: editorOptionalFlagKey({
			title: "Once Flag",
			description: "Optional flag used to track whether this command has already succeeded.",
			layout: {
				width: "half",
				order: 23,
			},
		}),

		messageVariables: editorArray(CommandMessageVariableSchema, {
			title: "Message Variables",
			description: "Optional documentation for message variables this command expects or exposes.",
			advanced: true,
			emptyState: {
				emptyTitle: "No message variables",
				emptyDescription: "Add variable documentation for authored command messages.",
				emptyActionLabel: "Add variable",
			},
			duplicate: {
				duplicateBehavior: "exact",
			},
			layout: {
				width: "full",
				order: 24,
			},
		}),

		debugNotes: editorTextarea({
			title: "Debug Notes",
			description: "Optional implementation or debugging notes for developers and advanced authors.",
			advanced: true,
			layout: {
				width: "full",
				order: 25,
			},
		}).default(""),
	}),
	{
		title: "Authored Command",
		description: docify(`
			An authored command rule.

			Authored commands are editor-created interactions saved as world data.
			They do not contain real JavaScript or TypeScript.

			A command generally means:

			When the player input matches one of these patterns,
			and this command is available in the current scope,
			and these conditions pass,
			run these effects or the first matching branch.

			This schema supports:
			- global, room, item, feature, NPC, quest, and tag-based scopes
			- simple verb commands
			- verb + target commands
			- verb + object + connector + target commands
			- speech commands
			- direction and movement-like commands
			- raw phrase triggers
			- priority and conflict handling
			- target resolution settings
			- success and failure branches
			- fallback to generic coded commands
			- turn consumption control
			- once-only and repeatable commands
			- message variables
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "command",
		},
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type CommandFallbackBehavior = z.infer<typeof CommandFallbackBehaviorSchema>;
export type CommandTurnBehavior = z.infer<typeof CommandTurnBehaviorSchema>;
export type CommandProtectedMode = z.infer<typeof CommandProtectedModeSchema>;
export type CommandScope = z.infer<typeof CommandScopeSchema>;
export type ResolvableEntityType = z.infer<typeof ResolvableEntityTypeSchema>;
export type CommandTargetRequirement = z.infer<typeof CommandTargetRequirementSchema>;
export type CommandPattern = z.infer<typeof CommandPatternSchema>;
export type CommandResolution = z.infer<typeof CommandResolutionSchema>;
export type CommandBranchKind = z.infer<typeof CommandBranchKindSchema>;
export type CommandBranch = z.infer<typeof CommandBranchSchema>;
export type CommandMessageVariable = z.infer<typeof CommandMessageVariableSchema>;
export type AuthorCommand = z.infer<typeof AuthorCommandSchema>;
