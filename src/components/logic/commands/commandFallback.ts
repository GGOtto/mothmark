import type {CommandConditionBranch} from "@/schemas/world/commandLogicSchemas";
import type {CommandBlock} from "@/schemas/world/commandSchemas";
import {idValue, toID} from "@/utils/idUtils";

export function createBlockFallbackBehavior(block: CommandBlock): CommandConditionBranch {
	const blockId = idValue(block.id);
	return {
		id: toID("condition-branch", `${blockId}-fallback`),
	};
}
