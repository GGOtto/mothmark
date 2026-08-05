import {CommandSchema} from "@/schemas/world/commandSchemas";
import {toID} from "@/utils/idUtils";

const travelPhrase = {
	id: toID("command-block", "command-block-1"),
	type: "phrase" as const,
	matches: ["go", "walk", "move", "travel", "head", "proceed", "run"],
};
const direction = {
	id: toID("command-block", "command-block-2"),
	type: "direction" as const,
	role: "direction",
	allowed: [],
};
const toRelation = {
	id: toID("command-block", "command-block-3"),
	type: "relation" as const,
	relation: "to" as const,
	aliasMode: "defaults" as const,
	aliases: [],
};
const thePhrase = {
	id: toID("command-block", "command-block-4"),
	type: "phrase" as const,
	matches: ["the"],
};
const directionVariable = {
	blockId: direction.id,
	field: "direction",
};

export const moveCommand = CommandSchema.parse({
	id: toID("command", "command-1"),
	name: "Travel",
	enabled: true,
	patterns: [
		{blocks: [travelPhrase, direction]},
		{blocks: [travelPhrase, toRelation, direction]},
		{blocks: [travelPhrase, toRelation, thePhrase, direction]},
		{blocks: [direction]},
	],
	scope: {scope: "global"},
	priority: 0,
	fallbacks: [
		{
			blockId: direction.id,
			behavior: {
				id: toID("condition-branch", "command-block-2-fallback"),
				always: {
					name: "Always",
					id: toID("effect", "command-1-always"),
					type: "group",
					effects: [
						{
							type: "message",
							operation: "show",
							commandVariables: [],
							message: "That's not a direction you can go.",
						},
					],
					allowMultipleUsesInWorld: true,
				},
				elifs: [],
			},
		},
	],
	behavior: {
		id: toID("condition-branch", "command-1-branch"),
		if: {
			condition: {
				type: "group",
				operation: "all",
				conditions: [
					{
						type: "current-room",
						operation: "is-exit-open",
						commandVariables: [directionVariable],
						direction: "n",
						id: toID("condition", "flag-1"),
						name: "Flag 1",
					},
				],
			},
			effect: {
				name: "If",
				id: toID("effect", "command-1-if"),
				type: "group",
				effects: [
					{
						type: "player",
						operation: "move-in-direction",
						commandVariables: [directionVariable],
						direction: "n",
					},
					{
						type: "message",
						operation: "current-room-description",
						allowShorten: true,
						commandVariables: [],
					},
				],
				allowMultipleUsesInWorld: true,
			},
			delayTurns: 0,
			cancelIfConditionFails: true,
		},
		elifs: [],
		else: {
			name: "Else",
			id: toID("effect", "command-1-else"),
			type: "group",
			effects: [
				{
					type: "message",
					operation: "show",
					commandVariables: [],
					message: "You can't go that way.",
				},
			],
			allowMultipleUsesInWorld: true,
		},
	},
});
