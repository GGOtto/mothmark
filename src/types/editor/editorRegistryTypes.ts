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

export type EditorKeyOption = {
	key: string;
	label: string;
	description?: string;
	source?: string;
	deprecated?: boolean;
	disabled?: boolean;
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
	features: EditorEntityOption[];
	containers: EditorEntityOption[];
	surfaces: EditorEntityOption[];
	objects: EditorEntityOption[];

	flags: EditorKeyOption[];
	counters: EditorKeyOption[];

	tags: EditorTagRegistry;
};
