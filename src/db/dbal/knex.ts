import knex, {type Knex} from "knex";

import knexConfig from "../../../knexfile";

const globalDatabase = globalThis as typeof globalThis & {
	mothmarkDatabase?: Knex;
};

/**
 * Returns the application's shared database client.
 *
 * Keeping creation lazy means modules can be loaded by tooling and static builds without opening a
 * database connection. The global cache also avoids accumulating pools during Next.js hot reloads.
 */
export const getDb = (): Knex => {
	globalDatabase.mothmarkDatabase ??= knex(knexConfig);

	return globalDatabase.mothmarkDatabase;
};

export type Database = Knex;
