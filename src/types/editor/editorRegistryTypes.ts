import type {EditorPath} from "./editorPathTypes";

export type EditorEntityOption = {
	id: string;
	label: string;
	description?: string;
	aliases?: string[];
	tags?: string[];
	kind?: string;
	parentId?: string;
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
	| "command"
	| "event"
	| "effect"
	| "feature"
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
	features: string[];
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
	features: EditorEntityOption[];
	conditions: EditorEntityOption[];
	containers: EditorEntityOption[];
	surfaces: EditorEntityOption[];
	objects: EditorEntityOption[];

	flags: EditorKeyOption[];
	counters: EditorKeyOption[];

	tags: EditorTagRegistry;
};
