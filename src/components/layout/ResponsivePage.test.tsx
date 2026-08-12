import {render, screen} from "@testing-library/react";

import {PageShell, PageShellBody, PageShellHeader} from "./ResponsivePage";

describe("ResponsivePage", () => {
	it("composes a semantic pinned-header page with a scrolling body", () => {
		render(
			<PageShell as="main" variant="catalog" aria-label="World catalog">
				<PageShellHeader>
					<h1>Worlds</h1>
				</PageShellHeader>
				<PageShellBody data-testid="body">Catalog content</PageShellBody>
			</PageShell>,
		);

		expect(screen.getByRole("main", {name: "World catalog"})).toHaveClass(
			"pageShell",
			"pageShell--catalog",
		);
		expect(screen.getByRole("banner")).toHaveClass("pageShellHeader");
		expect(screen.getByTestId("body")).toHaveClass("pageShellBody");
	});
});
