import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {EditorRegistries} from "@/types/editor/editorRegistryTypes";
import type {EditorControlContext} from "@/types/universalEditorTypes";
import {DirectionPickerEditor, type DirectionPickerMetadata} from "./SpecializedEditors";

const context: EditorControlContext = {
	mode: "edit",
	registries: {} as EditorRegistries,
	getValue: () => undefined,
	setValue: () => undefined,
};

const metadata: DirectionPickerMetadata = {
	type: "direction-picker",
	title: "Direction",
	features: {
		options: [
			{label: "North", value: "n", opposite: "s"},
			{label: "Northeast", value: "ne", opposite: "sw", diagonal: true},
			{label: "East", value: "e", opposite: "w"},
			{label: "Southeast", value: "se", opposite: "nw", diagonal: true},
			{label: "South", value: "s", opposite: "n"},
			{label: "Southwest", value: "sw", opposite: "ne", diagonal: true},
			{label: "West", value: "w", opposite: "e"},
			{label: "Northwest", value: "nw", opposite: "se", diagonal: true},
			{label: "Up", value: "up", opposite: "down"},
			{label: "Down", value: "down", opposite: "up"},
			{label: "In", value: "in", opposite: "out"},
			{label: "Out", value: "out", opposite: "in"},
		],
	},
};

describe("DirectionPickerEditor", () => {
	it("offers compass and spatial directions from one picker", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<DirectionPickerEditor
				value="n"
				onChange={onChange}
				metadata={metadata}
				path={[]}
				context={context}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "North N"}));
		const dialog = screen.getByRole("dialog", {name: "Choose direction"});
		const compass = within(dialog).getByRole("group", {name: "Compass directions"});
		const spatial = within(dialog).getByRole("group", {name: "Spatial directions"});

		expect(within(compass).getAllByRole("button")).toHaveLength(8);
		expect(within(spatial).getAllByRole("button")).toHaveLength(4);
		await user.click(within(spatial).getByRole("button", {name: "In"}));
		expect(onChange).toHaveBeenCalledWith("in");
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(screen.getByRole("button", {name: "North N"})).toHaveFocus();
	});

	it("supports compass arrow-key navigation", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<DirectionPickerEditor
				value="n"
				onChange={onChange}
				metadata={metadata}
				path={[]}
				context={context}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "North N"}));
		const compass = screen.getByRole("group", {name: "Compass directions"});
		const north = within(compass).getByRole("button", {name: "North"});
		const northeast = within(compass).getByRole("button", {name: "Northeast"});
		north.focus();
		await user.keyboard("{ArrowRight}");
		expect(northeast).toHaveFocus();
		await user.keyboard("{Enter}");
		expect(onChange).toHaveBeenCalledWith("ne");
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	});

	it("removes diagonal values even when schema options do not annotate them", async () => {
		const user = userEvent.setup();
		render(
			<DirectionPickerEditor
				value="n"
				onChange={() => undefined}
				metadata={{
					...metadata,
					features: {
						...metadata.features,
						includeDiagonals: false,
						options: metadata.features?.options?.map((option) => ({
							...option,
							diagonal: undefined,
						})),
					},
				}}
				path={[]}
				context={context}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "North N"}));
		const compass = screen.getByRole("group", {name: "Compass directions"});
		expect(within(compass).getAllByRole("button")).toHaveLength(4);
		expect(within(compass).queryByRole("button", {name: "Northeast"})).not.toBeInTheDocument();
	});

	it("closes on Escape and returns focus to its trigger", async () => {
		const user = userEvent.setup();
		render(
			<DirectionPickerEditor
				value="out"
				onChange={() => undefined}
				metadata={metadata}
				path={[]}
				context={context}
			/>,
		);

		const trigger = screen.getByRole("button", {name: "Out OUT"});
		await user.click(trigger);
		expect(screen.getByRole("dialog", {name: "Choose direction"})).toBeInTheDocument();
		await user.keyboard("{Escape}");

		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(trigger).toHaveFocus();
	});
});
