type CommandInputProps = {
	command: string;
	setCommand: React.Dispatch<React.SetStateAction<string>>;
	submitCommand: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CommandInput({command, setCommand, submitCommand}: CommandInputProps) {
	return (
		<form
			onSubmit={submitCommand}
			className="shrink-0 border-t border-neutral-800 bg-neutral-900 p-4"
		>
			<div className="mx-auto flex max-w-3xl gap-3">
				<span className="pt-2 text-neutral-400">&gt;</span>

				<input
					value={command}
					onChange={(event) => setCommand(event.target.value)}
					className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-400"
					autoFocus
				/>
			</div>
		</form>
	);
}
