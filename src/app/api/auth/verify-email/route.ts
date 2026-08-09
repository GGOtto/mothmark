import {NextResponse} from "next/server";
import {z} from "zod";

import {mutationSecurityError} from "@/auth/requestSecurity";
import {completeRegistration} from "@/db/dbal/registeredAccountRepository";
import {isResponse, readJson, requestNetwork} from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
	const securityError = mutationSecurityError(request);
	if (securityError) return securityError;
	const input = await readJson(request, z.object({token: z.string().min(1).max(512)}));
	if (isResponse(input)) return input;
	const result = await completeRegistration(input.token, new Date(), requestNetwork(request));
	if (result.status === "expired") {
		return NextResponse.json(
			{error: {code: "LINK_EXPIRED", message: "This verification link is invalid or has expired."}},
			{status: 410},
		);
	}
	return NextResponse.json({data: result});
}
