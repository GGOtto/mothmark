import {GameStateSchema, type GameState} from "@/schemas/states/gameStateSchemas";
import {EventSchema, type Event} from "@/schemas/world/eventSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {resolveConditionBranchWithResult} from "../branches/resolveConditionBranch";
import {addEvent, addEvents, resolveEvents} from "./resolveEvent";

jest.mock("../branches/resolveConditionBranch", () => ({
	resolveConditionBranchWithResult: jest.fn(),
}));

const mockedResolveConditionBranch = jest.mocked(resolveConditionBranchWithResult);

function createGame(events: Event[] = []): GameState {
	return {...createDefaultFieldObject(GameStateSchema), events};
}

function createEvent(overrides: Partial<Event> = {}): Event {
	const event = createDefaultFieldObject(EventSchema);
	const name = overrides.name ?? "event";

	return {
		...event,
		...overrides,
		id: overrides.id ?? toID("event", name),
		branch: overrides.branch ?? {
			...event.branch,
			id: toID("condition-branch", `${name}-branch`),
		},
	};
}

const world: World = createDefaultFieldObject(WorldSchema);

describe("addEvent", () => {
	it("inserts events in descending priority order without mutating the game", () => {
		const low = createEvent({name: "low", priority: 1});
		const high = createEvent({name: "high", priority: 10});
		const game = createGame([low]);

		const result = addEvent(game, high);

		expect(result.events).toEqual([high, low]);
		expect(game.events).toEqual([low]);
	});

	it("preserves insertion order among events with the same priority", () => {
		const first = createEvent({name: "first", priority: 5});
		const second = createEvent({name: "second", priority: 5});

		expect(addEvent(createGame([first]), second).events).toEqual([first, second]);
	});
});

describe("addEvents", () => {
	it("adds every event in priority order", () => {
		const low = createEvent({name: "low", priority: 1});
		const medium = createEvent({name: "medium", priority: 5});
		const high = createEvent({name: "high", priority: 10});

		expect(addEvents(createGame(), [medium, low, high]).events).toEqual([high, medium, low]);
	});
});

describe("resolveEvents", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedResolveConditionBranch.mockImplementation((_world, game) => ({
			game,
			actionTaken: true,
		}));
	});

	it("resolves each enabled event whose wait has elapsed", () => {
		const first = createEvent({name: "first", enabled: true, wait: 0});
		const disabled = createEvent({name: "disabled", enabled: false, wait: 0});
		const second = createEvent({name: "second", enabled: true, wait: 0});
		const game = createGame([first, disabled, second]);

		resolveEvents(world, game);

		expect(mockedResolveConditionBranch).toHaveBeenCalledTimes(2);
		expect(mockedResolveConditionBranch).toHaveBeenNthCalledWith(1, world, game, first.branch);
		expect(mockedResolveConditionBranch).toHaveBeenNthCalledWith(2, world, game, second.branch);
	});

	it("keeps authored wait durations unchanged until the turn threshold is reached", () => {
		const waiting = createEvent({wait: 2});
		const game = createGame([waiting]);

		const result = resolveEvents(world, game);

		expect(result.events[0].wait).toBe(2);
		expect(game.events[0].wait).toBe(2);
		expect(mockedResolveConditionBranch).not.toHaveBeenCalled();
	});

	it("removes disposable events after resolving and does not skip the following event", () => {
		const disposable = createEvent({name: "once", disposable: true});
		const following = createEvent({name: "following"});
		const game = createGame([disposable, following]);

		const result = resolveEvents(world, game);

		expect(mockedResolveConditionBranch).toHaveBeenCalledTimes(2);
		expect(result.events).toEqual([following]);
		expect(game.events).toEqual([disposable, following]);
	});

	it("keeps a disposable event when none of its branch actions run", () => {
		const disposable = createEvent({name: "not-yet", disposable: true});
		const game = createGame([disposable]);
		mockedResolveConditionBranch.mockReturnValue({
			game,
			actionTaken: false,
		});

		const result = resolveEvents(world, game);

		expect(result.events).toEqual([disposable]);
	});

	it("passes state changes from one event into the next event", () => {
		const first = createEvent({name: "first"});
		const second = createEvent({name: "second"});
		const game = createGame([first, second]);
		const afterFirst = createGame([first, second]);

		mockedResolveConditionBranch
			.mockReturnValueOnce({game: afterFirst, actionTaken: true})
			.mockImplementationOnce((_world, currentGame) => ({
				game: currentGame,
				actionTaken: true,
			}));

		resolveEvents(world, game);

		expect(mockedResolveConditionBranch).toHaveBeenNthCalledWith(2, world, afterFirst, second.branch);
	});

	it.each([
		["start", 20],
		["middle", 5],
	])(
		"continues resolving the original events once when a new event is inserted at the %s",
		(_position, insertedPriority) => {
			const first = createEvent({name: "first", priority: 10});
			const second = createEvent({name: "second", priority: 0});
			const inserted = createEvent({name: "inserted", priority: insertedPriority});
			const game = createGame([first, second]);

			mockedResolveConditionBranch
				.mockImplementationOnce((_world, currentGame) => ({
					game: addEvent(currentGame, inserted),
					actionTaken: true,
				}))
				.mockImplementation((_world, currentGame) => ({
					game: currentGame,
					actionTaken: true,
				}));

			const result = resolveEvents(world, game);

			expect(
				mockedResolveConditionBranch.mock.calls.map(([, , branch]) => idValue(branch.id)),
			).toEqual(["first-branch", "second-branch"]);
			expect(result.events.map((event) => event.name)).toEqual(
				insertedPriority > first.priority
					? ["inserted", "first", "second"]
					: ["first", "inserted", "second"],
			);
		},
	);
});
