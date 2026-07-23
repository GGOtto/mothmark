import {toID} from "@/utils/idUtils";
import {createDefaultConditionValue, createDefaultEffectValue} from "./editorCatalogs";

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
});
