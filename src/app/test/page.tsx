"use client";

import {useMemo, useState} from "react";
import {renderEditorControl} from "../../components/editor/universal/renderEditorControl";
import type {
	EditorControlChrome,
	EditorControlContext,
	EditorControlMetadata,
	EditorControlSize,
	EditorControlTheme,
	EditorControlTone,
	EditorControlType,
	EditorPath,
} from "../../types/universalEditorTypes";
import "./TestPage.scss";

type InputMetadataExtras = {
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	inputMode?: "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";
	autoComplete?: string;
	prefix?: string;
	suffix?: string;
	transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
};

type ThemeVariant = {
	id: EditorControlTheme;
};

type ParentSurface = {
	id: string;
	theme: Exclude<EditorControlTheme, "auto">;
	surface: "light" | "card";
};

type TextSetup = {
	id: string;
	value: string;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;
	metadata: Omit<EditorControlMetadata, "type" | "tone" | "chrome" | "size"> & InputMetadataExtras;
};

type ControlVariant = {
	id: string;
	tone: EditorControlTone;
	chrome: EditorControlChrome;
	size?: EditorControlSize;
	setup: TextSetup;
};

type RenderedExample = {
	id: string;
	value: unknown;
	path: EditorPath;
	themeVariant: ThemeVariant;
	parentSurface: ParentSurface;
	controlVariant: ControlVariant;
	metadata: EditorControlMetadata & InputMetadataExtras;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;
};

type MatrixRow = {
	id: string;
	variantJson: string;
	examples: RenderedExample[];
};

const CONTROL_TYPE: EditorControlType = "input";

const THEME_VARIANTS: ThemeVariant[] = [
	{id: "auto"},
	{id: "plain"},
	{id: "parchment"},
	{id: "blueprint"},
	{id: "terminal"},
	{id: "mothmark"},
];

const PARENT_SURFACES: ParentSurface[] = [
	{
		id: "plain-light",
		theme: "plain",
		surface: "light",
	},
	{
		id: "parchment-light",
		theme: "parchment",
		surface: "light",
	},
	{
		id: "blueprint-light",
		theme: "blueprint",
		surface: "light",
	},
	{
		id: "terminal-light",
		theme: "terminal",
		surface: "light",
	},
	{
		id: "mothmark-light",
		theme: "mothmark",
		surface: "light",
	},
	{
		id: "plain-card",
		theme: "plain",
		surface: "card",
	},
	{
		id: "parchment-card",
		theme: "parchment",
		surface: "card",
	},
	{
		id: "blueprint-card",
		theme: "blueprint",
		surface: "card",
	},
	{
		id: "terminal-card",
		theme: "terminal",
		surface: "card",
	},
	{
		id: "mothmark-card",
		theme: "mothmark",
		surface: "card",
	},
];

const TEXT_SETUPS = {
	basic: {
		id: "basic",
		value: "",
		metadata: {
			title: "Room ID",
			description: "Unique identifier used by rooms, connections, and commands.",
			placeholder: "forest-clearing",
			required: true,
			transform: "id",
		},
	},
	noHeader: {
		id: "no-header",
		value: "hidden-label-field",
		metadata: {
			placeholder: "No title or description",
			transform: "id",
		},
	},
	longDescription: {
		id: "long-description",
		value: "",
		metadata: {
			title: "Scene Entry Key",
			description:
				"A longer helper description used to test wrapping, spacing, and compactness in dense editor surfaces.",
			placeholder: "scene-entry-key",
			transform: "id",
		},
	},
	error: {
		id: "error",
		value: "duplicate-room",
		error: "This value is already used.",
		metadata: {
			title: "Errored Input",
			description: "Used to test validation styling.",
			placeholder: "room-id",
			transform: "id",
		},
	},
	warning: {
		id: "warning",
		value: "old-room-name",
		warnings: ["This value is valid, but it looks like an older naming format."],
		metadata: {
			title: "Warning Input",
			description: "Used to test warning styling.",
			placeholder: "room-id",
			transform: "id",
		},
	},
	disabledByProps: {
		id: "disabled-by-props",
		value: "locked-value",
		disabled: true,
		metadata: {
			title: "Disabled by Props",
			description: "Parent props disable this field.",
			placeholder: "Disabled",
		},
	},
	disabledByMetadata: {
		id: "disabled-by-metadata",
		value: "metadata-locked",
		metadata: {
			title: "Disabled by Metadata",
			description: "Metadata disables this field.",
			placeholder: "Disabled by metadata",
			disabled: true,
		},
	},
	readonlyByProps: {
		id: "readonly-by-props",
		value: "read-only-value",
		readonly: true,
		metadata: {
			title: "Readonly by Props",
			description: "Parent props mark this field readonly.",
			placeholder: "Readonly",
		},
	},
	readonlyByMetadata: {
		id: "readonly-by-metadata",
		value: "metadata-readonly",
		metadata: {
			title: "Readonly by Metadata",
			description: "Metadata marks this field readonly.",
			placeholder: "Readonly by metadata",
			readonly: true,
		},
	},
	slug: {
		id: "slug",
		value: "old-tower-door",
		metadata: {
			title: "Slug Transform",
			description: "Lowercases and converts spaces/symbols into hyphens.",
			placeholder: "Old Tower Door",
			transform: "slug",
		},
	},
	lowercase: {
		id: "lowercase",
		value: "shadow_moth",
		metadata: {
			title: "Lowercase Transform",
			description: "Forces all input to lowercase.",
			placeholder: "shadow_moth",
			transform: "lowercase",
		},
	},
	uppercase: {
		id: "uppercase",
		value: "DEBUG_ROOM",
		metadata: {
			title: "Uppercase Transform",
			description: "Forces all input to uppercase.",
			placeholder: "DEBUG_ROOM",
			transform: "uppercase",
		},
	},
	lengthLimited: {
		id: "length-limited",
		value: "abc",
		metadata: {
			title: "Length Limited",
			description: "Minimum 2 characters, maximum 8 characters.",
			placeholder: "2-8 chars",
			minLength: 2,
			maxLength: 8,
		},
	},
	pattern: {
		id: "pattern",
		value: "room_01",
		metadata: {
			title: "Pattern Input",
			description: "Allows lowercase letters, numbers, underscores, and hyphens.",
			placeholder: "room_01",
			pattern: "^[a-z0-9_-]+$",
		},
	},
	email: {
		id: "email",
		value: "",
		metadata: {
			title: "Email Input",
			description: "Uses email input mode and autocomplete.",
			placeholder: "author@example.com",
			inputMode: "email",
			autoComplete: "email",
		},
	},
	url: {
		id: "url",
		value: "",
		metadata: {
			title: "URL Input",
			description: "Uses URL input mode and autocomplete.",
			placeholder: "https://example.com",
			inputMode: "url",
			autoComplete: "url",
		},
	},
	numeric: {
		id: "numeric",
		value: "12",
		metadata: {
			title: "Numeric Input",
			description: "Uses numeric input mode while still storing a string.",
			placeholder: "12",
			inputMode: "numeric",
		},
	},
	prefix: {
		id: "prefix",
		value: "lantern",
		metadata: {
			title: "Prefix Metadata",
			description: "Tests prefix metadata if the input renders it.",
			placeholder: "item-id",
			prefix: "item/",
			transform: "id",
		},
	},
	suffix: {
		id: "suffix",
		value: "torch",
		metadata: {
			title: "Suffix Metadata",
			description: "Tests suffix metadata if the input renders it.",
			placeholder: "duration",
			suffix: " turns",
		},
	},
} satisfies Record<string, TextSetup>;

const CONTROL_VARIANTS: ControlVariant[] = [
	{
		id: "default-field-md-basic",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "quiet-field-md-basic",
		tone: "quiet",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "terminal-field-md-basic",
		tone: "terminal",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "paper-field-md-basic",
		tone: "paper",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "panel-field-md-basic",
		tone: "panel",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-card-md-basic",
		tone: "default",
		chrome: "card",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-inline-md-basic",
		tone: "default",
		chrome: "inline",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-compact-md-basic",
		tone: "default",
		chrome: "compact",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-bare-md-basic",
		tone: "default",
		chrome: "bare",
		size: "md",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-field-sm-basic",
		tone: "default",
		chrome: "field",
		size: "sm",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-field-lg-basic",
		tone: "default",
		chrome: "field",
		size: "lg",
		setup: TEXT_SETUPS.basic,
	},
	{
		id: "default-field-md-no-header",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.noHeader,
	},
	{
		id: "default-field-md-long-description",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.longDescription,
	},
	{
		id: "default-field-md-error",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.error,
	},
	{
		id: "default-field-md-warning",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.warning,
	},
	{
		id: "default-field-md-disabled-props",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.disabledByProps,
	},
	{
		id: "default-field-md-disabled-metadata",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.disabledByMetadata,
	},
	{
		id: "default-field-md-readonly-props",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.readonlyByProps,
	},
	{
		id: "default-field-md-readonly-metadata",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.readonlyByMetadata,
	},
	{
		id: "default-field-md-slug",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.slug,
	},
	{
		id: "default-field-md-lowercase",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.lowercase,
	},
	{
		id: "default-field-md-uppercase",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.uppercase,
	},
	{
		id: "default-field-md-length-limited",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.lengthLimited,
	},
	{
		id: "default-field-md-pattern",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.pattern,
	},
	{
		id: "default-field-md-email",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.email,
	},
	{
		id: "default-field-md-url",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.url,
	},
	{
		id: "default-field-md-numeric",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.numeric,
	},
	{
		id: "default-field-md-prefix",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.prefix,
	},
	{
		id: "default-field-md-suffix",
		tone: "default",
		chrome: "field",
		size: "md",
		setup: TEXT_SETUPS.suffix,
	},
];

function createInitialExamples() {
	const examples: RenderedExample[] = [];

	for (const controlVariant of CONTROL_VARIANTS) {
		for (const themeVariant of THEME_VARIANTS) {
			for (const parentSurface of PARENT_SURFACES) {
				const setup = controlVariant.setup;

				examples.push({
					id: `${controlVariant.id}-${themeVariant.id}-${parentSurface.id}`,
					value: setup.value,
					path: ["test", controlVariant.id, themeVariant.id, parentSurface.id],
					themeVariant,
					parentSurface,
					controlVariant,
					error: setup.error,
					warnings: setup.warnings,
					disabled: setup.disabled,
					readonly: setup.readonly,
					autoFocus: setup.autoFocus,
					metadata: {
						...setup.metadata,
						type: CONTROL_TYPE,
						tone: controlVariant.tone,
						chrome: controlVariant.chrome,
						size: controlVariant.size,
						testId: `test-${controlVariant.id}-${themeVariant.id}-${parentSurface.id}`,
					},
				});
			}
		}
	}

	return examples;
}

function createVariantJson(controlVariant: ControlVariant, themeVariant: ThemeVariant) {
	const setup = controlVariant.setup;

	return JSON.stringify(
		{
			id: controlVariant.id,
			value: setup.value,
			theme: themeVariant.id,
			props: {
				error: setup.error,
				warnings: setup.warnings,
				disabled: setup.disabled,
				readonly: setup.readonly,
				autoFocus: setup.autoFocus,
			},
			metadata: {
				...setup.metadata,
				type: CONTROL_TYPE,
				tone: controlVariant.tone,
				chrome: controlVariant.chrome,
				size: controlVariant.size,
			},
		},
		null,
		2,
	);
}

export default function TestPage() {
	const [examples, setExamples] = useState<RenderedExample[]>(() => createInitialExamples());

	const rows = useMemo<MatrixRow[]>(() => {
		return CONTROL_VARIANTS.flatMap((controlVariant) =>
			THEME_VARIANTS.map((themeVariant) => ({
				id: `${controlVariant.id}-${themeVariant.id}`,
				variantJson: createVariantJson(controlVariant, themeVariant),
				examples: examples.filter(
					(example) =>
						example.controlVariant.id === controlVariant.id &&
						example.themeVariant.id === themeVariant.id,
				),
			})),
		);
	}, [examples]);

	const baseContext = useMemo<EditorControlContext>(() => {
		return {
			theme: "auto",
			mode: "edit",

			getValue: (path) => {
				const matchingExample = examples.find((example) => arePathsEqual(example.path, path));

				return matchingExample?.value;
			},

			setValue: (path, value) => {
				setExamples((currentExamples) =>
					currentExamples.map((example) => {
						if (!arePathsEqual(example.path, path)) return example;

						return {
							...example,
							value,
						};
					}),
				);
			},
		};
	}, [examples]);

	function updateExampleValue(exampleId: string, nextValue: unknown) {
		setExamples((currentExamples) =>
			currentExamples.map((example) => {
				if (example.id !== exampleId) return example;

				return {
					...example,
					value: nextValue,
				};
			}),
		);
	}

	function renderExample(example: RenderedExample) {
		return (
			<article
				key={example.id}
				className={["test-page__theme-card", `test-page__theme-card--${example.parentSurface.id}`].join(
					" ",
				)}
			>
				{renderEditorControl({
					value: example.value,
					onChange: (nextValue) => updateExampleValue(example.id, nextValue),
					metadata: example.metadata,
					path: example.path,
					error: example.error,
					warnings: example.warnings,
					disabled: example.disabled,
					readonly: example.readonly,
					autoFocus: example.autoFocus,
					context: {
						...baseContext,
						theme: example.themeVariant.id,
					},
				})}
			</article>
		);
	}

	return (
		<main className="test-page">
			<section className="test-page__header">
				<div>
					<p className="test-page__eyebrow">Universal Editor</p>
					<h1 className="test-page__title">Text Field Theme Matrix</h1>
					<p className="test-page__description">
						Each row renders one JSON variant across ten parent surfaces.
					</p>
				</div>

				<div className="test-page__stats">
					<span>{CONTROL_VARIANTS.length} variants</span>
					<span>{THEME_VARIANTS.length} themes</span>
					<span>{PARENT_SURFACES.length} cards per row</span>
				</div>
			</section>

			<section className="test-page__scroll-panel">
				<div className="test-page__rows">
					{rows.map((row) => (
						<section key={row.id} className="test-page__row">
							<header className="test-page__row-header">
								<pre className="test-page__row-description">{row.variantJson}</pre>
							</header>

							<div className="test-page__theme-grid">{row.examples.map(renderExample)}</div>
						</section>
					))}
				</div>
			</section>
		</main>
	);
}

function arePathsEqual(left: EditorPath, right: EditorPath) {
	if (left.length !== right.length) return false;

	return left.every((part, index) => part === right[index]);
}
