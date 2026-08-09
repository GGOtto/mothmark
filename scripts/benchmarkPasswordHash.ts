import {performance} from "node:perf_hooks";

import {PASSWORD_PARAMETERS, hashPassword} from "../src/auth/passwords";

async function benchmark(): Promise<void> {
	const samples: number[] = [];
	for (let index = 0; index < 3; index += 1) {
		const started = performance.now();
		await hashPassword("Mothmark deployment benchmark value");
		samples.push(performance.now() - started);
	}
	const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
	process.stdout.write(
		`Argon2id ${JSON.stringify(PASSWORD_PARAMETERS)}: ${samples.map((sample) => `${sample.toFixed(1)}ms`).join(", ")} (average ${average.toFixed(1)}ms)\n`,
	);
}

void benchmark();
