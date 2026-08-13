import {ChevronDown, ChevronUp, SendHorizontal} from "lucide-react";

import "./CommandInput.scss";

type CommandInputProps = {
	command: string;
	busy?: boolean;
	disabled?: boolean;
	inputRef?: React.Ref<HTMLInputElement>;
	commandList: string[];
	currentCommandInHistory: number;
	setCurrentCommandInHistory: (currentCommand: number) => void;
	setCommand: React.Dispatch<React.SetStateAction<string>>;
	submitCommand: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CommandInput({
	command,
	busy = false,
	disabled = false,
	inputRef,
	commandList,
	currentCommandInHistory,
	setCurrentCommandInHistory,
	setCommand,
	submitCommand,
}: CommandInputProps) {
	function loadLastCommand() {
		if (currentCommandInHistory >= commandList.length) {
			return;
		}
		setCommand(commandList[commandList.length - currentCommandInHistory - 1]);
		setCurrentCommandInHistory(currentCommandInHistory + 1);
	}

	function loadNextCommand() {
		if (currentCommandInHistory === 0) {
			return;
		}
		if (currentCommandInHistory === 1) {
			setCurrentCommandInHistory(0);
			setCommand("");
			return;
		}
		setCommand(commandList[commandList.length - currentCommandInHistory + 1]);
		setCurrentCommandInHistory(currentCommandInHistory - 1);
	}

	return (
		<form
			onSubmit={submitCommand}
			className="command-input"
			aria-busy={busy}
			onPointerDown={(event) => {
				if (event.target instanceof HTMLInputElement) return;
				event.currentTarget.querySelector<HTMLInputElement>(".command-input__field")?.focus();
			}}
		>
			<span className="command-input__prompt">&gt;&gt;</span>

			<input
				ref={inputRef}
				disabled={disabled}
				readOnly={busy}
				aria-label="Game command"
				aria-disabled={disabled}
				value={command}
				onChange={(event) => {
					setCurrentCommandInHistory(0);
					setCommand(event.target.value);
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowUp") {
						event.preventDefault();
						loadLastCommand();
					}

					if (event.key === "ArrowDown") {
						event.preventDefault();
						loadNextCommand();
					}
				}}
				className="command-input__field"
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				enterKeyHint="send"
				spellCheck={false}
			/>
			<button
				type="submit"
				className="command-input__submit"
				disabled={disabled || busy || !command.trim()}
				aria-label="Send command"
			>
				<SendHorizontal size={16} aria-hidden="true" />
				<span>Send</span>
			</button>
			<div className="command-input__history" aria-label="Command history">
				<button
					type="button"
					onClick={() => {
						loadLastCommand();
						if (!disabled) {
							(inputRef as React.RefObject<HTMLInputElement | null> | undefined)?.current?.focus({
								preventScroll: true,
							});
						}
					}}
					disabled={disabled || busy || currentCommandInHistory >= commandList.length}
					aria-label="Previous command"
				>
					<ChevronUp size={17} aria-hidden="true" />
				</button>
				<button
					type="button"
					onClick={() => {
						loadNextCommand();
						if (!disabled) {
							(inputRef as React.RefObject<HTMLInputElement | null> | undefined)?.current?.focus({
								preventScroll: true,
							});
						}
					}}
					disabled={disabled || busy || currentCommandInHistory === 0}
					aria-label="Next command"
				>
					<ChevronDown size={17} aria-hidden="true" />
				</button>
			</div>
		</form>
	);
}
