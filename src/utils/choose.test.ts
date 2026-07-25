import {choose} from "./choose";

describe("choose", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("returns undefined for an empty array", () => {
		expect(choose([])).toBeUndefined();
	});

	it("returns the only element in a single-element array", () => {
		jest.spyOn(Math, "random").mockReturnValue(0.75);

		expect(choose(["only"])).toBe("only");
	});

	it("returns the first element when Math.random returns 0", () => {
		jest.spyOn(Math, "random").mockReturnValue(0);

		expect(choose(["first", "second", "third"])).toBe("first");
	});

	it("returns the expected middle element", () => {
		jest.spyOn(Math, "random").mockReturnValue(0.5);

		expect(choose(["first", "second", "third"])).toBe("second");
	});

	it("returns the last element when Math.random is close to 1", () => {
		jest.spyOn(Math, "random").mockReturnValue(0.999999);

		expect(choose(["first", "second", "third"])).toBe("third");
	});

	it("works with non-string values", () => {
		const values = [{id: 1}, {id: 2}, {id: 3}];

		jest.spyOn(Math, "random").mockReturnValue(0.4);

		expect(choose(values)).toBe(values[1]);
	});

	it("calls Math.random once", () => {
		const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

		choose([1, 2, 3]);

		expect(randomSpy).toHaveBeenCalledTimes(1);
	});
});
