import {NextResponse} from "next/server";

import {EDITOR_CSRF_COOKIE, createOpaqueToken, readCookie} from "@/auth/sessionTokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): NextResponse {
	const csrfToken = readCookie(request, EDITOR_CSRF_COOKIE) ?? createOpaqueToken();
	const response = NextResponse.json({data: {csrfToken}});
	response.cookies.set(EDITOR_CSRF_COOKIE, csrfToken, {
		httpOnly: false,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
	});
	return response;
}
