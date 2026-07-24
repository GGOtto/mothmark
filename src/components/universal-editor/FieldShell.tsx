import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import {createPortal} from "react-dom";
import type {ResolvedEditorControlAppearance} from "@/types/universalEditorTypes";
import type {EditorControlContext, EditorPath} from "@/types/universalEditorTypes";
import type {EditorDisclosure} from "@/types/editor/editorMetadataTypes";
import "./FieldShell.scss";
import {Info} from "lucide-react";

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
	hideInfoInBox?: boolean;
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

type FieldShellDisclosureValue = {
	metadata: {disclosure?: EditorDisclosure};
	path: EditorPath;
	context: EditorControlContext;
};

type TooltipPosition = {
	left: number;
	bottom: number;
	shiftX: number;
};

const FieldShellDisclosureContext = createContext<FieldShellDisclosureValue | undefined>(undefined);

export function FieldShellDisclosureProvider({
	value,
	children,
}: {
	value: FieldShellDisclosureValue;
	children: ReactNode;
}) {
	return (
		<FieldShellDisclosureContext.Provider value={value}>
			{children}
		</FieldShellDisclosureContext.Provider>
	);
}

export function FieldShell({
	title,
	description,
	hideInfoInBox = true,
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
	const disclosureValue = useContext(FieldShellDisclosureContext);
	const descriptionId = useId();
	const infoIconRef = useRef<HTMLSpanElement>(null);
	const infoBoxRef = useRef<HTMLSpanElement>(null);
	const [isInfoBoxVisible, setIsInfoBoxVisible] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
	const updateTooltipPosition = useCallback(() => {
		const icon = infoIconRef.current;
		if (!icon) {
			return;
		}

		const iconBounds = icon.getBoundingClientRect();
		setTooltipPosition({
			left: iconBounds.left + iconBounds.width / 2,
			bottom: window.innerHeight - iconBounds.top + 10,
			shiftX: 0,
		});
	}, []);
	const showInfoBox = useCallback(() => {
		updateTooltipPosition();
		setIsInfoBoxVisible(true);
	}, [updateTooltipPosition]);

	useEffect(() => {
		if (!isInfoBoxVisible) {
			return;
		}

		window.addEventListener("resize", updateTooltipPosition);
		window.addEventListener("scroll", updateTooltipPosition, true);
		return () => {
			window.removeEventListener("resize", updateTooltipPosition);
			window.removeEventListener("scroll", updateTooltipPosition, true);
		};
	}, [isInfoBoxVisible, updateTooltipPosition]);

	useLayoutEffect(() => {
		const infoBox = infoBoxRef.current;
		if (!isInfoBoxVisible || !infoBox || !tooltipPosition) {
			return;
		}

		const viewportMargin = 16;
		const infoBoxBounds = infoBox.getBoundingClientRect();
		let correction = 0;
		if (infoBoxBounds.left < viewportMargin) {
			correction = viewportMargin - infoBoxBounds.left;
		} else if (infoBoxBounds.right > window.innerWidth - viewportMargin) {
			correction = window.innerWidth - viewportMargin - infoBoxBounds.right;
		}

		if (Math.abs(correction) > 0.5) {
			setTooltipPosition((currentPosition) =>
				currentPosition
					? {...currentPosition, shiftX: currentPosition.shiftX + correction}
					: currentPosition,
			);
		}
	}, [isInfoBoxVisible, tooltipPosition]);

	const isCollapsible =
		appearance.chrome === "collapse" && disclosureValue?.metadata.disclosure?.collapsible !== false;
	const savedOpenState = disclosureValue?.context.editorChrome?.getSectionDisclosure?.(
		disclosureValue.path,
		"__control__",
	);
	const isOpen = savedOpenState ?? !appearance.defaultCollapsed;
	const classes = [
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
		.join(" ");
	const header =
		title || description || slots?.headerAction ? (
			<div className="universalField__header">
				{title || required || readonly || (description && hideInfoInBox) ? (
					<div className="universalField__titleRow">
						{title ? <div className="universalField__title">{title}</div> : null}
						{required ? <span className="universalField__required">Required</span> : null}
						{readonly ? <span className="universalField__status">Readonly</span> : null}
						{description && hideInfoInBox && (
							<span
								ref={infoIconRef}
								className="universalField__infoIcon"
								tabIndex={0}
								aria-describedby={descriptionId}
								onMouseEnter={showInfoBox}
								onMouseLeave={() => setIsInfoBoxVisible(false)}
								onFocus={showInfoBox}
								onBlur={() => setIsInfoBoxVisible(false)}
							>
								<Info size={16} aria-hidden="true" strokeWidth={2.5} />
								{isInfoBoxVisible &&
									tooltipPosition &&
									typeof document !== "undefined" &&
									createPortal(
										<span
											ref={infoBoxRef}
											className="universalField__infobox"
											id={descriptionId}
											role="tooltip"
											style={
												{
													left: tooltipPosition.left,
													bottom: tooltipPosition.bottom,
													"--tooltip-shift-x": `${tooltipPosition.shiftX}px`,
												} as CSSProperties
											}
										>
											{description}
										</span>,
										document.body,
									)}
							</span>
						)}
					</div>
				) : null}
				{slots?.headerAction ? (
					<div className="universalField__headerAction" onClick={(event) => event.stopPropagation()}>
						{slots.headerAction}
					</div>
				) : null}
				{!hideInfoInBox && description ? (
					<div className="universalField__description">{description}</div>
				) : null}
			</div>
		) : null;
	const body = (
		<>
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
		</>
	);

	if (isCollapsible && disclosureValue) {
		return (
			<details
				className={classes}
				data-testid={testId}
				open={isOpen}
				onToggle={(event) =>
					disclosureValue.context.editorChrome?.setSectionDisclosure?.(
						disclosureValue.path,
						"__control__",
						event.currentTarget.open,
					)
				}
			>
				<summary className="universalField__cardHeader">{header}</summary>
				<div className="universalField__cardBody">{body}</div>
			</details>
		);
	}
	return (
		<div className={classes} data-testid={testId}>
			{header}
			{body}
		</div>
	);
}
