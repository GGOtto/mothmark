import {NextResponse} from "next/server";

import {
	ADMIN_CSRF_COOKIE,
	EDITOR_CSRF_COOKIE,
	PLAY_CSRF_COOKIE,
	createOpaqueToken,
	readCookie,
} from "@/auth/sessionTokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): NextResponse {
	const audience = new URL(request.url).searchParams.get("audience");
	const cookieName =
		audience === "admin"
			? ADMIN_CSRF_COOKIE
			: audience === "play"
				? PLAY_CSRF_COOKIE
				: EDITOR_CSRF_COOKIE;
	const csrfToken = readCookie(request, cookieName) ?? createOpaqueToken();
	const response = NextResponse.json({data: {csrfToken}});
	response.cookies.set(cookieName, csrfToken, {
		httpOnly: false,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
	});
	return response;
}
