import type {CommandConditionBranch} from "@/schemas/world/commandLogicSchemas";
import type {CommandBlock} from "@/schemas/world/commandSchemas";
import {idValue, toID} from "@/utils/idUtils";

export function createBlockFallbackBehavior(block: CommandBlock): CommandConditionBranch {
	const blockId = idValue(block.id);
	return {
		id: toID("condition-branch", `${blockId}-fallback`),
		always: {
			id: toID("effect", `${blockId}-fallback-effect`),
			name: "Fallback response",
			type: "group",
			effects: [
				{
					type: "message",
					operation: "show",
					message: "That part of the command does not resolve.",
				},
			],
			allowMultipleUsesInWorld: true,
		},
	};
}
