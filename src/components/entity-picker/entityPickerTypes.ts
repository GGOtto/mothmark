import type {EditorPath} from "@/types/editor/editorPathTypes";
import type {EntityType} from "@/types/editor/editorRegistryTypes";
import type {ID, WorldIdEntityType} from "@/utils/idUtils";

export type EntityPickerPresentation = "auto" | "popover" | "popup";

export type EntityHierarchySegment = {
	kind: "type" | "layer" | "room" | "category";
	key: string;
	label: string;
};

export type EntityPickerEntry = {
	ref: ID<WorldIdEntityType>;
	entityType: EntityType;
	label: string;
	description?: string;
	summary?: string;
	aliases: string[];
	tags: string[];
	kind?: string;
	hierarchy: EntityHierarchySegment[];
	path?: EditorPath;
	parentId?: string;
	disabled?: boolean;
	deprecated?: boolean;
};

export type EntityPickerSelection = {
	ref: ID<WorldIdEntityType>;
	entry: EntityPickerEntry;
};

export type EntityPickerMatchField =
	"label" | "id" | "alias" | "tag" | "summary" | "description" | "hierarchy";

export type EntityPickerMatch = {
	entry: EntityPickerEntry;
	score: number;
	matchedFields: EntityPickerMatchField[];
};
