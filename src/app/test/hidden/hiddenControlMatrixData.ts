import type {HiddenControlMetadata} from "../../../components/editor/universal/HiddenEditor";
import type {
	EditorControlAppearance,
	EditorControlTheme,
} from "../../../types/universalEditorTypes";
import type {ControlMatrixVariant} from "../ControlMatrix";

const THEME_TEST_THEMES: EditorControlTheme[] = [
	"auto",
	"plain",
	"parchment",
	"blueprint",
	"terminal",
	"mothmark",
];

function makeVariant(
	id: string,
	description: string,
	appearance: Pick<EditorControlAppearance, "tone" | "chrome" | "size">,
	themes?: EditorControlTheme[],
): ControlMatrixVariant<unknown, HiddenControlMetadata> {
	return {
		id,
		description,
		value: "internal-generated-id",
		appearance,
		themes,
		metadata: {
			type: "hidden",
			features: {reason: "Edited elsewhere"},
		},
	};
}

export const hiddenControlMatrixVariants = [
	makeVariant(
		"theme-default-field-md-basic",
		"Theme test confirms hidden still renders nothing.",
		{tone: "default", chrome: "field", size: "md"},
		THEME_TEST_THEMES,
	),
	makeVariant("default-field-md-basic", "Baseline hidden control.", {
		tone: "default",
		chrome: "field",
		size: "md",
	}),
	makeVariant("default-card-md-basic", "Card chrome hidden control.", {
		tone: "default",
		chrome: "card",
		size: "md",
	}),
];
