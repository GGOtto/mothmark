import {fireEvent, render, screen} from "@testing-library/react";
import {world} from "@/data/worlds/initialWorld";
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

function renderLayerMenu(
	setIsLayerMenuOpen = jest.fn(),
	sourceWorld = world,
	renameLayer = jest.fn(),
	setCurrentLayer = jest.fn(),
	onClearLayer = jest.fn(),
) {
	return render(
		<LayerMenu
			world={sourceWorld}
			currentLayer={getLayer(sourceWorld, 0)}
			setIsLayerMenuOpen={setIsLayerMenuOpen}
			selectedId={null}
			isConnectionSelected={false}
			setCurrentLayer={setCurrentLayer}
			renameLayer={renameLayer}
			onClearLayer={onClearLayer}
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
					renameLayer={jest.fn()}
					onClearLayer={jest.fn()}
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

	it("renames the displayed layer", () => {
		const renameLayer = jest.fn();
		renderLayerMenu(jest.fn(), world, renameLayer);

		fireEvent.change(screen.getByRole("textbox", {name: "Layer name"}), {
			target: {value: "Street level"},
		});

		expect(screen.getByRole("textbox", {name: "Layer name"})).toHaveValue("Street level");
		expect(renameLayer).toHaveBeenLastCalledWith(
			expect.objectContaining({layer: 0, name: "Street level"}),
		);
	});

	it("keeps the clear action inside the layer menu", () => {
		const onClearLayer = jest.fn();
		renderLayerMenu(jest.fn(), world, jest.fn(), jest.fn(), onClearLayer);

		fireEvent.click(screen.getByRole("button", {name: "Clear layer"}));

		expect(onClearLayer).toHaveBeenCalledWith(expect.objectContaining({name: "Main floor"}));
	});

	it("keeps the preview static and opens its displayed layer when clicked", () => {
		const setIsLayerMenuOpen = jest.fn();
		const setCurrentLayer = jest.fn();
		const {container} = renderLayerMenu(setIsLayerMenuOpen, world, jest.fn(), setCurrentLayer);
		const preview = screen.getByRole("button", {name: "Open Main floor"});
		const viewport = container.querySelector<HTMLElement>(".layerPreviewViewport")!;
		const initialTransform = viewport.style.transform;

		fireEvent.wheel(preview, {clientX: 100, clientY: 100, deltaY: -100});

		expect(viewport.style.transform).toBe(initialTransform);
		fireEvent.click(preview);
		expect(setCurrentLayer).toHaveBeenCalledWith(expect.objectContaining({name: "Main floor"}));
		expect(setIsLayerMenuOpen).toHaveBeenCalledWith(false);
	});

	it("renders the layer stack with upper layers above lower layers", () => {
		renderLayerMenu();
		const layerList = screen.getByLabelText("Layers");
		const buttons = layerList.querySelectorAll("[data-layer-index]");

		expect(buttons).toHaveLength(101);
		expect(buttons[0]).toHaveTextContent("Upper 50");
		expect(buttons[49]).toHaveTextContent("Upstairs");
		expect(buttons[50]).toHaveTextContent("Main floor");
		expect(buttons[51]).toHaveTextContent("Basement");
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
			.spyOn(screen.getByRole("button", {name: "Upstairs"}), "getBoundingClientRect")
			.mockReturnValue(domRect(128, 44));

		fireEvent.scroll(layerList);

		expect(screen.getByRole("button", {name: "Open Upstairs"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Upstairs"})).toHaveClass("layerMenu--left__selected");
	});

	it("smoothly centers a clicked layer instead of selecting it off-center", () => {
		renderLayerMenu();
		const upperLayerButton = screen.getByRole("button", {name: "Upstairs"});
		const scrollIntoView = jest.fn();
		Object.defineProperty(upperLayerButton, "scrollIntoView", {value: scrollIntoView});

		fireEvent.click(upperLayerButton);

		expect(screen.getByRole("button", {name: "Open Main floor"})).toBeInTheDocument();
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
