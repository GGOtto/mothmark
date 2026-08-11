import "server-only";

import {normalizeUsername} from "@/auth/usernames";

import {getDb} from "./knex";
import {listPublicationsByOwnerUserId, type PublicPublication} from "./publicationRepository";

const database = getDb();

type PublicProfileRow = {
	account_type: "anonymous" | "registered";
	created_at: Date | string;
	display_name: string | null;
	id: string;
	profile_bio: string | null;
	profile_website: string | null;
	status: "active" | "deleted" | "suspended";
	username: string;
};

export type PublicUserProfile = {
	bio: string | null;
	createdAt: string;
	displayName: string | null;
	publications: PublicPublication[];
	username: string;
	website: string | null;
};

export async function getPublicUserProfile(
	username: string,
): Promise<PublicUserProfile | undefined> {
	const normalizedUsername = normalizeUsername(username);
	if (!normalizedUsername) return undefined;
	const user = await database<PublicProfileRow>("users")
		.where({account_type: "registered", status: "active"})
		.whereRaw("lower(username) = ?", [normalizedUsername])
		.first("id", "username", "display_name", "profile_bio", "profile_website", "created_at");
	if (!user) return undefined;
	return {
		bio: user.profile_bio,
		createdAt: new Date(user.created_at).toISOString(),
		displayName: user.display_name,
		publications: await listPublicationsByOwnerUserId(user.id),
		username: user.username,
		website: user.profile_website,
	};
}
