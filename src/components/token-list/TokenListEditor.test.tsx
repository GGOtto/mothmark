import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {TokenListEditor} from "./TokenListEditor";

function Editor({tone}: {tone: "aliases" | "tags"}) {
	const [values, setValues] = useState<string[]>([]);
	return (
		<TokenListEditor
			addLabel={tone === "aliases" ? "Add alias" : "Add tag"}
			normalizeValue={
				tone === "tags" ? (value) => value.trim().toLowerCase().replaceAll(" ", "-") : undefined
			}
			onChange={setValues}
			tone={tone}
			values={values}
		/>
	);
}

describe("TokenListEditor", () => {
	it.each([
		["aliases", "Add alias", "Red fruit", "Red fruit"],
		["tags", "Add tag", "Edible Fruit", "edible-fruit"],
	] as const)("uses the shared interaction for %s", async (_toneName, label, typed, stored) => {
		const user = userEvent.setup();
		render(<Editor tone={_toneName} />);

		await user.type(screen.getByRole("textbox", {name: label}), `${typed}{Enter}`);
		expect(screen.getByText(stored)).toBeVisible();
		await user.click(screen.getByRole("button", {name: `Remove ${stored}`}));
		expect(screen.queryByText(stored)).not.toBeInTheDocument();
	});
});
