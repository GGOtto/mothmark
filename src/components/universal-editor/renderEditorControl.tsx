import {ArrayEditor, type ArrayEditorProps} from "./ArrayEditor";
import {CodePreviewEditor, type CodePreviewEditorProps} from "./CodePreviewEditor";
import {ConditionBuilderEditor, type ConditionBuilderEditorProps} from "./ConditionBuilderEditor";
import {
	DiscriminatedUnionEditor,
	type DiscriminatedUnionEditorProps,
} from "./DiscriminatedUnionEditor";
import {EffectListEditor, type EffectListEditorProps} from "./EffectListEditor";
import {EffectEditor, type EffectEditorProps} from "./EffectEditor";
import {EntityPickerEditor, type EntityPickerEditorProps} from "./EntityPickerEditor";
import {FlagPickerEditor, type FlagPickerEditorProps} from "./FlagPickerEditor";
import {HiddenEditor, type HiddenEditorProps} from "./HiddenEditor";
import {LinkListEditor, type LinkListEditorProps} from "./LinkListEditor";
import {MessageEditor, type MessageEditorProps} from "./MessageEditor";
import {MultiSelectEditor, type MultiSelectEditorProps} from "./MultiSelectEditor";
import {NumberFieldEditor, type NumberFieldProps} from "./NumberFieldEditor";
import {ObjectEditor, type ObjectEditorProps} from "./ObjectEditor";
import {ObjectFlagEditor, type ObjectFlagEditorProps} from "./ObjectFlagEditor";
import {SelectEditor, type SelectEditorProps} from "./SelectEditor";
import {StringListEditor, type StringListEditorProps} from "./StringListEditor";
import {
	AliasSuggestionsEditor,
	CommandPatternEditor,
	ConditionalTextEditor,
	ConnectionPickerEditor,
	DiffPreviewEditor,
	DirectionPickerEditor,
	FlagEditor,
	IdEditor,
	JsonInspectorEditor,
	LogicBranchListEditor,
	PriorityControlEditor,
	RichTextEditor,
	RoomPickerEditor,
	ScopePickerEditor,
	TemplatePickerEditor,
	ValidationSummaryEditor,
	type AliasSuggestionsProps,
	type DirectionPickerProps,
	type IdEditorProps,
	type JsonInspectorProps,
	type PriorityControlProps,
	type RichTextProps,
	type RoomPickerProps,
	type ScopePickerProps,
	type SpecializedEditorProps,
} from "./SpecializedEditors";
import {TagListEditor, type TagListEditorProps} from "./TagListEditor";
import {TextField, type TextFieldProps} from "./TextFieldEditor";
import {TextareaEditor, type TextareaProps} from "./TextareaEditor";
import {ToggleEditor, type ToggleEditorProps} from "./ToggleEditor";
import type {EditorControlProps, EditorControlMetadata} from "../../types/universalEditorTypes";
import {FieldShellDisclosureProvider} from "./FieldShell";

export function renderEditorControl(props: EditorControlProps<unknown, EditorControlMetadata>) {
	return (
		<FieldShellDisclosureProvider
			value={{metadata: props.metadata, path: props.path, context: props.context}}
		>
			{renderControl(props)}
		</FieldShellDisclosureProvider>
	);
}

function renderControl(props: EditorControlProps<unknown, EditorControlMetadata>) {
	switch (props.metadata.type) {
		case "text":
		case "input":
		case "id":
			if (props.metadata.type === "id") return <IdEditor {...(props as IdEditorProps)} />;
			return <TextField {...(props as TextFieldProps)} />;

		case "textarea":
			return <TextareaEditor {...(props as TextareaProps)} />;

		case "rich-text":
			return <RichTextEditor {...(props as RichTextProps)} />;

		case "number":
			return <NumberFieldEditor {...(props as NumberFieldProps)} />;

		case "toggle":
			return <ToggleEditor {...(props as ToggleEditorProps)} />;

		case "select":
			return <SelectEditor {...(props as SelectEditorProps)} />;

		case "multi-select":
			return <MultiSelectEditor {...(props as MultiSelectEditorProps)} />;

		case "tag-list":
			return <TagListEditor {...(props as TagListEditorProps)} />;

		case "link-list":
			return <LinkListEditor {...(props as LinkListEditorProps)} />;

		case "string-list":
			return <StringListEditor {...(props as StringListEditorProps)} />;

		case "object":
			return <ObjectEditor {...(props as ObjectEditorProps)} />;

		case "array":
			return <ArrayEditor {...(props as ArrayEditorProps)} />;

		case "discriminated-union":
			return <DiscriminatedUnionEditor {...(props as DiscriminatedUnionEditorProps)} />;

		case "conditional-text":
			return <ConditionalTextEditor {...(props as SpecializedEditorProps)} />;

		case "condition-builder":
			return <ConditionBuilderEditor {...(props as ConditionBuilderEditorProps)} />;

		case "effect":
			return <EffectEditor {...(props as EffectEditorProps)} />;

		case "effect-list":
			return <EffectListEditor {...(props as EffectListEditorProps)} />;

		case "logic-branch-list":
			return <LogicBranchListEditor {...(props as SpecializedEditorProps)} />;

		case "command-pattern":
			return <CommandPatternEditor {...(props as SpecializedEditorProps)} />;

		case "alias-suggestions":
			return <AliasSuggestionsEditor {...(props as AliasSuggestionsProps)} />;

		case "entity-picker":
			return <EntityPickerEditor {...(props as EntityPickerEditorProps)} />;

		case "room-picker":
			return <RoomPickerEditor {...(props as RoomPickerProps)} />;

		case "connection-picker":
			return <ConnectionPickerEditor {...(props as SpecializedEditorProps)} />;

		case "flag-picker":
			return <FlagPickerEditor {...(props as FlagPickerEditorProps)} />;

		case "flag-editor":
			return <FlagEditor {...(props as SpecializedEditorProps)} />;

		case "object-flag-editor":
			return <ObjectFlagEditor {...(props as ObjectFlagEditorProps)} />;

		case "direction-picker":
			return <DirectionPickerEditor {...(props as DirectionPickerProps)} />;

		case "scope-picker":
			return <ScopePickerEditor {...(props as ScopePickerProps)} />;

		case "priority-control":
			return <PriorityControlEditor {...(props as PriorityControlProps)} />;

		case "template-picker":
			return <TemplatePickerEditor {...(props as SpecializedEditorProps)} />;

		case "validation-summary":
			return <ValidationSummaryEditor {...(props as SpecializedEditorProps)} />;

		case "code-preview":
			return <CodePreviewEditor {...(props as CodePreviewEditorProps)} />;

		case "json-inspector":
			return <JsonInspectorEditor {...(props as JsonInspectorProps)} />;

		case "diff-preview":
			return <DiffPreviewEditor {...(props as SpecializedEditorProps)} />;

		case "hidden":
			return <HiddenEditor {...(props as HiddenEditorProps)} />;

		case "message":
			return <MessageEditor {...(props as MessageEditorProps)} />;

		default:
			return null;
	}
}
