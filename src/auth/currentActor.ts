import "server-only";

import {EDITOR_SESSION_COOKIE, readCookie} from "./sessionTokens";
import {
	findCurrentActor,
	type CurrentActor,
	type SessionAudience,
} from "@/db/dbal/sessionsRepository";

export async function resolveCurrentActor(
	request: Request,
	audience: SessionAudience,
): Promise<CurrentActor | undefined> {
	const token = audience === "editor" ? readCookie(request, EDITOR_SESSION_COOKIE) : undefined;
	if (!token) return undefined;
	return findCurrentActor(token, audience);
}
