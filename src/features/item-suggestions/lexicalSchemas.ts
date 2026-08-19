import {z} from "zod";

export const LexicalSuggestionRequestSchema = z.object({
	name: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
	tags: z.array(z.string().trim().min(1).max(80)).max(80).default([]),
	iconCategory: z.string().trim().max(80).optional(),
});

export const ItemIconInferenceBatchRequestSchema = z.object({
	items: z.array(LexicalSuggestionRequestSchema).min(1).max(20),
});

export const ItemIconInferenceBatchResponseSchema = z.object({
	data: z.object({categories: z.array(z.string())}),
});

export const LexicalAliasCandidateSchema = z.object({
	value: z.string(),
	relation: z.enum(["phrase", "synonym", "reference", "inflection", "broader"]),
	evidence: z.string(),
});

export const LexicalConceptCandidateSchema = z.object({
	tag: z.string(),
	label: z.string(),
	depth: z.number().int().nonnegative(),
	evidence: z.string(),
	synsetId: z.string(),
});

export const LexicalSuggestionResponseSchema = z.object({
	data: z.object({
		aliases: z.array(LexicalAliasCandidateSchema),
		concepts: z.array(LexicalConceptCandidateSchema),
		version: z.string(),
	}),
});

export type LexicalSuggestionRequest = z.infer<typeof LexicalSuggestionRequestSchema>;
export type ItemIconInferenceBatchRequest = z.infer<typeof ItemIconInferenceBatchRequestSchema>;
export type LexicalAliasCandidate = z.infer<typeof LexicalAliasCandidateSchema>;
export type LexicalConceptCandidate = z.infer<typeof LexicalConceptCandidateSchema>;
export type LexicalSuggestionResponse = z.infer<typeof LexicalSuggestionResponseSchema>;
