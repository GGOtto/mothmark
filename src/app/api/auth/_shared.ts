import {NextResponse} from "next/server";
import {z} from "zod";

import {EDITOR_SESSION_COOKIE} from "@/auth/cookieNames";
import {EDITOR_SESSION_DURATION_MS} from "@/auth/sessionTokens";
import {AUTH_REQUEST_MAX_BYTES, RequestBodyError, readBoundedJson} from "@/auth/requestBody";

export const EmailSchema = z
	.email()
	.max(254)
	.transform((value) => value.trim());
export const PasswordSchema = z.string().min(1).max(128);

export const authenticationEmailUnavailableResponse = (): NextResponse =>
	NextResponse.json(
		{
			error: {
				code: "EMAIL_UNAVAILABLE",
				message: "Email delivery is not configured for this environment.",
			},
		},
		{status: 503},
	);

export async function readJson<T>(
	request: Request,
	schema: z.ZodType<T>,
): Promise<T | NextResponse> {
	try {
		const result = schema.safeParse(await readBoundedJson(request, AUTH_REQUEST_MAX_BYTES));
		if (result.success) return result.data;
		return NextResponse.json(
			{
				error: {
					code: "VALIDATION_ERROR",
					issues: result.error.issues,
					message: "Check the highlighted fields.",
				},
			},
			{status: 400},
		);
	} catch (error) {
		if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE")
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 413});
		return NextResponse.json(
			{error: {code: "INVALID_JSON", message: "The request body must contain valid JSON."}},
			{status: 400},
		);
	}
}

export function isResponse<T>(value: T | NextResponse): value is NextResponse {
	return value instanceof NextResponse;
}

export function requestNetwork(request: Request): string {
	return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unavailable";
}

export function setEditorSessionCookie(
	response: NextResponse,
	session: {expiresAt: Date; sessionToken: string},
): void {
	response.cookies.set(EDITOR_SESSION_COOKIE, session.sessionToken, {
		expires: session.expiresAt,
		httpOnly: true,
		maxAge: Math.floor(EDITOR_SESSION_DURATION_MS / 1_000),
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}

export function clearEditorSessionCookie(response: NextResponse): void {
	response.cookies.set(EDITOR_SESSION_COOKIE, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}
