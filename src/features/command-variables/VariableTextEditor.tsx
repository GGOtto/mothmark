"use client";

import {useCallback, useEffect, useMemo, useRef} from "react";
import type {EditorControlMetadata, EditorControlProps} from "@/types/universalEditorTypes";
import {resolveEditorControlAppearance} from "@/types/universalEditorTypes";
import {FieldShell} from "@/components/universal-editor/FieldShell";
import {compareIds} from "@/utils/idUtils";
import {
	inlineVariableOptions,
	type CommandVariableEditorContext,
	unavailableVariableMessage,
} from "./model";
import {parseVariableText, serializeVariableReference} from "./syntax";
import {VariableMenu} from "./VariableMenu";
import "./variableEditor.scss";

type VariableTextMetadata = EditorControlMetadata & {
	type: "text" | "input" | "textarea" | "rich-text";
};

type VariableTextEditorProps = Omit<
	EditorControlProps<string | undefined, VariableTextMetadata>,
	"context"
> & {
	context: EditorControlProps<unknown>["context"] & {
		commandVariables: CommandVariableEditorContext;
	};
};

function optionForToken(context: CommandVariableEditorContext, id: string, projection?: string) {
	return context.options.find(
		(option) =>
			compareIds(option.blockId, {type: "command-block", id}) && option.projection === projection,
	);
}

function tokenElement(raw: string, context: CommandVariableEditorContext) {
	const parsed = parseVariableText(raw)[0];
	if (!parsed || parsed.type !== "variable") return document.createTextNode(raw);
	const option = optionForToken(context, parsed.reference.blockId.id, parsed.reference.projection);
	const span = document.createElement("span");
	span.contentEditable = "false";
	span.dataset.variableToken = raw;
	span.className = [
		"variableToken",
		option ? `commandVariableColor--${option.blockType}` : "variableToken--invalid",
	]
		.filter(Boolean)
		.join(" ");
	span.title = option ? "" : `Missing command block ${parsed.reference.blockId.id}`;

	const marker = document.createElement("span");
	marker.className = "variableToken__marker";
	marker.setAttribute("aria-hidden", "true");
	marker.textContent = option ? "" : "!";
	span.append(marker);

	const label = document.createElement("span");
	label.className = "variableToken__label";
	label.textContent = option?.label ?? "Unavailable variable";
	span.append(label);

	if (option?.detail) {
		const detail = document.createElement("span");
		detail.className = "variableToken__detail";
		detail.textContent = ` · ${option.detail}`;
		span.append(detail);
	}
	return span;
}

function surfaceValue(root: HTMLElement) {
	let value = "";
	function read(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			value += node.textContent ?? "";
			return;
		}
		if (!(node instanceof HTMLElement)) return;
		if (node.dataset.variableToken) {
			value += node.dataset.variableToken;
			return;
		}
		if (node.tagName === "BR") {
			value += "\n";
			return;
		}
		const startsBlock = node !== root && (node.tagName === "DIV" || node.tagName === "P");
		if (startsBlock && value && !value.endsWith("\n")) value += "\n";
		node.childNodes.forEach(read);
	}
	root.childNodes.forEach(read);
	return value;
}

export function VariableTextEditor({
	value = "",
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: VariableTextEditorProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const selectionRef = useRef<Range | undefined>(undefined);
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const canEdit = !(disabled || metadata.disabled || readonly || metadata.readonly);
	const options = useMemo(
		() => inlineVariableOptions(context.commandVariables),
		[context.commandVariables],
	);
	const multiline = metadata.type === "textarea" || metadata.type === "rich-text";

	const renderValue = useCallback(() => {
		const root = rootRef.current;
		if (!root) return;
		const children = parseVariableText(value).map((node) =>
			node.type === "text"
				? document.createTextNode(node.value)
				: tokenElement(node.raw, context.commandVariables),
		);
		root.replaceChildren(...children);
	}, [context.commandVariables, value]);

	useEffect(() => {
		const root = rootRef.current;
		if (root && surfaceValue(root) === value) return;
		renderValue();
	}, [renderValue, value]);

	function rememberSelection() {
		const root = rootRef.current;
		const selection = window.getSelection();
		if (!root || !selection?.rangeCount) return;
		const range = selection.getRangeAt(0);
		if (root.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
	}

	function emitSurfaceValue() {
		const root = rootRef.current;
		if (!root) return;
		const nextValue = surfaceValue(root);
		onChange(nextValue);
	}

	function insertVariable(reference: (typeof options)[number]) {
		const root = rootRef.current;
		if (!root || !canEdit) return;
		root.focus();
		const raw = serializeVariableReference(reference);
		const token = tokenElement(raw, context.commandVariables);
		const range = selectionRef.current;
		if (range && root.contains(range.commonAncestorContainer)) {
			range.deleteContents();
			range.insertNode(token);
			range.setStartAfter(token);
			range.collapse(true);
		} else {
			root.append(token);
		}
		const selection = window.getSelection();
		selection?.removeAllRanges();
		if (range) selection?.addRange(range);
		rememberSelection();
		emitSurfaceValue();
	}

	function pasteText(text: string) {
		const root = rootRef.current;
		if (!root || !canEdit) return;
		const selection = window.getSelection();
		const range =
			selection?.rangeCount && root.contains(selection.getRangeAt(0).commonAncestorContainer)
				? selection.getRangeAt(0)
				: undefined;
		const fragment = document.createDocumentFragment();
		const insertedNodes = parseVariableText(multiline ? text : text.replace(/\s*\n\s*/g, " ")).map(
			(node) =>
				node.type === "text"
					? document.createTextNode(node.value)
					: tokenElement(node.raw, context.commandVariables),
		);
		insertedNodes.forEach((node) => fragment.append(node));
		if (range) {
			range.deleteContents();
			range.insertNode(fragment);
			const lastNode = insertedNodes.at(-1);
			if (lastNode) range.setStartAfter(lastNode);
			range.collapse(true);
			selection?.removeAllRanges();
			selection?.addRange(range);
		} else {
			root.append(fragment);
		}
		rememberSelection();
		emitSurfaceValue();
	}

	return (
		<FieldShell
			title={metadata.title}
			description={metadata.description}
			error={error}
			warnings={warnings}
			appearance={appearance}
			className={metadata.className}
			testId={metadata.testId}
		>
			<div className={`variableTextEditor ${multiline ? "variableTextEditor--multiline" : ""}`}>
				<div
					ref={rootRef}
					className="variableTextEditor__surface"
					role="textbox"
					aria-label={metadata.title}
					aria-multiline={multiline}
					aria-placeholder={metadata.placeholder}
					data-placeholder={metadata.placeholder}
					contentEditable={canEdit}
					suppressContentEditableWarning
					tabIndex={canEdit ? 0 : -1}
					autoFocus={autoFocus}
					onInput={emitSurfaceValue}
					onKeyUp={rememberSelection}
					onMouseUp={rememberSelection}
					onBlur={rememberSelection}
					onCopy={(event) => {
						const selection = window.getSelection();
						if (!selection?.rangeCount) return;
						const range = selection.getRangeAt(0);
						if (!rootRef.current?.contains(range.commonAncestorContainer)) return;
						const container = document.createElement("div");
						container.append(range.cloneContents());
						event.preventDefault();
						event.clipboardData.setData("text/plain", surfaceValue(container));
					}}
					onPaste={(event) => {
						event.preventDefault();
						pasteText(event.clipboardData.getData("text/plain"));
					}}
					onKeyDown={(event) => {
						if (!multiline && event.key === "Enter") event.preventDefault();
					}}
				/>
				<div className="variableTextEditor__toolbar">
					<VariableMenu
						options={options}
						onSelect={insertVariable}
						disabled={!canEdit}
						disabledReason={unavailableVariableMessage("string")}
					/>
					{options.length === 0 ? (
						<span className="variableTextEditor__unavailable">
							{unavailableVariableMessage("string")}
						</span>
					) : null}
				</div>
			</div>
		</FieldShell>
	);
}
