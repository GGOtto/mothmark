import {
	addPoints,
	getDistance,
	getMidpoint,
	multiplyPoints,
	scalePoint,
	subtractPoints,
} from "./pointUtils";

describe("pointUtils", () => {
	describe("point math helpers", () => {
		test("addPoints adds x and y values", () => {
			expect(addPoints({x: 2, y: 3}, {x: 4, y: 5})).toEqual({
				x: 6,
				y: 8,
			});
		});

		test("subtractPoints subtracts x and y values", () => {
			expect(subtractPoints({x: 8, y: 6}, {x: 3, y: 2})).toEqual({
				x: 5,
				y: 4,
			});
		});

		test("scalePoint multiplies x and y by a scalar", () => {
			expect(scalePoint({x: 3, y: -4}, 2)).toEqual({
				x: 6,
				y: -8,
			});
		});

		test("multiplyPoints multiplies matching coordinates", () => {
			expect(multiplyPoints({x: 3, y: 4}, {x: 5, y: -2})).toEqual({
				x: 15,
				y: -8,
			});
		});

		test("getMidpoint returns the midpoint between two points", () => {
			expect(getMidpoint({x: 0, y: 0}, {x: 10, y: 20})).toEqual({
				x: 5,
				y: 10,
			});
		});

		test("getDistance returns the distance between two points", () => {
			expect(getDistance({x: 0, y: 0}, {x: 3, y: 4})).toBe(5);
		});

		test("getDistance works with negative coordinates", () => {
			expect(getDistance({x: -1, y: -2}, {x: 2, y: 2})).toBe(5);
		});
	});
});
