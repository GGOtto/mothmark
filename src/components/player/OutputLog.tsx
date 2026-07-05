import type {GameMessage} from "../../engine/gameState";

type OutputLogProps = {
	messages: GameMessage[];
};

function getMessageClassName(type: GameMessage["type"]) {
	if (type === "command") return "text-neutral-400";
	if (type === "error") return "text-red-300";
	if (type === "system") return "text-neutral-300";
	return "text-neutral-100";
}

export function OutputLog({messages}: OutputLogProps) {
	return (
		<div className="flex flex-col gap-4">
			{messages.map((message) => (
				<p
					key={message.id}
					className={`whitespace-pre-wrap leading-7 ${getMessageClassName(message.type)}`}
				>
					{message.text}
				</p>
			))}
		</div>
	);
}
