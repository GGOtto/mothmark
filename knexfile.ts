import path from "node:path";
import {fileURLToPath} from "node:url";

import type {Knex} from "knex";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const readInteger = (name: string, fallback: number): number => {
	const value = process.env[name];

	if (value === undefined) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${name} must be a non-negative integer.`);
	}

	return parsed;
};

const poolMin = readInteger("DATABASE_POOL_MIN", 0);
const poolMax = readInteger("DATABASE_POOL_MAX", 10);

if (poolMax < poolMin) {
	throw new Error("DATABASE_POOL_MAX must be greater than or equal to DATABASE_POOL_MIN.");
}

const knexConfig: Knex.Config = {
	client: "pg",
	connection: () => {
		const connectionString = process.env.DATABASE_URL;

		if (!connectionString) {
			throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
		}

		return {
			connectionString,
			ssl: process.env.DATABASE_SSL === "true" ? {rejectUnauthorized: false} : false,
		};
	},
	pool: {
		min: poolMin,
		max: poolMax,
	},
	migrations: {
		directory: path.join(projectRoot, "db/migrations"),
		extension: "ts",
		tableName: "knex_migrations",
	},
};

export default knexConfig;
