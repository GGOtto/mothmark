"use client";

import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {
	applyTextTransform,
	generateConditionSummary,
	generateEffectSummary,
} from "../../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import "./SpecializedEditors.scss";

type RecordValue = Record<string, unknown>;
type RoomPickerOption = {
	id: string;
	label?: string;
	description?: string;
	isStartRoom?: boolean;
	issues?: number;
};
type DirectionPickerOption = EditorSelectOption & {
	opposite?: string;
	diagonal?: boolean;
};

export type SpecializedControlMetadata = EditorControlMetadata & {
	type:
		| "conditional-text"
		| "logic-branch-list"
		| "command-pattern"
		| "connection-picker"
		| "flag-editor"
		| "validation-summary"
		| "diff-preview"
		| "template-picker";
	features?: Record<string, unknown>;
};

export type IdControlMetadata = EditorControlMetadata & {
	type: "id";
	features?: {
		scope?: "world" | "room" | "feature" | "connection" | "command" | "flag";
		prefix?: string;
		checkUnique?: boolean;
		knownIds?: string[];
		renameReferences?: boolean;
		clearButton?: boolean;
		copyButton?: boolean;
	};
};

export type DirectionPickerMetadata = EditorControlMetadata & {
	type: "direction-picker";
	features?: {
		options?: DirectionPickerOption[];
		optionSource?: string;
		mode?: "compass" | "list" | "compact";
		includeDiagonals?: boolean;
		showOpposite?: boolean;
		clearButton?: boolean;
	};
};

export type ScopePickerMetadata = EditorControlMetadata & {
	type: "scope-picker";
	features?: {
		options?: EditorSelectOption[];
		optionSource?: string;
		clearButton?: boolean;
	};
};

export type PriorityControlMetadata = EditorControlMetadata & {
	type: "priority-control";
	features?: {
		presets?: Record<string, number>;
		presetOptions?: EditorSelectOption[];
		presetOptionSource?: string;
		customLabel?: string;
	};
};

export type RoomPickerMetadata = EditorControlMetadata & {
	type: "room-picker";
	features?: {
		options?: RoomPickerOption[];
		showMapPreview?: boolean;
		showStartRoomBadge?: boolean;
		showIssueBadges?: boolean;
		allowCreate?: boolean;
		clearButton?: boolean;
	};
};

export type JsonInspectorMetadata = EditorControlMetadata & {
	type: "json-inspector";
	features?: {
		editable?: boolean;
		collapsible?: boolean;
		highlightChanged?: boolean;
		copyButton?: boolean;
	};
};

export type RichTextMetadata = EditorControlMetadata & {
	type: "rich-text";
	features?: {
		allowedMarks?: Array<"bold" | "italic" | "code">;
		conditionalSnippets?: boolean;
		variableInsert?: boolean;
		preview?: boolean;
		clearButton?: boolean;
		copyButton?: boolean;
	};
};

export type AliasSuggestionsMetadata = EditorControlMetadata & {
	type: "alias-suggestions";
	features?: {
		sourceText?: string;
		includeSynonyms?: boolean;
		includePluralization?: boolean;
		showCollisionWarnings?: boolean;
		collisionValues?: string[];
	};
};

export type SpecializedEditorProps = EditorControlProps<unknown, SpecializedControlMetadata>;
export type IdEditorProps = EditorControlProps<string, IdControlMetadata>;
export type DirectionPickerProps = EditorControlProps<string, DirectionPickerMetadata>;
export type ScopePickerProps = EditorControlProps<string, ScopePickerMetadata>;
export type PriorityControlProps = EditorControlProps<number, PriorityControlMetadata>;
export type RoomPickerProps = EditorControlProps<string, RoomPickerMetadata>;
export type JsonInspectorProps = EditorControlProps<unknown, JsonInspectorMetadata>;
export type RichTextProps = EditorControlProps<string, RichTextMetadata>;
export type AliasSuggestionsProps = EditorControlProps<string[], AliasSuggestionsMetadata>;

const FALLBACK_DIRECTIONS: DirectionPickerOption[] = [
	{label: "North", value: "n", opposite: "s"},
	{label: "Northeast", value: "ne", opposite: "sw", diagonal: true},
	{label: "East", value: "e", opposite: "w"},
	{label: "Southeast", value: "se", opposite: "nw", diagonal: true},
	{label: "South", value: "s", opposite: "n"},
	{label: "Southwest", value: "sw", opposite: "ne", diagonal: true},
	{label: "West", value: "w", opposite: "e"},
	{label: "Northwest", value: "nw", opposite: "se", diagonal: true},
];

const FALLBACK_SCOPE_OPTIONS: EditorSelectOption[] = [
	{label: "Global", value: "global", description: "Available everywhere."},
	{label: "World", value: "world", description: "Available anywhere in this world."},
	{label: "Room", value: "room", description: "Available only in selected rooms."},
	{label: "Feature", value: "feature", description: "Attached to a specific room feature."},
	{label: "Item", value: "item", description: "Available when the player has or sees an item."},
	{label: "Character", value: "character", description: "Attached to a character."},
	{label: "Command", value: "command", description: "Available inside a command."},
];

const PRIORITY_PRESETS: Record<string, number> = {
	lowest: -100,
	low: -10,
	normal: 0,
	high: 10,
	highest: 100,
};

const FALLBACK_BRANCH_TYPE_OPTIONS: EditorSelectOption[] = [
	{label: "If", value: "if"},
	{label: "Else if", value: "else-if"},
	{label: "Else", value: "else"},
];

const FALLBACK_MATCH_MODE_OPTIONS: EditorSelectOption[] = [
	{label: "Exact", value: "exact"},
	{label: "Starts with", value: "starts-with"},
	{label: "Contains", value: "contains"},
	{label: "Regex", value: "regex"},
];

const FALLBACK_TARGET_MODE_OPTIONS: EditorSelectOption[] = [
	{label: "None", value: "none"},
	{label: "Single target", value: "single"},
	{label: "Multiple targets", value: "multiple"},
];

const FALLBACK_PATHWAY_OPTIONS: EditorSelectOption[] = [
	{label: "No way", value: "no-way"},
	{label: "Two way", value: "two-way"},
	{label: "Forwards", value: "forwards"},
	{label: "Backwards", value: "backwards"},
];

const FALLBACK_FLAG_KIND_OPTIONS: EditorSelectOption[] = [
	{label: "Boolean", value: "boolean"},
	{label: "Number", value: "number"},
	{label: "String", value: "string"},
];

function isRecord(value: unknown): value is RecordValue {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): RecordValue {
	return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function fieldValue(value: RecordValue, key: string, fallback: unknown = "") {
	return value[key] ?? fallback;
}

function optionList(
	context: EditorControlContext,
	source?: string,
	metadataOptions?: EditorSelectOption[],
	fallbackOptions: EditorSelectOption[] = [],
) {
	if (metadataOptions?.length) return metadataOptions;
	if (source) return context.getOptionList?.(source) ?? fallbackOptions;
	return fallbackOptions;
}

function featureOptionList(
	metadata: SpecializedControlMetadata,
	context: EditorControlContext,
	optionsKey: string,
	sourceKey: string,
	fallbackOptions: EditorSelectOption[],
) {
	const options = metadata.features?.[optionsKey];
	const source = metadata.features?.[sourceKey];

	return optionList(
		context,
		typeof source === "string" ? source : undefined,
		Array.isArray(options) ? (options as EditorSelectOption[]) : undefined,
		fallbackOptions,
	);
}

function resolveDirectionOptions(metadata: DirectionPickerMetadata, context: EditorControlContext) {
	const options = optionList(
		context,
		metadata.features?.optionSource,
		metadata.features?.options,
		FALLBACK_DIRECTIONS,
	) as DirectionPickerOption[];

	return options.filter(
		(direction) => metadata.features?.includeDiagonals !== false || !direction.diagonal,
	);
}

function shellProps(
	metadata: EditorControlMetadata,
	context: SpecializedEditorProps["context"],
	error?: string,
	warnings?: string[],
) {
	return {
		title: metadata.title,
		description: metadata.description,
		error,
		warnings,
		appearance: resolveEditorControlAppearance(context.appearance, metadata.appearance),
		className: metadata.className,
		testId: metadata.testId,
	};
}

export function IdEditor(props: IdEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const knownIds = new Set(metadata.features?.knownIds ?? []);
	const normalized = applyTextTransform(value, "id");
	const isDuplicate = metadata.features?.checkUnique && knownIds.has(value);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				{renderChildControl({
					type: "text",
					childKey: "id",
					value,
					onChange,
					metadata: {
						title: metadata.features?.scope ? `${metadata.features.scope} ID` : "ID",
						placeholder: metadata.placeholder,
						transform: "id",
						features: {
							prefix: metadata.features?.prefix,
							clearButton: metadata.features?.clearButton,
							copyButton: metadata.features?.copyButton,
							selectOnFocus: true,
						},
					},
					parentMetadata: metadata,
					path,
					disabled,
					readonly,
					context,
				})}
				{value && normalized !== value ? (
					<div className="specializedEditor__meta">Normalizes to {normalized}</div>
				) : null}
				{isDuplicate ? (
					<div className="specializedEditor__warning">This ID is already in use.</div>
				) : null}
			</div>
		</FieldShell>
	);
}

export function RichTextEditor(props: RichTextProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				{renderChildControl({
					type: "textarea",
					childKey: "text",
					value,
					onChange,
					metadata: {
						title: metadata.title ?? "Text",
						placeholder: metadata.placeholder,
						features: {
							minRows: 5,
							clearButton: metadata.features?.clearButton,
							copyButton: metadata.features?.copyButton,
							showPreview: metadata.features?.preview,
						},
					},
					parentMetadata: metadata,
					path,
					disabled,
					readonly,
					context,
				})}
				{metadata.features?.allowedMarks?.length ? (
					<div className="specializedEditor__meta">
						Allowed marks: {metadata.features.allowedMarks.join(", ")}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}

export function DirectionPickerEditor(props: DirectionPickerProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const options = resolveDirectionOptions(metadata, context);
	const selected = options.find((direction) => direction.value === value);
	const mode = metadata.features?.mode ?? "compact";

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className={`specializedEditor specializedEditor--direction-${mode}`}>
				<div className="specializedEditor__buttonGrid">
					{options.map((direction) => (
						<button
							key={direction.value}
							type="button"
							className={value === direction.value ? "specializedEditor__button--selected" : ""}
							disabled={disabled || readonly || metadata.disabled || metadata.readonly}
							onClick={() => onChange(direction.value)}
						>
							{direction.value.toUpperCase()}
						</button>
					))}
				</div>
				{renderChildControl({
					type: "select",
					childKey: "direction",
					value,
					onChange,
					metadata: {
						title: "Direction",
						appearance: {chrome: "inline", size: "sm"},
						features: {
							options: options.map((direction) => ({
								label: direction.label,
								value: direction.value,
								description:
									direction.description ??
									(direction.opposite ? `Opposite: ${direction.opposite}` : undefined),
							})),
							clearButton: metadata.features?.clearButton,
							showDescriptions: true,
						},
					},
					parentMetadata: metadata,
					path,
					disabled,
					readonly,
					context,
				})}
				{metadata.features?.showOpposite && selected ? (
					<div className="specializedEditor__meta">Opposite exit: {selected.opposite}</div>
				) : null}
			</div>
		</FieldShell>
	);
}

export function ScopePickerEditor(props: ScopePickerProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const options = optionList(
		context,
		metadata.features?.optionSource,
		metadata.features?.options,
		FALLBACK_SCOPE_OPTIONS,
	);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			{renderChildControl({
				type: "select",
				childKey: "scope",
				value,
				onChange,
				metadata: {
					title: metadata.title ?? "Scope",
					placeholder: metadata.placeholder ?? "Choose scope",
					features: {
						options,
						showDescriptions: true,
						clearButton: metadata.features?.clearButton,
					},
				},
				parentMetadata: metadata,
				path,
				disabled,
				readonly,
				context,
			})}
		</FieldShell>
	);
}

export function PriorityControlEditor(props: PriorityControlProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const presets = metadata.features?.presets ?? PRIORITY_PRESETS;
	const preset =
		Object.entries(presets).find(([, presetValue]) => presetValue === value)?.[0] ?? "custom";
	const presetOptions = optionList(
		context,
		metadata.features?.presetOptionSource,
		metadata.features?.presetOptions,
		Object.keys(presets).map((presetKey) => ({
			label: presetKey,
			value: presetKey,
			description: `${presets[presetKey]}`,
		})),
	);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				{renderChildControl({
					type: "select",
					childKey: "preset",
					value: preset,
					onChange: (nextPreset) => {
						if (nextPreset !== "custom") onChange(presets[nextPreset] ?? 0);
					},
					metadata: {
						title: "Priority",
						features: {
							options: [
								...presetOptions,
								{label: metadata.features?.customLabel ?? "Custom", value: "custom"},
							],
							showDescriptions: true,
						},
					},
					parentMetadata: metadata,
					path: [...path, "preset"],
					disabled,
					readonly,
					context,
				})}
				{preset === "custom"
					? renderChildControl({
							type: "number",
							childKey: "custom",
							value,
							onChange,
							metadata: {
								title: "Custom priority",
								features: {kind: "priority", nudgeButtons: true, resetButton: true},
							},
							parentMetadata: metadata,
							path,
							disabled,
							readonly,
							context,
						})
					: null}
			</div>
		</FieldShell>
	);
}

export function RoomPickerEditor(props: RoomPickerProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const registryOptions = context.registerEntityPicker?.getEntities("room") ?? [];
	const options: RoomPickerOption[] =
		metadata.features?.options ??
		registryOptions.map((option) => ({
			id: option.id,
			label: option.label,
			description: option.description,
		}));
	const selected = options.find((option) => option.id === value);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				{renderChildControl({
					type: "select",
					childKey: "room",
					value,
					onChange,
					metadata: {
						title: metadata.title ?? "Room",
						placeholder: metadata.placeholder ?? "Choose room",
						features: {
							options: options.map((option) => ({
								label: option.label ?? option.id,
								value: option.id,
								description: option.description,
								badge: [
									metadata.features?.showStartRoomBadge && option.isStartRoom ? "start" : "",
									metadata.features?.showIssueBadges && option.issues ? `${option.issues} issues` : "",
								]
									.filter(Boolean)
									.join(", "),
							})),
							searchable: true,
							clearButton: metadata.features?.clearButton,
							allowCreate: metadata.features?.allowCreate,
							showDescriptions: true,
							showBadges: true,
						},
					},
					parentMetadata: metadata,
					path,
					disabled,
					readonly,
					context,
				})}
				{metadata.features?.showMapPreview ? (
					<div className="specializedEditor__preview">
						<strong>{selected?.label ?? (value || "No room selected")}</strong>
						<span>{selected?.description ?? selected?.id ?? ""}</span>
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}

export function AliasSuggestionsEditor(props: AliasSuggestionsProps) {
	const {value, onChange, metadata, error, warnings, disabled, readonly, context} = props;
	const suggestions = buildAliases(
		metadata.features?.sourceText,
		metadata.features?.includePluralization,
	);
	const collisions = value.filter((alias) => metadata.features?.collisionValues?.includes(alias));

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				<div className="specializedEditor__buttonGrid">
					{suggestions.map((suggestion) => (
						<button
							key={suggestion}
							type="button"
							disabled={disabled || readonly || value.includes(suggestion)}
							onClick={() => onChange([...value, suggestion])}
						>
							{suggestion}
						</button>
					))}
				</div>
				{metadata.features?.showCollisionWarnings && collisions.length > 0 ? (
					<div className="specializedEditor__warning">Colliding aliases: {collisions.join(", ")}</div>
				) : null}
			</div>
		</FieldShell>
	);
}

export function JsonInspectorEditor(props: JsonInspectorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			{metadata.features?.editable
				? renderChildControl({
						type: "textarea",
						childKey: "json",
						value: JSON.stringify(value, null, 2),
						onChange: (nextValue) => {
							try {
								onChange(JSON.parse(nextValue));
							} catch {
								onChange(nextValue);
							}
						},
						metadata: {
							title: "JSON",
							features: {monospace: true, minRows: 8, copyButton: metadata.features.copyButton},
						},
						parentMetadata: metadata,
						path,
						disabled,
						readonly,
						context,
					})
				: renderChildControl({
						type: "code-preview",
						childKey: "json",
						value,
						onChange: () => undefined,
						metadata: {
							title: metadata.title ?? "JSON",
							features: {
								language: "json",
								copyButton: metadata.features?.copyButton,
								collapsible: metadata.features?.collapsible,
							},
						},
						parentMetadata: metadata,
						path,
						disabled,
						readonly,
						context,
					})}
		</FieldShell>
	);
}

export function TemplatePickerEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, error, warnings, disabled, readonly, context} = props;
	const templates =
		(metadata.features?.templates as
			| Array<{
					label: string;
					description?: string;
					value: unknown;
			  }>
			| undefined) ?? [];

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor__templateGrid">
				{templates.map((template) => (
					<button
						key={template.label}
						type="button"
						disabled={disabled || readonly}
						onClick={() => onChange(template.value)}
					>
						<strong>{template.label}</strong>
						{template.description ? <span>{template.description}</span> : null}
					</button>
				))}
				{templates.length === 0 ? (
					<pre className="specializedEditor__code">{JSON.stringify(value, null, 2)}</pre>
				) : null}
			</div>
		</FieldShell>
	);
}

export function ValidationSummaryEditor(props: SpecializedEditorProps) {
	const {value, metadata, error, warnings, context} = props;
	const issues = asArray(value).filter(isRecord);
	const showWarnings = metadata.features?.showWarnings !== false;
	const showErrors = metadata.features?.showErrors !== false;
	const visibleIssues = issues.filter((issue) => {
		const severity = String(issue.severity ?? issue.type ?? "warning");
		return (severity === "error" && showErrors) || (severity !== "error" && showWarnings);
	});

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor__issues">
				{visibleIssues.length > 0 ? (
					visibleIssues.map((issue, index) => (
						<div
							key={index}
							className={`specializedEditor__issue specializedEditor__issue--${issue.severity ?? "warning"}`}
						>
							<strong>{String(issue.severity ?? "warning")}</strong>
							<span>{String(issue.message ?? issue.path ?? "Validation issue")}</span>
						</div>
					))
				) : (
					<div className="specializedEditor__meta">No validation issues.</div>
				)}
			</div>
		</FieldShell>
	);
}

export function DiffPreviewEditor(props: SpecializedEditorProps) {
	const {value, metadata, error, warnings, context} = props;
	const record = asRecord(value);
	const before = fieldValue(record, "before", "");
	const after = fieldValue(record, "after", "");
	const mode = String(metadata.features?.mode ?? "inline");

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className={`specializedEditor__diff specializedEditor__diff--${mode}`}>
				<pre>{String(before)}</pre>
				<pre>{String(after)}</pre>
			</div>
		</FieldShell>
	);
}

export function ConditionalTextEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const record = asRecord(value);
	const variants = asArray(record.variants);

	function updateField(key: string, nextValue: unknown) {
		onChange({...record, [key]: nextValue});
	}

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor">
				{renderChildControl({
					type: "textarea",
					childKey: "default",
					value: String(record.default ?? ""),
					onChange: (nextValue) => updateField("default", nextValue),
					metadata: {title: "Default text", features: {minRows: 4, showPreview: true}},
					parentMetadata: metadata,
					path: [...path, "default"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "array",
					childKey: "variants",
					value: variants,
					onChange: (nextVariants) => updateField("variants", nextVariants),
					metadata: {
						title: "Conditional variants",
						features: {
							addLabel: "Add variant",
							defaultItem: {text: "", when: {kind: "single", flag: "", value: true}},
							getItemTitle: "Shown when {when}",
							itemMetadata: {
								type: "object",
								features: {
									fields: [
										{key: "text", metadata: {type: "textarea", title: "Text", features: {minRows: 3}}},
										{key: "when", metadata: {type: "condition-builder", title: "When"}},
									],
								},
							},
						},
					},
					parentMetadata: metadata,
					path: [...path, "variants"],
					disabled,
					readonly,
					context,
				})}
			</div>
		</FieldShell>
	);
}

export function LogicBranchListEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const branchTypeOptions = featureOptionList(
		metadata,
		context,
		"branchTypeOptions",
		"branchTypeOptionSource",
		FALLBACK_BRANCH_TYPE_OPTIONS,
	);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			{renderChildControl({
				type: "array",
				childKey: "branches",
				value: asArray(value),
				onChange,
				metadata: {
					title: metadata.title ?? "Branches",
					features: {
						addLabel: "Add branch",
						reorderable: true,
						defaultItem: {
							branchType: "if",
							when: {kind: "single", flag: "", value: true},
							message: "",
							effects: [],
						},
						getItemTitle: "{branchType}",
						getItemSubtitle: "when {when}",
						itemMetadata: {
							type: "object",
							features: {
								fields: [
									{
										key: "branchType",
										metadata: {
											type: "select",
											title: "Branch",
											features: {
												options: branchTypeOptions,
											},
										},
									},
									{key: "when", metadata: {type: "condition-builder", title: "When"}},
									{key: "message", metadata: {type: "message", title: "Message"}},
									{key: "effects", metadata: {type: "effect-list", title: "Effects"}},
								],
							},
						},
					},
				},
				parentMetadata: metadata,
				path,
				disabled,
				readonly,
				context,
			})}
		</FieldShell>
	);
}

export function CommandPatternEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const record = asRecord(value);
	const matchModeOptions = featureOptionList(
		metadata,
		context,
		"matchModeOptions",
		"matchModeOptionSource",
		FALLBACK_MATCH_MODE_OPTIONS,
	);
	const targetModeOptions = featureOptionList(
		metadata,
		context,
		"targetModeOptions",
		"targetModeOptionSource",
		FALLBACK_TARGET_MODE_OPTIONS,
	);

	function updateField(key: string, nextValue: unknown) {
		onChange({...record, [key]: nextValue});
	}

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor specializedEditor__grid">
				{renderChildControl({
					type: "select",
					childKey: "matchMode",
					value: String(record.matchMode ?? "exact"),
					onChange: (nextValue) => updateField("matchMode", nextValue),
					metadata: {
						title: "Match mode",
						features: {
							options: matchModeOptions,
						},
					},
					parentMetadata: metadata,
					path: [...path, "matchMode"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "select",
					childKey: "targetMode",
					value: String(record.targetMode ?? "none"),
					onChange: (nextValue) => updateField("targetMode", nextValue),
					metadata: {
						title: "Target mode",
						features: {
							options: targetModeOptions,
						},
					},
					parentMetadata: metadata,
					path: [...path, "targetMode"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "tag-list",
					childKey: "verbs",
					value: asArray(record.verbs) as string[],
					onChange: (nextValue) => updateField("verbs", nextValue),
					metadata: {title: "Verbs", features: {suggestArticleless: true, showNormalization: true}},
					parentMetadata: metadata,
					path: [...path, "verbs"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "scope-picker",
					childKey: "scope",
					value: String(record.scope ?? "room"),
					onChange: (nextValue) => updateField("scope", nextValue),
					metadata: {title: "Scope"},
					parentMetadata: metadata,
					path: [...path, "scope"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "priority-control",
					childKey: "priority",
					value: Number(record.priority ?? 0),
					onChange: (nextValue) => updateField("priority", nextValue),
					metadata: {title: "Priority"},
					parentMetadata: metadata,
					path: [...path, "priority"],
					disabled,
					readonly,
					context,
				})}
			</div>
		</FieldShell>
	);
}

export function ConnectionPickerEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const record = asRecord(value);
	const pathwayOptions = featureOptionList(
		metadata,
		context,
		"pathwayOptions",
		"pathwayOptionSource",
		FALLBACK_PATHWAY_OPTIONS,
	);

	function updateField(key: string, nextValue: unknown) {
		onChange({...record, [key]: nextValue});
	}

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			<div className="specializedEditor specializedEditor__grid">
				{renderChildControl({
					type: "room-picker",
					childKey: "fromRoom",
					value: String(record.fromRoom ?? ""),
					onChange: (nextValue) => updateField("fromRoom", nextValue),
					metadata: {title: "From room"},
					parentMetadata: metadata,
					path: [...path, "fromRoom"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "room-picker",
					childKey: "toRoom",
					value: String(record.toRoom ?? ""),
					onChange: (nextValue) => updateField("toRoom", nextValue),
					metadata: {title: "To room"},
					parentMetadata: metadata,
					path: [...path, "toRoom"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "direction-picker",
					childKey: "direction",
					value: String(record.direction ?? ""),
					onChange: (nextValue) => updateField("direction", nextValue),
					metadata: {title: "Direction", features: {showOpposite: true}},
					parentMetadata: metadata,
					path: [...path, "direction"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "select",
					childKey: "pathway",
					value: String(record.pathway ?? "open"),
					onChange: (nextValue) => updateField("pathway", nextValue),
					metadata: {
						title: "Pathway",
						features: {
							options: pathwayOptions,
						},
					},
					parentMetadata: metadata,
					path: [...path, "pathway"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "condition-builder",
					childKey: "condition",
					value: asRecord(record.condition),
					onChange: (nextValue) => updateField("condition", nextValue),
					metadata: {title: "Usable when"},
					parentMetadata: metadata,
					path: [...path, "condition"],
					disabled,
					readonly,
					context,
				})}
			</div>
		</FieldShell>
	);
}

export function FlagEditor(props: SpecializedEditorProps) {
	const {value, onChange, metadata, path, error, warnings, disabled, readonly, context} = props;
	const flagKindOptions = featureOptionList(
		metadata,
		context,
		"flagKindOptions",
		"flagKindOptionSource",
		FALLBACK_FLAG_KIND_OPTIONS,
	);

	return (
		<FieldShell {...shellProps(metadata, context, error, warnings)}>
			{renderChildControl({
				type: "array",
				childKey: "flags",
				value: asArray(value),
				onChange,
				metadata: {
					title: "Flags",
					features: {
						addLabel: "Add flag",
						duplicateable: true,
						duplicateBehavior: "with-new-id",
						defaultItem: {id: "", kind: "boolean", description: ""},
						getItemTitle: "{id}",
						getItemSubtitle: "{kind} - {description}",
						itemMetadata: {
							type: "object",
							features: {
								fields: [
									{key: "id", metadata: {type: "id", title: "Flag ID"}},
									{
										key: "kind",
										metadata: {
											type: "select",
											title: "Kind",
											features: {
												options: flagKindOptions,
											},
										},
									},
									{key: "description", metadata: {type: "text", title: "Description"}},
								],
							},
						},
					},
				},
				parentMetadata: metadata,
				path,
				disabled,
				readonly,
				context,
			})}
		</FieldShell>
	);
}

function buildAliases(sourceText?: string, includePluralization?: boolean) {
	const source = sourceText?.trim();
	if (!source) return [];
	const articleless = source.replace(/^(a|an|the)\s+/i, "").trim();
	const words = articleless.split(/\s+/).filter(Boolean);
	const values = new Set([source, articleless, words.at(-1) ?? ""]);
	if (includePluralization) {
		for (const value of [...values]) {
			if (value && !value.endsWith("s")) values.add(`${value}s`);
		}
	}
	return [...values].filter(Boolean);
}

export function formatConditionForArrayTitle(value: unknown) {
	return generateConditionSummary(value);
}

export function formatEffectForArrayTitle(value: unknown) {
	return generateEffectSummary(value);
}
