import type {ResolvedEditorControlAppearance} from "@/types/universalEditorTypes";
import "./FieldShell.scss";

export type FieldShellProps = {
	title?: string;
	description?: string;
	error?: string;
	warnings?: string[];

	appearance: ResolvedEditorControlAppearance;

	className?: string;
	testId?: string;

	children: React.ReactNode;
};

export function FieldShell({
	title,
	description,
	error,
	warnings = [],
	appearance,
	className,
	testId,
	children,
}: FieldShellProps) {
	return (
		<div
			className={[
				"universalField",
				`universalField--theme-${appearance.theme}`,
				`universalField--scheme-${appearance.scheme}`,
				`universalField--tone-${appearance.tone}`,
				`universalField--chrome-${appearance.chrome}`,
				`universalField--size-${appearance.size}`,
				error ? "universalField--error" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
			data-testid={testId}
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
