export type EntityType = "room" | "item" | "character" | "feature" | "connection";

export type EntityPickerOption = {
	id: string;
	label: string;
	description?: string;
	entityType: EntityType;
};

export type EntityRegistry = {
	getEntities: (entityType: EntityType) => EntityPickerOption[];
	getEntityById: (entityType: EntityType, id: string) => EntityPickerOption | undefined;
	isValidEntityId: (entityType: EntityType, id: string) => boolean;
};

export type FlagOption = {
	id: string;
	label?: string;
	description?: string;
	source?: "condition" | "effect" | "manual" | "schema";
};

export type FlagRegistry = {
	getFlags: () => FlagOption[];
	getFlagById: (id: string) => FlagOption | undefined;
	isKnownFlag: (id: string) => boolean;
	createFlag?: (id: string) => FlagOption;
};
