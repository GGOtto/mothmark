import {toID} from "@/utils/idUtils";
import {
	parseVariableText,
	serializeVariableReference,
	serializeVariableText,
	variableReferencesInText,
} from "./syntax";

describe("command variable token syntax", () => {
	it("round-trips scalar and projected UUID references without storing labels", () => {
		const target = toID("command-block", "2aa0c5a7-44e8-4fd5-8b31-769735ec6f39");
		const value = `Touch {variable ${target.id} name}: {variable ${target.id} description}`;

		const nodes = parseVariableText(value);

		expect(serializeVariableText(nodes)).toBe(value);
		expect(variableReferencesInText(value)).toEqual([
			{blockId: target, projection: "name"},
			{blockId: target, projection: "description"},
		]);
	});

	it("leaves ordinary braces and malformed tokens as authored text", () => {
		const value = "Keep {message}, {variable}, and {variable block nickname}.";

		expect(parseVariableText(value)).toEqual([{type: "text", value}]);
	});

	it("serializes failed-block input as an explicit text projection", () => {
		expect(
			serializeVariableReference({
				blockId: toID("command-block", "failed-target"),
				projection: "text",
			}),
		).toBe("{variable failed-target text}");
	});
});
