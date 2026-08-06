import type {EditorPath} from "./editorPathTypes";

export type EditorEntityFact = {
	label: string;
	value: string;
};

export type EditorEntityRelation = {
	label: string;
	items: Array<{
		id: string;
		label: string;
		entityType?: EntityType;
		detail?: string;
	}>;
};

export type EditorEntityOption = {
	id: string;
	label: string;
	description?: string;
	aliases?: string[];
	tags?: string[];
	kind?: string;
	parentId?: string;
	hierarchy?: Array<{
		kind: "type" | "layer" | "room" | "category";
		key: string;
		label: string;
	}>;
	facts?: EditorEntityFact[];
	relations?: EditorEntityRelation[];
	path?: EditorPath;
	deprecated?: boolean;
	disabled?: boolean;
};

export type EntityType =
	| "room"
	| "connection"
	| "item"
	| "npc"
	| "character"
	| "topic"
	| "quest"
	| "quest-objective"
	| "command"
	| "event"
	| "effect"
	| "condition"
	| "container"
	| "surface"
	| "object"
	| "direction";

export type EntityPickerOption = EditorEntityOption & {
	entityType?: EntityType;
};

export type EntityRegistry = {
	getEntities: (entityType: EntityType) => EntityPickerOption[];
	getEntityById: (entityType: EntityType, id: string) => EntityPickerOption | undefined;
	isValidEntityId: (entityType: EntityType, id: string) => boolean;
};

export type EditorKeyOption = {
	key: string;
	label: string;
	description?: string;
	source?: string;
	deprecated?: boolean;
	disabled?: boolean;
};

export type FlagOption = Omit<EditorKeyOption, "key"> & {
	id: string;
};

export type FlagRegistry = {
	getFlags: () => FlagOption[];
	getFlagById: (id: string) => FlagOption | undefined;
	isKnownFlag: (id: string) => boolean;
	createFlag?: (id: string) => FlagOption;
};

export type EditorTagRegistry = {
	rooms: string[];
	items: string[];
	npcs: string[];
	topics: string[];
	quests: string[];
	commands: string[];
	events: string[];
	all: string[];
};

export type EditorRegistries = {
	rooms: EditorEntityOption[];
	connections: EditorEntityOption[];
	items: EditorEntityOption[];
	npcs: EditorEntityOption[];
	topics: EditorEntityOption[];
	quests: EditorEntityOption[];
	commands: EditorEntityOption[];
	events: EditorEntityOption[];
	effects: EditorEntityOption[];
	conditions: EditorEntityOption[];
	containers: EditorEntityOption[];
	surfaces: EditorEntityOption[];
	objects: EditorEntityOption[];

	flags: EditorKeyOption[];
	counters: EditorKeyOption[];

	tags: EditorTagRegistry;
};
