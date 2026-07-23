"use client";

import {useMemo, useState} from "react";
import {renderEditorControl} from "../../components/universal-editor/renderEditorControl";
import type {
	EntityPickerOption,
	EntityRegistry,
	EntityType,
	FlagOption,
	FlagRegistry,
} from "../../types/editor/editorRegistryTypes";
import type {
	EditorControlAppearance,
	EditorControlContext,
	EditorControlMetadata,
	EditorSelectOption,
	EditorControlScheme,
	EditorControlTheme,
	EditorControlType,
	EditorPath,
} from "../../types/universalEditorTypes";
import "./ControlMatrix.scss";

export type ControlMatrixThemeVariant = {
	id: EditorControlTheme;
};

export type ControlMatrixParentSurface = {
	id: string;
	theme: Exclude<EditorControlTheme, "auto">;
	scheme: Exclude<EditorControlScheme, "auto">;
	surface: "flat" | "card";
};

export type ControlMatrixVariant<TValue, TMetadata extends EditorControlMetadata> = {
	id: string;
	description: string;
	value: TValue;
	metadata: TMetadata;
	appearance?: EditorControlAppearance;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;

	/**
	 * Most variants should use only ["auto"] so they inherit from the cards.
	 * Use all themes only for variants directly testing theme behavior.
	 */
	themes?: EditorControlTheme[];
};

type RenderedExample<TValue, TMetadata extends EditorControlMetadata> = {
	id: string;
	value: TValue;
	path: EditorPath;
	themeVariant: ControlMatrixThemeVariant;
	parentSurface: ControlMatrixParentSurface;
	variant: ControlMatrixVariant<TValue, TMetadata>;
	metadata: TMetadata;
	error?: string;
	warnings?: string[];
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;
};

type MatrixRow<TValue, TMetadata extends EditorControlMetadata> = {
	id: string;
	description: string;
	variantJson: string;
	examples: Array<RenderedExample<TValue, TMetadata>>;
};

export type ControlMatrixProps<TValue, TMetadata extends EditorControlMetadata> = {
	title: string;
	description: string;
	controlType: EditorControlType;
	variants: Array<ControlMatrixVariant<TValue, TMetadata>>;
	parentSurfaces?: ControlMatrixParentSurface[];
	themeVariants?: ControlMatrixThemeVariant[];
	defaultThemes?: EditorControlTheme[];
	themeTestThemes?: EditorControlTheme[];
};

const DEFAULT_THEME_VARIANTS: ControlMatrixThemeVariant[] = [
	{id: "auto"},
	{id: "plain"},
	{id: "parchment"},
	{id: "blueprint"},
	{id: "terminal"},
	{id: "mothmark"},
];

const DEFAULT_PARENT_SURFACES: ControlMatrixParentSurface[] = [
	{
		id: "plain-light-flat",
		theme: "plain",
		scheme: "light",
		surface: "flat",
	},
	{
		id: "parchment-light-flat",
		theme: "parchment",
		scheme: "light",
		surface: "flat",
	},
	{
		id: "blueprint-light-flat",
		theme: "blueprint",
		scheme: "light",
		surface: "flat",
	},
	{
		id: "terminal-light-flat",
		theme: "terminal",
		scheme: "light",
		surface: "flat",
	},
	{
		id: "mothmark-light-flat",
		theme: "mothmark",
		scheme: "light",
		surface: "flat",
	},
	{
		id: "plain-dark-card",
		theme: "plain",
		scheme: "dark",
		surface: "card",
	},
	{
		id: "parchment-dark-card",
		theme: "parchment",
		scheme: "dark",
		surface: "card",
	},
	{
		id: "blueprint-dark-card",
		theme: "blueprint",
		scheme: "dark",
		surface: "card",
	},
	{
		id: "terminal-dark-card",
		theme: "terminal",
		scheme: "dark",
		surface: "card",
	},
	{
		id: "mothmark-dark-card",
		theme: "mothmark",
		scheme: "dark",
		surface: "card",
	},
];

const DEFAULT_VARIANT_THEMES: EditorControlTheme[] = ["auto"];

const DEFAULT_THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

const SAMPLE_ENTITIES: EntityPickerOption[] = [
	{
		id: "foyer",
		label: "Foyer",
		description: "The first room in the sample world.",
		entityType: "room",
	},
	{
		id: "library",
		label: "Library",
		description: "A quiet room full of indexed shelves.",
		entityType: "room",
	},
	{
		id: "brass-key",
		label: "Brass Key",
		description: "A small key with a worn bow.",
		entityType: "item",
	},
	{
		id: "archivist",
		label: "Archivist",
		description: "A character who knows where the maps are filed.",
		entityType: "character",
	},
	{
		id: "glass-case",
		label: "Glass Case",
		description: "A feature that can be inspected and unlocked.",
		entityType: "feature",
	},
];

const SAMPLE_FLAGS: FlagOption[] = [
	{
		id: "foyer.doorUnlocked",
		label: "Door unlocked",
		description: "Whether the foyer door has been unlocked.",
		source: "manual",
	},
	{
		id: "library.lampLit",
		label: "Lamp lit",
		description: "Whether the library lamp is lit.",
		source: "effect",
	},
	{
		id: "archive.hasReadLedger",
		label: "Ledger read",
		description: "Whether the player has read the archive ledger.",
		source: "condition",
	},
];

const SAMPLE_ENTITY_REGISTRY: EntityRegistry = {
	getEntities: (entityType: EntityType) =>
		SAMPLE_ENTITIES.filter((entity) => entity.entityType === entityType),
	getEntityById: (entityType: EntityType, id: string) =>
		SAMPLE_ENTITIES.find((entity) => entity.entityType === entityType && entity.id === id),
	isValidEntityId: (entityType: EntityType, id: string) =>
		SAMPLE_ENTITIES.some((entity) => entity.entityType === entityType && entity.id === id),
};

const SAMPLE_FLAG_REGISTRY: FlagRegistry = {
	getFlags: () => SAMPLE_FLAGS,
	getFlagById: (id: string) => SAMPLE_FLAGS.find((flag) => flag.id === id),
	isKnownFlag: (id: string) => SAMPLE_FLAGS.some((flag) => flag.id === id),
	createFlag: (id: string) => ({
		id,
		label: id,
		source: "manual",
	}),
};

const SAMPLE_OPTION_LISTS: Record<string, EditorSelectOption[]> = {
	"schema.condition.types": [
		{label: "Flag", value: "flag", description: "Checks a boolean world, room, or feature flag."},
		{label: "Counter", value: "counter", description: "Checks a numeric counter."},
		{label: "Current room", value: "current-room", description: "Checks the player's room."},
		{label: "Inventory", value: "inventory", description: "Checks inventory state."},
		{label: "Item location", value: "item-location", description: "Checks where an item exists."},
		{label: "NPC", value: "npc", description: "Checks NPC state."},
		{label: "Command history", value: "command-history", description: "Checks recent commands."},
		{label: "Quest", value: "quest", description: "Checks quest state."},
		{label: "Group", value: "group", description: "Nests multiple conditions."},
	],
	"schema.condition.groupOperators": [
		{label: "All conditions pass", value: "all"},
		{label: "Any condition passes", value: "any"},
		{label: "No conditions pass", value: "none"},
	],
	"schema.condition.comparisonOperators": [
		{label: "Equals", value: "eq"},
		{label: "Does not equal", value: "neq"},
		{label: "Greater than", value: "gt"},
		{label: "Greater than or equal to", value: "gte"},
		{label: "Less than", value: "lt"},
		{label: "Less than or equal to", value: "lte"},
	],
	"schema.condition.flagOperations": [
		{label: "Equals", value: "equals"},
		{label: "Exists", value: "exists"},
		{label: "Missing", value: "missing"},
	],
	"schema.condition.counterOperations": [
		{label: "Compare", value: "compare"},
		{label: "Between", value: "between"},
		{label: "Exists", value: "exists"},
		{label: "Missing", value: "missing"},
	],
	"schema.condition.currentRoomOperations": [
		{label: "Is", value: "is"},
		{label: "Is not", value: "is-not"},
		{label: "Has tag", value: "has-tag"},
		{label: "Missing tag", value: "missing-tag"},
	],
	"schema.effect.types": [
		{label: "Message", value: "message"},
		{label: "Flag", value: "flag"},
		{label: "Counter", value: "counter"},
		{label: "Inventory", value: "inventory"},
		{label: "Item location", value: "item-location"},
		{label: "Feature", value: "feature"},
		{label: "Room", value: "room"},
		{label: "NPC", value: "npc"},
		{label: "Event", value: "event"},
		{label: "Flow", value: "flow"},
		{label: "Group", value: "group"},
		{label: "Conditional", value: "conditional"},
	],
	"schema.effect.flagOperations": [
		{label: "Create", value: "create"},
		{label: "Set", value: "set"},
		{label: "Toggle", value: "toggle"},
		{label: "Delete", value: "delete"},
	],
	"schema.effect.counterOperations": [
		{label: "Set", value: "set"},
		{label: "Increase", value: "increase"},
		{label: "Decrease", value: "decrease"},
		{label: "Reset", value: "reset"},
		{label: "Clamp", value: "clamp"},
	],
	"schema.world.directions": [
		{label: "North", value: "n", description: "Compass north."},
		{label: "East", value: "e", description: "Compass east."},
		{label: "South", value: "s", description: "Compass south."},
		{label: "West", value: "w", description: "Compass west."},
		{label: "Up", value: "up", description: "Vertical movement upward."},
		{label: "Down", value: "down", description: "Vertical movement downward."},
		{label: "In", value: "in", description: "Contextual inward movement."},
		{label: "Out", value: "out", description: "Contextual outward movement."},
	],
	"schema.world.pathways": [
		{label: "No way", value: "no-way"},
		{label: "Two way", value: "two-way"},
		{label: "Forwards", value: "forwards"},
		{label: "Backwards", value: "backwards"},
	],
};

export function ControlMatrix<TValue, TMetadata extends EditorControlMetadata>({
	title,
	description,
	controlType,
	variants,
	parentSurfaces = DEFAULT_PARENT_SURFACES,
	themeVariants = DEFAULT_THEME_VARIANTS,
	defaultThemes = DEFAULT_VARIANT_THEMES,
	themeTestThemes = DEFAULT_THEME_TEST_THEMES,
}: ControlMatrixProps<TValue, TMetadata>) {
	const [examples, setExamples] = useState<Array<RenderedExample<TValue, TMetadata>>>(() =>
		createInitialExamples({
			controlType,
			variants,
			parentSurfaces,
			defaultThemes,
		}),
	);

	const rows = useMemo<Array<MatrixRow<TValue, TMetadata>>>(() => {
		return variants.flatMap((variant) => {
			const themes = variant.themes ?? defaultThemes;

			return themes.map((theme) => ({
				id: `${variant.id}-${theme}`,
				description: variant.description,
				variantJson: createVariantJson({
					controlType,
					variant,
					theme,
				}),
				examples: examples.filter(
					(example) => example.variant.id === variant.id && example.themeVariant.id === theme,
				),
			}));
		});
	}, [controlType, defaultThemes, examples, variants]);

	const baseContext = useMemo<Omit<EditorControlContext, "appearance">>(() => {
		return {
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
							value: value as TValue,
						};
					}),
				);
			},

			getOptionList: (source) => SAMPLE_OPTION_LISTS[source],

			registerEntityPicker: SAMPLE_ENTITY_REGISTRY,
			registerFlagPicker: SAMPLE_FLAG_REGISTRY,
		};
	}, [examples]);

	function updateExampleValue(exampleId: string, nextValue: unknown) {
		setExamples((currentExamples) =>
			currentExamples.map((example) => {
				if (example.id !== exampleId) return example;

				return {
					...example,
					value: nextValue as TValue,
				};
			}),
		);
	}

	function renderExample(example: RenderedExample<TValue, TMetadata>) {
		return (
			<article
				key={example.id}
				className={[
					"control-matrix__theme-card",
					`control-matrix__theme-card--${example.parentSurface.id}`,
				].join(" ")}
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
						appearance: {
							theme: example.themeVariant.id,
							scheme: example.parentSurface.scheme,
						},
					},
				})}
			</article>
		);
	}

	return (
		<main className="control-matrix">
			<section className="control-matrix__header">
				<div>
					<p className="control-matrix__eyebrow">Universal Editor</p>
					<h1 className="control-matrix__title">{title}</h1>
					<p className="control-matrix__description">{description}</p>
				</div>

				<div className="control-matrix__stats">
					<span>{variants.length} variants</span>
					<span>{themeVariants.length} themes</span>
					<span>{parentSurfaces.length} cards per row</span>
					<span>{themeTestThemes.length} theme-test themes</span>
				</div>
			</section>

			<section className="control-matrix__scroll-panel">
				<div className="control-matrix__rows">
					{rows.map((row) => (
						<section key={row.id} className="control-matrix__row">
							<header className="control-matrix__row-header">
								<p className="control-matrix__row-description">{row.description}</p>

								<pre className="control-matrix__row-json">{row.variantJson}</pre>
							</header>

							<div className="control-matrix__theme-grid">{row.examples.map(renderExample)}</div>
						</section>
					))}
				</div>
			</section>
		</main>
	);
}

function createInitialExamples<TValue, TMetadata extends EditorControlMetadata>({
	controlType,
	variants,
	parentSurfaces,
	defaultThemes,
}: {
	controlType: EditorControlType;
	variants: Array<ControlMatrixVariant<TValue, TMetadata>>;
	parentSurfaces: ControlMatrixParentSurface[];
	defaultThemes: EditorControlTheme[];
}) {
	const examples: Array<RenderedExample<TValue, TMetadata>> = [];

	for (const variant of variants) {
		const themes = variant.themes ?? defaultThemes;

		for (const theme of themes) {
			for (const parentSurface of parentSurfaces) {
				examples.push({
					id: `${variant.id}-${theme}-${parentSurface.id}`,
					value: variant.value,
					path: ["test", controlType, variant.id, theme, parentSurface.id],
					themeVariant: {id: theme},
					parentSurface,
					variant,
					error: variant.error,
					warnings: variant.warnings,
					disabled: variant.disabled,
					readonly: variant.readonly,
					autoFocus: variant.autoFocus,
					metadata: {
						...variant.metadata,
						type: controlType,
						appearance: {
							...variant.metadata.appearance,
							...variant.appearance,
						},
						testId: `test-${controlType}-${variant.id}-${theme}-${parentSurface.id}`,
					},
				} as RenderedExample<TValue, TMetadata>);
			}
		}
	}

	return examples;
}

function createVariantJson<TValue, TMetadata extends EditorControlMetadata>({
	controlType,
	variant,
	theme,
}: {
	controlType: EditorControlType;
	variant: ControlMatrixVariant<TValue, TMetadata>;
	theme: EditorControlTheme;
}) {
	return JSON.stringify(
		{
			id: variant.id,
			value: variant.value,
			context: {
				appearance: {
					theme,
					scheme: "from parent surface",
				},
				mode: "edit",
			},
			props: {
				error: variant.error,
				warnings: variant.warnings,
				disabled: variant.disabled,
				readonly: variant.readonly,
				autoFocus: variant.autoFocus,
			},
			metadata: {
				...variant.metadata,
				type: controlType,
				appearance: {
					...variant.metadata.appearance,
					...variant.appearance,
				},
			},
		},
		null,
		2,
	);
}

function arePathsEqual(left: EditorPath, right: EditorPath) {
	if (left.length !== right.length) return false;

	return left.every((part, index) => part === right[index]);
}
