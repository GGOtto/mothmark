export type EntityFlagDefinition = {
	permanent?: boolean;
	defaultValue?: boolean;
	defaultReadonly?: boolean;
	description?: string;
};

export const ITEM_FLAG_DEFINITIONS = {
	examined: {
		permanent: true,
		defaultReadonly: true,
		description: "Set when the player examines this item.",
	},
	hidden: {
		defaultValue: false,
	},
} satisfies Record<string, EntityFlagDefinition>;

export const ROOM_FLAG_DEFINITIONS = {
	visited: {
		permanent: true,
		defaultReadonly: true,
		description: "Set when the player visits this room.",
	},
	active: {
		permanent: true,
		defaultValue: true,
		description: "If set to false, passages into the room will be blocked.",
	},
} satisfies Record<string, EntityFlagDefinition>;

export function getEntityFlagDefinition(flagType: "room" | "item", flag: string) {
	const definitions =
		flagType === "room"
			? (ROOM_FLAG_DEFINITIONS as Record<string, EntityFlagDefinition>)
			: (ITEM_FLAG_DEFINITIONS as Record<string, EntityFlagDefinition>);
	return definitions[flag];
}

export function entityFlagMutationError(
	flagType: "room" | "item",
	flag: string,
	operation: "set" | "toggle" | "delete",
) {
	const definition = getEntityFlagDefinition(flagType, flag);
	if (definition?.defaultReadonly) return `${flagType} flag "${flag}" is readonly.`;
	if (operation === "delete" && definition?.permanent) {
		return `${flagType} flag "${flag}" is permanent and cannot be deleted.`;
	}
}
