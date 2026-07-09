import {TextField, type TextFieldProps} from "./TextFieldEditor";
import type {EditorControlProps, EditorControlMetadata} from "../../../types/universalEditorTypes";

export function renderEditorControl(props: EditorControlProps<unknown, EditorControlMetadata>) {
	switch (props.metadata.type) {
		case "input":
			return <TextField {...(props as TextFieldProps)} />;

		// 	case "textarea":
		// 		return <TextareaEditor {...props as TextareaEditorProps} />;

		// 	case "number":
		// 		return <NumberEditor {...props as NumberEditorProps} />;

		// 	case "toggle":
		// 		return <ToggleEditor {...props as ToggleEditorProps} />;

		// 	case "select":
		// 		return <SelectEditor {...props as SelectEditorProps} />;

		// 	case "multi-select":
		// 		return <MultiSelectEditor {...props as MultiSelectEditorProps} />;

		// 	case "tag-list":
		// 		return <TagListEditor {...props as TagListEditorProps} />;

		// 	case "string-list":
		// 		return <StringListEditor {...props as StringListEditorProps} />;

		// 	case "object":
		// 		return <ObjectEditor {...props as ObjectEditorProps} />;

		// 	case "array":
		// 		return <ArrayEditor {...props as ArrayEditorProps} />;

		// 	case "discriminated-union":
		// 		return <DiscriminatedUnionEditor {...props as DiscriminatedUnionEditorProps} />;

		// 	case "condition-builder":
		// 		return <ConditionBuilderEditor {...props as ConditionBuilderEditorProps} />;

		// 	case "effect-list":
		// 		return <EffectListEditor {...props as EffectListEditorProps} />;

		// 	case "entity-picker":
		// 		return <EntityPickerEditor {...props as EntityPickerEditorProps} />;

		// 	case "flag-picker":
		// 		return <FlagPickerEditor {...props as FlagPickerEditorProps} />;

		// 	case "code-preview":
		// 		return <CodePreviewEditor {...props as CodePreviewEditorProps} />;

		// 	case "hidden":
		// 		return null;

		// 	case "message":
		// 		return <MessageEditor {...props as MessageEditorProps} />;

		default:
			return null;
	}
}
