import "server-only";

import {cookies} from "next/headers";

import {EDITOR_SESSION_COOKIE} from "./sessionTokens";
import {findCurrentActor, type CurrentActor} from "@/db/dbal/sessionsRepository";

export async function resolveCurrentEditorPageActor(): Promise<CurrentActor | undefined> {
	const token = (await cookies()).get(EDITOR_SESSION_COOKIE)?.value;
	return token ? findCurrentActor(token, "editor") : undefined;
}
