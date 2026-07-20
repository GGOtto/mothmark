import {fireEvent, render, screen} from "@testing-library/react";
import {useCallback, useState} from "react";
import {produce} from "immer";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld, WorldUpdate} from "@/types/worldUpdaterTypes";
import {idValue} from "@/utils/idUtils";
import {initializeConnectionStubPoints} from "./Connection";
import {Map, type ConnectionDraft} from "./Map";

function MapHarness({
	initialWorld,
	onZoomChange,
	tool = "edit",
	initialSelectedId = null,
	initialIsConnectionSelected = false,
	replacementWorld,
}: {
	initialWorld: World;
	onZoomChange: jest.Mock;
	tool?: "edit" | "pan";
	initialSelectedId?: string | null;
	initialIsConnectionSelected?: boolean;
	replacementWorld?: World;
}) {
	const [world, setWorld] = useState(initialWorld);
	const [activeTool, setActiveTool] = useState(tool);
	const [temporaryTool, setTemporaryTool] = useState<"edit" | "pan" | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
	const [isConnectionSelected, setIsConnectionSelected] = useState(initialIsConnectionSelected);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});

	const updateWorld = useCallback<UpdateWorld>((update: WorldUpdate) => {
		setWorld((current) => (typeof update === "function" ? produce(current, update) : update));
	}, []);

	return (
		<>
			<div data-testid="effective-map-tool">{temporaryTool ?? activeTool}</div>
			<div data-testid="start-room-id">{idValue(world.startRoomId)}</div>
			{replacementWorld ? (
				<button type="button" onClick={() => setWorld(replacementWorld)}>
					Replace test world
				</button>
			) : null}
			<Map
				world={world}
				tool={activeTool}
				onToolChange={setActiveTool}
				onTemporaryToolChange={setTemporaryTool}
				onZoomChange={onZoomChange}
				updateWorld={updateWorld}
				selectedId={selectedId}
				setSelectedId={setSelectedId}
				isConnectionSelected={isConnectionSelected}
				setIsConnectionSelected={setIsConnectionSelected}
				connectionDraft={connectionDraft}
				setConnectionDraft={setConnectionDraft}
				updateStatus={jest.fn()}
				recenterRequest={0}
			/>
		</>
	);
}

describe("Map layer viewports", () => {
	it("restores each layer's viewport after switching layers", () => {
		const groundLayer = exampleWorld.metadata.layers.find((layer) => layer.layer === 0)!;
		const upperLayer = exampleWorld.metadata.layers.find((layer) => layer.layer === 1)!;
		const initialWorld: World = {
			...exampleWorld,
			metadata: {
				...exampleWorld.metadata,
				layers: exampleWorld.metadata.layers.map((layer) => {
					if (layer.layer === groundLayer.layer) {
						return {...layer, viewport: {x: 10, y: 20, zoom: 1}};
					}
					if (layer.layer === upperLayer.layer) {
						return {...layer, viewport: {x: 30, y: 40, zoom: 1.5}};
					}
					return layer;
				}),
			},
		};
		const onZoomChange = jest.fn();
		const {container} = render(
			<MapHarness initialWorld={initialWorld} onZoomChange={onZoomChange} />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const mapViewport = container.querySelector<HTMLElement>(".mapViewport")!;

		expect(mapViewport).toHaveStyle({transform: "translate(10px, 20px) scale(1)"});

		fireEvent.click(screen.getByRole("button", {name: `Switch to ${upperLayer.name}`}));
		expect(mapViewport).toHaveStyle({transform: "translate(30px, 40px) scale(1.5)"});

		fireEvent.wheel(map, {clientX: 0, clientY: 0, deltaY: -200});
		const updatedUpperTransform = mapViewport.style.transform;
		expect(updatedUpperTransform).not.toBe("translate(30px, 40px) scale(1.5)");

		fireEvent.click(screen.getByRole("button", {name: `Switch to ${groundLayer.name}`}));
		expect(mapViewport).toHaveStyle({transform: "translate(10px, 20px) scale(1)"});

		fireEvent.click(screen.getByRole("button", {name: `Switch to ${upperLayer.name}`}));
		expect(mapViewport.style.transform).toBe(updatedUpperTransform);
	});
});

describe("Map visual layers", () => {
	it("makes the first room added after an empty clear the start room", () => {
		const onlyRoom = exampleWorld.rooms[0];
		const initialWorld: World = {
			...exampleWorld,
			startRoomId: onlyRoom.id,
			rooms: [onlyRoom],
			connections: [],
			metadata: {
				...exampleWorld.metadata,
				layers: [
					{
						...exampleWorld.metadata.layers.find((layer) => layer.layer === 0)!,
						rooms: [onlyRoom.id],
					},
				],
			},
		};
		const {container} = render(<MapHarness initialWorld={initialWorld} onZoomChange={jest.fn()} />);

		fireEvent.click(screen.getByRole("button", {name: "Clear Ground Level layer"}));
		fireEvent.click(container.querySelector<HTMLElement>("[data-map]")!, {
			clientX: 100,
			clientY: 100,
		});

		expect(screen.getByTestId("start-room-id")).toHaveTextContent("room-1");
		expect(screen.getByRole("button", {name: "Room 1"})).toBeInTheDocument();
	});

	it("clears every room from the active layer", () => {
		const groundLayer = exampleWorld.metadata.layers.find((layer) => layer.layer === 0)!;
		const upperLayer = exampleWorld.metadata.layers.find((layer) => layer.layer === 1)!;
		const groundRoomNames = exampleWorld.rooms
			.filter((room) => groundLayer.rooms.some((roomId) => roomId.id === room.id.id))
			.map((room) => room.name);
		const upperLayerRoom = exampleWorld.rooms.find((room) =>
			upperLayer.rooms.some((roomId) => roomId.id === room.id.id),
		)!;

		render(<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} />);

		fireEvent.click(screen.getByRole("button", {name: `Clear ${groundLayer.name} layer`}));

		for (const roomName of groundRoomNames) {
			expect(screen.queryByRole("button", {name: roomName})).not.toBeInTheDocument();
		}

		fireEvent.click(screen.getByRole("button", {name: `Switch to ${upperLayer.name}`}));
		expect(screen.getByRole("button", {name: upperLayerRoom.name})).toBeInTheDocument();
	});

	it("switches tools with horizontal arrows", () => {
		const {container} = render(
			<>
				<button type="button">Focused control</button>
				<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="edit" />
			</>,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const focusedControl = screen.getByRole("button", {name: "Focused control"});
		focusedControl.focus();

		expect(map).toHaveClass("map--tool-edit");
		fireEvent.keyDown(focusedControl, {key: "ArrowRight"});
		expect(map).toHaveClass("map--tool-pan");
		expect(focusedControl).toHaveFocus();
		fireEvent.keyDown(focusedControl, {key: "ArrowLeft"});
		expect(map).toHaveClass("map--tool-edit");
		expect(focusedControl).toHaveFocus();
	});

	it("ignores horizontal touchpad wheel gestures", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="pan" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const viewport = container.querySelector<HTMLElement>(".mapViewport")!;
		const initialTransform = viewport.style.transform;

		const horizontalWheel = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			deltaX: 120,
			deltaY: 4,
		});
		map.dispatchEvent(horizontalWheel);

		expect(horizontalWheel.defaultPrevented).toBe(true);
		expect(viewport.style.transform).toBe(initialTransform);
	});

	it("temporarily toggles tools while Space is held and restores the selected tool", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="edit" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--tool-pan");
		expect(screen.getByTestId("effective-map-tool")).toHaveTextContent("pan");
		fireEvent.keyUp(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--tool-edit");
		expect(screen.getByTestId("effective-map-tool")).toHaveTextContent("edit");
	});

	it("temporarily edits from pan mode while Space is held", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="pan" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--tool-edit");
		expect(screen.getByTestId("effective-map-tool")).toHaveTextContent("edit");
		fireEvent.keyUp(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--tool-pan");
		expect(screen.getByTestId("effective-map-tool")).toHaveTextContent("pan");
	});

	it("ends an active temporary pan when Space is released", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="edit" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		map.setPointerCapture = jest.fn();

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 100,
			clientY: 100,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(map, pointerDown);
		expect(map).toHaveClass("map--panning");

		fireEvent.keyUp(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--tool-edit");
		expect(map).not.toHaveClass("map--panning");

		const pointerUp = new MouseEvent("pointerup", {bubbles: true, clientX: 176, clientY: 311});
		Object.defineProperty(pointerUp, "pointerId", {value: 1});
		fireEvent(map, pointerUp);
		fireEvent.click(map, {clientX: 176, clientY: 311});
		expect(screen.queryByRole("button", {name: "Room 12"})).not.toBeInTheDocument();
	});

	it("does not retain focus or select a stub when Space temporarily enables edit mode", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="pan" />,
		);
		const stub = container.querySelector<SVGGElement>(
			'.mapSvgStubs .connectionStub[data-room-id="dungeon-entrance"] .connectionLayerTag',
		)!;
		stub.focus();

		fireEvent.keyDown(stub, {key: " ", code: "Space"});

		expect(stub).not.toHaveFocus();
		expect(screen.getByTestId("effective-map-tool")).toHaveTextContent("edit");
		expect(container.querySelector(".connectionSelected")).not.toBeInTheDocument();
		fireEvent.keyUp(stub, {key: " ", code: "Space"});
	});

	it("prevents map controls from taking pointer focus while Space is held", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="pan" />,
		);

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		const room = screen.getByRole("button", {name: "Dungeon Entrance"});
		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 100,
			clientY: 100,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		room.setPointerCapture = jest.fn();

		fireEvent(room, pointerDown);
		room.focus();

		expect(pointerDown.defaultPrevented).toBe(true);
		expect(room).not.toHaveFocus();
		expect(container.querySelector("[data-map]")).toHaveClass("map--tool-edit");
		fireEvent.keyUp(window, {key: " ", code: "Space"});
	});

	it("pans from a stub without moving the stub in pan mode", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="pan" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const viewport = container.querySelector<HTMLElement>(".mapViewport")!;
		const stub = container.querySelector<SVGGElement>(
			'.mapSvgStubs .connectionStub[data-room-id="dungeon-entrance"] .connectionLayerTag',
		)!;
		const initialStubTransform = stub.getAttribute("transform");
		map.setPointerCapture = jest.fn();

		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 100,
			clientY: 100,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(stub, pointerDown);
		const pointerMove = new MouseEvent("pointermove", {
			bubbles: true,
			clientX: 140,
			clientY: 125,
		});
		Object.defineProperty(pointerMove, "pointerId", {value: 1});
		fireEvent(map, pointerMove);

		expect(stub).toHaveAttribute("transform", initialStubTransform);
		expect(viewport).toHaveStyle({transform: "translate(74px, 39px) scale(1)"});
	});

	it("steps the active map layer with arrow and page keys", () => {
		render(<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} />);

		fireEvent.keyDown(window, {key: "ArrowUp"});
		expect(screen.getByRole("button", {name: "Layers · Lower Crypts"})).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Lower Crypts");
		fireEvent.keyDown(window, {key: "ArrowDown"});
		expect(screen.getByRole("button", {name: "Layers · Ground Level"})).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Ground Level");
		fireEvent.keyDown(window, {key: "PageDown"});
		expect(screen.getByRole("button", {name: "Layers · Lower Crypts"})).toBeInTheDocument();
		fireEvent.keyDown(window, {key: "PageUp"});
		expect(screen.getByRole("button", {name: "Layers · Ground Level"})).toBeInTheDocument();
	});

	it("renders the layer menu over the shared toolbar and map area", () => {
		const {container} = render(
			<div className="editorMapArea">
				<div data-testid="map-toolbar" />
				<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} />
			</div>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Layers · Ground Level"}));

		const menu = container.querySelector(".layerMenu");
		expect(menu).toBeInTheDocument();
		expect(menu?.parentElement).toHaveClass("editorMapArea");
	});

	it("renders connection paths below stubs and rooms above both", () => {
		const {container} = render(<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} />);
		const connections = container.querySelector(".mapSvgConnections")!;
		const stubPaths = container.querySelector(".mapSvgStubPaths")!;
		const room = container.querySelector(".roomCard")!;
		const stubs = container.querySelector(".mapSvgStubs")!;

		expect(connections.querySelector(".connectionPath")).toBeInTheDocument();
		expect(stubPaths.querySelector(".connectionPath")).toBeInTheDocument();
		expect(stubs.querySelector(".connectionLayerTag")).toBeInTheDocument();
		expect(
			connections.compareDocumentPosition(stubPaths) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(stubPaths.compareDocumentPosition(stubs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(stubs.compareDocumentPosition(room) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("leaves cross-layer stubs fixed when their room is dragged", () => {
		const {container} = render(
			<MapHarness initialWorld={exampleWorld} onZoomChange={jest.fn()} tool="edit" />,
		);
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const room = screen.getByRole("button", {name: "Dungeon Entrance"});
		const getStubTransforms = () =>
			Array.from(
				container.querySelectorAll(
					'.mapSvgStubs .connectionStub[data-room-id="dungeon-entrance"] .connectionLayerTag',
				),
			).map((stub) => stub.getAttribute("transform"));
		const stubTransforms = getStubTransforms();
		room.setPointerCapture = jest.fn();

		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 134,
			clientY: 199,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(room, pointerDown);
		const pointerMove = new MouseEvent("pointermove", {
			bubbles: true,
			clientX: 174,
			clientY: 229,
		});
		Object.defineProperty(pointerMove, "pointerId", {value: 1});
		fireEvent(map, pointerMove);

		expect(room).toHaveStyle({left: "140px", top: "215px"});
		expect(getStubTransforms()).toEqual(stubTransforms);
	});

	it("initializes stubs again when the loaded world replaces a world with the same IDs", () => {
		const worldWithPersistedStubs: World = {
			...exampleWorld,
			connections: exampleWorld.connections.map((connection) =>
				initializeConnectionStubPoints(exampleWorld, connection),
			),
		};
		const {container} = render(
			<MapHarness
				initialWorld={worldWithPersistedStubs}
				replacementWorld={exampleWorld}
				onZoomChange={jest.fn()}
				tool="edit"
			/>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Replace test world"}));
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const room = screen.getByRole("button", {name: "Dungeon Entrance"});
		const getStubTransforms = () =>
			Array.from(
				container.querySelectorAll(
					'.mapSvgStubs .connectionStub[data-room-id="dungeon-entrance"] .connectionLayerTag',
				),
			).map((stub) => stub.getAttribute("transform"));
		const stubTransforms = getStubTransforms();
		room.setPointerCapture = jest.fn();

		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 134,
			clientY: 199,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(room, pointerDown);
		const pointerMove = new MouseEvent("pointermove", {
			bubbles: true,
			clientX: 174,
			clientY: 229,
		});
		Object.defineProperty(pointerMove, "pointerId", {value: 1});
		fireEvent(map, pointerMove);

		expect(getStubTransforms()).toEqual(stubTransforms);
	});

	it("moves a selected connection above rooms and returns it to its base layer when unselected", () => {
		const {container} = render(
			<MapHarness
				initialWorld={exampleWorld}
				onZoomChange={jest.fn()}
				tool="edit"
				initialSelectedId="entrance-guardroom"
				initialIsConnectionSelected
			/>,
		);
		const selectedLayer = container.querySelector(".mapSvgSelectedConnection")!;
		const baseLayer = container.querySelector(".mapSvgConnections")!;
		const room = screen.getByRole("button", {name: "Dungeon Entrance"});
		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const baseConnectionCount = baseLayer.querySelectorAll(".connection").length;

		expect(selectedLayer.querySelector(".connectionSelected")).toBeInTheDocument();
		expect(
			room.compareDocumentPosition(selectedLayer) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		room.setPointerCapture = jest.fn();
		const pointerDown = new MouseEvent("pointerdown", {bubbles: true, button: 0});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(room, pointerDown);
		const pointerUp = new MouseEvent("pointerup", {bubbles: true});
		Object.defineProperty(pointerUp, "pointerId", {value: 1});
		fireEvent(map, pointerUp);

		expect(selectedLayer.querySelector(".connection")).not.toBeInTheDocument();
		expect(baseLayer.querySelectorAll(".connection")).toHaveLength(baseConnectionCount + 1);
		expect(room).toHaveClass("roomCardSelected");
	});

	it("keeps a selected connection's stub above its selected path", () => {
		const {container} = render(
			<MapHarness
				initialWorld={exampleWorld}
				onZoomChange={jest.fn()}
				initialSelectedId="entrance-cistern"
				initialIsConnectionSelected
			/>,
		);
		const selectedPath = container.querySelector(".mapSvgSelectedConnection")!;
		const selectedStub = container.querySelector(".mapSvgSelectedStub")!;

		expect(selectedPath.querySelector(".connectionPath")).toBeInTheDocument();
		expect(selectedStub.querySelector(".connectionLayerTag")).toBeInTheDocument();
		expect(
			selectedPath.compareDocumentPosition(selectedStub) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});
