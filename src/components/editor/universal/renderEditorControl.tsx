import {ArrayEditor, type ArrayEditorProps} from "./ArrayEditor";
import {CodePreviewEditor, type CodePreviewEditorProps} from "./CodePreviewEditor";
import {ConditionBuilderEditor, type ConditionBuilderEditorProps} from "./ConditionBuilderEditor";
import {
	DiscriminatedUnionEditor,
	type DiscriminatedUnionEditorProps,
} from "./DiscriminatedUnionEditor";
import {EffectListEditor, type EffectListEditorProps} from "./EffectListEditor";
import {EntityPickerEditor, type EntityPickerEditorProps} from "./EntityPickerEditor";
import {FlagPickerEditor, type FlagPickerEditorProps} from "./FlagPickerEditor";
import {HiddenEditor, type HiddenEditorProps} from "./HiddenEditor";
import {MessageEditor, type MessageEditorProps} from "./MessageEditor";
import {MultiSelectEditor, type MultiSelectEditorProps} from "./MultiSelectEditor";
import {NumberFieldEditor, type NumberFieldProps} from "./NumberFieldEditor";
import {ObjectEditor, type ObjectEditorProps} from "./ObjectEditor";
import {SelectEditor, type SelectEditorProps} from "./SelectEditor";
import {StringListEditor, type StringListEditorProps} from "./StringListEditor";
import {TagListEditor, type TagListEditorProps} from "./TagListEditor";
import {TextField, type TextFieldProps} from "./TextFieldEditor";
import {TextareaEditor, type TextareaProps} from "./TextareaEditor";
import {ToggleEditor, type ToggleEditorProps} from "./ToggleEditor";
import type {EditorControlProps, EditorControlMetadata} from "../../../types/universalEditorTypes";

export function renderEditorControl(props: EditorControlProps<unknown, EditorControlMetadata>) {
	switch (props.metadata.type) {
		case "input":
			return <TextField {...(props as TextFieldProps)} />;

		case "textarea":
			return <TextareaEditor {...(props as TextareaProps)} />;

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

		case "string-list":
			return <StringListEditor {...(props as StringListEditorProps)} />;

		case "object":
			return <ObjectEditor {...(props as ObjectEditorProps)} />;

		case "array":
			return <ArrayEditor {...(props as ArrayEditorProps)} />;

		case "discriminated-union":
			return <DiscriminatedUnionEditor {...(props as DiscriminatedUnionEditorProps)} />;

		case "condition-builder":
			return <ConditionBuilderEditor {...(props as ConditionBuilderEditorProps)} />;

		case "effect-list":
			return <EffectListEditor {...(props as EffectListEditorProps)} />;

		case "entity-picker":
			return <EntityPickerEditor {...(props as EntityPickerEditorProps)} />;

		case "flag-picker":
			return <FlagPickerEditor {...(props as FlagPickerEditorProps)} />;

		case "code-preview":
			return <CodePreviewEditor {...(props as CodePreviewEditorProps)} />;

		case "hidden":
			return <HiddenEditor {...(props as HiddenEditorProps)} />;

		case "message":
			return <MessageEditor {...(props as MessageEditorProps)} />;

		default:
			return null;
	}
}
