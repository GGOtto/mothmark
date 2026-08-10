import "server-only";

import {createHash} from "node:crypto";

import {getDb} from "./knex";

const database = getDb();
const FEEDBACK_WINDOW_MS = 60 * 60 * 1_000;

export class FeedbackRateLimitError extends Error {
	readonly retryAfterSeconds = Math.ceil(FEEDBACK_WINDOW_MS / 1_000);

	constructor() {
		super("You can send up to 3 feedback messages per hour.");
		this.name = "FeedbackRateLimitError";
	}
}

const dimensionHash = (kind: string, value: string) =>
	createHash("sha256").update(`${kind}:${value}`).digest("hex");

export async function enforceFeedbackRateLimit(input: {
	actorUserId?: string;
	network: string;
}): Promise<void> {
	const dimensions = input.actorUserId
		? [
				{kind: "actor", value: input.actorUserId, limit: 3},
				{kind: "network", value: input.network, limit: 20},
			]
		: [{kind: "network", value: input.network, limit: 3}];

	await database.transaction(async (transaction) => {
		const now = new Date();
		const cutoff = new Date(now.getTime() - FEEDBACK_WINDOW_MS);
		const hashed = dimensions.map((dimension) => ({
			...dimension,
			hash: dimensionHash(dimension.kind, dimension.value),
		}));

		for (const dimension of [...hashed].sort((left, right) => left.hash.localeCompare(right.hash))) {
			await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
				`mothmark-feedback-rate:${dimension.hash}`,
			]);
		}

		for (const dimension of hashed) {
			const count = await transaction("request_rate_limit_events")
				.where({action: "feedback_submit", dimension_hash: dimension.hash})
				.where("attempted_at", ">=", cutoff)
				.count<{count: string}[]>("id as count")
				.first();
			if (Number(count?.count ?? 0) >= dimension.limit) throw new FeedbackRateLimitError();
		}

		await transaction("request_rate_limit_events").insert(
			hashed.map((dimension) => ({
				action: "feedback_submit",
				attempted_at: now,
				dimension_hash: dimension.hash,
			})),
		);
	});
}
