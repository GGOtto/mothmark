import {fireEvent, render, screen} from "@testing-library/react";
import {world} from "@/data/worlds/exampleWorld";
import {getLayer} from "@/utils/layerUtils";
import {LayerMenu} from "./LayerMenu";

function renderLayerMenu(setIsLayerMenuOpen = jest.fn()) {
	return render(
		<LayerMenu
			world={world}
			currentLayer={getLayer(world, 0)}
			setIsLayerMenuOpen={setIsLayerMenuOpen}
			selectedId={null}
			isConnectionSelected={false}
			setCurrentLayer={jest.fn()}
		/>,
	);
}

describe("LayerMenu", () => {
	it("contains map interaction events", () => {
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
					currentLayer={getLayer(world, 0)}
					setIsLayerMenuOpen={jest.fn()}
					selectedId={null}
					isConnectionSelected={false}
					setCurrentLayer={jest.fn()}
				/>
			</div>,
		);
		const menu = container.querySelector(".layerMenu")!;

		fireEvent.pointerDown(menu);
		fireEvent.pointerMove(menu);
		fireEvent.pointerUp(menu);
		fireEvent.wheel(menu);
		fireEvent.click(menu);

		expect(onPointerDown).not.toHaveBeenCalled();
		expect(onPointerMove).not.toHaveBeenCalled();
		expect(onPointerUp).not.toHaveBeenCalled();
		expect(onWheel).not.toHaveBeenCalled();
		expect(onClick).not.toHaveBeenCalled();
	});

	it("can be closed while its UI is rebuilt", () => {
		const setIsLayerMenuOpen = jest.fn();
		renderLayerMenu(setIsLayerMenuOpen);

		fireEvent.click(screen.getByRole("button", {name: "Close layer menu"}));

		expect(setIsLayerMenuOpen).toHaveBeenCalledWith(false);
	});
});
