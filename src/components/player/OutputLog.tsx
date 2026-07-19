"use client";

import {useEffect, useRef} from "react";
import type {GameMessage} from "../../engine/messages/createMessage";
import "./OutputLog.scss";

type OutputLogProps = {
	messages: GameMessage[];
};

function getMessageClassName(type: GameMessage["type"]) {
	if (type === "error") return "output-log__message output-log__message--error";
	if (type === "system") return "output-log__message output-log__message--system";
	return "output-log__message";
}

function getPrefix(type: GameMessage["type"]) {
	if (type === "command") return "> ";
	if (type === "error") return "error: ";
	return "";
}

export function OutputLog({messages}: OutputLogProps) {
	const bottomRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView?.({
			block: "end",
		});
	}, [messages]);

	return (
		<div className="output-log">
			{messages.map((message) => (
				<p key={message.id} className={getMessageClassName(message.type)}>
					{getPrefix(message.type)}
					{message.text}
				</p>
			))}

			<div ref={bottomRef} />
		</div>
	);
}
