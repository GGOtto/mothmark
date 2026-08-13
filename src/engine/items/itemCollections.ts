import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {ItemCollectionScopeSchema} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import type {z} from "zod";
import {rootItemLocation} from "./itemRuntime";

export type ItemCollectionQuery = {
	scope: z.infer<typeof ItemCollectionScopeSchema>;
	containerId?: ID<"item">;
	placement: "inside" | "on" | "both";
	tag?: string;
	includeNested: boolean;
};

function isDescendantOf(
	game: GameState,
	itemId: ID<"item">,
	containerId: ID<"item">,
	placement: ItemCollectionQuery["placement"],
): boolean {
	const seen = new Set<string>();
	let current = game.itemStates.find((item) => compareIds(item.id, itemId));
	while (current?.location.type === "item") {
		const parentId = current.location.itemId;
		if (compareIds(parentId, containerId)) {
			return placement === "both" || current.location.placement === placement;
		}
		if (seen.has(parentId.id)) return false;
		seen.add(parentId.id);
		current = game.itemStates.find((item) => compareIds(item.id, parentId));
	}
	return false;
}

export function matchingItems(_world: World, game: GameState, query: ItemCollectionQuery) {
	return game.itemStates.filter((item) => {
		if (item.location.type === "destroyed") return false;
		if (query.tag && !item.tags.includes(query.tag)) return false;

		switch (query.scope) {
			case "world":
				return true;
			case "current-room":
				if (!query.includeNested) {
					return (
						item.location.type === "room" && compareIds(item.location.roomId, game.player.currentRoom)
					);
				}
				const root = rootItemLocation(game, item.id);
				return root?.type === "room" && compareIds(root.roomId, game.player.currentRoom);
			case "inventory": {
				if (item.location.type === "inventory") return true;
				if (!query.includeNested) return false;
				return rootItemLocation(game, item.id)?.type === "inventory";
			}
			case "contents":
				if (!query.containerId || compareIds(item.id, query.containerId)) return false;
				if (query.includeNested) {
					return isDescendantOf(game, item.id, query.containerId, query.placement);
				}
				return (
					item.location.type === "item" &&
					compareIds(item.location.itemId, query.containerId) &&
					(query.placement === "both" || item.location.placement === query.placement)
				);
		}
	});
}
