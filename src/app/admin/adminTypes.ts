export type AdminPermission = {allowed: boolean; permission: string; source: string};
export type AdminWorld = {
	createdAt: string;
	deletedAt: string | null;
	editorSlug: string | null;
	id: string;
	lifecycle: "active" | "trashed";
	name: string;
	owner: {accountType: "anonymous" | "registered"; displayName: string | null; id: string};
	revision: number;
	schemaVersion: number;
	trashPurgeAfter: string | null;
	updatedAt: string;
	worldSizeBytes: number;
};
export type AdminUser = {
	accountType: "anonymous" | "registered";
	cleanupAfter: string | null;
	cleanupReason: string | null;
	cleanupScheduledAt: string | null;
	createdAt: string;
	displayName: string | null;
	id: string;
	lastSeenAt: string;
	maxWorlds: number;
	siteRole: "admin" | "user";
	status: "active" | "deleted" | "suspended";
	trashedWorldCount: number;
	worldCount: number;
};
export type AdminUserDetail = AdminUser & {
	permissions: AdminPermission[];
	sessions: Array<{
		audience: "admin" | "editor" | "play";
		createdAt: string;
		expiresAt: string;
		id: string;
		lastSeenAt: string;
		revokedAt: string | null;
	}>;
	worlds: AdminWorld[];
};
