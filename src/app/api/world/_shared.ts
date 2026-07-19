import {NextResponse} from "next/server";
import {z} from "zod";

import {WorldSchema} from "@/schemas/world/worldSchema";

export const WorldIdSchema = z.uuid();

export const CreateWorldRequestSchema = z.object({
	name: z.string().trim().min(1),
	slug: z.string().trim().min(1).nullable().optional(),
	world: WorldSchema,
	schemaVersion: z.number().int().positive().optional(),
});

export const CreateDefaultWorldRequestSchema = z.object({
	name: z.string().trim().min(1),
	slug: z.string().trim().min(1).nullable().optional(),
	schemaVersion: z.number().int().positive().optional(),
});

export const UpdateWorldRequestSchema = z
	.object({
		name: z.string().trim().min(1).optional(),
		slug: z.string().trim().min(1).nullable().optional(),
		world: WorldSchema.optional(),
		expectedRevision: z.number().int().positive().optional(),
	})
	.refine(
		(input) => input.name !== undefined || input.slug !== undefined || input.world !== undefined,
		{
			message: "At least one world field must be provided.",
		},
	);

export const UpdateSchemaVersionRequestSchema = z.object({
	schemaVersion: z.number().int().positive(),
});

export const invalidJsonResponse = (): NextResponse =>
	NextResponse.json(
		{
			error: {
				code: "INVALID_JSON",
				message: "The request body must contain valid JSON.",
			},
		},
		{status: 400},
	);

export const validationErrorResponse = (issues: z.core.$ZodIssue[]): NextResponse =>
	NextResponse.json(
		{
			error: {
				code: "VALIDATION_ERROR",
				message: "The request data is invalid.",
				issues,
			},
		},
		{status: 400},
	);

export const worldNotFoundResponse = (): NextResponse =>
	NextResponse.json(
		{
			error: {
				code: "WORLD_NOT_FOUND",
				message: "The requested world does not exist.",
			},
		},
		{status: 404},
	);

export const worldRevisionConflictResponse = (): NextResponse =>
	NextResponse.json(
		{
			error: {
				code: "WORLD_REVISION_CONFLICT",
				message: "This world was changed by another editor. Reload before saving again.",
			},
		},
		{status: 409},
	);

export const handleWorldRouteError = (error: unknown): NextResponse => {
	if ((error as {code?: string}).code === "23505") {
		return NextResponse.json(
			{
				error: {
					code: "WORLD_CONFLICT",
					message: "A world with that slug already exists.",
				},
			},
			{status: 409},
		);
	}

	console.error("World API request failed", error);

	return NextResponse.json(
		{
			error: {
				code: "INTERNAL_ERROR",
				message: "The world request could not be completed.",
			},
		},
		{status: 500},
	);
};
