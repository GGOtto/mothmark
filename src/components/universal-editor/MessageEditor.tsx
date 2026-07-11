"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./MessageEditor.scss";

export type MessageVariant = "info" | "warning" | "error" | "success" | "empty";

export type MessageFeatures = {
	variant?: MessageVariant;
	collapsible?: boolean;
	defaultCollapsed?: boolean;
};

export type MessageControlMetadata = EditorControlMetadata & {
	type: "message";
	features?: MessageFeatures;
};

export type MessageEditorProps = EditorControlProps<string, MessageControlMetadata>;

export function MessageEditor({value, metadata, error, warnings, context}: MessageEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const variant = metadata.features?.variant ?? "info";
	const messageBody = <p className="messageEditor__body">{value}</p>;

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
			{metadata.features?.collapsible ? (
				<details
					className={`messageEditor messageEditor--${variant}`}
					open={!metadata.features.defaultCollapsed}
				>
					<summary className="messageEditor__summary">{metadata.placeholder ?? "Details"}</summary>
					{messageBody}
				</details>
			) : (
				<div className={`messageEditor messageEditor--${variant}`}>{messageBody}</div>
			)}
		</FieldShell>
	);
}
