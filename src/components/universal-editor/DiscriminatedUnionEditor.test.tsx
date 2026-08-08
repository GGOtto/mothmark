import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {
	DiscriminatedUnionEditor,
	type DiscriminatedUnionControlMetadata,
} from "./DiscriminatedUnionEditor";

const metadata: DiscriminatedUnionControlMetadata = {
	type: "discriminated-union",
	title: "Take when",
	features: {
		discriminator: "type",
		options: [{label: "Flag", value: "flag", defaultValue: {operation: "true"}, fields: []}],
	},
};

function OptionalUnion() {
	const [value, setValue] = useState<Record<string, unknown> | undefined>();
	return (
		<DiscriminatedUnionEditor
			value={value}
			onChange={setValue}
			metadata={metadata}
			path={["condition"]}
			context={{mode: "edit", getValue: () => undefined, setValue: () => undefined}}
		/>
	);
}

describe("DiscriminatedUnionEditor", () => {
	it("offers to create an unset optional condition", () => {
		render(<OptionalUnion />);
		fireEvent.click(screen.getByRole("button", {name: "Add condition"}));
		expect(screen.getByRole("combobox")).toHaveValue("flag");
	});
});
