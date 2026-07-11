import {sortEditorObjectFields} from "./sortEditorObjectFields";

type SortableField = {
	key: string;
	index: number;
	metadata: {
		control: "input";
		layout?: {
			order?: number;
		};
	};
};

function field(key: string, index: number, layout?: SortableField["metadata"]["layout"]) {
	return {
		key,
		index,
		metadata: {
			control: "input",
			layout,
		},
	} satisfies SortableField;
}

function sortedKeys(fields: SortableField[]) {
	return sortEditorObjectFields(fields).map((sortableField) => sortableField.key);
}

describe("sortEditorObjectFields", () => {
	it("keeps schema order as the fallback", () => {
		expect(sortedKeys([field("a", 0), field("b", 1), field("c", 2)])).toEqual(["a", "b", "c"]);
	});

	it("uses lower positive layout order before schema order", () => {
		expect(
			sortedKeys([field("a", 0, {order: 3}), field("b", 1, {order: 1}), field("c", 2, {order: 2})]),
		).toEqual(["b", "c", "a"]);
	});

	it("puts positive layout order fields before unranked fields", () => {
		expect(sortedKeys([field("a", 0), field("b", 1, {order: 1}), field("c", 2)])).toEqual([
			"b",
			"a",
			"c",
		]);
	});

	it("keeps unranked fields in schema order after positive ordered fields", () => {
		expect(
			sortedKeys([field("a", 0), field("b", 1, {order: 2}), field("c", 2), field("d", 3, {order: 1})]),
		).toEqual(["d", "b", "a", "c"]);
	});

	it("puts negative layout order fields after unranked fields", () => {
		expect(
			sortedKeys([
				field("a", 0, {order: -1}),
				field("b", 1),
				field("c", 2, {order: 1}),
				field("d", 3),
			]),
		).toEqual(["c", "b", "d", "a"]);
	});

	it("sorts negative layout order fields by ascending order after unranked fields", () => {
		expect(
			sortedKeys([
				field("a", 0, {order: -1}),
				field("b", 1, {order: -3}),
				field("c", 2),
				field("d", 3, {order: -2}),
			]),
		).toEqual(["c", "b", "d", "a"]);
	});

	it("falls back to schema order when order values match", () => {
		expect(
			sortedKeys([field("a", 0, {order: 1}), field("b", 1, {order: 1}), field("c", 2, {order: 1})]),
		).toEqual(["a", "b", "c"]);
	});

	it("treats explicit order 0 like an unranked field", () => {
		expect(
			sortedKeys([field("a", 0), field("b", 1, {order: 0}), field("c", 2, {order: 1}), field("d", 3)]),
		).toEqual(["c", "a", "b", "d"]);
	});

	it("does not mutate the original array", () => {
		const fields = [field("a", 0), field("b", 1, {order: 1})];

		expect(sortedKeys(fields)).toEqual(["b", "a"]);
		expect(fields.map((sortableField) => sortableField.key)).toEqual(["a", "b"]);
	});
});
