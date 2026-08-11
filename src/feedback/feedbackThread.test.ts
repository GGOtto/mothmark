import {feedbackConversationSubject} from "./feedbackThread";

describe("feedback conversation subjects", () => {
	it("keeps every message for one submission stable and separates a new form submission", () => {
		const firstId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
		const secondId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";

		expect(feedbackConversationSubject("idea", firstId)).toBe("Mothmark support: idea [3e816c4d]");
		expect(feedbackConversationSubject("idea", firstId)).not.toBe(
			feedbackConversationSubject("idea", secondId),
		);
	});
});
