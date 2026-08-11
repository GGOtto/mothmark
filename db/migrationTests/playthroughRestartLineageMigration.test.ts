import {PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL} from "../migrations/20260811003100_playthrough_restart_lineage";

describe("playthrough restart lineage migration", () => {
	it("requires complete, non-self restart metadata", () => {
		expect(PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL).toContain(
			"restarted_from_playthrough_id <> id",
		);
		expect(PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL).toContain("restart_request_id is not null");
		expect(PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL).toContain("'release_notice'");
		expect(PLAYTHROUGH_RESTART_LINEAGE_CONSTRAINT_SQL).toContain("'replay_completed'");
	});
});
