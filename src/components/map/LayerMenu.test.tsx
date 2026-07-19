import {fireEvent, render, screen} from "@testing-library/react";
import {world} from "@/data/worlds/exampleWorld";
import {getLayer} from "./utils/layerUtils";
import {LayerMenu} from "./LayerMenu";

function domRect(top: number, height: number) {
	return {
		top,
		bottom: top + height,
		left: 0,
		right: 160,
		x: 0,
		y: top,
		width: 160,
		height,
	} as DOMRect;
}

function renderLayerMenu(setIsLayerMenuOpen = jest.fn(), sourceWorld = world) {
	return render(
		<LayerMenu
			world={sourceWorld}
			currentLayer={getLayer(sourceWorld, 0)}
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

	it("renders the layer stack with upper layers above lower layers", () => {
		renderLayerMenu();
		const layerList = screen.getByLabelText("Layers");
		const buttons = layerList.querySelectorAll("[data-layer-index]");

		expect(buttons).toHaveLength(101);
		expect(buttons[0]).toHaveTextContent("Upper 50");
		expect(buttons[49]).toHaveTextContent("Upper Works");
		expect(buttons[50]).toHaveTextContent("Ground Level");
		expect(buttons[51]).toHaveTextContent("Lower Crypts");
		expect(buttons[100]).toHaveTextContent("Lower 50");
	});

	it("renders a stationary center indicator over the real scroll container", () => {
		const {container} = renderLayerMenu();

		expect(container.querySelector(".layerMenu--left__centerIndicator")).toBeInTheDocument();
		expect(screen.getByLabelText("Layers")).toHaveClass("layerMenu--left");
	});

	it("fills both sides of layer zero when no layers exist", () => {
		const emptyWorld = {...world, metadata: {...world.metadata, layers: []}};
		renderLayerMenu(jest.fn(), emptyWorld);
		const layerList = screen.getByLabelText("Layers");

		expect(layerList.querySelectorAll("[data-layer-index]")).toHaveLength(101);
		expect(screen.getByRole("button", {name: "Upper 50"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Ground"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Lower 50"})).toBeInTheDocument();
	});

	it("selects whichever layer is closest to the center while scrolling", () => {
		renderLayerMenu();
		const layerList = screen.getByLabelText("Layers");
		const buttons = Array.from(layerList.querySelectorAll<HTMLButtonElement>("[data-layer-value]"));
		jest.spyOn(layerList, "getBoundingClientRect").mockReturnValue(domRect(0, 300));
		for (const button of buttons) {
			jest.spyOn(button, "getBoundingClientRect").mockReturnValue(domRect(1000, 44));
		}
		jest
			.spyOn(screen.getByRole("button", {name: "Upper Works"}), "getBoundingClientRect")
			.mockReturnValue(domRect(128, 44));

		fireEvent.scroll(layerList);

		expect(screen.getByLabelText("Upper Works preview")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Upper Works"})).toHaveClass(
			"layerMenu--left__selected",
		);
	});

	it("smoothly centers a clicked layer instead of selecting it off-center", () => {
		renderLayerMenu();
		const upperLayerButton = screen.getByRole("button", {name: "Upper Works"});
		const scrollIntoView = jest.fn();
		Object.defineProperty(upperLayerButton, "scrollIntoView", {value: scrollIntoView});

		fireEvent.click(upperLayerButton);

		expect(screen.getByLabelText("Ground Level preview")).toBeInTheDocument();
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
			inline: "nearest",
		});
	});

	it("steps the displayed layer with arrow and page keys", () => {
		renderLayerMenu();
		const scrollIntoView = jest.fn();
		for (const button of screen.getByLabelText("Layers").querySelectorAll("button")) {
			Object.defineProperty(button, "scrollIntoView", {value: scrollIntoView});
		}

		fireEvent.keyDown(window, {key: "ArrowUp"});
		expect(scrollIntoView).toHaveBeenLastCalledWith({
			behavior: "smooth",
			block: "center",
			inline: "nearest",
		});
		fireEvent.keyDown(window, {key: "ArrowDown"});
		fireEvent.keyDown(window, {key: "PageDown"});
		fireEvent.keyDown(window, {key: "PageUp"});
		expect(scrollIntoView).toHaveBeenCalledTimes(4);
	});
});
