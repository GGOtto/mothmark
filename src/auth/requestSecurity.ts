import {NextResponse} from "next/server";

import {
	ADMIN_CSRF_COOKIE,
	EDITOR_CSRF_COOKIE,
	PLAY_CSRF_COOKIE,
	readCookie,
	tokensMatch,
} from "./sessionTokens";
import type {SessionAudience} from "@/db/dbal/sessionsRepository";

export function mutationSecurityError(
	request: Request,
	audience: SessionAudience = "editor",
): NextResponse | undefined {
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(request.url).origin) {
		return NextResponse.json(
			{error: {code: "INVALID_ORIGIN", message: "The request origin is not allowed."}},
			{status: 403},
		);
	}

	const cookieToken = readCookie(
		request,
		audience === "admin"
			? ADMIN_CSRF_COOKIE
			: audience === "play"
				? PLAY_CSRF_COOKIE
				: EDITOR_CSRF_COOKIE,
	);
	const headerToken = request.headers.get("x-csrf-token") ?? undefined;
	if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
		return NextResponse.json(
			{error: {code: "INVALID_CSRF_TOKEN", message: "The request could not be verified."}},
			{status: 403},
		);
	}

	return undefined;
}

export const authRequiredResponse = (): NextResponse =>
	NextResponse.json(
		{error: {code: "AUTH_REQUIRED", message: "An active editor session is required."}},
		{status: 401},
	);

export const adminAuthRequiredResponse = (): NextResponse =>
	NextResponse.json(
		{error: {code: "ADMIN_AUTH_REQUIRED", message: "An active administrator session is required."}},
		{status: 401},
	);
