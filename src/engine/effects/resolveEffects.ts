import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";
import type {Effect, EffectGroup, PlayerItemActionEffect} from "@/schemas/world/effectSchema";
import {produce} from "immer";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {choose} from "@/utils/choose";
import {compareIds, generateUniqueId, idValue} from "@/utils/idUtils";
import type {Direction, World} from "@/schemas/world/worldSchema";
import type {UseTarget} from "@/schemas/world/itemSchema";
import {DIRECTIONS} from "@/schemas/world/directionSchema";
import {
	entityFlagMutationError,
	getEntityFlagDefinition,
} from "@/schemas/world/entityFlagDefinitions";
import {getEffect} from "../utils/lookupUtils";
import {teleport} from "../player/teleport";
import {kill} from "../player/kill";
import {silentlyMove} from "../player/move";
import {availableExitsMessage, commandHelpMessage} from "../player/playerGuidance";
import {lookAtRoom} from "../messages/createRoomMessage";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {
	canPlaceItem,
	directContents,
	findAuthoredItem,
	findBehavior,
	findItemState,
	itemAccess,
	keyUnlocks,
	playerCanCarry,
} from "../items/itemRuntime";
import {matchingItems} from "../items/itemCollections";
import {findVariable} from "../utils/lookupUtils";
import {createItemState} from "../states/createEntityState";
import {addEvent} from "../events/eventQueue";

// TODO: message effects are all screwed up when events fire them
export function resolveMessageEffect(world: World, game: GameState, effect: Effect): GameState {
	if (effect.type !== "message") {
		return game;
	}

	let message: GameMessage;
	switch (effect.operation) {
		case "show":
			message = createGameMessage(effect.message, "system");
			break;
		case "show-random":
			message = createGameMessage(choose(effect.messages) ?? "", "system");
			break;
		case "append-to-last":
			return appendLastMessage(game, effect.message, effect.format);
		case "describe-current-room":
			return lookAtRoom(world, game, !effect.allowShorten);
		case "list-available-exits":
			message = createGameMessage(availableExitsMessage(world, game), "system");
			break;
		case "show-command-help":
			message = createGameMessage(commandHelpMessage(world, game), "system");
			break;
		case "list-inventory": {
			const names = game.itemStates
				.filter((item) => item.location.type === "inventory")
				.map((item) => item.name);
			message = createGameMessage(
				names.length
					? `You are carrying:\n${names.map((name) => `- ${name}`).join("\n")}`
					: effect.emptyMessage,
				"system",
			);
			break;
		}
		case "list-contents": {
			const names = directContents(
				game,
				effect.itemId,
				effect.placement === "both" ? "either" : effect.placement,
			).map((item) => item.name);
			message = createGameMessage(
				names.length ? names.map((name) => `- ${name}`).join("\n") : effect.emptyMessage,
				"system",
			);
			break;
		}
		case "show-counter": {
			const found = findVariable(game.variables.counters, effect.variable);
			message = createGameMessage(
				`${effect.prefix}${found.exists ? found.value : 0}${effect.suffix}`,
				"system",
			);
			break;
		}
		case "show-saved-text": {
			const found = findVariable(game.variables.texts, effect.variable);
			message = createGameMessage(
				`${effect.prefix}${found.exists ? found.value : ""}${effect.suffix}`,
				"system",
			);
			break;
		}
		default:
			return game;
	}

	return produce(game, (draft) => {
		draft.messages.push(message);
	});
}

type EffectResolutionContext = {
	visitedRoomIdsAtStart: ReadonlySet<string>;
};

export function resolveWorldEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "world") return game;

	return produce(game, (draft) => {
		if ("flag" in effect) {
			const flagRecordIndex = draft.variables.flags.findIndex((record) =>
				Object.hasOwn(record, effect.flag),
			);
			const flagRecord = flagRecordIndex >= 0 ? draft.variables.flags[flagRecordIndex] : undefined;
			switch (effect.operation) {
				case "set-flag": {
					if (flagRecord) {
						flagRecord[effect.flag] = effect.value;
					} else {
						draft.variables.flags.push({
							[effect.flag]: effect.value,
						});
					}
					break;
				}

				case "toggle-flag": {
					if (flagRecord) {
						flagRecord[effect.flag] = !flagRecord[effect.flag];
					} else {
						draft.variables.flags.push({
							[effect.flag]: true,
						});
					}
					break;
				}

				case "delete-flag": {
					if (!flagRecord) {
						break;
					}

					delete flagRecord[effect.flag];

					// Remove the record if deleting the flag left it empty.
					if (Object.keys(flagRecord).length === 0) {
						draft.variables.flags.splice(flagRecordIndex, 1);
					}
					break;
				}
			}
			return;
		}

		if ("counter" in effect) {
			const counterRecordIndex = draft.variables.counters.findIndex((record) =>
				Object.hasOwn(record, effect.counter),
			);

			const counterRecord =
				counterRecordIndex >= 0 ? draft.variables.counters[counterRecordIndex] : undefined;

			switch (effect.operation) {
				case "set-counter": {
					if (counterRecord) {
						counterRecord[effect.counter] = effect.value;
					} else {
						draft.variables.counters.push({
							[effect.counter]: effect.value,
						});
					}
					break;
				}

				case "decrease-counter":
					if (counterRecord) {
						counterRecord[effect.counter] = counterRecord[effect.counter] - effect.amount;
					} else {
						draft.variables.counters.push({
							[effect.counter]: -effect.amount,
						});
					}
					break;

				case "increase-counter": {
					if (counterRecord) {
						counterRecord[effect.counter] = counterRecord[effect.counter] + effect.amount;
					} else {
						draft.variables.counters.push({
							[effect.counter]: effect.amount,
						});
					}
					break;
				}

				case "delete-counter": {
					if (!counterRecord) {
						break;
					}

					delete counterRecord[effect.counter];

					// Remove the record if deleting the counter left it empty.
					if (Object.keys(counterRecord).length === 0) {
						draft.variables.counters.splice(counterRecordIndex, 1);
					}
					break;
				}
				case "copy-counter":
				case "add-counter":
				case "subtract-counter":
				case "multiply-counter":
				case "divide-counter": {
					const source = findVariable(draft.variables.counters, effect.sourceCounter);
					if (!source.exists) break;
					const current = counterRecord?.[effect.counter] ?? 0;
					const value =
						effect.operation === "copy-counter"
							? source.value
							: effect.operation === "add-counter"
								? current + source.value
								: effect.operation === "subtract-counter"
									? current - source.value
									: effect.operation === "multiply-counter"
										? current * source.value
										: source.value === 0
											? current
											: Math.trunc(current / source.value);
					if (counterRecord) counterRecord[effect.counter] = value;
					else draft.variables.counters.push({[effect.counter]: value});
					break;
				}
				case "clamp-counter": {
					const low = Math.min(effect.min, effect.max);
					const high = Math.max(effect.min, effect.max);
					const value = Math.min(high, Math.max(low, counterRecord?.[effect.counter] ?? 0));
					if (counterRecord) counterRecord[effect.counter] = value;
					else draft.variables.counters.push({[effect.counter]: value});
					break;
				}
			}
			return;
		}

		if (!("text" in effect)) return;
		const textRecordIndex = draft.variables.texts.findIndex((record) =>
			Object.hasOwn(record, effect.text),
		);
		const textRecord = textRecordIndex >= 0 ? draft.variables.texts[textRecordIndex] : undefined;

		switch (effect.operation) {
			case "set-text":
				if (textRecord) textRecord[effect.text] = effect.value;
				else draft.variables.texts.push({[effect.text]: effect.value});
				break;
			case "delete-text":
				if (!textRecord) break;
				delete textRecord[effect.text];
				if (Object.keys(textRecord).length === 0) {
					draft.variables.texts.splice(textRecordIndex, 1);
				}
				break;
			case "copy-text":
			case "append-text":
			case "prepend-text":
			case "append-saved-text":
			case "prepend-saved-text": {
				const current = textRecord?.[effect.text] ?? "";
				const source = effect.sourceText
					? findVariable(draft.variables.texts, effect.sourceText)
					: undefined;
				const addition = source?.exists ? source.value : (effect.value ?? "");
				const value =
					effect.operation === "copy-text"
						? addition
						: effect.operation === "append-text" || effect.operation === "append-saved-text"
							? current + addition
							: addition + current;
				if (textRecord) textRecord[effect.text] = value;
				else draft.variables.texts.push({[effect.text]: value});
				break;
			}
		}
	});
}

export function resolveItemEffect(game: GameState, effect: Effect): GameState;
export function resolveItemEffect(world: World, game: GameState, effect: Effect): GameState;
export function resolveItemEffect(
	worldOrGame: World | GameState,
	gameOrEffect: GameState | Effect,
	effectOrUndefined?: Effect,
): GameState {
	const hasWorld = "rooms" in worldOrGame;
	const world = hasWorld ? worldOrGame : undefined;
	const game = (hasWorld ? gameOrEffect : worldOrGame) as GameState;
	const effect = (hasWorld ? effectOrUndefined : gameOrEffect) as Effect;
	if (effect.type !== "item") {
		return game;
	}
	const itemId = effect.itemId;
	const secondaryId =
		effect.operation === "place-inside"
			? effect.containerId
			: effect.operation === "place-on"
				? effect.surfaceId
				: effect.operation === "place-inside-validated" ||
					  effect.operation === "place-on-validated" ||
					  effect.operation === "move-contents"
					? effect.destinationItemId
					: undefined;

	return produce(game, (draft) => {
		const itemState = draft.itemStates.find((item) => compareIds(item.id, itemId));
		if (!itemState) return;

		switch (effect.operation) {
			case "set-name":
				itemState.name = effect.value;
				break;

			case "set-examine-text":
				itemState.description = effect.value;
				break;
			case "set-listing-text":
				itemState.listingText = effect.value;
				break;
			case "append-examine-text":
				itemState.description += effect.value;
				break;
			case "prepend-examine-text":
				itemState.description = effect.value + itemState.description;
				break;
			case "append-listing-text":
				itemState.listingText += effect.value;
				break;
			case "prepend-listing-text":
				itemState.listingText = effect.value + itemState.listingText;
				break;
			case "add-alias":
				if (!itemState.aliases.includes(effect.value)) itemState.aliases.push(effect.value);
				break;
			case "remove-alias":
				itemState.aliases = itemState.aliases.filter((alias) => alias !== effect.value);
				break;
			case "add-tag":
				if (!itemState.tags.includes(effect.value)) itemState.tags.push(effect.value);
				break;
			case "remove-tag":
				itemState.tags = itemState.tags.filter((tag) => tag !== effect.value);
				break;

			case "move-to-room":
				if (draft.roomStates.some((room) => compareIds(room.id, effect.roomId))) {
					itemState.location = {type: "room", roomId: effect.roomId};
				}
				break;

			case "move-to-inventory":
				itemState.location = {type: "inventory"};
				break;

			case "move-to-current-room":
				itemState.location = {type: "room", roomId: draft.player.currentRoom};
				break;

			case "place-inside":
				if (
					secondaryId &&
					!compareIds(itemState.id, secondaryId) &&
					draft.itemStates.some((item) => compareIds(item.id, secondaryId))
				) {
					itemState.location = {
						type: "item",
						itemId: secondaryId,
						placement: "inside",
					};
				}
				break;

			case "place-on":
				if (
					secondaryId &&
					!compareIds(itemState.id, secondaryId) &&
					draft.itemStates.some((item) => compareIds(item.id, secondaryId))
				) {
					itemState.location = {
						type: "item",
						itemId: secondaryId,
						placement: "on",
					};
				}
				break;
			case "place-inside-validated":
			case "place-on-validated": {
				const placement = effect.operation === "place-inside-validated" ? "inside" : "on";
				if (world && secondaryId && canPlaceItem(world, draft, itemId, secondaryId, placement)) {
					itemState.location = {type: "item", itemId: secondaryId, placement};
				}
				break;
			}

			case "hide":
				itemState.flags.hidden = true;
				break;

			case "reveal":
				itemState.flags.hidden = false;
				break;

			case "set-listed":
				itemState.listedInRoom = true;
				break;

			case "set-unlisted":
				itemState.listedInRoom = false;
				break;

			case "set-open":
				itemState.locked = false;
				itemState.open = true;
				break;

			case "set-closed":
				itemState.open = false;
				break;

			case "set-locked":
				itemState.open = false;
				itemState.locked = true;
				break;

			case "set-unlocked":
				itemState.locked = false;
				break;
			case "set-examined":
				itemState.flags.examined = true;
				break;
			case "set-unexamined":
				itemState.flags.examined = false;
				break;

			case "destroy":
				itemState.location = {type: "destroyed"};
				break;
			case "restore-start-location": {
				const authored = world ? findAuthoredItem(world, itemId, game) : undefined;
				if (authored) itemState.location = authored.initialState.location;
				break;
			}
			case "reset-state": {
				const authored = world ? findAuthoredItem(world, itemId, game) : undefined;
				if (!authored) break;
				const reset = createItemState(authored);
				itemState.name = reset.name;
				itemState.description = reset.description;
				itemState.aliases = reset.aliases;
				itemState.tags = reset.tags;
				itemState.behaviorTags = reset.behaviorTags;
				itemState.listedInRoom = reset.listedInRoom;
				itemState.listingText = reset.listingText;
				itemState.location = reset.location;
				itemState.open = reset.open;
				itemState.locked = reset.locked;
				itemState.flags = reset.flags;
				break;
			}
			case "apply-item-template": {
				const template = world ? findAuthoredItem(world, effect.templateItemId) : undefined;
				if (!template) break;
				const state = createItemState(template);
				itemState.name = state.name;
				itemState.description = state.description;
				itemState.aliases = state.aliases;
				itemState.tags = state.tags;
				itemState.behaviorTags = state.behaviorTags;
				itemState.listedInRoom = state.listedInRoom;
				itemState.listingText = state.listingText;
				itemState.open = state.open;
				itemState.locked = state.locked;
				itemState.flags = state.flags;
				break;
			}
			case "empty-into-room":
			case "empty-into-inventory":
				for (const child of draft.itemStates) {
					if (
						child.location.type === "item" &&
						compareIds(child.location.itemId, itemId) &&
						(effect.placement === "both" || child.location.placement === effect.placement)
					) {
						child.location =
							effect.operation === "empty-into-room"
								? {type: "room", roomId: draft.player.currentRoom}
								: {type: "inventory"};
					}
				}
				break;
			case "move-contents":
				if (!secondaryId || compareIds(secondaryId, itemId)) break;
				for (const child of draft.itemStates) {
					if (
						child.location.type === "item" &&
						compareIds(child.location.itemId, itemId) &&
						child.location.placement === effect.placement
					) {
						child.location = {type: "item", itemId: secondaryId, placement: effect.placement};
					}
				}
				break;
			case "set-flag":
			case "toggle-flag":
			case "delete-flag": {
				const operation = effect.operation.replace("-flag", "") as "set" | "toggle" | "delete";
				const definition = getEntityFlagDefinition("item", effect.flag);
				if (entityFlagMutationError("item", effect.flag, operation)) break;
				if (operation === "set" && "value" in effect) itemState.flags[effect.flag] = effect.value;
				if (operation === "toggle") itemState.flags[effect.flag] = !itemState.flags[effect.flag];
				if (operation === "delete" && !definition?.permanent) delete itemState.flags[effect.flag];
				break;
			}
		}
	});
}

export function resolveItemCollectionEffect(
	world: World,
	game: GameState,
	effect: Effect,
): GameState {
	if (effect.type !== "items") return game;
	if (effect.operation === "instantiate") {
		const template = findAuthoredItem(world, effect.templateItemId);
		if (!template) return game;
		return produce(game, (draft) => {
			const state = createItemState(template);
			state.id = generateUniqueId("item", draft.itemStates);
			state.templateItemId = template.id;
			if (effect.destination === "current-room") {
				state.location = {type: "room", roomId: draft.player.currentRoom};
			} else if (effect.destination === "inventory") {
				state.location = {type: "inventory"};
			}
			draft.itemStates.push(state);
		});
	}
	const matchedIds = matchingItems(world, game, effect).map((item) => item.id);
	return produce(game, (draft) => {
		for (const itemId of matchedIds) {
			const item = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
			if (!item) continue;
			switch (effect.operation) {
				case "move-matching-to-current-room":
					item.location = {type: "room", roomId: draft.player.currentRoom};
					break;
				case "move-matching-to-inventory":
					item.location = {type: "inventory"};
					break;
				case "move-matching-to-room":
					if (draft.roomStates.some((room) => compareIds(room.id, effect.roomId))) {
						item.location = {type: "room", roomId: effect.roomId};
					}
					break;
				case "place-matching-inside":
				case "place-matching-on": {
					const placement = effect.operation === "place-matching-inside" ? "inside" : "on";
					if (canPlaceItem(world, draft, itemId, effect.destinationItemId, placement)) {
						item.location = {type: "item", itemId: effect.destinationItemId, placement};
					}
					break;
				}
				case "destroy-matching":
					item.location = {type: "destroyed"};
					break;
				case "add-tag-to-matching":
					if (!item.tags.includes(effect.value)) item.tags.push(effect.value);
					break;
				case "remove-tag-from-matching":
					item.tags = item.tags.filter((tag) => tag !== effect.value);
					break;
				case "set-flag-on-matching":
					if (!entityFlagMutationError("item", effect.flag, "set")) {
						item.flags[effect.flag] = effect.value;
					}
					break;
				case "set-name-on-matching":
					item.name = effect.value;
					break;
				case "set-examine-text-on-matching":
					item.description = effect.value;
					break;
				case "set-listing-text-on-matching":
					item.listingText = effect.value;
					break;
			}
		}
	});
}

function withSystemMessage(game: GameState, text: string): GameState {
	return produce(game, (draft) => {
		draft.messages.push(createGameMessage(text, "system"));
	});
}

function runItemHook(
	world: World,
	game: GameState,
	group: EffectGroup | undefined,
	context: EffectResolutionContext,
): GameState {
	return group ? resolveEffects(world, game, group, context) : game;
}

function useTargetMatches(
	game: GameState,
	target: UseTarget,
	targetId: import("@/utils/idUtils").ID<"item"> | undefined,
): boolean {
	if (target.type === "none") return !targetId;
	if (!targetId || !itemAccess(game, targetId).reachable) return false;
	if (target.type === "any") return true;
	if (target.type === "item") return Boolean(target.itemId && compareIds(target.itemId, targetId));
	const state = findItemState(game, targetId);
	return Boolean(target.tag && state?.tags.includes(target.tag));
}

export function resolvePlayerItemAction(
	world: World,
	game: GameState,
	effect: PlayerItemActionEffect,
	context: EffectResolutionContext,
): GameState {
	const itemId = effect.itemId;
	const item = findItemState(game, itemId);
	const authored = findAuthoredItem(world, itemId, game);
	if (!item || !authored) return game;
	const access = itemAccess(game, itemId);

	switch (effect.operation) {
		case "take": {
			const behavior = findBehavior(authored, "takeable");
			if (!behavior) return game;
			if (access.carried) return withSystemMessage(game, `You're already carrying the ${item.name}.`);
			if (!access.reachable) return withSystemMessage(game, behavior.blockedMessage);
			if (behavior.allowedWhen && !evaluateCondition(world, game, behavior.allowedWhen)) {
				return withSystemMessage(game, behavior.blockedMessage);
			}
			if (!playerCanCarry(world, game, itemId)) {
				return withSystemMessage(game, "You can't carry any more.");
			}
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.location = {type: "inventory"};
			});
			return runItemHook(
				world,
				withSystemMessage(next, `You take the ${item.name}.`),
				behavior.afterTake,
				context,
			);
		}
		case "drop": {
			const behavior = findBehavior(authored, "takeable");
			if (!behavior) return game;
			if (!access.carried) return withSystemMessage(game, `You're not carrying the ${item.name}.`);
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.location = {type: "room", roomId: draft.player.currentRoom};
				draft.player.equippedItemIds = (draft.player.equippedItemIds ?? []).filter(
					(candidate) => !compareIds(candidate, itemId),
				);
			});
			return runItemHook(
				world,
				withSystemMessage(next, `You drop the ${item.name}.`),
				behavior.afterDrop,
				context,
			);
		}
		case "examine": {
			if (!access.visible) return game;
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.flags.examined = true;
			});
			const conditionalText = authored.examine.conditionalText
				.filter((fragment) => evaluateCondition(world, game, fragment.when))
				.map((fragment) => fragment.text)
				.filter(Boolean);
			return runItemHook(
				world,
				withSystemMessage(next, [item.description, ...conditionalText].join("\n")),
				authored.examine.afterExamine,
				context,
			);
		}
		case "open": {
			const behavior = findBehavior(authored, "openable");
			if (!behavior || !access.reachable) return game;
			if (item.locked) return withSystemMessage(game, behavior.blockedMessage);
			if (item.open) return withSystemMessage(game, `The ${item.name} is already open.`);
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.open = true;
			});
			return runItemHook(
				world,
				withSystemMessage(next, behavior.openMessage),
				behavior.afterOpen,
				context,
			);
		}
		case "close": {
			const behavior = findBehavior(authored, "openable");
			if (!behavior || !access.reachable) return game;
			if (!item.open) return withSystemMessage(game, `The ${item.name} is already closed.`);
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.open = false;
			});
			return runItemHook(
				world,
				withSystemMessage(next, behavior.closeMessage),
				behavior.afterClose,
				context,
			);
		}
		case "lock": {
			const behavior = findBehavior(authored, "lockable");
			if (!behavior || !access.reachable) return game;
			if (item.locked) return withSystemMessage(game, `The ${item.name} is already locked.`);
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) {
					state.open = false;
					state.locked = true;
				}
			});
			return runItemHook(world, withSystemMessage(next, "You lock it."), behavior.afterLock, context);
		}
		case "unlock": {
			const behavior = findBehavior(authored, "lockable");
			if (!behavior || !access.reachable) return game;
			if (!item.locked) return withSystemMessage(game, `The ${item.name} is already unlocked.`);
			const requestedKey = effect.keyItemId;
			const keyId =
				requestedKey ??
				game.itemStates.find(
					(candidate) =>
						itemAccess(game, candidate.id).carried && keyUnlocks(world, game, itemId, candidate.id),
				)?.id;
			if (!keyId || !itemAccess(game, keyId).carried || !keyUnlocks(world, game, itemId, keyId)) {
				return withSystemMessage(game, behavior.wrongKeyMessage);
			}
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.locked = false;
				if (behavior.consumesKey) {
					const key = draft.itemStates.find((candidate) => compareIds(candidate.id, keyId));
					if (key) key.location = {type: "destroyed"};
				}
			});
			return runItemHook(
				world,
				withSystemMessage(next, behavior.unlockMessage),
				behavior.afterUnlock,
				context,
			);
		}
		case "put-inside":
		case "put-on": {
			if (!access.carried) {
				return withSystemMessage(game, `You're not carrying the ${item.name}.`);
			}
			const parentId = effect.operation === "put-inside" ? effect.containerId : effect.surfaceId;
			const placement = effect.operation === "put-inside" ? "inside" : "on";
			if (
				!parentId ||
				!itemAccess(game, parentId).reachable ||
				!canPlaceItem(world, game, itemId, parentId, placement)
			) {
				return withSystemMessage(game, "It won't fit there.");
			}
			const parent = findItemState(game, parentId);
			const next = produce(game, (draft) => {
				const state = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
				if (state) state.location = {type: "item", itemId: parentId, placement};
			});
			return withSystemMessage(
				next,
				`You put the ${item.name} ${placement} the ${parent?.name ?? "item"}.`,
			);
		}
		case "use": {
			const behavior = findBehavior(authored, "usable");
			if (!behavior || !access.reachable) return game;
			const targetId = effect.targetItemId;
			const recipe = behavior.recipes.find(
				(candidate) =>
					useTargetMatches(game, candidate.target, targetId) &&
					(!candidate.when || evaluateCondition(world, game, candidate.when)),
			);
			return recipe
				? resolveEffects(world, game, recipe.outcome, context)
				: withSystemMessage(game, behavior.fallbackMessage);
		}
		default:
			return game;
	}
}

export function resolveRoomEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "room") {
		return game;
	}

	return produce(game, (draft) => {
		const targetRoomId = "roomId" in effect ? effect.roomId : draft.player.currentRoom;
		const roomState = draft.roomStates.find((room) => compareIds(room.id, targetRoomId));
		if (!roomState) {
			return;
		}

		switch (effect.operation) {
			case "set-name":
				roomState.name = effect.value;
				break;

			case "set-description":
				roomState.description = effect.value;
				break;

			case "set-short-description":
				roomState.shortDescription = effect.value;
				break;

			case "add-tag":
				if (!roomState.tags.includes(effect.tag)) {
					roomState.tags.push(effect.tag);
				}
				break;

			case "remove-tag":
				roomState.tags = roomState.tags.filter((tag) => tag !== effect.tag);
				break;
			case "add-alias":
				if (!roomState.aliases.includes(effect.value)) roomState.aliases.push(effect.value);
				break;
			case "remove-alias":
				roomState.aliases = roomState.aliases.filter((alias) => alias !== effect.value);
				break;

			case "set-active":
				roomState.flags.active = true;
				break;

			case "set-inactive":
				roomState.flags.active = false;
				break;
			case "set-flag":
			case "toggle-flag":
			case "delete-flag": {
				const operation = effect.operation.replace("-flag", "") as "set" | "toggle" | "delete";
				const definition = getEntityFlagDefinition("room", effect.flag);
				if (entityFlagMutationError("room", effect.flag, operation)) break;
				if (operation === "set" && "value" in effect) roomState.flags[effect.flag] = effect.value;
				if (operation === "toggle") roomState.flags[effect.flag] = !roomState.flags[effect.flag];
				if (operation === "delete" && !definition?.permanent) delete roomState.flags[effect.flag];
				break;
			}
			case "set-current-flag":
				if (!entityFlagMutationError("room", effect.flag, "set")) {
					roomState.flags[effect.flag] = effect.value ?? true;
				}
				break;
			case "toggle-current-flag":
				if (!entityFlagMutationError("room", effect.flag, "toggle")) {
					roomState.flags[effect.flag] = !roomState.flags[effect.flag];
				}
				break;
			case "delete-current-flag":
				if (!entityFlagMutationError("room", effect.flag, "delete")) {
					delete roomState.flags[effect.flag];
				}
				break;
		}
	});
}

export function resolveNavigationEffect(world: World, game: GameState, effect: Effect): GameState {
	if (effect.type !== "navigation") return game;
	switch (effect.operation) {
		case "move-to-room":
			return teleport(world, game, effect.roomId);
		case "move-in-direction":
			return silentlyMove(world, game, effect.direction);
		case "set-facing":
			return produce(game, (draft) => {
				draft.player.facing = effect.direction;
			});
		case "lock-exit":
		case "unlock-exit":
		case "lock-all-exits":
		case "unlock-all-exits":
			return produce(game, (draft) => {
				const room = draft.roomStates.find((candidate) => compareIds(candidate.id, effect.roomId));
				if (!room) return;
				if (effect.operation === "lock-all-exits") room.lockedExits = [...DIRECTIONS];
				else if (effect.operation === "unlock-all-exits") room.lockedExits = [];
				else if (effect.operation === "lock-exit") {
					const direction = effect.direction as Direction;
					if (!room.lockedExits.includes(direction)) room.lockedExits.push(direction);
				} else if ("direction" in effect) {
					room.lockedExits = room.lockedExits.filter((direction) => direction !== effect.direction);
				}
			});
	}
}

export function resolvePlayerEffect(world: World, game: GameState, effect: Effect): GameState {
	if (effect.type !== "player") {
		return game;
	}

	switch (effect.operation) {
		case "freeze":
			return produce(game, (draft) => {
				draft.player.freezeState.frozen = true;
				draft.player.freezeState.message = effect.freezeMessage;
				draft.player.freezeState.turns = effect.turns;
				draft.player.freezeState.startOfFreeze = game.player.turns;
			});
		case "unfreeze":
			return produce(game, (draft) => {
				draft.player.freezeState.frozen = false;
			});
		case "kill":
			return kill(world, game, effect.customDeathMessage);
		case "win":
			return produce(game, (draft) => {
				draft.player.hasWon = true;
				draft.messages.push(createGameMessage(effect.message, "system"));
			});
		case "end-game":
			return produce(game, (draft) => {
				draft.player.isEnded = true;
				draft.player.endingMessage = effect.message;
				draft.messages.push(createGameMessage(effect.message, "system"));
			});
		case "revive":
			return produce(game, (draft) => {
				draft.player.isDead = false;
				delete draft.player.customDeathMessage;
			});
		case "respawn": {
			const revived = produce(game, (draft) => {
				draft.player.isDead = false;
				delete draft.player.customDeathMessage;
				draft.player.freezeState = {};
			});
			return teleport(world, revived, effect.roomId);
		}
		case "equip":
			return produce(game, (draft) => {
				if (
					itemAccess(game, effect.itemId).carried &&
					!(draft.player.equippedItemIds ?? []).some((itemId) => compareIds(itemId, effect.itemId))
				) {
					draft.player.equippedItemIds ??= [];
					draft.player.equippedItemIds.push(effect.itemId);
				}
			});
		case "unequip":
			return produce(game, (draft) => {
				draft.player.equippedItemIds = (draft.player.equippedItemIds ?? []).filter(
					(itemId) => !compareIds(itemId, effect.itemId),
				);
			});
		case "set-carrying-capacity":
			return produce(game, (draft) => {
				draft.player.carryingCapacity = effect.capacity ?? 0;
			});
		case "clear-carrying-capacity":
			return produce(game, (draft) => {
				delete draft.player.carryingCapacity;
			});
		default:
			return game;
	}
}

export function resolveEventEffect(world: World, game: GameState, effect: Effect): GameState {
	if (effect.type !== "event") return game;
	if (effect.operation === "cancel") {
		return produce(game, (draft) => {
			draft.events = draft.events.filter((event) => !compareIds(event.id, effect.eventId));
		});
	}

	const existing = game.events.find((event) => compareIds(event.id, effect.eventId));
	if (!existing && (effect.operation === "schedule" || effect.operation === "reschedule")) {
		const authored = world.events?.find((event) => compareIds(event.id, effect.eventId));
		if (!authored) return game;
		return addEvent(
			game,
			produce(authored, (draft) => {
				draft.enabled = true;
				draft.lastSuccess = game.player.turns;
				if (effect.operation === "reschedule") draft.wait = effect.wait;
			}),
		);
	}

	return produce(game, (draft) => {
		const event = draft.events.find((candidate) => compareIds(candidate.id, effect.eventId));
		if (!event) return;
		switch (effect.operation) {
			case "schedule": {
				const authored = world.events?.find((candidate) => compareIds(candidate.id, effect.eventId));
				if (authored) {
					event.enabled = true;
					event.wait = authored.wait;
					event.disposable = authored.disposable;
					event.priority = authored.priority;
					event.branch = authored.branch;
				}
				event.lastSuccess = draft.player.turns;
				break;
			}
			case "enable":
				event.enabled = true;
				break;
			case "disable":
				event.enabled = false;
				break;
			case "reset-cooldown":
				event.lastSuccess = draft.player.turns;
				break;
			case "reschedule":
				event.enabled = true;
				event.wait = effect.wait;
				event.lastSuccess = draft.player.turns;
				break;
		}
	});
}

function advanceRandom(game: GameState): {game: GameState; value: number} {
	let state = game.player.randomState ?? 0x6d2b79f5;
	state ^= state << 13;
	state ^= state >>> 17;
	state ^= state << 5;
	state >>>= 0;
	return {
		game: produce(game, (draft) => {
			draft.player.randomState = state;
		}),
		value: state / 0x1_0000_0000,
	};
}

function resolveControlEffect(
	world: World,
	game: GameState,
	effect: Extract<Effect, {type: "control"}>,
	context?: EffectResolutionContext,
): GameState {
	if (effect.operation === "when") {
		const effectId = evaluateCondition(world, game, effect.condition)
			? effect.thenEffectId
			: effect.otherwiseEffectId;
		if (!effectId) return game;
		const group = getEffect(world, effectId);
		return group.type === "group"
			? resolveEffects(world, game, group, context)
			: resolveEffect(world, game, group, context);
	}
	if (effect.choices.length === 0) return game;
	const total = effect.choices.reduce((sum, choice) => sum + choice.weight, 0);
	if (!(total > 0)) return game;
	const random = advanceRandom(game);
	let cursor = random.value * total;
	const choice =
		effect.choices.find((candidate) => {
			cursor -= candidate.weight;
			return cursor < 0;
		}) ?? effect.choices.at(-1);
	if (!choice) return random.game;
	const group = getEffect(world, choice.effectId);
	return group.type === "group"
		? resolveEffects(world, random.game, group, context)
		: resolveEffect(world, random.game, group, context);
}

export function resolveEffect(
	world: World,
	game: GameState,
	effect: Effect,
	context?: EffectResolutionContext,
): GameState {
	return produce(game, (draft) => {
		switch (effect.type) {
			case "effect-ref":
				const foundEffect = getEffect(world, effect.effectId);
				return foundEffect.type === "group"
					? resolveEffects(world, draft, foundEffect, context)
					: resolveEffect(world, draft, foundEffect, context);
			case "world":
				return resolveWorldEffect(draft, effect);
			case "message":
				if (
					effect.operation === "describe-current-room" &&
					effect.allowShorten &&
					context &&
					!context.visitedRoomIdsAtStart.has(idValue(draft.player.currentRoom))
				) {
					return lookAtRoom(world, draft, true);
				}
				return resolveMessageEffect(world, draft, effect);
			case "item":
				return resolveItemEffect(world, draft, effect);
			case "items":
				return resolveItemCollectionEffect(world, draft, effect);
			case "room":
				return resolveRoomEffect(draft, effect);
			case "player":
				return [
					"take",
					"drop",
					"examine",
					"open",
					"close",
					"lock",
					"put-inside",
					"put-on",
					"unlock",
					"use",
				].includes(effect.operation)
					? resolvePlayerItemAction(
							world,
							draft,
							effect as PlayerItemActionEffect,
							context ?? {
								visitedRoomIdsAtStart: new Set(
									draft.roomStates
										.filter((roomState) => roomState.flags.visited)
										.map((roomState) => idValue(roomState.id)),
								),
							},
						)
					: resolvePlayerEffect(world, draft, effect);
			case "navigation":
				return resolveNavigationEffect(world, draft, effect);
			case "event":
				return resolveEventEffect(world, draft, effect);
			case "control":
				return resolveControlEffect(world, draft, effect, context);
			default:
				return draft;
		}
	});
}

export function resolveEffects(
	world: World,
	game: GameState,
	group: EffectGroup,
	context?: EffectResolutionContext,
): GameState {
	const resolutionContext =
		context ??
		({
			visitedRoomIdsAtStart: new Set(
				game.roomStates
					.filter((roomState) => roomState.flags.visited)
					.map((roomState) => idValue(roomState.id)),
			),
		} satisfies EffectResolutionContext);
	let newGameState = game;
	for (const effect of group.effects) {
		newGameState = resolveEffect(world, newGameState, effect, resolutionContext);
	}
	return newGameState;
}
