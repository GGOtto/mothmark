import type {ReactNode} from "react";
import type {ResolvedEditorControlAppearance} from "@/types/universalEditorTypes";
import "./FieldShell.scss";

export type FieldShellSlots = {
	headerAction?: ReactNode;
	summary?: ReactNode;
	footer?: ReactNode;
	validation?: ReactNode;
	toolbar?: ReactNode;
};

export type FieldShellProps = {
	title?: string;
	description?: string;
	error?: string;
	warnings?: string[];
	required?: boolean;
	disabled?: boolean;
	readonly?: boolean;
	slots?: FieldShellSlots;

	appearance: ResolvedEditorControlAppearance;

	className?: string;
	testId?: string;

	children: ReactNode;
};

export function FieldShell({
	title,
	description,
	error,
	warnings = [],
	required,
	disabled,
	readonly,
	slots,
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
				disabled ? "universalField--disabled" : "",
				readonly ? "universalField--readonly" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
			data-testid={testId}
		>
			{title || description || slots?.headerAction ? (
				<div className="universalField__header">
					{title || required || readonly ? (
						<div className="universalField__titleRow">
							{title ? <div className="universalField__title">{title}</div> : null}
							{required ? <span className="universalField__required">Required</span> : null}
							{readonly ? <span className="universalField__status">Readonly</span> : null}
						</div>
					) : null}
					{slots?.headerAction ? (
						<div className="universalField__headerAction">{slots.headerAction}</div>
					) : null}

					{description ? <div className="universalField__description">{description}</div> : null}
				</div>
			) : null}

			{slots?.summary ? <div className="universalField__summarySlot">{slots.summary}</div> : null}
			{slots?.toolbar ? <div className="universalField__toolbar">{slots.toolbar}</div> : null}

			<div className="universalField__control">{children}</div>

			{error ? <div className="universalField__error">{error}</div> : null}

			{warnings.length > 0 ? (
				<div className="universalField__warnings">
					{warnings.map((warning) => (
						<div key={warning}>{warning}</div>
					))}
				</div>
			) : null}
			{slots?.validation ? <div className="universalField__validation">{slots.validation}</div> : null}
			{slots?.footer ? <div className="universalField__footer">{slots.footer}</div> : null}
		</div>
	);
}
