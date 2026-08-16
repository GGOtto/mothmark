import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {AUTH_REQUEST_MAX_BYTES, readBoundedJson} from "@/auth/requestBody";
import {authRequiredResponse, mutationSecurityError} from "@/auth/requestSecurity";
import {userHasPermission} from "@/db/dbal/permissionRepository";
import {LexicalSuggestionRequestSchema} from "@/features/item-suggestions/lexicalSchemas";
import {suggestFromWordNet} from "@/features/item-suggestions/wordnetLexicon.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const errorResponse = (status: number, code: string, message: string) =>
	NextResponse.json({error: {code, message}}, {status});

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;

	let body: unknown;
	try {
		body = await readBoundedJson(request, AUTH_REQUEST_MAX_BYTES);
	} catch {
		return errorResponse(400, "INVALID_JSON", "The suggestion request must contain valid JSON.");
	}
	const parsed = LexicalSuggestionRequestSchema.safeParse(body);
	if (!parsed.success) {
		return errorResponse(400, "VALIDATION_ERROR", "The suggestion request is invalid.");
	}

	try {
		const actor = await resolveCurrentActor(request, "editor");
		if (!actor) return authRequiredResponse();
		if (!(await userHasPermission(actor.userId, "editor.access"))) {
			return errorResponse(403, "FORBIDDEN", "This account cannot use the editor.");
		}
		return NextResponse.json({data: await suggestFromWordNet(parsed.data)});
	} catch (error) {
		console.error("Item suggestion request failed", error);
		return errorResponse(500, "INTERNAL_ERROR", "Suggestions are temporarily unavailable.");
	}
}
