import type {FeedbackCategory} from "./feedbackEmail";

export function feedbackConversationSubject(
	category: FeedbackCategory,
	feedbackId: string,
): string {
	return `Mothmark support: ${category} [${feedbackId.slice(0, 8)}]`;
}
