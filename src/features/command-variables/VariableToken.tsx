"use client";

import {AlertTriangle} from "lucide-react";
import type {CommandVariableOption, CommandVariableReference} from "./model";

export function VariableToken({
	reference,
	option,
	compact = false,
}: {
	reference: CommandVariableReference;
	option?: CommandVariableOption;
	compact?: boolean;
}) {
	const invalid = !option;
	return (
		<span
			className={[
				"variableToken",
				compact ? "variableToken--compact" : "",
				invalid ? "variableToken--invalid" : `commandVariableColor--${option.blockType}`,
			]
				.filter(Boolean)
				.join(" ")}
			data-variable-token
			contentEditable={false}
			title={invalid ? `Missing command block ${reference.blockId.id}` : undefined}
		>
			<span className="variableToken__marker" aria-hidden="true">
				{invalid ? <AlertTriangle size={10} /> : null}
			</span>
			<span className="variableToken__label">{option?.label ?? "Unavailable variable"}</span>
			{option?.detail ? <span className="variableToken__detail">· {option.detail}</span> : null}
		</span>
	);
}
