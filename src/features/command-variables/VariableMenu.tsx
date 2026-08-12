"use client";

import {Braces, ChevronDown} from "lucide-react";
import {useRef, useState} from "react";
import {AnchoredLayer} from "@/components/overlay/Overlay";
import type {CommandVariableOption} from "./model";

const PREFERRED_WIDTH = 250;

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
	const triggerRef = useRef<HTMLButtonElement>(null);

	return (
		<div className="variableMenu">
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
			{open ? (
				<AnchoredLayer
					anchorRef={triggerRef}
					ariaLabel={label}
					className="variableMenu__popover"
					mobilePresentation="sheet"
					onClose={() => setOpen(false)}
					preferredWidth={PREFERRED_WIDTH}
					role="menu"
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
				</AnchoredLayer>
			) : null}
		</div>
	);
}
