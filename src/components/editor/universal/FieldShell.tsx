import type {
	EditorControlChrome,
	EditorControlTone,
	EditorControlSize,
	EditorControlTheme,
} from "@/types/universalEditorTypes";
import "./FieldShell.scss";

export type FieldShellProps = {
	title?: string;
	description?: string;
	error?: string;
	warnings?: string[];

	chrome?: EditorControlChrome;
	tone?: EditorControlTone;
	size?: EditorControlSize;

	children: React.ReactNode;
};

export function FieldShell({
	title,
	description,
	error,
	warnings = [],
	chrome = "field",
	tone = "default",
	size = "md",
	theme = "auto",
	children,
}: FieldShellProps & {theme?: EditorControlTheme}) {
	return (
		<div
			className={[
				"universalField",
				`universalField--theme-${theme}`,
				`universalField--${chrome}`,
				`universalField--${tone}`,
				`universalField--${size}`,
				error ? "universalField--error" : "",
			].join(" ")}
		>
			{title || description ? (
				<div className="universalField__header">
					{title ? <div className="universalField__title">{title}</div> : null}
					{description ? <div className="universalField__description">{description}</div> : null}
				</div>
			) : null}

			<div className="universalField__control">{children}</div>

			{error ? <div className="universalField__error">{error}</div> : null}

			{warnings.length > 0 ? (
				<div className="universalField__warnings">
					{warnings.map((warning) => (
						<div key={warning}>{warning}</div>
					))}
				</div>
			) : null}
		</div>
	);
}
