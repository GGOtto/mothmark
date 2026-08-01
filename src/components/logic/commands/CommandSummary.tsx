import type {CSSProperties} from "react";
import type {CommandBlock, CommandPattern} from "@/schemas/world/commandSchemas";
import "./CommandSummary.scss";

export function commandBlockWord(block: CommandBlock): string {
	switch (block.type) {
		case "phrase":
			return block.matches[0] || "phrase";
		case "relation":
			return block.aliasMode === "replace" && block.aliases[0] ? block.aliases[0] : block.relation;
		case "target":
			return block.tags[0] || `<${block.role || "target"}>`;
		case "number":
			return "<number>";
		case "boolean":
			return block.trueMatches[0] || "<boolean>";
		case "direction":
			return block.allowed[0] || "<direction>";
		case "choice":
			return block.choices[0]?.matches[0] || block.choices[0]?.label || "<choice>";
		case "text":
			return "<text>";
	}
}

export function commandPatternText(pattern: CommandPattern | undefined): string {
	if (!pattern?.blocks.length) return "No pattern";
	return pattern.blocks.map(commandBlockWord).join(" ");
}

export function CommandSummary({
	pattern,
	className = "",
	compact = false,
}: {
	pattern: CommandPattern | undefined;
	className?: string;
	compact?: boolean;
}) {
	const text = commandPatternText(pattern);
	return (
		<span
			className={`commandSummary ${compact ? "commandSummary--compact" : ""} ${className}`}
			aria-label={text}
			style={{"--command-summary-gap": compact ? "3px" : "5px"} as CSSProperties}
		>
			{pattern?.blocks.length ? (
				pattern.blocks.map((block, index) => (
					<span className={`commandSummary__token commandColor--${block.type}`} key={index}>
						{commandBlockWord(block)}
					</span>
				))
			) : (
				<span className="commandSummary__empty">No pattern</span>
			)}
		</span>
	);
}
