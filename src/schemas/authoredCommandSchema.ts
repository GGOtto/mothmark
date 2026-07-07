import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {EffectSchema} from "./effectSchema";
import {docify} from "../utils/docify";

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

export const CommandFallbackBehaviorSchema = z
	.enum(["stop", "continue-authored", "run-generic", "run-generic-after-effects", "unknown-command"])
	.describe(
		docify(`
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
	);

export const CommandTurnBehaviorSchema = z
	.enum(["default", "consume", "do-not-consume"])
	.default("default")
	.describe(
		docify(`
			Controls whether this command consumes a turn.

			default:
			The engine decides based on the matched command and effects.

			consume:
			This command always consumes a turn when a success branch runs.

			do-not-consume:
			This command does not consume a turn unless an effect explicitly consumes one.
		`),
	);

export const CommandProtectedModeSchema = z
	.enum(["normal", "protected", "allow-override-protected"])
	.default("normal")
	.describe(
		docify(`
			Controls how this command interacts with protected developer commands.

			normal:
			Regular authored command behavior.

			protected:
			This command is treated as protected and should generally win against authored overrides.

			allow-override-protected:
			This authored command is explicitly allowed to override protected coded commands.
			Use carefully for commands like help, inventory, save, load, or debug behavior.
		`),
	);

export const CommandScopeSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("global").describe("This command can match anywhere in the world."),
		}),

		z.object({
			type: z.literal("room").describe("This command can only match in a specific room."),
			roomId: z.string().min(1).describe("The id of the room where this command is available."),
		}),

		z.object({
			type: z
				.literal("room-tag")
				.describe("This command can only match in rooms with a specific tag."),
			tag: z.string().min(1).describe("The room tag required for this command to be available."),
		}),

		z.object({
			type: z.literal("item").describe("This command is attached to a specific item."),
			itemId: z.string().min(1).describe("The id of the item this command is attached to."),
		}),

		z.object({
			type: z.literal("item-tag").describe("This command applies to items with a specific tag."),
			tag: z.string().min(1).describe("The item tag required for this command to apply."),
		}),

		z.object({
			type: z.literal("feature").describe("This command is attached to a specific room feature."),
			roomId: z.string().min(1).describe("The id of the room containing the feature."),
			featureId: z.string().min(1).describe("The id of the feature this command is attached to."),
		}),

		z.object({
			type: z
				.literal("feature-tag")
				.describe("This command applies to room features with a specific tag."),
			tag: z.string().min(1).describe("The feature tag required for this command to apply."),
			roomId: z
				.string()
				.min(1)
				.optional()
				.describe("Optional room id. If provided, only features in this room are considered."),
		}),

		z.object({
			type: z.literal("npc").describe("This command is attached to a specific NPC."),
			npcId: z.string().min(1).describe("The id of the NPC this command is attached to."),
		}),

		z.object({
			type: z.literal("npc-tag").describe("This command applies to NPCs with a specific tag."),
			tag: z.string().min(1).describe("The NPC tag required for this command to apply."),
		}),

		z.object({
			type: z.literal("quest").describe("This command is available during a specific quest context."),
			questId: z.string().min(1).describe("The quest id this command belongs to."),
		}),
	])
	.describe(
		docify(`
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
	);

export const ResolvableEntityTypeSchema = z
	.enum([
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
	])
	.describe(
		docify(`
			The kind of world entity that command text should resolve to.

			Use this to tell the parser whether text like "apple", "table", "north",
			or "rats" should be interpreted as an item, feature, direction, topic, NPC,
			or another world entity.
		`),
	);

export const CommandTargetRequirementSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("exact").describe("The command target must resolve to one specific entity id."),
			entityId: z.string().min(1).describe("The exact entity id required for this target."),
			entityType: ResolvableEntityTypeSchema.default("any").describe("The kind of entity expected."),
		}),

		z.object({
			type: z
				.literal("tag")
				.describe("The command target must resolve to an entity with a specific tag."),
			tag: z.string().min(1).describe("The tag required on the resolved entity."),
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
			entityIds: z.array(z.string().min(1)).min(1).describe("Allowed entity ids for this target."),
			entityType: ResolvableEntityTypeSchema.default("any").describe("The kind of entity expected."),
		}),

		z.object({
			type: z
				.literal("raw-text")
				.describe(
					"The command target is matched against raw normalized text instead of a resolved entity.",
				),
			text: z.string().min(1).describe("The normalized text that must appear in the command."),
			match: z
				.enum(["exact", "includes", "starts-with", "ends-with"])
				.default("exact")
				.describe("How the raw command text should be compared."),
		}),

		z.object({
			type: z.literal("any").describe("Any resolved target is allowed."),
			entityType: ResolvableEntityTypeSchema.default("any").describe(
				"Optional entity type filter for the allowed target.",
			),
		}),
	])
	.describe(
		docify(`
			Describes what an object, target, NPC, topic, direction, or other command part
			must resolve to.

			Examples:
			- exact item apple
			- any item with tag food
			- any NPC
			- topic rats
			- raw phrase mothmark
		`),
	);

export const CommandPatternSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("verb-only").describe("Matches commands made of only a verb or verb alias."),
			verbs: z
				.array(z.string().min(1))
				.min(1)
				.describe("Verb aliases that can trigger this command, such as listen, wait, pray, or sleep."),
		}),

		z.object({
			type: z.literal("verb-target").describe("Matches commands shaped like verb + target."),
			verbs: z
				.array(z.string().min(1))
				.min(1)
				.describe(
					"Verb aliases that can trigger this command, such as examine, read, touch, eat, or take.",
				),
			target: CommandTargetRequirementSchema.describe("The required target for this command."),
		}),

		z.object({
			type: z
				.literal("verb-object-connector-target")
				.describe("Matches commands shaped like verb + object + connector + target."),
			verbs: z
				.array(z.string().min(1))
				.min(1)
				.describe(
					"Verb aliases that can trigger this command, such as put, place, use, unlock, give, throw, or hide.",
				),
			object: CommandTargetRequirementSchema.describe(
				"The left-side object, such as apple in 'put apple on table'.",
			),
			connectors: z
				.array(z.string().min(1))
				.min(1)
				.describe(
					"Connector words that split the object and target, such as on, in, with, to, under, or about.",
				),
			target: CommandTargetRequirementSchema.describe(
				"The right-side target, such as table in 'put apple on table'.",
			),
		}),

		z.object({
			type: z
				.literal("speech-phrase")
				.describe("Matches speech commands shaped like say/speak/whisper + phrase."),
			verbs: z
				.array(z.string().min(1))
				.default([...DEFAULT_SPEECH_VERBS])
				.describe("Speech verbs that can trigger this pattern."),
			phrase: z
				.union([z.string().min(1), CommandTargetRequirementSchema])
				.describe("The required spoken phrase or topic-like phrase requirement."),
		}),

		z.object({
			type: z
				.literal("speech-npc-topic")
				.describe("Matches speech commands shaped like ask/tell + npc + about + topic."),
			verbs: z
				.array(z.string().min(1))
				.default(["ask", "tell"])
				.describe("Speech verbs that can trigger this pattern."),
			npc: CommandTargetRequirementSchema.describe("The NPC being asked or told."),
			connectors: z
				.array(z.string().min(1))
				.default(["about"])
				.describe("Topic connectors, usually about."),
			topic: CommandTargetRequirementSchema.describe("The topic being discussed."),
		}),

		z.object({
			type: z
				.literal("direction-only")
				.describe("Matches a bare direction command, such as north, south, up, or out."),
			directions: z
				.array(z.string().min(1))
				.min(1)
				.describe("Direction aliases that can trigger this command."),
		}),

		z.object({
			type: z
				.literal("verb-direction")
				.describe("Matches movement-like commands shaped like verb + direction or verb + destination."),
			verbs: z
				.array(z.string().min(1))
				.min(1)
				.describe("Movement verbs such as go, enter, climb, crawl, cross, descend, or ascend."),
			direction: CommandTargetRequirementSchema.describe(
				"The direction, exit, room, or destination to resolve.",
			),
		}),

		z.object({
			type: z
				.literal("raw-phrase")
				.describe("Matches one or more exact or fuzzy raw command phrases."),
			phrases: z
				.array(z.string().min(1))
				.min(1)
				.describe("Raw normalized phrases that can trigger this command."),
			match: z
				.enum(["exact", "includes", "starts-with", "ends-with"])
				.default("exact")
				.describe("How the raw phrase should be matched against player input."),
		}),
	])
	.describe(
		docify(`
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
	);

export const CommandResolutionSchema = z
	.object({
		stripLeadingArticles: z
			.boolean()
			.default(true)
			.describe("If true, target resolution ignores leading articles like a, an, and the."),
		preferInventory: z
			.boolean()
			.default(true)
			.describe("If true, inventory items are preferred when resolving ambiguous targets."),
		preferCurrentRoom: z
			.boolean()
			.default(true)
			.describe(
				"If true, visible entities in the current room are preferred when resolving ambiguous targets.",
			),
		allowInvisibleTargets: z
			.boolean()
			.default(false)
			.describe("If true, this command can resolve targets that are not currently visible."),
		allowUnreachableTargets: z
			.boolean()
			.default(false)
			.describe("If true, this command can resolve targets that are visible but not reachable."),
		allowAmbiguousTargets: z
			.boolean()
			.default(false)
			.describe("If true, the command may proceed even if multiple targets match."),
		ambiguousTargetMessage: z
			.string()
			.default("")
			.describe(
				"Optional message to show when multiple targets match and the engine needs clarification.",
			),
	})
	.describe(
		docify(`
			Configures how this authored command resolves player text into world entities.

			The first version can use a simple priority:
			1. Inventory item
			2. Current room visible item
			3. Current room feature
			4. NPC in current room
			5. Global known topic
		`),
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

export const CommandBranchKindSchema = z.enum(["success", "failure", "before", "after"]).describe(
	docify(`
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
);

export const CommandBranchSchema = z
	.object({
		id: z.string().min(1).describe("Stable unique id for this command branch."),
		name: z.string().default("").describe("Human-readable editor label for this branch."),
		kind: CommandBranchKindSchema.default("success").describe(
			"Whether this branch is success, failure, before, or after behavior.",
		),
		priority: z
			.number()
			.default(0)
			.describe("Branch priority. Higher-priority matching branches should be considered first."),
		conditions: ConditionSchema.default(DefaultEmptyCondition).describe(
			"Conditions that must pass for this branch to run.",
		),
		effects: z
			.array(EffectSchema)
			.default([])
			.describe("Effects to run when this branch is selected."),
		fallbackBehavior: CommandFallbackBehaviorSchema.default("stop").describe(
			"What command processing should do after this branch runs.",
		),
		consumeTurn: CommandTurnBehaviorSchema.describe("Whether this branch consumes a turn."),
		once: z
			.boolean()
			.default(false)
			.describe("If true, this branch should only be allowed to run once per playthrough."),
		setOnceFlag: z
			.string()
			.min(1)
			.optional()
			.describe(
				"Optional flag key to set after this branch runs, used to enforce once-only behavior.",
			),
	})
	.describe(
		docify(`
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
	);

export const CommandMessageVariableSchema = z
	.object({
		key: z
			.string()
			.min(1)
			.describe(
				"The variable token available in messages, such as object.theName or target.displayName.",
			),
		description: z
			.string()
			.default("")
			.describe("Editor-facing explanation of what this variable inserts."),
		example: z.string().default("").describe("Example rendered value for this variable."),
	})
	.describe(
		docify(`
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
	);

export const AuthorCommandSchema = z
	.object({
		id: z.string().min(1).describe("Stable unique id for this authored command."),
		name: z.string().min(1).describe("Human-readable editor name for this authored command."),
		description: z
			.string()
			.default("")
			.describe("Editor-facing notes explaining what this command does and when it should be used."),

		enabled: z
			.boolean()
			.default(true)
			.describe("If false, this command is ignored without deleting it from the world."),
		priority: z
			.number()
			.default(0)
			.describe(
				"Command priority. Higher-priority authored commands should match before lower-priority ones.",
			),
		protectedMode: CommandProtectedModeSchema.describe(
			"Controls whether this command can interact with protected developer commands.",
		),

		scope: CommandScopeSchema.default({type: "global"}).describe("Where this command is available."),
		tags: z
			.array(z.string().min(1))
			.default([])
			.describe("Editor and runtime tags used to organize, filter, or batch commands."),

		aliases: z
			.array(z.string().min(1))
			.default([])
			.describe(
				"Optional top-level verb aliases. Prefer putting verbs on patterns unless the command shares aliases across many patterns.",
			),
		connectors: z
			.array(z.string().min(1))
			.default([...DEFAULT_COMMAND_CONNECTORS])
			.describe(
				"Connector words this command can use. These should be sorted longest-first by the parser before matching.",
			),
		patterns: z
			.array(CommandPatternSchema)
			.min(1)
			.describe("Structured command patterns that can trigger this authored command."),

		resolution: CommandResolutionSchema.default(DefaultCommandResolution).describe(
			"Target resolution behavior for this command.",
		),

		conditions: ConditionSchema.default(DefaultEmptyCondition).describe(
			"Top-level conditions that must pass before success branches are considered.",
		),
		effects: z
			.array(EffectSchema)
			.default([])
			.describe(
				"Default success effects for this command. Prefer branches for complex commands with multiple outcomes.",
			),
		elseEffects: z
			.array(EffectSchema)
			.default([])
			.describe(
				"Default effects to run when the command matches but top-level conditions fail and no failure branch handles it.",
			),

		branches: z
			.array(CommandBranchSchema)
			.default([])
			.describe("Conditional success, failure, before, or after branches for this command."),

		failureMessage: z
			.string()
			.default("")
			.describe(
				"Default fallback message when the command matches but cannot run and no failure branch handles it.",
			),
		noMatchMessage: z
			.string()
			.default("")
			.describe(
				"Optional message for editor/debug use when this command does not match. Usually not shown to players.",
			),

		consumeTurn: CommandTurnBehaviorSchema.describe(
			"Default turn consumption behavior for this command.",
		),
		fallbackBehavior: CommandFallbackBehaviorSchema.default("stop").describe(
			"Default command processing behavior after this command runs.",
		),
		stopProcessing: z
			.boolean()
			.default(true)
			.describe(
				"Legacy convenience field. If true, this command usually prevents lower-priority authored commands and generic coded commands from running.",
			),

		allowRepeat: z
			.boolean()
			.default(true)
			.describe("If false, this command should only succeed once unless reset by other state."),
		onceFlag: z
			.string()
			.min(1)
			.optional()
			.describe("Optional flag used to track whether this command has already succeeded."),

		messageVariables: z
			.array(CommandMessageVariableSchema)
			.default([])
			.describe("Optional documentation for message variables this command expects or exposes."),
		debugNotes: z
			.string()
			.default("")
			.describe("Optional implementation or debugging notes for developers and advanced authors."),
	})
	.describe(
		docify(`
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
