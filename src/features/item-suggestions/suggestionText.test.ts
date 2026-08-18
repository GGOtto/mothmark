import {normalizeSuggestionText} from "./suggestionText";

describe("suggestion text normalization", () => {
	it("normalizes straight and curly possessives without creating a stray s token", () => {
		expect(normalizeSuggestionText("The shepherd's flute")).toBe("shepherd flute");
		expect(normalizeSuggestionText("The shepherd’s flute")).toBe("shepherd flute");
	});
});
