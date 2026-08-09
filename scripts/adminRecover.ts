import {createInterface} from "node:readline/promises";
import {exit, stdin, stdout} from "node:process";

import {
	recoverAdministrator,
	replaceAdministrator,
	type AdministratorProvisioning,
} from "../src/db/dbal/adminAuthRepository";
import {createTotpSecret, totpEnrollmentUri} from "../src/auth/totp";
import {promptSecret} from "./secretPrompt";

export async function runAdminRecover(
	mode = process.argv[2],
	readSecret: (prompt: string) => Promise<string> = promptSecret,
): Promise<void> {
	if (mode !== "password" && mode !== "mfa" && mode !== "replace") {
		throw new Error(
			"Use `pnpm admin:recover password`, `pnpm admin:recover mfa`, or `pnpm admin:recover replace`.",
		);
	}
	const lines = createInterface({input: stdin, output: stdout});
	const confirmation = await lines.question(
		`Type RESET ${mode.toUpperCase()} to revoke every administrator session and continue: `,
	);
	lines.close();
	if (confirmation !== `RESET ${mode.toUpperCase()}`) throw new Error("Recovery was cancelled.");
	let password: string | undefined;
	if (mode === "password") {
		password = await readSecret("New administrator password: ");
		if (password !== (await readSecret("Confirm password: ")))
			throw new Error("The passwords do not match.");
	}
	let result: AdministratorProvisioning | {userId: string};
	if (mode === "replace") {
		const email = process.env.ADMIN_EMAIL?.trim();
		if (!email)
			throw new Error("ADMIN_EMAIL must identify an existing verified replacement account.");
		const totpSecret = createTotpSecret();
		stdout.write(
			`\nAdd this URI to the replacement administrator's authenticator:\n${totpEnrollmentUri(email, totpSecret)}\n\n`,
		);
		const totpCode = await readSecret("Current six-digit authenticator code: ");
		result = await replaceAdministrator({email, totpCode, totpSecret});
	} else {
		result = await recoverAdministrator({password, resetMfa: mode === "mfa"});
	}
	if ("totpUri" in result) {
		stdout.write(`\nNew authenticator URI:\n${result.totpUri}\n\nNew one-time recovery codes:\n`);
		for (const code of result.recoveryCodes) stdout.write(`${code}\n`);
	}
	stdout.write(`\nAdministrator ${result.userId} recovered; all sessions were revoked.\n`);
}

if (process.argv[1]?.endsWith("adminRecover.ts")) {
	runAdminRecover().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : "Administrator recovery failed."}\n`,
		);
		exit(1);
	});
}
