import type {GameMessage, GameState} from "@/schemas/states/gameStateSchema";
import {type Effect} from "@/schemas/world/effectSchema";
import {produce} from "immer";
import {appendLastMessage, createGameMessage} from "../messages/createMessage";
import {choose} from "@/utils/choose";
import {compareIds} from "@/utils/idUtils";

export function resolveMessageEffect(game: GameState, effect: Effect): GameState {
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
		default:
			return game;
	}

	return produce(game, (draft) => {
		draft.messages.push(message);
	});
}

export function resolveFlagEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "flag") {
		return game;
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

export function resolveFeatureEffect(game: GameState, effect: Effect): GameState {
	if (effect.type !== "feature") {
		return game;
	}

	return produce(game, (draft) => {
		const roomState = draft.roomStates.find((room) => compareIds(room.id, effect.roomId));
		if (!roomState) {
			return;
		}

		const featureStateIndex = roomState.featureStates.findIndex((feature) =>
			compareIds(feature.id, effect.featureId),
		);
		const featureState = roomState.featureStates[featureStateIndex];
		if (!featureState) {
			return;
		}

		switch (effect.operation) {
			case "change-name":
				featureState.name = effect.value;
				break;

			case "change-description":
				featureState.description = effect.value;
				break;

			case "move-to-room": {
				const newRoomState = draft.roomStates.find((room) => compareIds(room.id, effect.newRoomId));
				if (!newRoomState || newRoomState === roomState) {
					break;
				}

				roomState.featureStates.splice(featureStateIndex, 1);
				newRoomState.featureStates.push(featureState);
				break;
			}

			case "hide-from-player":
				featureState.flags.hidden = true;
				break;

			case "show-to-player":
				featureState.flags.hidden = false;
				break;

			case "show-in-room-description":
				featureState.flags.listedInRoom = true;
				break;

			case "hide-in-room-description":
				featureState.flags.listedInRoom = false;
				break;

			case "destroy":
				roomState.featureStates.splice(featureStateIndex, 1);
				break;
		}
	});
}
