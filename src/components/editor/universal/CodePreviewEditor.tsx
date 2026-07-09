"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./CodePreviewEditor.scss";

export type CodePreviewFeatures = {
	language?: "json" | "ts" | "text";
	copyButton?: boolean;
	collapsible?: boolean;
	defaultCollapsed?: boolean;
	maxHeight?: number;
};

export type CodePreviewControlMetadata = EditorControlMetadata & {
	type: "code-preview";
	features?: CodePreviewFeatures;
};

export type CodePreviewEditorProps = EditorControlProps<unknown, CodePreviewControlMetadata>;

function formatPreview(value: unknown, language: CodePreviewFeatures["language"]) {
	if (typeof value === "string" && language !== "json") return value;

	if (language === "text") return String(value ?? "");

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export function CodePreviewEditor({
	value,
	metadata,
	error,
	warnings,
	context,
}: CodePreviewEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const language = metadata.features?.language ?? "json";
	const previewValue = formatPreview(value, language);

	function copyValue() {
		if (!navigator?.clipboard) return;

		void navigator.clipboard.writeText(previewValue);
	}

	const codeBlock = (
		<pre
			className={`codePreviewEditor__code codePreviewEditor__code--${language}`}
			style={{maxHeight: metadata.features?.maxHeight}}
		>
			<code>{previewValue}</code>
		</pre>
	);

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
			<div className="codePreviewEditor">
				<div className="codePreviewEditor__toolbar">
					<span>{language}</span>
					{metadata.features?.copyButton ? (
						<button type="button" disabled={previewValue.length === 0} onClick={copyValue}>
							Copy
						</button>
					) : null}
				</div>

				{metadata.features?.collapsible ? (
					<details className="codePreviewEditor__details" open={!metadata.features.defaultCollapsed}>
						<summary>{metadata.placeholder ?? "Preview"}</summary>
						{codeBlock}
					</details>
				) : (
					codeBlock
				)}
			</div>
		</FieldShell>
	);
}
