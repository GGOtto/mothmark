import {SESSION_CLIENT_LABEL_CONSTRAINT_SQL} from "../migrations/20260811001400_session_client_labels";

describe("session client labels migration", () => {
	it("keeps derived session labels short", () => {
		expect(SESSION_CLIENT_LABEL_CONSTRAINT_SQL).toContain("char_length(client_label) <= 120");
	});
});
