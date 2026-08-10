"use client";

import {useEffect, useRef, useState} from "react";

import type {GameMessage} from "@/schemas/states/gameStateSchemas";

import {CommandInput} from "./CommandInput";
import {OutputLog} from "./OutputLog";
import "./GamePlayer.scss";

type PlayerTerminalProps = {
	command: string;
	disabled?: boolean;
	messages: GameMessage[];
	onCommandChange: React.Dispatch<React.SetStateAction<string>>;
	onSubmit: (command: string) => void | Promise<void>;
	commandHistory?: string[];
};

export function PlayerTerminal({
	command,
	disabled = false,
	messages,
	onCommandChange,
	onSubmit,
	commandHistory = [],
}: PlayerTerminalProps) {
	const playerRef = useRef<HTMLElement | null>(null);
	const commandInputRef = useRef<HTMLInputElement | null>(null);
	const restoreFocusAfterSubmitRef = useRef(false);
	const [currentCommandInHistory, setCurrentCommandInHistory] = useState(0);

	useEffect(() => {
		function blurCommandInputOutsidePlayer(event: PointerEvent) {
			const player = playerRef.current;
			if (!player || !(event.target instanceof Node) || player.contains(event.target)) return;
			restoreFocusAfterSubmitRef.current = false;
			const input = commandInputRef.current;
			if (input && document.activeElement === input) input.blur();
		}
		document.addEventListener("pointerdown", blurCommandInputOutsidePlayer, true);
		return () => document.removeEventListener("pointerdown", blurCommandInputOutsidePlayer, true);
	}, []);

	return (
		<section
			ref={playerRef}
			className="game-player"
			onPointerDown={(event) => {
				if (event.target !== event.currentTarget) return;
				event.currentTarget.querySelector<HTMLInputElement>(".command-input__field")?.focus();
			}}
		>
			<div className="game-player__output">
				<OutputLog messages={messages} />
			</div>
			<CommandInput
				inputRef={commandInputRef}
				disabled={disabled}
				command={command}
				setCommand={onCommandChange}
				submitCommand={(event) => {
					event.preventDefault();
					if (!command.trim() || disabled) return;
					setCurrentCommandInHistory(0);
					restoreFocusAfterSubmitRef.current = document.activeElement === commandInputRef.current;
					const restoreSubmittedCommandFocus = () => {
						window.requestAnimationFrame(() => {
							if (restoreFocusAfterSubmitRef.current && !commandInputRef.current?.disabled) {
								commandInputRef.current?.focus({preventScroll: true});
							}
							restoreFocusAfterSubmitRef.current = false;
						});
					};
					void Promise.resolve(onSubmit(command)).then(
						restoreSubmittedCommandFocus,
						restoreSubmittedCommandFocus,
					);
				}}
				commandList={commandHistory}
				currentCommandInHistory={currentCommandInHistory}
				setCurrentCommandInHistory={setCurrentCommandInHistory}
			/>
		</section>
	);
}
