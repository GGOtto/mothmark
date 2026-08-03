import {getPartitionSegments, getPartitions} from "./getPartitions";

describe("getPartitions", () => {
	it("returns an empty array for an empty string", () => {
		expect(getPartitions("")).toEqual([]);
	});

	it("returns an empty array for whitespace-only text", () => {
		expect(getPartitions("   \t\n  ")).toEqual([]);
	});

	it("returns one partition for a single word", () => {
		expect(getPartitions("look")).toEqual([["look"]]);
	});

	it("returns every partition for two words", () => {
		expect(getPartitions("pick up")).toEqual([["pick", "up"], ["pick up"]]);
	});

	it("returns every partition for three words", () => {
		expect(getPartitions("pick up sword")).toEqual([
			["pick", "up", "sword"],
			["pick", "up sword"],
			["pick up", "sword"],
			["pick up sword"],
		]);
	});

	it("returns every partition for four words", () => {
		expect(getPartitions("take the red sword")).toEqual([
			["take", "the", "red", "sword"],
			["take", "the", "red sword"],
			["take", "the red", "sword"],
			["take", "the red sword"],
			["take the", "red", "sword"],
			["take the", "red sword"],
			["take the red", "sword"],
			["take the red sword"],
		]);
	});

	it("normalizes leading and trailing whitespace", () => {
		expect(getPartitions("  pick up  ")).toEqual([["pick", "up"], ["pick up"]]);
	});

	it("normalizes repeated whitespace between words", () => {
		expect(getPartitions("pick    up\t sword")).toEqual([
			["pick", "up", "sword"],
			["pick", "up sword"],
			["pick up", "sword"],
			["pick up sword"],
		]);
	});

	it("retains the exact source span for values echoed by command fallbacks", () => {
		expect(getPartitionSegments("  touch silver   skull  ")).toContainEqual([
			{text: "touch", rawText: "touch"},
			{text: "silver skull", rawText: "silver   skull"},
		]);
	});

	it("preserves punctuation as part of its word", () => {
		expect(getPartitions("say hello, world")).toEqual([
			["say", "hello,", "world"],
			["say", "hello, world"],
			["say hello,", "world"],
			["say hello, world"],
		]);
	});

	it("does not mutate previously returned partitions", () => {
		const result = getPartitions("pick up sword");

		result[0]?.push("changed");

		expect(result[1]).toEqual(["pick", "up sword"]);
		expect(result[2]).toEqual(["pick up", "sword"]);
		expect(result[3]).toEqual(["pick up sword"]);
	});

	it("produces 2^(n - 1) partitions for n words", () => {
		expect(getPartitions("one two three four five")).toHaveLength(16);
	});

	it("preserves the original word order in every partition", () => {
		const partitions = getPartitions("one two three four");

		for (const partition of partitions) {
			expect(partition.join(" ")).toBe("one two three four");
		}
	});
});
