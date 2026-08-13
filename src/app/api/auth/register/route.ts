import {NextResponse} from "next/server";
import {z} from "zod";

import {authenticationEmailIsConfigured, sendAuthenticationEmail} from "@/auth/email";
import {resolveCurrentActor} from "@/auth/currentActor";
import {mutationSecurityError} from "@/auth/requestSecurity";
import {PasswordValidationError} from "@/auth/passwords";
import {UsernameSchema} from "@/auth/usernames";
import {UsernameUnavailableError, beginRegistration} from "@/db/dbal/registeredAccountRepository";
import {
	EmailSchema,
	PasswordSchema,
	authenticationEmailUnavailableResponse,
	isResponse,
	readJson,
	requestNetwork,
} from "../_shared";

export const runtime = "nodejs";
const InputSchema = z.object({
	email: EmailSchema,
	password: PasswordSchema,
	subscribeToUpdates: z.boolean().optional().default(false),
	username: UsernameSchema,
});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(request, InputSchema);
	if (isResponse(input)) return input;
	if (!authenticationEmailIsConfigured()) return authenticationEmailUnavailableResponse();
	try {
		const actor = await resolveCurrentActor(request, "editor");
		const dispatch = await beginRegistration({
			email: input.email,
			network: requestNetwork(request),
			password: input.password,
			subscribeToUpdates: input.subscribeToUpdates,
			username: input.username,
			...(actor?.accountType === "anonymous" && {userId: actor.userId}),
		});
		if (dispatch) await sendAuthenticationEmail({...dispatch, kind: "verify_email"});
		return NextResponse.json(
			{data: {message: "If the address can be registered, a verification message is on its way."}},
			{status: 202},
		);
	} catch (error) {
		if (error instanceof UsernameUnavailableError) {
			return NextResponse.json(
				{error: {code: "USERNAME_UNAVAILABLE", message: error.message}},
				{status: 409},
			);
		}
		if (error instanceof PasswordValidationError) {
			return NextResponse.json({error: {code: error.code, message: error.message}}, {status: 400});
		}
		console.error("Registration could not be completed.");
		return NextResponse.json(
			{data: {message: "If the address can be registered, a verification message is on its way."}},
			{status: 202},
		);
	}
}
