import "server-only";

import type {Knex} from "knex";

import {normalizeEmail} from "@/auth/normalizeEmail";
import {getDb} from "./knex";

const database = getDb();

export type SubscriberSource = "footer" | "registration";
export type AdminSubscriber = {
	email: string;
	source: SubscriberSource;
	subscribedAt: string;
};

type SubscriberRow = {
	email: string;
	source: SubscriberSource;
	subscribed_at: Date | string;
};

const iso = (value: Date | string): string => new Date(value).toISOString();

export async function upsertEmailSubscriber(
	connection: Knex | Knex.Transaction,
	input: {email: string; source: SubscriberSource},
	now = new Date(),
): Promise<void> {
	const email = input.email.trim();
	await connection("email_subscribers")
		.insert({
			email,
			normalized_email: normalizeEmail(email),
			source: input.source,
			subscribed_at: now,
			unsubscribed_at: null,
			updated_at: now,
		})
		.onConflict("normalized_email")
		.merge({
			email,
			source: input.source,
			subscribed_at: now,
			unsubscribed_at: null,
			updated_at: now,
		});
}

export async function subscribeEmail(input: {
	email: string;
	source: SubscriberSource;
}): Promise<void> {
	await upsertEmailSubscriber(database, input);
}

export async function listAdminSubscribers(actorUserId: string): Promise<AdminSubscriber[]> {
	return database.transaction(async (transaction) => {
		const rows = await transaction("email_subscribers")
			.select<SubscriberRow[]>("email", "source", "subscribed_at")
			.whereNull("unsubscribed_at")
			.orderBy("subscribed_at", "desc");
		await transaction("operational_events").insert({
			details: {actorUserId, subscriberCount: rows.length, targetType: "email_subscribers"},
			event_type: "administrator_sensitive_read",
		});
		return rows.map((row) => ({
			email: row.email,
			source: row.source,
			subscribedAt: iso(row.subscribed_at),
		}));
	});
}
