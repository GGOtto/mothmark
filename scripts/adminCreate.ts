import {exit} from "node:process";

import {createTotpSecret, totpEnrollmentUri} from "../src/auth/totp";
import {provisionAdministrator} from "../src/db/dbal/adminAuthRepository";
import {promptSecret} from "./secretPrompt";

export async function runAdminCreate(
	readSecret: (prompt: string) => Promise<string> = promptSecret,
): Promise<void> {
	const email = process.env.ADMIN_EMAIL?.trim();
	if (!email) throw new Error("ADMIN_EMAIL is required in the matching Phase environment.");
	const password = await readSecret("Administrator password: ");
	const confirmation = await readSecret("Confirm password: ");
	if (password !== confirmation) throw new Error("The passwords do not match.");
	const totpSecret = createTotpSecret();
	process.stdout.write(
		`\nAdd this URI to the administrator authenticator:\n${totpEnrollmentUri(email, totpSecret)}\n\n`,
	);
	const totpCode = await readSecret("Current six-digit authenticator code: ");
	const result = await provisionAdministrator({email, password, totpCode, totpSecret});
	process.stdout.write(
		"\nStore these one-time recovery codes offline. They will not be shown again:\n",
	);
	for (const code of result.recoveryCodes) process.stdout.write(`${code}\n`);
	process.stdout.write(`\nAdministrator ${result.userId} is ready.\n`);
}

if (process.argv[1]?.endsWith("adminCreate.ts")) {
	runAdminCreate().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : "Administrator creation failed."}\n`,
		);
		exit(1);
	});
}
