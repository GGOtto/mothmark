import "server-only";

import type {Knex} from "knex";

import {resolvePermissions, type EffectivePermission, type Permission} from "@/auth/permissions";

import {getDb} from "./knex";

const database = getDb();

export async function effectivePermissionsForUser(
	userId: string,
	connection: Knex | Knex.Transaction = database,
): Promise<EffectivePermission[] | undefined> {
	const [user, overrides] = await Promise.all([
		connection("users").select("account_type", "site_role", "status").where({id: userId}).first(),
		connection("user_permission_overrides")
			.select("permission", "allowed", "expires_at")
			.where({user_id: userId}),
	]);
	if (!user) return undefined;
	return resolvePermissions(
		{accountType: user.account_type, siteRole: user.site_role, status: user.status},
		overrides.map((override) => ({
			allowed: override.allowed,
			expiresAt: override.expires_at,
			permission: override.permission as Permission,
		})),
	);
}

export async function userHasPermission(userId: string, permission: Permission): Promise<boolean> {
	return Boolean(
		(await effectivePermissionsForUser(userId))?.find((entry) => entry.permission === permission)
			?.allowed,
	);
}
