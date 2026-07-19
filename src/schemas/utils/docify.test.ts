import {docify} from "./docify";

describe("schema docify", () => {
	it("removes common leading whitespace from all lines", () => {
		const input = `
    Hello
    World
    `;
		const expected = `
Hello
World
`;
		expect(docify(input)).toBe(expected);
	});

	it("preserves relative indentation between lines", () => {
		const input = ["    Level 1", "        Level 2", "    Back to 1"].join("\n");

		const expected = ["Level 1", "    Level 2", "Back to 1"].join("\n");

		expect(docify(input)).toBe(expected);
	});

	it("handles lines with no indentation", () => {
		const input = "Line 1\nLine 2\nLine 3";
		expect(docify(input)).toBe("Line 1\nLine 2\nLine 3");
	});

	it("ignores blank lines when computing minimum indent", () => {
		const input = ["    Hello", "", "    World"].join("\n");

		const expected = ["Hello", "", "World"].join("\n");

		expect(docify(input)).toBe(expected);
	});

	it("handles tabs as indentation", () => {
		const input = "  \t\tHello\n  \t\tWorld";
		const expected = "Hello\nWorld";
		expect(docify(input)).toBe(expected);
	});

	it("returns an empty string when given an empty string", () => {
		expect(docify("")).toBe("");
	});

	it("handles a single line with no newlines", () => {
		expect(docify("    Just one line")).toBe("Just one line");
	});

	it("handles a string that is all whitespace", () => {
		const input = "  \n  \n  ";
		expect(docify(input)).toBe("\n\n");
	});
});
