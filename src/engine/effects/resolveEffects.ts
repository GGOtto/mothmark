import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";
import type {Effect, EffectGroup, ItemActionEffect} from "@/schemas/world/effectSchema";
import {produce} from "immer";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {choose} from "@/utils/choose";
import {compareIds, idValue} from "@/utils/idUtils";
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
import {lookAtRoom} from "../messages/createRoomMessage";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {
	canPlaceItem,
	findAuthoredItem,
	findBehavior,
	findItemState,
	itemAccess,
	keyUnlocks,
} from "../items/itemRuntime";

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
		case "random":
			message = createGameMessage(choose(effect.messages) ?? "", "system");
			break;
		case "append-last-message":
			return appendLastMessage(game, effect.message, effect.format);
		case "current-room-description":
			return lookAtRoom(world, game, !effect.allowShorten);
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

export function resolveFlagEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "flag") {
		return game;
	}

	if (effect["flag-type"] === "room" || effect["flag-type"] === "item") {
		return produce(game, (draft) => {
			const definition = getEntityFlagDefinition(effect["flag-type"], effect.flag);
			if (entityFlagMutationError(effect["flag-type"], effect.flag, effect.operation)) return;

			const flags =
				effect["flag-type"] === "item"
					? draft.itemStates.find((item) => compareIds(item.id, effect.itemId))?.flags
					: draft.roomStates.find((room) => compareIds(room.id, effect.roomId))?.flags;
			if (!flags) return;

			switch (effect.operation) {
				case "set":
					flags[effect.flag] = effect.value;
					break;
				case "toggle":
					flags[effect.flag] = !flags[effect.flag];
					break;
				case "delete":
					if (!definition?.permanent) delete flags[effect.flag];
					break;
			}
		});
	}

	return produce(game, (draft) => {
		const flagRecordIndex = draft.variables.flags.findIndex((record) =>
			Object.hasOwn(record, effect.flag),
		);

		const flagRecord = flagRecordIndex >= 0 ? draft.variables.flags[flagRecordIndex] : undefined;

		switch (effect.operation) {
			case "create":
			case "set": {
				if (flagRecord) {
					flagRecord[effect.flag] = effect.value;
				} else {
					draft.variables.flags.push({
						[effect.flag]: effect.value,
					});
				}
				break;
			}

			case "toggle": {
				if (flagRecord) {
					flagRecord[effect.flag] = !flagRecord[effect.flag];
				} else {
					draft.variables.flags.push({
						[effect.flag]: true,
					});
				}
				break;
			}

			case "delete": {
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
	});
}

export function resolveCounterEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "counter") {
		return game;
	}

	return produce(game, (draft) => {
		const counterRecordIndex = draft.variables.counters.findIndex((record) =>
			Object.hasOwn(record, effect.counter),
		);

		const counterRecord =
			counterRecordIndex >= 0 ? draft.variables.counters[counterRecordIndex] : undefined;

		switch (effect.operation) {
			case "create":
			case "set": {
				if (counterRecord) {
					counterRecord[effect.counter] = effect.value;
				} else {
					draft.variables.counters.push({
						[effect.counter]: effect.value,
					});
				}
				break;
			}

			case "decrease":
				if (counterRecord) {
					counterRecord[effect.counter] = counterRecord[effect.counter] - effect.amount;
				} else {
					draft.variables.counters.push({
						[effect.counter]: -effect.amount,
					});
				}
				break;

			case "increase": {
				if (counterRecord) {
					counterRecord[effect.counter] = counterRecord[effect.counter] + effect.amount;
				} else {
					draft.variables.counters.push({
						[effect.counter]: effect.amount,
					});
				}
				break;
			}

			case "delete": {
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
		}
	});
}

export function resolveTextEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "text") return game;

	return produce(game, (draft) => {
		const textRecordIndex = draft.variables.texts.findIndex((record) =>
			Object.hasOwn(record, effect.text),
		);
		const textRecord = textRecordIndex >= 0 ? draft.variables.texts[textRecordIndex] : undefined;

		switch (effect.operation) {
			case "create":
			case "set":
				if (textRecord) textRecord[effect.text] = effect.value;
				else draft.variables.texts.push({[effect.text]: effect.value});
				break;
			case "delete":
				if (!textRecord) break;
				delete textRecord[effect.text];
				if (Object.keys(textRecord).length === 0) {
					draft.variables.texts.splice(textRecordIndex, 1);
				}
				break;
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
				: effect.operation === "move-contents"
					? effect.destinationItemId
					: undefined;

	return produce(game, (draft) => {
		const itemState = draft.itemStates.find((item) => compareIds(item.id, itemId));
		if (!itemState) return;

		switch (effect.operation) {
			case "change-name":
				itemState.name = effect.value;
				break;

			case "change-examine-text":
				itemState.description = effect.value;
				break;
			case "change-listing-text":
				itemState.listingText = effect.value;
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

			case "drop-in-current-room":
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

			case "hide":
				itemState.flags.hidden = true;
				break;

			case "reveal":
				itemState.flags.hidden = false;
				break;

			case "list-in-room":
				itemState.listedInRoom = true;
				break;

			case "unlist-in-room":
				itemState.listedInRoom = false;
				break;

			case "open":
				itemState.locked = false;
				itemState.open = true;
				break;

			case "close":
				itemState.open = false;
				break;

			case "lock":
				itemState.open = false;
				itemState.locked = true;
				break;

			case "unlock":
				itemState.locked = false;
				break;
			case "mark-examined":
				itemState.flags.examined = true;
				break;
			case "mark-unexamined":
				itemState.flags.examined = false;
				break;

			case "destroy":
				itemState.location = {type: "destroyed"};
				break;
			case "restore-start-location": {
				const authored = world ? findAuthoredItem(world, itemId) : undefined;
				if (authored) itemState.location = authored.initialState.location;
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

export function resolveItemActionEffect(
	world: World,
	game: GameState,
	effect: ItemActionEffect,
	context: EffectResolutionContext,
): GameState {
	const itemId = effect.itemId;
	const item = findItemState(game, itemId);
	const authored = findAuthoredItem(world, itemId);
	if (!item || !authored) return game;
	const access = itemAccess(game, itemId);

	switch (effect.action) {
		case "take": {
			const behavior = findBehavior(authored, "takeable");
			if (!behavior) return game;
			if (access.carried) return withSystemMessage(game, `You're already carrying the ${item.name}.`);
			if (!access.reachable) return withSystemMessage(game, behavior.blockedMessage);
			if (behavior.allowedWhen && !evaluateCondition(world, game, behavior.allowedWhen)) {
				return withSystemMessage(game, behavior.blockedMessage);
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
			return runItemHook(
				world,
				withSystemMessage(next, item.description),
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
			const parentId = effect.action === "put-inside" ? effect.containerId : effect.surfaceId;
			const placement = effect.action === "put-inside" ? "inside" : "on";
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
	}
}

export function resolveRoomEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "room") {
		return game;
	}

	if (effect.operation === "move-player-to") {
		return produce(game, (draft) => {
			draft.player.currentRoom = effect.roomId;
			const destinationState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
			if (destinationState) {
				destinationState.flags.visited = true;
			}
		});
	}

	return produce(game, (draft) => {
		const roomState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
		if (!roomState) {
			return;
		}

		switch (effect.operation) {
			case "set-name":
				roomState.name = effect.variantId;
				break;

			case "set-description":
				roomState.description = effect.variantId;
				break;

			case "set-short-description":
				roomState.shortDescription = effect.variantId;
				break;

			case "lock-exit": {
				const direction = effect.direction as Direction;
				if (!roomState.lockedExits.includes(direction)) {
					roomState.lockedExits.push(direction);
				}
				break;
			}

			case "unlock-exit": {
				const direction = effect.direction as Direction;
				roomState.lockedExits = roomState.lockedExits.filter((candidate) => candidate !== direction);
				break;
			}

			case "lock-all-exits":
				roomState.lockedExits = [...DIRECTIONS];
				break;

			case "unlock-all-exits":
				roomState.lockedExits = [];
				break;

			case "add-tag":
				if (!roomState.tags.includes(effect.tag)) {
					roomState.tags.push(effect.tag);
				}
				break;

			case "remove-tag":
				roomState.tags = roomState.tags.filter((tag) => tag !== effect.tag);
				break;

			case "set-active":
				roomState.flags.active = true;
				break;

			case "set-inactive":
				roomState.flags.active = false;
				break;
		}
	});
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
		case "teleport":
			return teleport(world, game, effect.roomId);
		case "move-in-direction":
			return silentlyMove(world, game, effect.direction);
	}
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
			case "flag":
				return resolveFlagEffect(draft, effect);
			case "message":
				if (
					effect.operation === "current-room-description" &&
					effect.allowShorten &&
					context &&
					!context.visitedRoomIdsAtStart.has(idValue(draft.player.currentRoom))
				) {
					return lookAtRoom(world, draft, true);
				}
				return resolveMessageEffect(world, draft, effect);
			case "counter":
				return resolveCounterEffect(draft, effect);
			case "text":
				return resolveTextEffect(draft, effect);
			case "item":
				return resolveItemEffect(world, draft, effect);
			case "item-action":
				return resolveItemActionEffect(
					world,
					draft,
					effect,
					context ?? {
						visitedRoomIdsAtStart: new Set(
							draft.roomStates
								.filter((roomState) => roomState.flags.visited)
								.map((roomState) => idValue(roomState.id)),
						),
					},
				);
			case "room":
				return effect.operation === "move-player-to"
					? teleport(world, draft, effect.roomId)
					: resolveRoomEffect(draft, effect);
			case "player":
				return resolvePlayerEffect(world, draft, effect);
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
