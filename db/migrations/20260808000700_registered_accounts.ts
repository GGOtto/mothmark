import type {Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
	if (await knex.schema.hasTable("auth_identities")) {
		const identity = await knex("auth_identities").select("id", "provider").first();
		if (identity) {
			throw new Error(
				`Refusing to remove a provisioned ${identity.provider} identity. Complete the reviewed administrator recovery procedure first.`,
			);
		}
		await knex.schema.dropTable("auth_identities");
	}

	await knex.schema.createTable("user_emails", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("email").notNullable();
		table.text("normalized_email").notNullable().unique();
		table.timestamp("verified_at").notNullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["user_id"]);
	});

	await knex.schema.createTable("password_credentials", (table) => {
		table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
		table.text("password_hash").notNullable();
		table.integer("hash_version").notNullable();
		table.jsonb("hash_parameters").notNullable();
		table.timestamp("authenticated_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
	});

	await knex.schema.createTable("account_registrations", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").nullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("email").notNullable();
		table.text("normalized_email").notNullable();
		table.text("password_hash").notNullable();
		table.integer("hash_version").notNullable();
		table.jsonb("hash_parameters").notNullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("expires_at").notNullable();
		table.timestamp("completed_at").nullable();
		table.timestamp("superseded_at").nullable();
		table.index(["normalized_email", "created_at"]);
		table.index(["user_id", "created_at"]);
	});

	await knex.schema.createTable("account_tokens", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").nullable().references("id").inTable("users").onDelete("CASCADE");
		table
			.uuid("registration_id")
			.nullable()
			.references("id")
			.inTable("account_registrations")
			.onDelete("CASCADE");
		table.text("purpose").notNullable();
		table.text("token_hash").notNullable().unique();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("expires_at").notNullable();
		table.timestamp("consumed_at").nullable();
		table.timestamp("superseded_at").nullable();
		table.check("purpose in ('verify_email', 'password_reset', 'admin_sign_in')");
		table.check("user_id is not null or registration_id is not null");
		table.index(["user_id", "purpose", "created_at"]);
		table.index(["registration_id", "purpose", "created_at"]);
	});

	await knex.schema.createTable("totp_authenticators", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("encrypted_secret").notNullable();
		table.bigInteger("last_used_counter").nullable();
		table.timestamp("confirmed_at").notNullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["user_id"]);
	});

	await knex.schema.createTable("administrator_recovery_codes", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("code_hash").notNullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("used_at").nullable();
		table.unique(["user_id", "code_hash"]);
	});

	await knex.schema.createTable("authentication_attempts", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.text("dimension_hash").notNullable();
		table.text("action").notNullable();
		table.timestamp("attempted_at").notNullable().defaultTo(knex.fn.now());
		table.index(["dimension_hash", "action", "attempted_at"]);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists("authentication_attempts");
	await knex.schema.dropTableIfExists("administrator_recovery_codes");
	await knex.schema.dropTableIfExists("totp_authenticators");
	await knex.schema.dropTableIfExists("account_tokens");
	await knex.schema.dropTableIfExists("account_registrations");
	await knex.schema.dropTableIfExists("password_credentials");
	await knex.schema.dropTableIfExists("user_emails");
	await knex.schema.createTable("auth_identities", (table) => {
		table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
		table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
		table.text("provider").notNullable();
		table.text("provider_subject").notNullable();
		table.text("email").nullable();
		table.timestamp("email_verified_at").nullable();
		table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
		table.timestamp("last_authenticated_at").notNullable().defaultTo(knex.fn.now());
		table.unique(["provider", "provider_subject"]);
		table.unique(["user_id", "provider"]);
		table.index(["user_id"]);
	});
}
