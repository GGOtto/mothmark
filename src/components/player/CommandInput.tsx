import "./CommandInput.scss";

type CommandInputProps = {
	command: string;
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
			onPointerDown={(event) => {
				if (event.target instanceof HTMLInputElement) return;
				event.currentTarget.querySelector<HTMLInputElement>(".command-input__field")?.focus();
			}}
		>
			<span className="command-input__prompt">&gt;&gt;</span>

			<input
				ref={inputRef}
				disabled={disabled}
				aria-label="Game command"
				value={command}
				onChange={(event) => setCommand(event.target.value)}
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
				spellCheck={false}
			/>
		</form>
	);
}
