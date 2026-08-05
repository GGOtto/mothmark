"use client";

import {Check, Copy} from "lucide-react";
import {createContext, type ReactNode, useContext, useEffect, useState} from "react";
import type {Command} from "@/schemas/world/commandSchemas";

type CommandCopyContextValue = {
	command: Command | null;
	setCommand: (command: Command | null) => void;
};

const CommandCopyContext = createContext<CommandCopyContextValue | null>(null);

export function CommandCopyProvider({children}: {children: ReactNode}) {
	const [command, setCommand] = useState<Command | null>(null);

	return (
		<CommandCopyContext.Provider value={{command, setCommand}}>
			{children}
		</CommandCopyContext.Provider>
	);
}

export function useCommandCopyRegistration(command: Command | null) {
	const context = useContext(CommandCopyContext);
	const setCommand = context?.setCommand;

	useEffect(() => {
		setCommand?.(command);
		return () => setCommand?.(null);
	}, [command, setCommand]);
}

export function CommandCopyButton() {
	const context = useContext(CommandCopyContext);
	const [copied, setCopied] = useState(false);

	if (!context?.command) return null;

	async function copyCommand() {
		if (!context?.command) return;
		await navigator.clipboard.writeText(JSON.stringify(context.command, null, 2));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	}

	return (
		<button type="button" className="headerCommandCopy" onClick={() => void copyCommand()}>
			{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
			{copied ? "Copied" : "Copy command"}
		</button>
	);
}
