import {defineStorageMigration, unchanged} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function without(value: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function migratedBindings(
	value: unknown,
	fieldNames: Record<string, string> = {},
): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((binding) => {
		if (!isRecord(binding) || typeof binding.field !== "string") return [];
		return [{...binding, field: fieldNames[binding.field] ?? binding.field}];
	});
}

function withRenamedBindings(
	value: Record<string, unknown>,
	fieldNames: Record<string, string>,
): Record<string, unknown> {
	if (!Array.isArray(value.commandVariables)) return value;
	return {...value, commandVariables: migratedBindings(value.commandVariables, fieldNames)};
}

function flattenItemCondition(
	condition: Record<string, unknown>,
	test: Record<string, unknown>,
	fields: Record<string, unknown>,
	bindingNames: Record<string, string> = {},
): Record<string, unknown> {
	const base = without(condition, "test", "commandVariables");
	const outerBindings = migratedBindings(condition.commandVariables);
	const nestedBindings = migratedBindings(test.commandVariables, bindingNames);
	const commandVariables = [...outerBindings, ...nestedBindings];
	return {
		...base,
		...fields,
		...(commandVariables.length > 0 ? {commandVariables} : {}),
	};
}

function migrateItemCondition(condition: Record<string, unknown>): Record<string, unknown> {
	if (!isRecord(condition.test)) return condition;
	const test = condition.test;
	const stateOperations: Record<string, string> = {
		visible: "is-visible",
		reachable: "is-reachable",
		known: "is-known",
		carried: "is-carried",
		hidden: "is-hidden",
		destroyed: "is-destroyed",
		examined: "is-examined",
		listed: "is-listed",
		open: "is-open",
		locked: "is-locked",
	};
	if (test.type === "state" && typeof test.state === "string" && stateOperations[test.state]) {
		return flattenItemCondition(condition, test, {
			operation: stateOperations[test.state],
			value: test.value,
		});
	}
	if (test.type === "location") {
		switch (test.location) {
			case "current-room":
				return flattenItemCondition(condition, test, {operation: "is-in-current-room"});
			case "inventory":
				return flattenItemCondition(condition, test, {operation: "is-in-inventory"});
			case "hidden":
				return flattenItemCondition(condition, test, {operation: "location-is-hidden", value: true});
			case "destroyed":
				return flattenItemCondition(condition, test, {operation: "location-is-destroyed", value: true});
			case "room":
				return flattenItemCondition(condition, test, {operation: "is-in-room", roomId: test.roomId});
			case "inside-item":
				return flattenItemCondition(condition, test, {
					operation: "is-inside",
					parentItemId: test.parentItemId,
				});
			case "on-item":
				return flattenItemCondition(condition, test, {
					operation: "is-on",
					parentItemId: test.parentItemId,
				});
		}
	}
	if (test.type === "important-tag")
		return flattenItemCondition(
			condition,
			test,
			{operation: "has-behavior", behavior: test.tag, value: test.value},
			{tag: "behavior"},
		);
	if (test.type === "tag")
		return flattenItemCondition(condition, test, {
			operation: "has-tag",
			tag: test.tag,
			value: test.value,
		});
	if (test.type === "contents") {
		if (test.test === "empty")
			return flattenItemCondition(condition, test, {
				operation: "contents-empty",
				placement: test.placement,
				value: test.value,
			});
		if (test.test === "contains-item")
			return flattenItemCondition(
				condition,
				test,
				{operation: "contains-item", containedItemId: test.itemId, placement: test.placement},
				{itemId: "containedItemId"},
			);
		if (test.test === "contains-tag")
			return flattenItemCondition(condition, test, {
				operation: "contains-tag",
				tag: test.tag,
				placement: test.placement,
			});
	}
	if (test.type === "capacity") {
		if (test.test === "empty")
			return flattenItemCondition(condition, test, {
				operation: "capacity-is-empty",
				placement: test.placement,
				value: test.value,
			});
		if (test.test === "full")
			return flattenItemCondition(condition, test, {
				operation: "capacity-is-full",
				placement: test.placement,
				value: test.value,
			});
		if (test.test === "can-fit")
			return flattenItemCondition(
				condition,
				test,
				{operation: "can-fit-item", candidateItemId: test.itemId, placement: test.placement},
				{itemId: "candidateItemId"},
			);
	}
	if (test.type === "can-unlock") {
		const withoutSubjectBinding = {
			...condition,
			commandVariables: migratedBindings(condition.commandVariables).filter(
				(binding) => binding.field !== "itemId",
			),
		};
		return flattenItemCondition(
			withoutSubjectBinding,
			test,
			{itemId: test.lockItemId, operation: "can-be-unlocked-by", keyItemId: test.keyItemId},
			{lockItemId: "itemId"},
		);
	}
	if (test.type === "door") {
		return flattenItemCondition(condition, test, {
			operation:
				test.test === "controls-connection" ? "controls-connection" : "connection-is-passable",
			connectionId: test.connectionId,
			value: test.value,
		});
	}
	return condition;
}

function migrateCondition(condition: Record<string, unknown>): Record<string, unknown> {
	const operation = typeof condition.operation === "string" ? condition.operation : undefined;
	if (condition.type === "flag") {
		const scope = condition["flag-type"];
		const migratedOperation =
			operation === "is" ? "flag-is" : operation === "exists" ? "flag-exists" : "flag-missing";
		return {
			...without(condition, "flag-type"),
			type: scope === "room" ? "room" : scope === "item" ? "item" : "world",
			operation: migratedOperation,
		};
	}
	if (condition.type === "counter")
		return {...condition, type: "world", operation: `counter-${operation}`};
	if (condition.type === "text")
		return {...condition, type: "world", operation: `text-${operation}`};
	if (condition.type === "current-room") {
		if (operation === "is" || operation === "is-not")
			return {
				...condition,
				type: "player",
				operation: operation === "is" ? "is-in-room" : "is-not-in-room",
			};
		if (operation === "is-exit-open")
			return {...condition, type: "navigation", operation: "exit-is-open"};
		return {
			...condition,
			type: "room",
			operation: operation === "has-tag" ? "current-has-tag" : "current-missing-tag",
		};
	}
	if (condition.type === "item" && isRecord(condition.test)) return migrateItemCondition(condition);
	return condition;
}

function migrateEffect(effect: Record<string, unknown>): Record<string, unknown> {
	const operation = typeof effect.operation === "string" ? effect.operation : undefined;
	if (effect.type === "item-action")
		return {...without(effect, "action"), type: "player", operation: effect.action};
	if (effect.type === "message") {
		const operations: Record<string, string> = {
			random: "show-random",
			"append-last-message": "append-to-last",
			"current-room-description": "describe-current-room",
		};
		return operations[String(operation)]
			? {...effect, operation: operations[String(operation)]}
			: effect;
	}
	if (effect.type === "flag") {
		const scope = effect["flag-type"];
		const migratedOperation =
			operation === "create" || operation === "set" ? "set-flag" : `${operation}-flag`;
		return {
			...without(effect, "flag-type"),
			type: scope === "room" ? "room" : scope === "item" ? "item" : "world",
			operation: migratedOperation,
		};
	}
	if (effect.type === "counter") {
		return {
			...effect,
			type: "world",
			operation:
				operation === "create" || operation === "set" ? "set-counter" : `${operation}-counter`,
		};
	}
	if (effect.type === "text") {
		return {
			...effect,
			type: "world",
			operation: operation === "create" || operation === "set" ? "set-text" : "delete-text",
		};
	}
	if (effect.type === "player") {
		if (operation === "teleport") return {...effect, type: "navigation", operation: "move-to-room"};
		if (operation === "move-in-direction" || operation === "set-facing")
			return {...effect, type: "navigation"};
		return effect;
	}
	if (effect.type === "room") {
		if (operation === "move-player-to")
			return {...effect, type: "navigation", operation: "move-to-room"};
		if (
			["lock-exit", "unlock-exit", "lock-all-exits", "unlock-all-exits"].includes(String(operation))
		)
			return {...effect, type: "navigation"};
		if (["set-name", "set-description", "set-short-description"].includes(String(operation))) {
			return withRenamedBindings(
				{...without(effect, "variantId"), value: effect.variantId},
				{variantId: "value"},
			);
		}
		return effect;
	}
	if (effect.type === "item") {
		const operations: Record<string, string> = {
			"change-name": "set-name",
			"change-description": "set-examine-text",
			"change-examine-text": "set-examine-text",
			"change-listing-text": "set-listing-text",
			"drop-in-current-room": "move-to-current-room",
			"place-inside-item": "place-inside",
			"place-on-item": "place-on",
			"hide-from-player": "hide",
			"show-to-player": "reveal",
			"show-in-room-description": "set-listed",
			"hide-in-room-description": "set-unlisted",
			open: "set-open",
			close: "set-closed",
			lock: "set-locked",
			unlock: "set-unlocked",
			"mark-examined": "set-examined",
			"mark-unexamined": "set-unexamined",
			"list-in-room": "set-listed",
			"unlist-in-room": "set-unlisted",
		};
		const migrated = operations[String(operation)]
			? {...effect, operation: operations[String(operation)]}
			: effect;
		if (operation === "move-to-room" && effect.newRoomId !== undefined) {
			return withRenamedBindings(
				{...without(migrated, "newRoomId"), roomId: effect.newRoomId},
				{newRoomId: "roomId"},
			);
		}
		return migrated;
	}
	return effect;
}

function migrateLogic(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(migrateLogic);
	if (!isRecord(value)) return value;
	const migratedChildren = Object.fromEntries(
		Object.entries(value).map(([key, child]) => [key, migrateLogic(child)]),
	);
	if (migratedChildren.type === "item" && isRecord(migratedChildren.test))
		return migrateCondition(migratedChildren);
	if (["flag", "counter", "text", "current-room"].includes(String(migratedChildren.type))) {
		return [
			"is",
			"exists",
			"missing",
			"compare",
			"between",
			"is-not",
			"starts-with",
			"does-not-start-with",
			"ends-with",
			"does-not-end-with",
			"contains",
			"does-not-contain",
			"is-empty",
			"is-not-empty",
			"has-tag",
			"missing-tag",
			"is-exit-open",
		].includes(String(migratedChildren.operation))
			? migrateCondition(migratedChildren)
			: migrateEffect(migratedChildren);
	}
	if (
		["item", "item-action", "message", "room", "player"].includes(String(migratedChildren.type)) &&
		("operation" in migratedChildren || "action" in migratedChildren)
	)
		return migrateEffect(migratedChildren);
	return migratedChildren;
}

export function reorganizeConditionsAndEffects(value: unknown): unknown {
	return migrateLogic(value);
}

function effectGroupId(value: unknown) {
	if (!isRecord(value) || value.type !== "group" || !isRecord(value.id)) return undefined;
	return value.id.type === "effect" && typeof value.id.id === "string" ? value.id.id : undefined;
}

function effectReferenceId(value: unknown) {
	if (!isRecord(value) || value.type !== "effect-ref" || !isRecord(value.effectId)) return undefined;
	return value.effectId.type === "effect" && typeof value.effectId.id === "string"
		? value.effectId.id
		: undefined;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => sameJsonValue(value, right[index]))
		);
	}
	if (!isRecord(left) || !isRecord(right)) return false;
	const leftKeys = Object.keys(left).sort();
	const rightKeys = Object.keys(right).sort();
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every((key, index) => key === rightKeys[index] && sameJsonValue(left[key], right[key]))
	);
}

function removeAccidentalEmbeddedEffectCopies(value: unknown): unknown {
	if (!isRecord(value) || !Array.isArray(value.effects)) return value;
	const embeddedGroups = new Map<string, Record<string, unknown>[]>();
	const referencedEffectIds = new Set<string>();

	function visit(child: unknown) {
		if (Array.isArray(child)) {
			child.forEach(visit);
			return;
		}
		if (!isRecord(child)) return;

		const groupId = effectGroupId(child);
		if (groupId) {
			const matches = embeddedGroups.get(groupId) ?? [];
			matches.push(child);
			embeddedGroups.set(groupId, matches);
		}
		const referenceId = effectReferenceId(child);
		if (referenceId) referencedEffectIds.add(referenceId);
		Object.values(child).forEach(visit);
	}

	Object.entries(value).forEach(([key, child]) => {
		if (key !== "effects") visit(child);
	});
	value.effects.forEach((effect) => {
		if (isRecord(effect)) Object.values(effect).forEach(visit);
	});

	const effects = value.effects.filter((effect) => {
		const id = effectGroupId(effect);
		if (!id || referencedEffectIds.has(id)) return true;
		return !(embeddedGroups.get(id) ?? []).some((embedded) => sameJsonValue(effect, embedded));
	});

	return effects.length === value.effects.length ? value : {...value, effects};
}

function migrateWorld(value: unknown): unknown {
	return removeAccidentalEmbeddedEffectCopies(reorganizeConditionsAndEffects(value));
}

export const v5ToV6 = defineStorageMigration({
	id: "v5-to-v6-reorganize-conditions-and-effects",
	fromVersion: 5,
	toVersion: 6,
	world: migrateWorld,
	gameState: unchanged,
	messages: unchanged,
});
