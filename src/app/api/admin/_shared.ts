import {NextResponse} from "next/server";

import {resolveCurrentActor} from "@/auth/currentActor";
import {adminAuthRequiredResponse} from "@/auth/requestSecurity";
import type {Permission} from "@/auth/permissions";
import {AdminControlError, administratorHasPermission} from "@/db/dbal/adminRepository";
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

export async function requireAdminPermission(
	request: Request,
	permission: Permission,
): Promise<CurrentActor | NextResponse> {
	const actor = await requireAdministrator(request);
	if (isResponse(actor)) return actor;
	if (!(await administratorHasPermission(actor.userId, permission))) {
		return NextResponse.json(
			{error: {code: "FORBIDDEN", message: "This administrator capability is not enabled."}},
			{status: 403},
		);
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
	if (error instanceof AdminControlError) {
		const status =
			error.code === "NOT_FOUND"
				? 404
				: error.code === "FORBIDDEN"
					? 403
					: error.code === "WORLD_LIMIT_REACHED" || error.code === "CONFLICT"
						? 409
						: 400;
		return NextResponse.json({error: {code: error.code, message: error.message}}, {status});
	}
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
