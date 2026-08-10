import {NextResponse} from "next/server";

import {UsernameSchema, usernameValidationMessage} from "@/auth/usernames";
import {isUsernameAvailable} from "@/db/dbal/registeredAccountRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
	const value = new URL(request.url).searchParams.get("username") ?? "";
	const parsed = UsernameSchema.safeParse(value);
	if (!parsed.success) {
		return NextResponse.json(
			{
				data: {
					available: false,
					message: usernameValidationMessage(value) ?? "Enter a valid username.",
					valid: false,
				},
			},
			{headers: {"cache-control": "no-store"}},
		);
	}
	try {
		const available = await isUsernameAvailable(parsed.data);
		return NextResponse.json(
			{
				data: {
					available,
					message: available ? "Username is available." : "That username is already in use.",
					valid: true,
				},
			},
			{headers: {"cache-control": "no-store"}},
		);
	} catch (error) {
		console.error("Username availability check failed", error);
		return NextResponse.json(
			{error: {code: "INTERNAL_ERROR", message: "Username availability could not be checked."}},
			{status: 500},
		);
	}
}
