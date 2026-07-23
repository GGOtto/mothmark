import {toID} from "@/utils/idUtils";
import {
	createDefaultConditionValue,
	createDefaultEffectValue,
	effectTypeOptions,
} from "./editorCatalogs";

describe("editor catalog reference defaults", () => {
	it("creates typed IDs for condition references", () => {
		expect(createDefaultConditionValue("current-room")).toMatchObject({
			roomId: toID("room", ""),
		});
		expect(createDefaultConditionValue("flag")).toMatchObject({
			"flag-type": "normal",
			flag: "",
		});
	});

	it("creates typed IDs for effect references", () => {
		expect(createDefaultEffectValue("room")).toMatchObject({
			roomId: toID("room", ""),
		});
		expect(createDefaultEffectValue("feature")).toMatchObject({
			roomId: toID("room", ""),
			featureId: toID("feature", ""),
		});
	});

	it("creates the complete field shape for operation-specific effects", () => {
		expect(createDefaultEffectValue("player", undefined, "freeze")).toEqual({
			type: "player",
			operation: "freeze",
			freezeMessage: undefined,
			turns: undefined,
		});
		expect(effectTypeOptions.map((option) => option.value)).not.toContain("group");
		expect(createDefaultEffectValue("effect-ref")).toEqual({
			type: "effect-ref",
			effectId: toID("effect", ""),
		});
	});
});
