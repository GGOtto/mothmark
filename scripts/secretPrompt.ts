import {stdin, stdout} from "node:process";

export type SecretInput = {
	isTTY?: boolean;
	off(event: "data", listener: (chunk: string) => void): unknown;
	on(event: "data", listener: (chunk: string) => void): unknown;
	pause(): unknown;
	resume(): unknown;
	setEncoding(encoding: "utf8"): unknown;
	setRawMode(enabled: boolean): unknown;
};

export type SecretOutput = {isTTY?: boolean; write(value: string): unknown};

/** Reads a secret from a TTY without writing entered characters to the output. */
export function promptSecretFrom(
	input: SecretInput,
	output: SecretOutput,
	prompt: string,
): Promise<string> {
	if (!input.isTTY || !output.isTTY) throw new Error("A terminal is required for secret input.");
	output.write(prompt);
	input.setRawMode(true);
	input.resume();
	input.setEncoding("utf8");
	return new Promise((resolve, reject) => {
		const finish = (error?: Error, value = "") => {
			input.off("data", onData);
			input.setRawMode(false);
			input.pause();
			output.write("\n");
			if (error) reject(error);
			else resolve(value);
		};
		let value = "";
		const onData = (chunk: string) => {
			for (const character of chunk) {
				if (character === "\u0003") return finish(new Error("Cancelled."));
				if (character === "\r" || character === "\n") return finish(undefined, value);
				if (character === "\u007f") value = value.slice(0, -1);
				else value += character;
			}
		};
		input.on("data", onData);
	});
}

/** Process-bound convenience wrapper used by operational commands. */
export function promptSecret(prompt: string): Promise<string> {
	return promptSecretFrom(stdin, stdout, prompt);
}
