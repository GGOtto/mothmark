import {z} from "zod";
import {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import {withEditorMetadata} from "@/utils/editorMetadata";
import type {EditorTagSource} from "@/types/editor/editorMetadataTypes";
import type {EntityType} from "@/types/editor/editorRegistryTypes";
import {isID, toID, type ID, type IdEntityType, type WorldIdEntityType} from "@/utils/idUtils";
import type {LinkListFeatures} from "@/components/universal-editor/LinkListEditor";
import {
	CONDITION_COMPARISON_OPERATOR_OPTION_SOURCE,
	CONDITION_GROUP_OPERATOR_OPTION_SOURCE,
	CONDITION_TYPE_OPTION_SOURCE,
	EFFECT_TYPE_OPTION_SOURCE,
	conditionOperationOptionsByType,
	effectOperationOptionsByType,
} from "@/schemas/editorCatalogs";

type EditorMetadataWithoutControl = Omit<EditorFieldMetadata, "control">;

type EditorMetadataWithoutControlOrTagSource = Omit<EditorFieldMetadata, "control" | "tagSource">;

type LinkListMetadata = EditorMetadataWithoutControl & {
	features: LinkListFeatures;
};

type OptionalReferenceMetadata = EditorMetadataWithoutControl & {
	required: false;
};

export function editorString(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string(), {
		control: "text",
		placeholder: "",
		...metadata,
	});
}

export function editorInput(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string(), {
		control: "input",
		placeholder: "",
		...metadata,
	});
}

export function editorId<TEntityType extends IdEntityType>(
	entityType: TEntityType,
	metadata: EditorMetadataWithoutControl = {},
) {
	return editorHidden(
		z
			.union([z.custom<ID<TEntityType>>(isID), z.string().min(1)])
			.transform((value) => toID(entityType, value as string | ID<TEntityType>)),
		{
			...metadata,
			readonly: true,
		},
	);
}

export function editorTextarea(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string(), {
		control: "textarea",
		placeholder: "",
		preview: {
			showPreview: false,
			previewMode: "below",
			...metadata.preview,
		},
		...metadata,
	});
}

export function editorRichText(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string(), {
		control: "rich-text",
		placeholder: "",
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		...metadata,
	});
}

export function editorMessage(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string(), {
		control: "message",
		placeholder: "Message shown to the player...",
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		appearance: {
			tone: "paper",
			chrome: "card",
			...metadata.appearance,
		},
		...metadata,
	});
}

export function editorNumber<TSchema extends z.ZodTypeAny = z.ZodNumber>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
) {
	return withEditorMetadata((schema ?? z.number()) as TSchema, {
		control: "number",
		...metadata,
	});
}

export function editorInteger(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.number().int(), {
		control: "number",
		...metadata,
	});
}

export function editorNonNegativeInteger(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.number().int().nonnegative(), {
		control: "number",
		...metadata,
	});
}

export function editorPositiveInteger(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.number().int().positive(), {
		control: "number",
		...metadata,
	});
}

export function editorBoolean<TSchema extends z.ZodTypeAny = z.ZodBoolean>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
) {
	return withEditorMetadata((schema ?? z.boolean()) as TSchema, {
		control: "toggle",
		appearance: {
			chrome: "inline",
			...metadata.appearance,
		},
		...metadata,
	});
}

export function editorSelect<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "select",
		picker: {
			searchable: false,
			clearable: false,
			showDescriptions: false,
			showBadges: true,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorMultiSelect<
	TSchema extends z.ZodTypeAny = z.ZodDefault<z.ZodArray<z.ZodString>>,
>(metadata: EditorMetadataWithoutControl = {}, schema?: TSchema) {
	return withEditorMetadata((schema ?? z.array(z.string().min(1)).default([])) as TSchema, {
		control: "multi-select",
		picker: {
			searchable: true,
			clearable: true,
			showDescriptions: false,
			showBadges: true,
			...metadata.picker,
		},
		emptyState: {
			emptyTitle: "Nothing selected",
			emptyDescription: "Add one or more values.",
			emptyActionLabel: "Add value",
			...metadata.emptyState,
		},
		...metadata,
	});
}

export function editorReference<TEntityType extends WorldIdEntityType>(
	entityType: TEntityType,
	metadata: OptionalReferenceMetadata,
): z.ZodOptional<z.ZodType<ID<TEntityType>>>;
export function editorReference<TEntityType extends WorldIdEntityType>(
	entityType: TEntityType,
	metadata?: EditorMetadataWithoutControl,
): z.ZodType<ID<TEntityType>>;
export function editorReference<TEntityType extends WorldIdEntityType>(
	entityType: TEntityType,
	metadata: EditorMetadataWithoutControl = {},
) {
	const referenceObjectSchema = z
		.object({
			type: z.literal(entityType),
			id: z.string().min(1),
		})
		.transform((reference) => reference as ID<TEntityType>);
	const legacyStringReferenceSchema = z
		.string()
		.min(1)
		.transform((id) => ({type: entityType, id}) as ID<TEntityType>);
	const schema = z.union([referenceObjectSchema, legacyStringReferenceSchema]);
	const isRequired = metadata.required ?? true;

	return editorSelect(isRequired ? schema : schema.optional(), {
		entityType,
		required: isRequired,
		picker: {
			searchable: true,
			clearable: !isRequired,
			clearButton: !isRequired,
			showDescriptions: false,
			showBadges: true,
			...metadata.picker,
		},
		...metadata,
	}) as z.ZodType<ID<TEntityType>> | z.ZodOptional<z.ZodType<ID<TEntityType>>>;
}

export function editorStringList<
	TSchema extends z.ZodTypeAny = z.ZodDefault<z.ZodArray<z.ZodString>>,
>(metadata: EditorMetadataWithoutControl = {}, schema?: TSchema) {
	return withEditorMetadata((schema ?? z.array(z.string().min(1)).default([])) as TSchema, {
		control: "string-list",
		emptyState: {
			emptyTitle: "No values",
			emptyDescription: "Add one or more text values.",
			emptyActionLabel: "Add value",
			...metadata.emptyState,
		},
		duplicate: {
			duplicateBehavior: "exact",
			...metadata.duplicate,
		},
		...metadata,
	});
}

export function editorAliasList<
	TSchema extends z.ZodTypeAny = z.ZodDefault<z.ZodArray<z.ZodString>>,
>(metadata: EditorMetadataWithoutControl = {}, schema?: TSchema) {
	return withEditorMetadata((schema ?? z.array(z.string().min(1)).default([])) as TSchema, {
		control: "tag-list",
		title: "Aliases",
		description: "Alternative names the player can use.",
		placeholder: "Add alias",
		...metadata,
		features: {
			suggestionFields: ["name", "title", "label", "id"],
			...(metadata.features ?? {}),
		},
	});
}

export function editorTagList<TSchema extends z.ZodTypeAny = z.ZodDefault<z.ZodArray<z.ZodString>>>(
	tagSource: EditorTagSource,
	metadata: EditorMetadataWithoutControlOrTagSource = {},
	schema?: TSchema,
) {
	return withEditorMetadata((schema ?? z.array(z.string().min(1)).default([])) as TSchema, {
		control: "tag-list",
		tagSource,
		picker: {
			searchable: true,
			allowCreate: true,
			clearable: true,
			grouped: false,
			...metadata.picker,
		},
		emptyState: {
			emptyTitle: "No tags",
			emptyDescription: "Tags help with grouping, filtering, and authored logic.",
			emptyActionLabel: "Add tag",
			...metadata.emptyState,
		},
		...metadata,
		features: {
			suggestionFields: ["name", "title", "label", "id", "kind", "type"],
			...(metadata.features ?? {}),
		},
	});
}

export function editorLinkList<
	TSchema extends z.ZodTypeAny = z.ZodDefault<z.ZodArray<z.ZodString>>,
>(metadata: LinkListMetadata, schema?: TSchema) {
	return withEditorMetadata((schema ?? z.array(z.string().min(1)).default([])) as TSchema, {
		control: "link-list",
		...metadata,
	});
}

export function editorInternalLinkList(
	metadata: Omit<LinkListMetadata, "features"> & {
		features?: Partial<Omit<LinkListFeatures, "linkType">>;
	} = {},
) {
	return editorLinkList({
		...metadata,
		features: {
			linkType: "internal-link",
			...metadata.features,
		},
	});
}

export function editorExternalLinkList(
	metadata: Omit<LinkListMetadata, "features"> & {
		features?: Partial<Omit<LinkListFeatures, "linkType">>;
	} = {},
) {
	return editorLinkList({
		...metadata,
		features: {
			linkType: "external-link",
			...metadata.features,
		},
	});
}

function entityCollectionPath(entityType: EntityType) {
	if (entityType === "character" || entityType === "npc") return "npcs";
	if (entityType === "direction") return "directions";
	return `${entityType}s`;
}

export function editorEditorLinkList(
	entityType: EntityType,
	metadata: Omit<LinkListMetadata, "features"> & {
		features?: Partial<Omit<LinkListFeatures, "linkType" | "editorTarget">>;
	} = {},
) {
	return editorLinkList(
		{
			...metadata,
			features: {
				linkType: "editor",
				editorTarget: {
					kind: "entity",
					entityType,
					path: [entityCollectionPath(entityType), "{id}"],
				},
				...metadata.features,
			},
		},
		z.array(z.object({type: z.string(), id: z.string(), label: z.string().optional()})).default([]),
	);
}

export function editorSingleEditorLink(
	entityType: EntityType,
	metadata: Omit<LinkListMetadata, "features"> & {
		features?: Partial<Omit<LinkListFeatures, "linkType" | "mode" | "editorTarget">>;
	} = {},
) {
	return editorLinkList(
		{
			...metadata,
			features: {
				mode: "single-link",
				linkType: "editor",
				editorTarget: {
					kind: "entity",
					entityType,
					path: [entityCollectionPath(entityType), "{id}"],
				},
				...metadata.features,
			},
		},
		z.object({type: z.string(), id: z.string(), label: z.string().optional()}).nullable(),
	);
}

export function editorFlagKey(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string().min(1), {
		control: "flag-picker",
		required: true,
		picker: {
			searchable: true,
			allowCreate: true,
			showDescriptions: false,
			clearable: false,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorOptionalFlagKey(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string().min(1).optional(), {
		control: "flag-picker",
		picker: {
			searchable: true,
			allowCreate: true,
			showDescriptions: false,
			clearable: true,
			clearButton: true,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorCounterKey(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string().min(1), {
		control: "counter-picker",
		required: true,
		picker: {
			searchable: true,
			allowCreate: true,
			showDescriptions: false,
			clearable: false,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorOptionalCounterKey(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string().min(1).optional(), {
		control: "counter-picker",
		picker: {
			searchable: true,
			allowCreate: true,
			showDescriptions: false,
			clearable: true,
			clearButton: true,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorDirection(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.string().min(1), {
		control: "direction-picker",
		required: true,
		picker: {
			searchable: true,
			showDescriptions: false,
			clearable: false,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorScope<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "scope-picker",
		picker: {
			searchable: true,
			showDescriptions: false,
			showBadges: true,
			clearable: false,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorPriority(metadata: EditorMetadataWithoutControl = {}) {
	return withEditorMetadata(z.number().default(0), {
		control: "priority-control",
		appearance: {
			chrome: "compact",
			...metadata.appearance,
		},
		...metadata,
	});
}

export function editorCondition<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "condition-builder",
		features: {
			conditionTypeOptionSource: CONDITION_TYPE_OPTION_SOURCE,
			groupOperatorOptionSource: CONDITION_GROUP_OPERATOR_OPTION_SOURCE,
			comparisonOperatorOptionSource: CONDITION_COMPARISON_OPERATOR_OPTION_SOURCE,
			operatorOptionSourcesByType: Object.fromEntries(
				Object.keys(conditionOperationOptionsByType).map((type) => [
					type,
					`schema.condition.${type}.operations`,
				]),
			),
			...metadata.features,
		},
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No condition",
			emptyDescription: "Add a condition or condition group.",
			emptyActionLabel: "Add condition",
			...metadata.emptyState,
		},
		...metadata,
	});
}

export function editorConditionList<TSchema extends z.ZodTypeAny>(
	conditionSchema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(z.array(conditionSchema).default([]), {
		control: "condition-builder",
		features: {
			conditionTypeOptionSource: CONDITION_TYPE_OPTION_SOURCE,
			groupOperatorOptionSource: CONDITION_GROUP_OPERATOR_OPTION_SOURCE,
			comparisonOperatorOptionSource: CONDITION_COMPARISON_OPERATOR_OPTION_SOURCE,
			operatorOptionSourcesByType: Object.fromEntries(
				Object.keys(conditionOperationOptionsByType).map((type) => [
					type,
					`schema.condition.${type}.operations`,
				]),
			),
			...metadata.features,
		},
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No conditions",
			emptyDescription: "Add one or more conditions.",
			emptyActionLabel: "Add condition",
			...metadata.emptyState,
		},
		...metadata,
	});
}

export function editorEffects<TSchema extends z.ZodTypeAny>(
	effectSchema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(z.array(effectSchema).default([]), {
		control: "effect-list",
		features: {
			effectTypeOptionSource: EFFECT_TYPE_OPTION_SOURCE,
			operationOptionSourcesByType: Object.fromEntries(
				Object.keys(effectOperationOptionsByType).map((type) => [
					type,
					`schema.effect.${type}.operations`,
				]),
			),
			...metadata.features,
		},
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No effects",
			emptyDescription: "Add effects to change game state or show output.",
			emptyActionLabel: "Add effect",
			...metadata.emptyState,
		},
		duplicate: {
			duplicateBehavior: "exact",
			...metadata.duplicate,
		},
		...metadata,
	});
}

export function editorLogicBranchList<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "logic-branch-list",
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No branches",
			emptyDescription: "Add success, failure, before, or after branches.",
			emptyActionLabel: "Add branch",
			...metadata.emptyState,
		},
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			...metadata.duplicate,
		},
		...metadata,
	});
}

export function editorCommandPattern<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "command-pattern",
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No patterns",
			emptyDescription: "Add at least one command pattern.",
			emptyActionLabel: "Add pattern",
			...metadata.emptyState,
		},
		...metadata,
	});
}

export function editorConditionalText<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "conditional-text",
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		summary: {
			enabled: true,
			mode: "deterministic",
			...metadata.summary,
		},
		emptyState: {
			emptyTitle: "No conditional text",
			emptyDescription: "Add default text or conditional variants.",
			emptyActionLabel: "Add variant",
			...metadata.emptyState,
		},
		...metadata,
	});
}

export function editorDiscriminatedUnion<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "discriminated-union",
		picker: {
			searchable: true,
			showDescriptions: false,
			showBadges: true,
			clearable: false,
			...metadata.picker,
		},
		...metadata,
	});
}

export function editorObject<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "object",
		appearance: {
			chrome: "card",
			...metadata.appearance,
		},
		...metadata,
	});
}

export function editorArray<TItemSchema extends z.ZodTypeAny>(
	itemSchema: TItemSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(z.array(itemSchema).default([]), {
		control: "array",
		emptyState: {
			emptyTitle: "No entries",
			emptyDescription: "Add one or more entries.",
			emptyActionLabel: "Add entry",
			...metadata.emptyState,
		},
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			...metadata.duplicate,
		},
		...metadata,
	});
}

export function editorValidationSummary<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "validation-summary",
		readonly: true,
		appearance: {
			tone: "warning",
			chrome: "card",
			...metadata.appearance,
		},
		...metadata,
	});
}

export function editorCodePreview<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "code-preview",
		readonly: true,
		appearance: {
			tone: "terminal",
			chrome: "card",
			...metadata.appearance,
		},
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		...metadata,
	});
}

export function editorJsonInspector<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "json-inspector",
		readonly: true,
		appearance: {
			tone: "terminal",
			chrome: "card",
			...metadata.appearance,
		},
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		...metadata,
	});
}

export function editorDiffPreview<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "diff-preview",
		readonly: true,
		appearance: {
			tone: "terminal",
			chrome: "card",
			...metadata.appearance,
		},
		preview: {
			showPreview: true,
			previewMode: "below",
			...metadata.preview,
		},
		...metadata,
	});
}

export function editorHidden<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(schema, {
		control: "hidden",
		hidden: true,
		...metadata,
	});
}

export const editor = {
	aliasList: editorAliasList,
	array: editorArray,
	boolean: editorBoolean,
	conditionList: editorConditionList,
	conditionalText: editorConditionalText,
	discriminatedUnion: editorDiscriminatedUnion,
	flagKey: editorFlagKey,
	id: editorId,
	input: editorInput,
	internalLinkList: editorInternalLinkList,
	linkList: editorLinkList,
	message: editorMessage,
	multiSelect: editorMultiSelect,
	number: editorNumber,
	object: editorObject,
	optionalFlagKey: editorOptionalFlagKey,
	positiveInteger: editorPositiveInteger,
	reference: editorReference,
	richText: editorRichText,
	select: editorSelect,
	singleEditorLink: editorSingleEditorLink,
	tagList: editorTagList,
	textarea: editorTextarea,
	externalLinkList: editorExternalLinkList,
	editorLinkList: editorEditorLinkList,
} as const;
