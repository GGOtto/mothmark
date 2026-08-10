export const PERMISSIONS = [
	"editor.access",
	"world.create",
	"world.update_owned",
	"world.delete_owned",
	"world.export_owned",
	"world.publish_owned",
	"hosted_play.access",
	"hosted_play.save_progress",
	"admin.users.view",
	"admin.users.manage",
	"admin.users.manage_permissions",
	"admin.worlds.view",
	"admin.worlds.manage",
	"admin.worlds.transfer",
	"admin.publications.manage",
	"admin.playthroughs.view",
	"admin.audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionPrincipal = {
	accountType: "anonymous" | "registered";
	siteRole: "admin" | "user";
	status: "active" | "deleted" | "suspended";
};
export type PermissionOverride = {
	allowed: boolean;
	expiresAt: Date | string | null;
	permission: Permission;
};
export type EffectivePermission = {
	allowed: boolean;
	expiresAt: string | null;
	override: "allow" | "deny" | "inherited";
	permission: Permission;
	source:
		| "account default"
		| "account status"
		| "explicit allow"
		| "explicit deny"
		| "not granted"
		| "site role";
};

const ORDINARY_DEFAULTS = new Set<Permission>([
	"editor.access",
	"world.create",
	"world.update_owned",
	"world.delete_owned",
	"world.export_owned",
	"hosted_play.access",
	"hosted_play.save_progress",
]);
const ADMIN_DEFAULTS = new Set<Permission>(
	PERMISSIONS.filter((value) => value.startsWith("admin.")),
);

export function resolvePermissions(
	principal: PermissionPrincipal,
	overrides: PermissionOverride[] = [],
	now = new Date(),
): EffectivePermission[] {
	const activeOverrides = new Map(
		overrides
			.filter((override) => !override.expiresAt || new Date(override.expiresAt) > now)
			.map((override) => [override.permission, override]),
	);
	return PERMISSIONS.map((permission) => {
		const override = activeOverrides.get(permission);
		if (principal.status !== "active") {
			return {
				allowed: false,
				expiresAt: override?.expiresAt ? new Date(override.expiresAt).toISOString() : null,
				override: override ? (override.allowed ? "allow" : "deny") : "inherited",
				permission,
				source: "account status",
			};
		}
		if (override) {
			return {
				allowed: override.allowed,
				expiresAt: override.expiresAt ? new Date(override.expiresAt).toISOString() : null,
				override: override.allowed ? "allow" : "deny",
				permission,
				source: override.allowed ? "explicit allow" : "explicit deny",
			};
		}
		const fromRole = principal.siteRole === "admin" && ADMIN_DEFAULTS.has(permission);
		const fromAccount =
			ORDINARY_DEFAULTS.has(permission) ||
			(permission === "world.publish_owned" && principal.accountType === "registered");
		return {
			allowed: fromRole || fromAccount,
			expiresAt: null,
			override: "inherited",
			permission,
			source: fromRole ? "site role" : fromAccount ? "account default" : "not granted",
		};
	});
}
