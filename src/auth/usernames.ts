import {z} from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9._\\-]{2,29}";

export const normalizeUsername = (value: string): string => value.trim().toLowerCase();

export function usernameValidationMessage(value: string): string | undefined {
	if (!value) return undefined;
	if (value.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
	if (value.length > USERNAME_MAX_LENGTH)
		return `Use no more than ${USERNAME_MAX_LENGTH} characters.`;
	if (!/^[a-z0-9]/i.test(value)) return "Start with a letter or number.";
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value))
		return "Use only letters, numbers, periods, underscores, or hyphens—no spaces or other special characters.";
	return undefined;
}

export const UsernameSchema = z
	.string()
	.min(USERNAME_MIN_LENGTH)
	.max(USERNAME_MAX_LENGTH)
	.regex(/^[a-z0-9][a-z0-9._-]*$/i);
