import {NextResponse} from "next/server";
import {z} from "zod";

import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {sessionClientLabel} from "@/auth/sessionClient";
import {EDITOR_SESSION_COOKIE, EDITOR_SESSION_DURATION_MS, readCookie} from "@/auth/sessionTokens";
import {
	createAnonymousEditorBootstrap,
	findBootstrapEditorActor,
	getOrCreateFirstOwnedWorld,
	getRecentOwnedWorld,
} from "@/db/dbal/sessionsRepository";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {handleWorldRouteError, worldPermissionError} from "../../world/_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BootstrapRequestSchema = z.object({openWorld: z.boolean().optional()});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	let input: z.infer<typeof BootstrapRequestSchema> = {};
	try {
		const rawBody = await request.text();
		if (rawBody) {
			const result = BootstrapRequestSchema.safeParse(JSON.parse(rawBody));
			if (!result.success)
				return NextResponse.json(
					{error: {code: "VALIDATION_ERROR", message: "The request data is invalid."}},
					{status: 400},
				);
			input = result.data;
		}
	} catch {
		return NextResponse.json(
			{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
			{status: 400},
		);
	}
	const recordOpened = input.openWorld === true;

	try {
		const sessionToken = readCookie(request, EDITOR_SESSION_COOKIE);
		const actor = sessionToken ? await findBootstrapEditorActor(sessionToken) : undefined;
		if (actor === "blocked") return authRequiredResponse();
		if (actor) {
			const accessError = await worldPermissionError(actor, "editor.access");
			if (accessError) return accessError;
			if (recordOpened && !(await userHasPermission(actor.userId, "world.create"))) {
				const existing = await getRecentOwnedWorld(actor.userId);
				if (!existing)
					return NextResponse.json(
						{error: {code: "FORBIDDEN", message: "This account cannot create a world."}},
						{status: 403},
					);
			}
			const world = recordOpened
				? await getOrCreateFirstOwnedWorld(actor.userId, true)
				: await getRecentOwnedWorld(actor.userId);
			return NextResponse.json({data: world ?? null, meta: {userId: actor.userId}});
		}

		const bootstrap = await createAnonymousEditorBootstrap(
			recordOpened,
			sessionClientLabel(request.headers.get("user-agent")),
		);
		const response = NextResponse.json(
			{data: bootstrap.world, meta: {userId: bootstrap.userId}},
			{status: 201},
		);
		response.cookies.set(EDITOR_SESSION_COOKIE, bootstrap.sessionToken, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: Math.floor(EDITOR_SESSION_DURATION_MS / 1_000),
			expires: bootstrap.expiresAt,
		});
		return response;
	} catch (error) {
		return handleWorldRouteError(error);
	}
}
