import {sortEditorObjectFields} from "./sortEditorObjectFields";

type SortableField = {
	key: string;
	index: number;
	metadata: {
		control: "input";
		layout?: {
			order?: number;
			pinned?: boolean;
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

	it("uses lower layout order before schema order", () => {
		expect(
			sortedKeys([field("a", 0, {order: 3}), field("b", 1, {order: 1}), field("c", 2, {order: 2})]),
		).toEqual(["b", "c", "a"]);
	});

	it("renders pinned fields before unpinned fields", () => {
		expect(
			sortedKeys([
				field("a", 0, {order: 1}),
				field("b", 1, {order: 99, pinned: true}),
				field("c", 2, {order: 2}),
			]),
		).toEqual(["b", "a", "c"]);
	});

	it("sorts pinned fields by order", () => {
		expect(
			sortedKeys([
				field("a", 0, {order: 2, pinned: true}),
				field("b", 1, {order: 1, pinned: true}),
				field("c", 2, {order: 3}),
			]),
		).toEqual(["b", "a", "c"]);
	});

	it("falls back to schema order when order values match", () => {
		expect(
			sortedKeys([field("a", 0, {order: 1}), field("b", 1, {order: 1}), field("c", 2, {order: 1})]),
		).toEqual(["a", "b", "c"]);
	});
});
