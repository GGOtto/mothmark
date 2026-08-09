import {NextResponse} from "next/server";
import {z} from "zod";

import {WorldSchema} from "@/schemas/world/worldSchema";
import {WORLD_EDITOR_SLUG_MAX_LENGTH, isWorldEditorSlug} from "@/utils/worldSlug";

export const WorldIdSchema = z.uuid();
export const WorldLocatorSchema = z
	.string()
	.refine((value) => z.uuid().safeParse(value).success || isWorldEditorSlug(value), {
		message: `The world locator must be a UUID or an editor slug up to ${WORLD_EDITOR_SLUG_MAX_LENGTH} characters.`,
	});

const WorldNameSchema = z.string().trim().min(1).max(80);

export const CreateWorldRequestSchema = z.discriminatedUnion("source", [
	z.object({name: WorldNameSchema, source: z.enum(["starter", "blank"])}),
	z.object({name: WorldNameSchema, source: z.literal("import"), world: WorldSchema}),
]);

export const CreateDefaultWorldRequestSchema = z.object({
	name: z.string().trim().min(1),
	slug: z.string().trim().min(1).nullable().optional(),
	schemaVersion: z.number().int().positive().optional(),
});

export const UpdateWorldRequestSchema = z
	.object({
		name: z.string().trim().min(1).max(80).optional(),
		world: WorldSchema.optional(),
		expectedRevision: z.number().int().positive().optional(),
	})
	.refine((input) => input.name !== undefined || input.world !== undefined, {
		message: "At least one world field must be provided.",
	});

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
	if ((error as {code?: string}).code === "WORLD_LIMIT_REACHED") {
		return NextResponse.json(
			{
				error: {
					code: "WORLD_LIMIT_REACHED",
					message: error instanceof Error ? error.message : "The world limit has been reached.",
				},
			},
			{status: 409},
		);
	}
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
