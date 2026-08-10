import {render} from "@testing-library/react";

import {HomeScrollReset} from "./HomeScrollReset";

describe("HomeScrollReset", () => {
	it("starts the homepage scroller at the top", () => {
		const page = document.createElement("div");
		page.className = "homePage";
		page.scrollTop = 420;
		document.body.append(page);

		render(<HomeScrollReset />);

		expect(page.scrollTop).toBe(0);
		page.remove();
	});
});
