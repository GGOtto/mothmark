import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {Connection, Layer, Room, World} from "@/schemas/worldSchema";
import {initializeConnectionStubPoints} from "./Connection";
import {Map, type ConnectionDraft} from "./Map";

function applyStateAction<T>(action: React.SetStateAction<T>, current: T): T {
	return typeof action === "function" ? (action as (value: T) => T)(current) : action;
}

function MapHarness({
	initialWorld,
	onZoomChange,
	tool = "pan",
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
	const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
	const [isConnectionSelected, setIsConnectionSelected] = useState(initialIsConnectionSelected);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});

	const setRooms: React.Dispatch<React.SetStateAction<Room[]>> = (action) =>
		setWorld((current) => ({...current, rooms: applyStateAction(action, current.rooms)}));
	const setConnections: React.Dispatch<React.SetStateAction<Connection[]>> = (action) =>
		setWorld((current) => ({
			...current,
			connections: applyStateAction(action, current.connections),
		}));
	const setLayers: React.Dispatch<React.SetStateAction<Layer[]>> = (action) =>
		setWorld((current) => ({
			...current,
			metadata: {
				...current.metadata,
				layers: applyStateAction(action, current.metadata.layers),
			},
		}));

	return (
		<>
			{replacementWorld ? (
				<button type="button" onClick={() => setWorld(replacementWorld)}>
					Replace test world
				</button>
			) : null}
			<Map
				world={world}
				tool={tool}
				onZoomChange={onZoomChange}
				setRooms={setRooms}
				setConnections={setConnections}
				setLayers={setLayers}
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
