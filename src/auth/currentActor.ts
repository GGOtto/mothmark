import "server-only";

import {
	ADMIN_SESSION_COOKIE,
	EDITOR_SESSION_COOKIE,
	PLAY_SESSION_COOKIE,
	readCookie,
} from "./sessionTokens";
import {
	findCurrentActor,
	type CurrentActor,
	type SessionAudience,
} from "@/db/dbal/sessionsRepository";

export async function resolveCurrentActor(
	request: Request,
	audience: SessionAudience,
): Promise<CurrentActor | undefined> {
	const cookieName =
		audience === "editor"
			? EDITOR_SESSION_COOKIE
			: audience === "admin"
				? ADMIN_SESSION_COOKIE
				: PLAY_SESSION_COOKIE;
	const token = cookieName ? readCookie(request, cookieName) : undefined;
	if (!token) return undefined;
	return findCurrentActor(token, audience);
}
