import {NextResponse} from "next/server";
import {z} from "zod";

import {resolveCurrentActor} from "@/auth/currentActor";
import {PasswordValidationError} from "@/auth/passwords";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {changePassword} from "@/db/dbal/registeredAccountRepository";
import {PasswordSchema, clearEditorSessionCookie, isResponse, readJson} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const actor = await resolveCurrentActor(request, "editor");
	if (!actor || actor.accountType !== "registered") return authRequiredResponse();
	const input = await readJson(
		request,
		z.object({currentPassword: PasswordSchema, newPassword: PasswordSchema}),
	);
	if (isResponse(input)) return input;
	try {
		if (!(await changePassword({...input, userId: actor.userId}))) {
			return NextResponse.json(
				{error: {code: "INVALID_CREDENTIALS", message: "The current password is incorrect."}},
				{status: 401},
			);
		}
		const response = NextResponse.json({data: {passwordChanged: true}});
		clearEditorSessionCookie(response);
		return response;
	} catch (error) {
		if (error instanceof PasswordValidationError) {
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 400});
		}
		throw error;
	}
}
