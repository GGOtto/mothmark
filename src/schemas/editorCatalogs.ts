import type {EditorOption} from "@/types/editor/editorMetadataTypes";

export const CONDITION_TYPE_OPTION_SOURCE = "schema.condition.types";
export const CONDITION_GROUP_OPERATOR_OPTION_SOURCE = "schema.condition.group.operations";
export const CONDITION_COMPARISON_OPERATOR_OPTION_SOURCE = "schema.condition.comparison-operators";
export const CONDITION_STRING_COMPARISON_OPERATOR_OPTION_SOURCE =
	"schema.condition.string-comparison-operators";
export const EFFECT_TYPE_OPTION_SOURCE = "schema.effect.types";

export const conditionTypeOptions: EditorOption[] = [
	{label: "Flag", value: "flag", description: "Checks a boolean world flag."},
	{label: "Counter", value: "counter", description: "Compares a numeric counter."},
	{label: "Current room", value: "current-room", description: "Checks where the player is."},
	{label: "Inventory", value: "inventory", description: "Checks the player's inventory."},
	{label: "Item location", value: "item-location", description: "Checks where an item exists."},
	{label: "Object state", value: "object-state", description: "Checks object state."},
	{label: "NPC", value: "npc", description: "Checks NPC state."},
	{label: "Command history", value: "command-history", description: "Checks recent commands."},
	{label: "Random chance", value: "random-chance", description: "Checks a probability."},
	{label: "Quest", value: "quest", description: "Checks quest state."},
	{label: "Scheduled event", value: "scheduled-event", description: "Checks scheduled event state."},
	{label: "Turn", value: "turn", description: "Checks the global turn count."},
	{
		label: "Resolved target",
		value: "resolved-target",
		description: "Checks parsed command targets.",
	},
	{label: "Group", value: "group", description: "Nests multiple conditions."},
];

export const conditionGroupOperatorOptions: EditorOption[] = [
	{label: "All conditions pass", value: "all", description: "Every child condition must pass."},
	{
		label: "Any condition passes",
		value: "any",
		description: "At least one child condition must pass.",
	},
	{label: "No conditions pass", value: "none", description: "No child condition may pass."},
];

export const comparisonOperatorOptions: EditorOption[] = [
	{label: "Equals", value: "eq"},
	{label: "Does not equal", value: "neq"},
	{label: "Greater than", value: "gt"},
	{label: "Greater than or equal to", value: "gte"},
	{label: "Less than", value: "lt"},
	{label: "Less than or equal to", value: "lte"},
];

export const stringComparisonOperatorOptions: EditorOption[] = [
	{label: "Equals", value: "eq"},
	{label: "Does not equal", value: "neq"},
	{label: "Includes", value: "includes"},
	{label: "Starts with", value: "starts-with"},
	{label: "Ends with", value: "ends-with"},
];

export const conditionOperationOptionsByType: Record<string, EditorOption[]> = {
	flag: [
		{label: "Equals", value: "equals"},
		{label: "Exists", value: "exists"},
		{label: "Missing", value: "missing"},
	],
	counter: [
		{label: "Compare", value: "compare"},
		{label: "Between", value: "between"},
		{label: "Exists", value: "exists"},
		{label: "Missing", value: "missing"},
	],
	"current-room": [
		{label: "Is", value: "is"},
		{label: "Is not", value: "is-not"},
		{label: "Has tag", value: "has-tag"},
		{label: "Missing tag", value: "missing-tag"},
	],
	inventory: [
		{label: "Has item", value: "has-item"},
		{label: "Missing item", value: "missing-item"},
		{label: "Has all items", value: "has-all-items"},
		{label: "Has any item", value: "has-any-item"},
		{label: "Contains tag", value: "contains-tag"},
		{label: "Missing tag", value: "missing-tag"},
		{label: "Count", value: "count"},
		{label: "Tag count", value: "tag-count"},
	],
	"item-location": [
		{label: "In inventory", value: "in-inventory"},
		{label: "In current room", value: "in-current-room"},
		{label: "In room", value: "in-room"},
		{label: "On surface", value: "on-surface"},
		{label: "In container", value: "in-container"},
		{label: "Held by NPC", value: "held-by-npc"},
		{label: "Hidden", value: "hidden"},
		{label: "Destroyed", value: "destroyed"},
		{label: "Visible", value: "visible"},
		{label: "Reachable", value: "reachable"},
	],
	"object-state": [
		{label: "Open", value: "open"},
		{label: "Closed", value: "closed"},
		{label: "Locked", value: "locked"},
		{label: "Unlocked", value: "unlocked"},
		{label: "Lit", value: "lit"},
		{label: "Unlit", value: "unlit"},
		{label: "Broken", value: "broken"},
		{label: "Intact", value: "intact"},
		{label: "Clean", value: "clean"},
		{label: "Dirty", value: "dirty"},
		{label: "Contains item", value: "contains-item"},
		{label: "Missing item", value: "missing-item"},
		{label: "Surface has item", value: "surface-has-item"},
		{label: "Surface missing item", value: "surface-missing-item"},
		{label: "Empty", value: "empty"},
		{label: "Custom", value: "custom"},
	],
	npc: [
		{label: "In current room", value: "in-current-room"},
		{label: "In room", value: "in-room"},
		{label: "Has item", value: "has-item"},
		{label: "Mood is", value: "mood-is"},
		{label: "Trust", value: "trust"},
		{label: "Met player", value: "met-player"},
		{label: "Not met player", value: "not-met-player"},
		{label: "Hostile", value: "hostile"},
		{label: "Friendly", value: "friendly"},
		{label: "Asleep", value: "asleep"},
		{label: "Awake", value: "awake"},
		{label: "Can see player", value: "can-see-player"},
		{label: "Cannot see player", value: "cannot-see-player"},
	],
	"command-history": [
		{label: "Previous command was", value: "previous-command-was"},
		{label: "Previous raw command was", value: "previous-raw-command-was"},
		{label: "Previous target was", value: "previous-target-was"},
		{label: "Used command before", value: "used-command-before"},
		{label: "Never used command", value: "never-used-command"},
		{label: "Used command within turns", value: "used-command-within-turns"},
		{label: "Repeated command", value: "repeated-command"},
		{label: "Sequence", value: "sequence"},
	],
	quest: [
		{label: "Not started", value: "not-started"},
		{label: "Active", value: "active"},
		{label: "Completed", value: "completed"},
		{label: "Failed", value: "failed"},
		{label: "Objective complete", value: "objective-complete"},
		{label: "Objective incomplete", value: "objective-incomplete"},
	],
	"scheduled-event": [
		{label: "Exists", value: "exists"},
		{label: "Missing", value: "missing"},
		{label: "Event scheduled", value: "event-scheduled"},
		{label: "Event not scheduled", value: "event-not-scheduled"},
		{label: "Tag scheduled", value: "tag-scheduled"},
		{label: "Tag not scheduled", value: "tag-not-scheduled"},
	],
	turn: [
		{label: "Compare", value: "compare"},
		{label: "Multiple of", value: "multiple-of"},
	],
	"resolved-target": [
		{label: "Object is", value: "object-is"},
		{label: "Target is", value: "target-is"},
		{label: "Connector is", value: "connector-is"},
		{label: "Topic is", value: "topic-is"},
		{label: "Direction is", value: "direction-is"},
	],
};

export const effectTypeOptions: EditorOption[] = [
	{label: "Show message", value: "message"},
	{label: "Set flag", value: "flag"},
	{label: "Counter", value: "counter"},
	{label: "Inventory", value: "inventory"},
	{label: "Item location", value: "item-location"},
	{label: "Object state", value: "object-state"},
	{label: "Move room", value: "room"},
	{label: "NPC", value: "npc"},
	{label: "Event", value: "event"},
	{label: "Flow", value: "flow"},
	{label: "Group", value: "group"},
	{label: "Conditional", value: "conditional"},
];

export const effectOperationOptionsByType: Record<string, EditorOption[]> = {
	message: [
		{label: "Show", value: "show"},
		{label: "Random", value: "random"},
		{label: "Append room description", value: "append-room-description"},
	],
	flag: [
		{label: "Set", value: "set"},
		{label: "Toggle", value: "toggle"},
		{label: "Clear", value: "clear"},
	],
	counter: [
		{label: "Set", value: "set"},
		{label: "Increase", value: "increase"},
		{label: "Decrease", value: "decrease"},
		{label: "Reset", value: "reset"},
		{label: "Clamp", value: "clamp"},
	],
	inventory: [
		{label: "Add item", value: "add"},
		{label: "Remove item", value: "remove"},
		{label: "Remove all with tag", value: "remove-all-with-tag"},
		{label: "Replace item", value: "replace"},
	],
	"item-location": [
		{label: "Move to room", value: "move-to-room"},
		{label: "Move to current room", value: "move-to-current-room"},
		{label: "Place on surface", value: "place-on-surface"},
		{label: "Place in container", value: "place-in-container"},
		{label: "Give to NPC", value: "give-to-npc"},
		{label: "Hide", value: "hide"},
		{label: "Reveal", value: "reveal"},
		{label: "Destroy", value: "destroy"},
		{label: "Create", value: "create"},
	],
	"object-state": [
		{label: "Open", value: "open"},
		{label: "Close", value: "close"},
		{label: "Lock", value: "lock"},
		{label: "Unlock", value: "unlock"},
		{label: "Light", value: "light"},
		{label: "Extinguish", value: "extinguish"},
		{label: "Break", value: "break"},
		{label: "Repair", value: "repair"},
		{label: "Clean", value: "clean"},
		{label: "Dirty", value: "dirty"},
		{label: "Set custom", value: "set-custom"},
	],
	room: [
		{label: "Move player", value: "move-player"},
		{label: "Set description variant", value: "set-description-variant"},
		{label: "Reveal exit", value: "reveal-exit"},
		{label: "Hide exit", value: "hide-exit"},
		{label: "Lock exit", value: "lock-exit"},
		{label: "Unlock exit", value: "unlock-exit"},
		{label: "Add tag", value: "add-tag"},
		{label: "Remove tag", value: "remove-tag"},
	],
	npc: [
		{label: "Move to room", value: "move-to-room"},
		{label: "Move to current room", value: "move-to-current-room"},
		{label: "Remove", value: "remove"},
		{label: "Set mood", value: "set-mood"},
		{label: "Increase trust", value: "increase-trust"},
		{label: "Decrease trust", value: "decrease-trust"},
		{label: "Make hostile", value: "make-hostile"},
		{label: "Make friendly", value: "make-friendly"},
		{label: "Start dialogue", value: "start-dialogue"},
		{label: "End dialogue", value: "end-dialogue"},
	],
	event: [
		{label: "Schedule", value: "schedule"},
		{label: "Cancel instance", value: "cancel"},
		{label: "Cancel by event", value: "cancel-by-event-id"},
		{label: "Cancel with tag", value: "cancel-with-tag"},
		{label: "Delay", value: "delay"},
		{label: "Repeat", value: "repeat"},
	],
	flow: [
		{label: "Stop processing", value: "stop-processing"},
		{label: "Continue processing", value: "continue-processing"},
		{label: "Run generic command afterward", value: "run-generic-command-afterward"},
		{label: "Prevent turn consumption", value: "prevent-turn-consumption"},
		{label: "Consume extra turn", value: "consume-extra-turn"},
	],
};

export const editorOptionCatalogs: Record<string, EditorOption[]> = {
	[CONDITION_TYPE_OPTION_SOURCE]: conditionTypeOptions,
	[CONDITION_GROUP_OPERATOR_OPTION_SOURCE]: conditionGroupOperatorOptions,
	[CONDITION_COMPARISON_OPERATOR_OPTION_SOURCE]: comparisonOperatorOptions,
	[CONDITION_STRING_COMPARISON_OPERATOR_OPTION_SOURCE]: stringComparisonOperatorOptions,
	[EFFECT_TYPE_OPTION_SOURCE]: effectTypeOptions,
};

for (const [type, options] of Object.entries(conditionOperationOptionsByType)) {
	editorOptionCatalogs[`schema.condition.${type}.operations`] = options;
}

for (const [type, options] of Object.entries(effectOperationOptionsByType)) {
	editorOptionCatalogs[`schema.effect.${type}.operations`] = options;
}

export function createDefaultConditionValue(type = "flag"): Record<string, unknown> {
	if (type === "group") return {type: "group", kind: "group", operator: "all", conditions: []};
	if (type === "counter") return {type, operation: "compare", counter: "", operator: "eq", value: 0};
	if (type === "current-room") return {type, operation: "is", roomId: ""};
	if (type === "inventory") return {type, operation: "has-item", itemId: ""};
	if (type === "item-location") return {type, operation: "in-inventory", itemId: ""};
	if (type === "object-state") return {type, operation: "open", objectId: ""};
	if (type === "npc") return {type, operation: "in-current-room", npcId: ""};
	if (type === "command-history") return {type, operation: "previous-command-was", commandName: ""};
	if (type === "random-chance") return {type, chance: 0.5, seedKey: "", invert: false};
	if (type === "quest") return {type, operation: "active", questId: ""};
	if (type === "scheduled-event") return {type, operation: "exists", instanceId: ""};
	if (type === "turn") return {type, operation: "compare", operator: "eq", value: 0};
	if (type === "resolved-target") return {type, operation: "object-is", objectId: ""};
	if (type === "has-item") return {type, itemId: "", negate: false};
	if (type === "room-history") return {type, roomId: "", history: "visited", value: true};
	if (type === "feature-examined") return {type, roomId: "", featureId: "", value: true};
	return {type, operation: "equals", flag: "", value: true};
}

export function createDefaultEffectValue(
	type: string,
	operationOptions: EditorOption[] = effectOperationOptionsByType[type] ?? [],
): Record<string, unknown> {
	const operation = operationOptions[0]?.value;
	if (type === "message") return {type, messageType: "show", text: ""};
	if (type === "flag") return {type, operation: operation ?? "set", flag: "", value: true};
	if (type === "counter") return {type, operation: operation ?? "set", counter: "", value: 0};
	if (type === "inventory") return {type, operation: operation ?? "add", itemId: ""};
	if (type === "item-location")
		return {type, operation: operation ?? "move-to-room", itemId: "", roomId: ""};
	if (type === "object-state") return {type, operation: operation ?? "open", objectId: ""};
	if (type === "room") return {type, operation: operation ?? "move-player", roomId: ""};
	if (type === "npc") return {type, operation: operation ?? "move-to-room", npcId: "", roomId: ""};
	if (type === "event") return {type, operation: operation ?? "schedule", eventId: ""};
	if (type === "group") return {type, effects: []};
	if (type === "conditional") return {type, when: [], then: [], otherwise: []};
	return {type, operation: operation ?? "stop-processing"};
}
