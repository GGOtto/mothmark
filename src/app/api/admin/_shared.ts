import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {adminAuthRequiredResponse} from "@/auth/requestSecurity";
import type {CurrentActor} from "@/db/dbal/sessionsRepository";

export async function requireAdministrator(request: Request): Promise<CurrentActor | NextResponse> {
	const actor = await resolveCurrentActor(request, "admin");
	if (
		!actor ||
		actor.accountType !== "registered" ||
		actor.siteRole !== "admin" ||
		actor.audience !== "admin"
	) {
		return adminAuthRequiredResponse();
	}
	return actor;
}

export const isResponse = (value: CurrentActor | NextResponse): value is NextResponse =>
	value instanceof NextResponse;

export const adminNotFoundResponse = (): NextResponse =>
	NextResponse.json(
		{error: {code: "NOT_FOUND", message: "The requested administrative record was not found."}},
		{status: 404},
	);

export const adminRouteError = (error: unknown): NextResponse => {
	console.error("Administrator route failed", error);
	return NextResponse.json(
		{
			error: {
				code: "ADMIN_REQUEST_FAILED",
				message: "The administrative request could not be completed.",
			},
		},
		{status: 500},
	);
};
