"use client";

import {X} from "lucide-react";
import type {ReactNode} from "react";
import {compareIds} from "@/utils/idUtils";
import type {EditorControlProps} from "@/types/universalEditorTypes";
import {
	acceptedVariableType,
	compatibleVariableOptions,
	type CommandVariableEditorContext,
	type CommandVariableOption,
	unavailableVariableMessage,
} from "./model";
import {VariableMenu} from "./VariableMenu";
import {VariableToken} from "./VariableToken";
import "./variableEditor.scss";

export function VariableFieldEditor({
	props,
	children,
}: {
	props: EditorControlProps<unknown> & {
		context: EditorControlProps<unknown>["context"] & {
			commandVariables: CommandVariableEditorContext;
		};
	};
	children: ReactNode;
}) {
	const {context, metadata, path, value} = props;
	const options = compatibleVariableOptions(context.commandVariables, metadata);
	const binding = context.commandVariables.getBinding(path);
	const variableType = acceptedVariableType(metadata);
	const unavailableMessage = variableType ? unavailableVariableMessage(variableType) : undefined;
	if (options.length === 0 && !binding && !metadata.commandVariableType) return children;
	const selected = binding
		? options.find(
				(option) =>
					compareIds(option.blockId, binding.blockId) && option.projection === binding.projection,
			)
		: undefined;

	function select(option: CommandVariableOption) {
		context.commandVariables.setBinding(path, option, value);
	}

	return (
		<div className={`variableFieldEditor ${binding ? "variableFieldEditor--bound" : ""}`}>
			{binding ? (
				<div className="variableFieldEditor__binding">
					<span className="variableFieldEditor__bindingLabel">Variable</span>
					<VariableToken reference={binding} option={selected} compact />
					<div className="variableFieldEditor__bindingActions">
						<VariableMenu options={options} label="Change" onSelect={select} />
						<button
							type="button"
							className="variableFieldEditor__remove"
							aria-label="Remove variable"
							title="Remove variable"
							onClick={() => context.commandVariables.setBinding(path, undefined, value)}
						>
							<X size={14} aria-hidden="true" />
						</button>
					</div>
				</div>
			) : null}
			<div className="variableFieldEditor__fallback">
				{children}
				{binding ? (
					<span className="variableFieldEditor__fallbackLabel">
						Set a value to replace this variable.
					</span>
				) : null}
			</div>
			{!binding ? (
				<div className="variableFieldEditor__add">
					<VariableMenu
						options={options}
						label="Use command value"
						disabledReason={unavailableMessage}
						onSelect={select}
					/>
					{options.length === 0 && unavailableMessage ? (
						<span className="variableFieldEditor__unavailable">{unavailableMessage}</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}
