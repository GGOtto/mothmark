import "./CommandInput.scss";

type CommandInputProps = {
	command: string;
	setCommand: React.Dispatch<React.SetStateAction<string>>;
	submitCommand: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CommandInput({command, setCommand, submitCommand}: CommandInputProps) {
	return (
		<form onSubmit={submitCommand} className="command-input">
			<span className="command-input__prompt">&gt;</span>

			<input
				value={command}
				onChange={(event) => setCommand(event.target.value)}
				className="command-input__field"
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				autoFocus
			/>
		</form>
	);
}
