/** @jest-environment node */

import {EventEmitter} from "node:events";

import {promptSecretFrom, type SecretInput} from "./secretPrompt";

class FakeInput extends EventEmitter implements SecretInput {
	isTTY = true;
	rawModes: boolean[] = [];
	pause() {
		return this;
	}
	resume() {
		return this;
	}
	setEncoding() {
		return this;
	}
	setRawMode(enabled: boolean) {
		this.rawModes.push(enabled);
		return this;
	}
}

describe("operational secret prompt", () => {
	it("returns entered input without echoing credential material", async () => {
		const input = new FakeInput();
		let output = "";
		const secret = promptSecretFrom(
			input,
			{isTTY: true, write: (value) => (output += value)},
			"Password: ",
		);
		input.emit("data", "not-in-logs");
		input.emit("data", "\r");
		await expect(secret).resolves.toBe("not-in-logs");
		expect(output).toBe("Password: \n");
		expect(input.rawModes).toEqual([true, false]);
	});
});
