import {NumberBlockSchema, type CommandBlock} from "@/schemas/world/commandSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {matchBlock, matchNumber} from "./blocks";

type NumberBlock = Extract<CommandBlock, {type: "number"}>;

function numberBlock(overrides: Partial<NumberBlock> = {}): NumberBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		role: "amount",
		...overrides,
	};
}

describe("matchNumber", () => {
	it("only matches number blocks", () => {
		const phraseBlock: CommandBlock = {type: "phrase", matches: ["three"]};

		expect(matchNumber("3", phraseBlock)).toBe(false);
	});

	it("matches integers without accepting other JavaScript number syntax", () => {
		const block = numberBlock();

		expect(matchNumber("42", block)).toBe(true);
		expect(matchNumber("-7", block)).toBe(true);
		expect(matchNumber("  +12  ", block)).toBe(true);
		expect(matchNumber("7.0", block)).toBe(true);
		expect(matchNumber("1.5", block)).toBe(false);
		expect(matchNumber("1e3", block)).toBe(false);
		expect(matchNumber("0xff", block)).toBe(false);
		expect(matchNumber("", block)).toBe(false);
	});

	it("matches digit and written decimals", () => {
		const block = numberBlock({numberType: "decimal"});

		expect(matchNumber("4", block)).toBe(true);
		expect(matchNumber(".75", block)).toBe(true);
		expect(matchNumber("-2.5", block)).toBe(true);
		expect(matchNumber("three point five", block)).toBe(true);
	});

	it("matches written integers when allowed", () => {
		const block = numberBlock();

		expect(matchNumber("Three", block)).toBe(true);
		expect(matchNumber("twenty-one", block)).toBe(true);
		expect(matchNumber("one hundred and five", block)).toBe(true);
		expect(matchNumber("two thousand", block)).toBe(true);
		expect(matchNumber("twenty ten", block)).toBe(false);
	});

	it("rejects written numbers when they are disabled", () => {
		const block = numberBlock({allowWords: false});

		expect(matchNumber("three", block)).toBe(false);
		expect(matchNumber("3", block)).toBe(true);
	});

	it("applies inclusive minimum and maximum bounds", () => {
		const block = numberBlock({min: 2, max: 4});

		expect(matchNumber("1", block)).toBe(false);
		expect(matchNumber("2", block)).toBe(true);
		expect(matchNumber("four", block)).toBe(true);
		expect(matchNumber("5", block)).toBe(false);
	});

	it("is used by the generic block matcher", () => {
		expect(matchBlock("three", numberBlock())).toBe(true);
	});
});
