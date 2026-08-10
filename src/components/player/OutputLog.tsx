"use client";

import {useEffect, useRef} from "react";
import type {GameMessage} from "../../schemas/states/gameStateSchemas";
import "./OutputLog.scss";

type OutputLogProps = {
	messages: GameMessage[];
};

function getMessageClassName(type: GameMessage["type"]) {
	if (type === "error") return "output-log__message output-log__message--error";
	if (type === "system") return "output-log__message output-log__message--system";
	if (type === "death") return "output-log__message output-log__message--death";
	return "output-log__message";
}

function getPrefix(type: GameMessage["type"]) {
	if (type === "command") return "> ";
	if (type === "error") return "";
	return "";
}

export function OutputLog({messages}: OutputLogProps) {
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const shouldFollowRef = useRef(true);

	useEffect(() => {
		if (shouldFollowRef.current) bottomRef.current?.scrollIntoView?.({block: "end"});
	}, [messages]);

	useEffect(() => {
		const scroller = bottomRef.current?.closest<HTMLElement>(".game-player__output");
		if (!scroller) return;
		const updateFollow = () => {
			shouldFollowRef.current =
				scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
		};
		updateFollow();
		scroller.addEventListener("scroll", updateFollow, {passive: true});
		return () => scroller.removeEventListener("scroll", updateFollow);
	}, []);

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
