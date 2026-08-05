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
} from "@/schemas/utils/editorCatalogs";

type EditorMetadataWithoutControl = Omit<EditorFieldMetadata, "control">;

type EditorMetadataWithoutControlOrTagSource = Omit<EditorFieldMetadata, "control" | "tagSource">;

type LinkListMetadata = EditorMetadataWithoutControl & {
	features: LinkListFeatures;
};

type OptionalReferenceMetadata = EditorMetadataWithoutControl & {
	required: false;
};

export function editorSetDefault<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	defaultFieldValue: unknown,
): TSchema {
	return schema.meta({
		...(schema.meta() ?? {}),
		defaultFieldValue,
	}) as TSchema;
}

export function editorString(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.string(),
		{
			control: "text",
			placeholder: "",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorInput(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.string(),
		{
			control: "input",
			placeholder: "",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorId<TEntityType extends IdEntityType>(
	entityType: TEntityType,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue: unknown = "",
) {
	return editorHidden(
		z
			.union([z.custom<ID<TEntityType>>(isID), z.string().min(1)])
			.transform((value) => toID(entityType, value as string | ID<TEntityType>)),
		{
			...metadata,
			readonly: true,
		},
		defaultFieldValue,
	);
}

export function editorTextarea(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.string(),
		{
			control: "textarea",
			placeholder: "",
			preview: {
				showPreview: false,
				previewMode: "below",
				...metadata.preview,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorRichText(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.string(),
		{
			control: "rich-text",
			placeholder: "",
			preview: {
				showPreview: true,
				previewMode: "below",
				...metadata.preview,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorMessage(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.string(),
		{
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
		},
		defaultFieldValue,
	);
}

export function editorNumber<TSchema extends z.ZodTypeAny = z.ZodNumber>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		(schema ?? z.number()) as TSchema,
		{
			control: "number",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorInteger(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.number().int(),
		{
			control: "number",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorNonNegativeInteger(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.number().int().nonnegative(),
		{
			control: "number",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorPositiveInteger(
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.number().int().positive(),
		{
			control: "number",
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorBoolean<TSchema extends z.ZodTypeAny = z.ZodBoolean>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		(schema ?? z.boolean()) as TSchema,
		{
			control: "toggle",
			appearance: {
				chrome: "inline",
				...metadata.appearance,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorSelect<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
			control: "select",
			picker: {
				searchable: false,
				clearable: false,
				showDescriptions: false,
				showBadges: true,
				...metadata.picker,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorMultiSelect(
	metadata?: EditorMetadataWithoutControl,
): z.ZodDefault<z.ZodArray<z.ZodString>>;
export function editorMultiSelect<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl,
	schema: TSchema,
): TSchema;
export function editorMultiSelect<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
) {
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
	defaultFieldValue?: unknown,
): z.ZodOptional<z.ZodType<ID<TEntityType>>>;
export function editorReference<TEntityType extends WorldIdEntityType>(
	entityType: TEntityType,
	metadata?: EditorMetadataWithoutControl,
	defaultFieldValue?: unknown,
): z.ZodType<ID<TEntityType>>;
export function editorReference<TEntityType extends WorldIdEntityType>(
	entityType: TEntityType,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	const referenceObjectSchema = z
		.object({
			type: z.literal(entityType),
			id: z.string().min(1),
		})
		.transform((reference) => reference as ID<TEntityType>);
	const isRequired = metadata.required ?? true;

	return editorSelect(
		isRequired ? referenceObjectSchema : referenceObjectSchema.optional(),
		{
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
		},
		defaultFieldValue ?? (isRequired ? {type: entityType, id: ""} : undefined),
	) as z.ZodType<ID<TEntityType>> | z.ZodOptional<z.ZodType<ID<TEntityType>>>;
}

export function editorStringList(
	metadata?: EditorMetadataWithoutControl,
): z.ZodDefault<z.ZodArray<z.ZodString>>;
export function editorStringList<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl,
	schema: TSchema,
): TSchema;
export function editorStringList<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
) {
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

export function editorAliasList(
	metadata?: EditorMetadataWithoutControl,
): z.ZodDefault<z.ZodArray<z.ZodString>>;
export function editorAliasList<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl,
	schema: TSchema,
): TSchema;
export function editorAliasList<TSchema extends z.ZodTypeAny>(
	metadata: EditorMetadataWithoutControl = {},
	schema?: TSchema,
) {
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

export function editorTagList(
	tagSource: EditorTagSource,
	metadata?: EditorMetadataWithoutControlOrTagSource,
): z.ZodDefault<z.ZodArray<z.ZodString>>;
export function editorTagList<TSchema extends z.ZodTypeAny>(
	tagSource: EditorTagSource,
	metadata: EditorMetadataWithoutControlOrTagSource,
	schema: TSchema,
): TSchema;
export function editorTagList<TSchema extends z.ZodTypeAny>(
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

export function editorLinkList(metadata: LinkListMetadata): z.ZodDefault<z.ZodArray<z.ZodString>>;
export function editorLinkList<TSchema extends z.ZodTypeAny>(
	metadata: LinkListMetadata,
	schema: TSchema,
): TSchema;
export function editorLinkList<TSchema extends z.ZodTypeAny>(
	metadata: LinkListMetadata,
	schema?: TSchema,
) {
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

export function editorObjectFlags(metadata: EditorMetadataWithoutControl = {}) {
	const flagDefinitions = (metadata.features?.flags ?? {}) as Record<
		string,
		{permanent?: boolean; defaultValue?: boolean}
	>;
	const permanentDefaults = Object.fromEntries(
		Object.entries(flagDefinitions)
			.filter(([, definition]) => definition.permanent)
			.map(([name, definition]) => [name, definition.defaultValue ?? false]),
	);

	return withEditorMetadata(
		z.record(z.string().min(1), z.boolean()).transform((flags) => ({...permanentDefaults, ...flags})),
		{
			control: "object-flag-editor",
			...metadata,
		},
	);
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
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
			control: "scope-picker",
			picker: {
				searchable: true,
				showDescriptions: false,
				showBadges: true,
				clearable: false,
				...metadata.picker,
			},
			...metadata,
		},
		defaultFieldValue,
	);
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
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
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
		},
		defaultFieldValue,
	);
}

export function editorConditionControl<TSchema extends z.ZodTypeAny>(
	conditionSchema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
) {
	return withEditorMetadata(
		z.preprocess(
			(value) => (Array.isArray(value) ? {type: "group", operation: "all", conditions: value} : value),
			z
				.object({
					type: z.literal("group"),
					operation: z.enum(["all", "any", "none"]),
					conditions: z.array(conditionSchema),
				})
				.default({type: "group", operation: "all", conditions: []}),
		),
		{
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
				rootGroup: true,
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
		},
		{type: "group", operation: "all", conditions: []},
	);
}

function effectChildControls(
	overrides: EditorMetadataWithoutControl["childControls"],
): NonNullable<EditorMetadataWithoutControl["childControls"]> {
	return {
		effectType: {
			control: "select",
			title: "Effect type",
			description: "Choose what should happen.",
		},
		operator: {
			control: "select",
			title: "Action",
			description: "Choose how the effect changes the game.",
		},
		"flag-type": {control: "select", title: "Flag type"},
		flag: {title: "Flag"},
		value: {title: "Value"},
		counter: {control: "input", title: "Counter", placeholder: "Counter name"},
		amount: {control: "number", title: "Amount", placeholder: "Enter an amount"},
		message: {
			control: "textarea",
			title: "Message",
			placeholder: "Enter the message shown to the player",
		},
		messages: {control: "string-list", title: "Messages"},
		format: {
			control: "select",
			title: "Format",
			features: {
				options: [
					{label: "Inline", value: "inline"},
					{label: "New line", value: "newline"},
				],
			},
		},
		freezeMessage: {
			control: "input",
			title: "Freeze message",
			description: "Shown when the player tries to act while frozen.",
			placeholder: "Optional message while frozen",
		},
		turns: {
			control: "number",
			title: "Turns",
			description: "Leave blank to keep the player frozen until another effect unfreezes them.",
			placeholder: "No turn limit",
		},
		customDeathMessage: {
			control: "input",
			title: "Death message",
			placeholder: "Use the default death message",
		},
		roomId: {control: "entity-picker", title: "Room"},
		newRoomId: {control: "entity-picker", title: "New room"},
		featureId: {control: "entity-picker", title: "Feature"},
		variantId: {control: "input", title: "Variant ID", placeholder: "Variant ID"},
		direction: {control: "direction-picker", title: "Direction"},
		tag: {control: "input", title: "Tag", placeholder: "Tag name"},
		mode: {
			control: "select",
			title: "Run",
			features: {
				options: [
					{label: "All effects", value: "all"},
					{label: "First effect", value: "first"},
					{label: "Last effect", value: "last"},
				],
			},
		},
		effects: {control: "effect-list", title: "Effects"},
		then: {control: "effect-list", title: "Then"},
		else: {control: "effect-list", title: "Otherwise"},
		condition: {control: "condition-builder", title: "Condition"},
		effectId: {
			control: "entity-picker",
			title: "Saved effect",
			features: {entityType: "effect", allowCreate: false, clearButton: false},
		},
		name: {
			control: "input",
			title: "Group name",
			description:
				"Generated from the group's effects until you choose a custom name. Use Clear to return to the generated name.",
			placeholder: "Generated from effects",
		},
		id: {
			control: "hidden",
			title: "Group ID",
			hidden: true,
		},
		allowMultipleUsesInWorld: {
			control: "hidden",
			title: "Stored in world effects",
			hidden: true,
		},
		...overrides,
	};
}

export function editorEffects<TSchema extends z.ZodTypeAny>(
	effectSchema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.array(effectSchema).default([]),
		{
			control: "effect-list",
			...metadata,
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
			childControls: effectChildControls(metadata.childControls),
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
		},
		defaultFieldValue,
	);
}

export function editorEffectControl<TSchema extends z.ZodTypeAny>(
	effectSchema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		effectSchema,
		{
			control: "effect",
			...metadata,
			features: {
				effectTypeOptionSource: EFFECT_TYPE_OPTION_SOURCE,
				operationOptionSourcesByType: Object.fromEntries(
					Object.keys(effectOperationOptionsByType).map((type) => [
						type,
						`schema.effect.${type}.operations`,
					]),
				),
				showGeneratedSummary: true,
				allowedEffectTypes: ["message", "flag", "counter", "feature", "room", "player", "effect-ref"],
				...metadata.features,
			},
			childControls: {
				...effectChildControls(metadata.childControls),
			},
			summary: {
				enabled: true,
				mode: "deterministic",
				...metadata.summary,
			},
		},
		defaultFieldValue,
	);
}

export function editorLogicBranchList<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
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
		},
		defaultFieldValue,
	);
}

export function editorCommandPattern<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
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
		},
		defaultFieldValue,
	);
}

export function editorConditionalText<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
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
		},
		defaultFieldValue,
	);
}

export function editorDiscriminatedUnion<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
			control: "discriminated-union",
			picker: {
				searchable: true,
				showDescriptions: false,
				showBadges: true,
				clearable: false,
				...metadata.picker,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorObject<TShape extends z.ZodRawShape>(
	shape: TShape,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.object(shape),
		{
			control: "object",
			appearance: {
				chrome: "card",
				...metadata.appearance,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorRecord<TValueSchema extends z.ZodTypeAny>(
	valueSchema: TValueSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.record(z.string(), valueSchema).default({}),
		{
			control: "object",
			appearance: {
				chrome: "card",
				...metadata.appearance,
			},
			...metadata,
		},
		defaultFieldValue,
	);
}

export function editorArray<TItemSchema extends z.ZodTypeAny>(
	itemSchema: TItemSchema,
	metadata: EditorMetadataWithoutControl = {},
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		z.array(itemSchema).default([]),
		{
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
		},
		defaultFieldValue,
	);
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
	defaultFieldValue?: unknown,
) {
	return withEditorMetadata(
		schema,
		{
			control: "hidden",
			hidden: true,
			...metadata,
		},
		defaultFieldValue,
	);
}

export const editor = {
	aliasList: editorAliasList,
	array: editorArray,
	boolean: editorBoolean,
	codePreview: editorCodePreview,
	commandPattern: editorCommandPattern,
	condition: editorCondition,
	conditionControl: editorConditionControl,
	conditionalText: editorConditionalText,
	counterKey: editorCounterKey,
	diffPreview: editorDiffPreview,
	direction: editorDirection,
	discriminatedUnion: editorDiscriminatedUnion,
	effectControl: editorEffectControl,
	effects: editorEffects,
	editorLinkList: editorEditorLinkList,
	externalLinkList: editorExternalLinkList,
	flagKey: editorFlagKey,
	hidden: editorHidden,
	id: editorId,
	input: editorInput,
	integer: editorInteger,
	internalLinkList: editorInternalLinkList,
	jsonInspector: editorJsonInspector,
	linkList: editorLinkList,
	logicBranchList: editorLogicBranchList,
	message: editorMessage,
	multiSelect: editorMultiSelect,
	nonNegativeInteger: editorNonNegativeInteger,
	number: editorNumber,
	object: editorObject,
	record: editorRecord,
	optionalCounterKey: editorOptionalCounterKey,
	optionalFlagKey: editorOptionalFlagKey,
	objectFlags: editorObjectFlags,
	positiveInteger: editorPositiveInteger,
	priority: editorPriority,
	reference: editorReference,
	richText: editorRichText,
	scope: editorScope,
	select: editorSelect,
	setDefault: editorSetDefault,
	singleEditorLink: editorSingleEditorLink,
	string: editorString,
	stringList: editorStringList,
	tagList: editorTagList,
	textarea: editorTextarea,
	validationSummary: editorValidationSummary,
} as const;
