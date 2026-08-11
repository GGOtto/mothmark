import {createInterface} from "node:readline/promises";
import {exit, stdin, stdout} from "node:process";

import {createTotpSecret, totpEnrollmentUri} from "../src/auth/totp";
import {addAdministrator} from "../src/db/dbal/adminAuthRepository";
import {promptSecret} from "./secretPrompt";

async function promptEmail(): Promise<string> {
	const lines = createInterface({input: stdin, output: stdout});
	try {
		return await lines.question("Verified account email: ");
	} finally {
		lines.close();
	}
}

export async function runAdminAdd(
	readEmail: () => Promise<string> = promptEmail,
	readSecret: (prompt: string) => Promise<string> = promptSecret,
): Promise<void> {
	const email = (await readEmail()).trim();
	if (!email) throw new Error("A verified account email is required.");
	const totpSecret = createTotpSecret();
	stdout.write(
		`\nAdd this URI to the new administrator's authenticator:\n${totpEnrollmentUri(email, totpSecret)}\n\n`,
	);
	const totpCode = await readSecret("Current six-digit authenticator code: ");
	const result = await addAdministrator({email, totpCode, totpSecret});
	stdout.write("\nStore these one-time recovery codes offline. They will not be shown again:\n");
	for (const code of result.recoveryCodes) stdout.write(`${code}\n`);
	stdout.write(`\nAdministrator ${result.userId} is ready; existing sessions were revoked.\n`);
}

if (process.argv[1]?.endsWith("adminAdd.ts")) {
	runAdminAdd().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : "Adding the administrator failed."}\n`,
		);
		exit(1);
	});
}
