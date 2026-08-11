import {z} from "zod";

export const PUBLIC_PROFILE_DISPLAY_NAME_MAX_LENGTH = 80;
export const PUBLIC_PROFILE_BIO_MAX_LENGTH = 500;
export const PUBLIC_PROFILE_WEBSITE_MAX_LENGTH = 2_048;

function normalizePublicWebsite(value: string): string {
	const trimmed = value.trim();
	if (!trimmed || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

function isPublicWebsite(value: string): boolean {
	const normalized = normalizePublicWebsite(value);
	if (!normalized) return true;
	try {
		const url = new URL(normalized);
		return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
	} catch {
		return false;
	}
}

export const PublicProfileInputSchema = z.object({
	bio: z.string().trim().max(PUBLIC_PROFILE_BIO_MAX_LENGTH),
	displayName: z.string().trim().max(PUBLIC_PROFILE_DISPLAY_NAME_MAX_LENGTH),
	website: z
		.string()
		.trim()
		.max(PUBLIC_PROFILE_WEBSITE_MAX_LENGTH)
		.refine(
			(value) => normalizePublicWebsite(value).length <= PUBLIC_PROFILE_WEBSITE_MAX_LENGTH,
			"The web address is too long.",
		)
		.refine(isPublicWebsite, "Enter a complete http or https web address."),
});

export type PublicProfileInput = z.infer<typeof PublicProfileInputSchema>;

export type StoredPublicProfileInput = {
	bio: string | null;
	displayName: string | null;
	website: string | null;
};

export function normalizePublicProfileInput(input: PublicProfileInput): StoredPublicProfileInput {
	return {
		bio: input.bio || null,
		displayName: input.displayName || null,
		website: input.website ? normalizePublicWebsite(input.website) : null,
	};
}

export function publicProfileDisplayName(input: {
	displayName: string | null;
	username: string;
}): string {
	return input.displayName?.trim() || input.username;
}
