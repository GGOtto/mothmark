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

	it("zooms the preview without changing the displayed layer", () => {
		const {container} = renderLayerMenu();
		const preview = screen.getByLabelText("Ground Level preview");
		const viewport = container.querySelector<HTMLElement>(".layerPreviewViewport")!;
		const initialTransform = viewport.style.transform;

		fireEvent.wheel(preview, {clientX: 100, clientY: 100, deltaY: -100});

		expect(screen.getByLabelText("Ground Level preview")).toBeInTheDocument();
		expect(viewport.style.transform).not.toBe(initialTransform);
	});

	it("lets the list snap naturally while selecting the layer nearest its center", () => {
		renderLayerMenu();
		const scrollIntoView = jest.fn();
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		});
		const layerList = screen.getByLabelText("Layers");
		const layerButtons = Array.from(
			layerList.querySelectorAll<HTMLButtonElement>("[data-layer-index]"),
		);
		const rect = (top: number, height: number) =>
			({top, bottom: top + height, left: 0, right: 160, x: 0, y: top, width: 160, height}) as DOMRect;
		jest.spyOn(layerList, "getBoundingClientRect").mockReturnValue(rect(0, 300));
		const buttonRects = layerButtons.map((button) => jest.spyOn(button, "getBoundingClientRect"));
		buttonRects[0].mockReturnValue(rect(50, 44));
		buttonRects[1].mockReturnValue(rect(94, 44));
		buttonRects[2].mockReturnValue(rect(128, 44));

		fireEvent.scroll(layerList);
		expect(screen.getByLabelText("Upper Works preview")).toBeInTheDocument();
		expect(scrollIntoView).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", {name: "Ground Level"}));
		expect(screen.getByLabelText("Ground Level preview")).toBeInTheDocument();
		expect(scrollIntoView).toHaveBeenLastCalledWith({block: "center", inline: "nearest"});

		Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
	});

	it("steps the displayed layer with arrow and page keys", () => {
		renderLayerMenu();

		fireEvent.keyDown(window, {key: "ArrowUp"});
		expect(screen.getByLabelText("Lower Crypts preview")).toBeInTheDocument();
		fireEvent.keyDown(window, {key: "ArrowDown"});
		expect(screen.getByLabelText("Ground Level preview")).toBeInTheDocument();
		fireEvent.keyDown(window, {key: "PageDown"});
		expect(screen.getByLabelText("Lower Crypts preview")).toBeInTheDocument();
		fireEvent.keyDown(window, {key: "PageUp"});
		expect(screen.getByLabelText("Ground Level preview")).toBeInTheDocument();
	});
});
