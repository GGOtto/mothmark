import {fireEvent, render, screen} from "@testing-library/react";
import {ConnectionSchema, RoomSchema} from "../../schemas/world/roomSchema";
import {DefaultViewport} from "../../schemas/world/worldSchema";
import {createDefaultFieldObject} from "../../utils/createDefaultFieldObject";
import {world as exampleWorld} from "../../data/worlds/exampleWorld";
import {getLayer} from "./utils/layerUtils";
import {idValue} from "../../utils/idUtils";
import {
	Connection,
	getConnectionVisualBounds,
	getStubTagAnchorOffset,
	initializeConnectionStubPoints,
} from "./Connection";

describe("connection visual bounds", () => {
	it("include cross-layer stub tags beyond the room cards", () => {
		const upperLayer = getLayer(exampleWorld, 1);
		const rooms = exampleWorld.rooms.filter((room) =>
			upperLayer.rooms.some((roomId) => idValue(roomId) === idValue(room.id)),
		);
		const roomMinX = Math.min(...rooms.map((room) => room.metadata.position.x - 64));
		const roomMaxX = Math.max(...rooms.map((room) => room.metadata.position.x + 64));
		const bounds = getConnectionVisualBounds(exampleWorld, upperLayer)!;

		expect(bounds.minX).toBeLessThan(roomMinX);
		expect(bounds.maxX).toBeGreaterThan(roomMaxX);
	});
});

describe("cross-layer stub positions", () => {
	it("chooses automatic positions once and then preserves them", () => {
		const connection = {...exampleWorld.connections[0], metadata: {}};
		const initialized = initializeConnectionStubPoints(exampleWorld, connection);

		expect(initialized.metadata.fromLayerStubPoint).toBeDefined();
		expect(initialized.metadata.toLayerStubPoint).toBeDefined();
		expect(
			initializeConnectionStubPoints(
				{
					...exampleWorld,
					connections: exampleWorld.connections.map((candidate) =>
						idValue(candidate.id) === idValue(initialized.id) ? initialized : candidate,
					),
				},
				initialized,
			),
		).toBe(initialized);
	});

	it("uses a separate persisted position on each endpoint layer", () => {
		const roomDefaults = createDefaultFieldObject(RoomSchema);
		const fromRoom = RoomSchema.parse({
			...roomDefaults,
			id: "room-from",
			name: "Lower Room",
			metadata: {position: {x: 40, y: 40}},
		});
		const toRoom = RoomSchema.parse({
			...roomDefaults,
			id: "room-to",
			name: "Upper Room",
			metadata: {position: {x: 200, y: 40}},
		});
		const connection = ConnectionSchema.parse({
			...createDefaultFieldObject(ConnectionSchema),
			id: "connection-split",
			fromRoomId: fromRoom.id,
			toRoomId: toRoom.id,
			direction: "up",
			returnDirection: "down",
			metadata: {
				fromLayerStubPoint: {x: 75, y: 90},
				toLayerStubPoint: {x: 325, y: 410},
			},
		});
		const fromLayer = {
			name: "Lower",
			layer: 0,
			rooms: [fromRoom.id],
			viewport: DefaultViewport,
		};
		const toLayer = {
			name: "Upper",
			layer: 1,
			rooms: [toRoom.id],
			viewport: DefaultViewport,
		};
		const world = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, layers: [fromLayer, toLayer]},
			rooms: [fromRoom, toRoom],
			connections: [connection],
		};
		const onStubPointChange = jest.fn();
		const props = {
			world,
			connection,
			fromRoom,
			toRoom,
			selectConnection: jest.fn(),
			changePathway: jest.fn(() => connection.pathway),
			updateStatus: jest.fn(),
			onStubPointChange,
		};
		const {container, rerender} = render(
			<svg>
				<Connection {...props} currentLayer={fromLayer} />
			</svg>,
		);

		expect(container.querySelector(".connectionLayerTag")).toHaveAttribute(
			"transform",
			"translate(75 90)",
		);

		rerender(
			<svg>
				<Connection {...props} currentLayer={toLayer} />
			</svg>,
		);
		expect(container.querySelector(".connectionLayerTag")).toHaveAttribute(
			"transform",
			"translate(325 410)",
		);

		const svg = container.querySelector("svg")!;
		Object.defineProperty(svg, "getScreenCTM", {
			value: () => ({inverse: () => ({})}),
		});
		Object.defineProperty(svg, "createSVGPoint", {
			value: () => ({
				x: 0,
				y: 0,
				matrixTransform(this: {x: number; y: number}) {
					return {x: this.x, y: this.y};
				},
			}),
		});
		const tag = container.querySelector<SVGGElement>(".connectionLayerTag")!;
		tag.setPointerCapture = jest.fn();
		tag.hasPointerCapture = jest.fn(() => false);
		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 325,
			clientY: 410,
		});
		Object.defineProperty(pointerDown, "pointerId", {value: 1});
		fireEvent(tag, pointerDown);
		const pointerJitter = new MouseEvent("pointermove", {
			bubbles: true,
			clientX: 327,
			clientY: 411,
		});
		Object.defineProperty(pointerJitter, "pointerId", {value: 1});
		fireEvent(tag, pointerJitter);
		expect(onStubPointChange).not.toHaveBeenCalled();

		const pointerUp = new MouseEvent("pointerup", {bubbles: true});
		Object.defineProperty(pointerUp, "pointerId", {value: 1});
		fireEvent(tag, pointerUp);
		fireEvent.click(tag);
		expect(props.selectConnection).toHaveBeenCalledWith(connection);

		const dragPointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			clientX: 325,
			clientY: 410,
		});
		Object.defineProperty(dragPointerDown, "pointerId", {value: 2});
		fireEvent(tag, dragPointerDown);
		const pointerMove = new MouseEvent("pointermove", {
			bubbles: true,
			clientX: 345,
			clientY: 425,
		});
		Object.defineProperty(pointerMove, "pointerId", {value: 2});
		fireEvent(tag, pointerMove);

		expect(onStubPointChange).toHaveBeenCalledWith(connection, {x: 345, y: 425}, "toLayerStubPoint");
	});
});

describe("stub tag anchors", () => {
	it("uses the opposite fixed edge or corner", () => {
		expect(getStubTagAnchorOffset("n", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("ne", 100)).toEqual({x: -50, y: 13});
		expect(getStubTagAnchorOffset("e", 100)).toEqual({x: -50, y: 0});
		expect(getStubTagAnchorOffset("sw", 100)).toEqual({x: 50, y: -13});
	});

	it("centers special vertical anchors", () => {
		expect(getStubTagAnchorOffset("up", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("out", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("down", 100)).toEqual({x: 0, y: -13});
		expect(getStubTagAnchorOffset("in", 100)).toEqual({x: 0, y: -13});
	});
});

describe("Connection pathway glyph", () => {
	it("shows the current pathway through the shared status updater", () => {
		const roomDefaults = createDefaultFieldObject(RoomSchema);
		const fromRoom = RoomSchema.parse({
			...roomDefaults,
			id: "room-1",
			name: "Gate",
			metadata: {position: {x: 40, y: 40}},
		});
		const toRoom = RoomSchema.parse({
			...roomDefaults,
			id: "room-2",
			name: "Hall",
			metadata: {position: {x: 200, y: 40}},
		});
		const connection = ConnectionSchema.parse({
			...createDefaultFieldObject(ConnectionSchema),
			id: "connection-1",
			fromRoomId: fromRoom.id,
			toRoomId: toRoom.id,
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		});
		const updateStatus = jest.fn();
		const changePathway = jest.fn(() => "forwards" as const);
		const currentLayer = {
			name: "Ground",
			layer: 0,
			rooms: [fromRoom.id, toRoom.id],
			viewport: DefaultViewport,
		};
		const world = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, layers: [currentLayer]},
			rooms: [fromRoom, toRoom],
			connections: [connection],
		};

		const {container} = render(
			<svg>
				<Connection
					world={world}
					connection={connection}
					fromRoom={fromRoom}
					toRoom={toRoom}
					selectConnection={jest.fn()}
					changePathway={changePathway}
					updateStatus={updateStatus}
					currentLayer={currentLayer}
					onStubPointChange={jest.fn()}
				/>
			</svg>,
		);

		const glyph = screen.getByRole("button", {name: "Change Two way pathway"});
		expect(glyph.querySelector("title")).toHaveTextContent("Two way pathway");
		for (const element of container.querySelectorAll("[transform]")) {
			expect(element.getAttribute("transform")).not.toMatch(/\.\d{7}/);
		}

		fireEvent.pointerEnter(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith({
			kind: "pathway",
			label: "Two way pathway · Click to change",
		});

		fireEvent.click(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith({
			kind: "pathway",
			label: "One way pathway · Click to change",
		});

		fireEvent.pointerLeave(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith(null);
	});
});
