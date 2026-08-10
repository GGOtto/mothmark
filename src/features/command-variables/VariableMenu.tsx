"use client";

import {Braces, ChevronDown} from "lucide-react";
import {type CSSProperties, useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import type {CommandVariableOption} from "./model";

const VIEWPORT_PADDING = 12;
const TRIGGER_GAP = 6;
const PREFERRED_WIDTH = 250;
const PREFERRED_HEIGHT = 280;

function useMenuPosition(open: boolean, triggerRef: React.RefObject<HTMLButtonElement | null>) {
	const [position, setPosition] = useState<CSSProperties>({});

	useLayoutEffect(() => {
		if (!open) return;
		function updatePosition() {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const width = Math.min(PREFERRED_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
			const left = Math.min(
				Math.max(VIEWPORT_PADDING, rect.left),
				window.innerWidth - width - VIEWPORT_PADDING,
			);
			const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING - TRIGGER_GAP;
			const spaceAbove = rect.top - VIEWPORT_PADDING - TRIGGER_GAP;
			const placeBelow = spaceBelow >= Math.min(160, PREFERRED_HEIGHT) || spaceBelow >= spaceAbove;
			const availableHeight = Math.max(0, placeBelow ? spaceBelow : spaceAbove);

			setPosition({
				position: "fixed",
				width,
				left,
				maxHeight: Math.min(PREFERRED_HEIGHT, availableHeight),
				top: placeBelow ? rect.bottom + TRIGGER_GAP : undefined,
				bottom: placeBelow ? undefined : window.innerHeight - rect.top + TRIGGER_GAP,
			});
		}

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open, triggerRef]);

	return position;
}

export function VariableMenu({
	options,
	label = "Insert command value",
	onSelect,
	disabled,
	disabledReason,
}: {
	options: CommandVariableOption[];
	label?: string;
	onSelect: (option: CommandVariableOption) => void;
	disabled?: boolean;
	disabledReason?: string;
}) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const position = useMenuPosition(open, triggerRef);

	useEffect(() => {
		if (!open) return;
		function close(event: PointerEvent) {
			const target = event.target as Node;
			if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
			setOpen(false);
		}
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			setOpen(false);
			triggerRef.current?.focus();
		}
		document.addEventListener("pointerdown", close);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", close);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	return (
		<div className="variableMenu" ref={rootRef}>
			<button
				ref={triggerRef}
				type="button"
				className="variableMenu__trigger"
				aria-label={label}
				aria-expanded={open}
				title={options.length === 0 && disabledReason ? disabledReason : label}
				disabled={disabled || options.length === 0}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => setOpen((current) => !current)}
			>
				<Braces size={14} aria-hidden="true" />
				<span className="variableMenu__label">{label}</span>
				<ChevronDown className="variableMenu__chevron" size={12} aria-hidden="true" />
			</button>
			{open && typeof document !== "undefined"
				? createPortal(
						<div
							ref={popoverRef}
							className="variableMenu__popover"
							role="menu"
							aria-label={label}
							style={position}
						>
							<div className="variableMenu__heading">Available values</div>
							{options.map((candidate) => (
								<button
									type="button"
									role="menuitem"
									className={`variableMenu__option commandVariableColor--${candidate.blockType}`}
									key={`${candidate.blockId.id}:${candidate.projection ?? "value"}`}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => {
										onSelect(candidate);
										setOpen(false);
									}}
								>
									<span className="variableMenu__marker" aria-hidden="true" />
									<span>
										<strong>{candidate.label}</strong>
										{candidate.detail ? <small>{candidate.detail}</small> : null}
									</span>
								</button>
							))}
						</div>,
						document.body,
					)
				: null}
		</div>
	);
}
