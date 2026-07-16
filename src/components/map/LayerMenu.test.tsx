import {fireEvent, render, screen} from "@testing-library/react";
import {world} from "@/data/worlds/exampleWorld";
import {LayerMenu} from "./LayerMenu";

describe("LayerMenu", () => {
	it("contains pointer, click, and wheel events so the map cannot handle them", () => {
		const onClick = jest.fn();
		const onPointerDown = jest.fn();
		const onPointerMove = jest.fn();
		const onPointerUp = jest.fn();
		const onWheel = jest.fn();
		const {container} = render(
			<div
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onWheel={onWheel}
			>
				<LayerMenu
					world={world}
					setIsLayerMenuOpen={jest.fn()}
					selectedId={null}
					isConnectionSelected={false}
					setCurrentLayer={jest.fn()}
				/>
			</div>,
		);
		const preview = container.querySelector("[data-layer-preview]")!;

		fireEvent.pointerDown(preview);
		fireEvent.pointerMove(preview);
		fireEvent.pointerUp(preview);
		fireEvent.wheel(preview);
		fireEvent.click(preview);

		expect(onPointerDown).not.toHaveBeenCalled();
		expect(onPointerMove).not.toHaveBeenCalled();
		expect(onPointerUp).not.toHaveBeenCalled();
		expect(onWheel).not.toHaveBeenCalled();
		expect(onClick).not.toHaveBeenCalled();
	});

	it("shows every world layer and switches to the chosen one", () => {
		const setCurrentLayer = jest.fn();
		const setIsLayerMenuOpen = jest.fn();
		render(
			<LayerMenu
				world={world}
				setIsLayerMenuOpen={setIsLayerMenuOpen}
				selectedId={null}
				isConnectionSelected={false}
				setCurrentLayer={setCurrentLayer}
			/>,
		);

		expect(screen.getAllByRole("button", {name: /Open /})).toHaveLength(3);
		fireEvent.click(screen.getByRole("button", {name: "Open Lower Crypts"}));

		expect(setCurrentLayer).toHaveBeenCalledWith(
			expect.objectContaining({name: "Lower Crypts", layer: -1}),
		);
		expect(setIsLayerMenuOpen).toHaveBeenCalledWith(false);
	});
});
