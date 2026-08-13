import {produce} from "immer";
import {moveCommand} from "@/data/commands/initialCommands";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ConditionWithEffectSchema} from "@/schemas/world/conditionBranchSchemas";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {EventSchema} from "@/schemas/world/eventSchema";
import {
	ItemSchema,
	ContainerBehaviorSchema,
	OpenableBehaviorSchema,
} from "@/schemas/world/itemSchema";
import {ConnectionSchema, RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {resolveTurn} from "../player/resolveTurn";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestEffectGroup} from "../utils/testUtils";

describe("audited logic through the player turn path", () => {
	it("awards a continuing win on arrival, creates runtime state, then ends on a later turn", () => {
		const yard = produce(createDefaultFieldObject(RoomSchema), (draft) => {
			draft.id = toID("room", "yard");
			draft.name = "Yard";
			draft.description = "A yard.";
		});
		const vault = produce(createDefaultFieldObject(RoomSchema), (draft) => {
			draft.id = toID("room", "vault");
			draft.name = "Vault";
			draft.description = "The final vault.";
		});
		const connection = produce(createDefaultFieldObject(ConnectionSchema), (draft) => {
			draft.id = toID("connection", "yard-vault");
			draft.fromRoomId = yard.id;
			draft.toRoomId = vault.id;
			draft.direction = "e";
			draft.returnDirection = "w";
			draft.pathway = "two-way";
		});
		const hole = produce(createDefaultFieldObject(ItemSchema), (draft) => {
			draft.id = toID("item", "hole-template");
			draft.name = "Hole";
			draft.tags = ["hole"];
			draft.behaviors = [
				createDefaultFieldObject(ContainerBehaviorSchema),
				createDefaultFieldObject(OpenableBehaviorSchema),
			];
			draft.initialState.location = {type: "hidden", roomId: vault.id};
			draft.initialState.open = true;
		});

		const arrival = produce(createDefaultFieldObject(EventSchema), (draft) => {
			draft.id = toID("event", "arrival");
			draft.name = "Arrival";
			draft.disposable = true;
			draft.branch.always = undefined;
			const guarded = ConditionWithEffectSchema.parse({
				...createDefaultFieldObject(ConditionWithEffectSchema),
				condition: {
					type: "group",
					operation: "all",
					conditions: [
						ConditionSchema.parse({
							type: "player",
							operation: "entered-room-this-turn",
							roomId: vault.id,
						}),
					],
				},
				effect: createPlayerTestEffectGroup("arrival-effects", [
					EffectSchema.parse({
						type: "player",
						operation: "win",
						message: "You found the vault. You may keep exploring.",
					}),
					EffectSchema.parse({
						type: "items",
						operation: "instantiate",
						templateItemId: hole.id,
						destination: "current-room",
					}),
					EffectSchema.parse({
						type: "room",
						operation: "set-current-flag",
						flag: "discovered",
						value: true,
					}),
				]),
			});
			draft.branch.if = guarded;
		});
		const ending = produce(createDefaultFieldObject(EventSchema), (draft) => {
			draft.id = toID("event", "ending");
			draft.name = "Ending";
			draft.wait = 2;
			draft.disposable = true;
			draft.branch.always = createPlayerTestEffectGroup("ending-effects", [
				EffectSchema.parse({
					type: "player",
					operation: "end-game",
					message: "The expedition is complete.",
				}),
			]);
		});
		const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.startRoomId = yard.id;
			draft.deathMessage = "Dead.";
			draft.rooms = [yard, vault];
			draft.connections = [connection];
			draft.items = [hole];
			draft.commands = [moveCommand];
			draft.events = [arrival, ending];
		});

		let game = resolveTurn(world, createInitialGameState(world, yard.id), "east");
		expect(game.player.currentRoom).toEqual(vault.id);
		expect(game.player.previousRoom).toEqual(yard.id);
		expect(game.player.hasWon).toBe(true);
		expect(game.player.isEnded).not.toBe(true);
		expect(game.messages.some((message) => message.text.includes("keep exploring"))).toBe(true);
		expect(game.itemStates.some((item) => item.templateItemId?.id === "hole-template")).toBe(true);
		expect(game.roomStates.find((room) => room.id.id === "vault")?.flags.discovered).toBe(true);

		game = resolveTurn(world, game, "west");
		expect(game.player.isEnded).toBe(true);
		expect(game.messages.at(-1)?.text).toBe("The expedition is complete.");
		const ended = game;
		expect(resolveTurn(world, game, "east")).toBe(game);
		expect(ended.player.turns).toBe(2);
	});

	it("keeps a command out of matching until its availability condition passes", () => {
		const first = produce(createDefaultFieldObject(RoomSchema), (draft) => {
			draft.id = toID("room", "first");
			draft.name = "First";
			draft.description = "The first room.";
		});
		const second = produce(createDefaultFieldObject(RoomSchema), (draft) => {
			draft.id = toID("room", "second");
			draft.name = "Second";
			draft.description = "The second room.";
		});
		const connection = produce(createDefaultFieldObject(ConnectionSchema), (draft) => {
			draft.id = toID("connection", "path");
			draft.fromRoomId = first.id;
			draft.toRoomId = second.id;
			draft.direction = "e";
			draft.returnDirection = "w";
			draft.pathway = "two-way";
		});
		const gatedMove = produce(moveCommand, (draft) => {
			draft.availableWhen = {
				type: "group",
				operation: "all",
				conditions: [{type: "world", operation: "flag-is", flag: "learned-movement", value: true}],
			};
		});
		const unlock = produce(createDefaultFieldObject(EventSchema), (draft) => {
			draft.id = toID("event", "learn-movement");
			draft.name = "Learn movement";
			draft.disposable = true;
			draft.branch.always = createPlayerTestEffectGroup("learn", [
				EffectSchema.parse({
					type: "world",
					operation: "set-flag",
					flag: "learned-movement",
					value: true,
				}),
			]);
		});
		const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.startRoomId = first.id;
			draft.deathMessage = "Dead.";
			draft.rooms = [first, second];
			draft.connections = [connection];
			draft.commands = [gatedMove];
			draft.events = [unlock];
		});
		let game = resolveTurn(world, createInitialGameState(world, first.id), "east");
		expect(game.player.currentRoom).toEqual(first.id);
		expect(game.messages.some((message) => message.text === "I don't know what that means.")).toBe(
			true,
		);
		game = resolveTurn(world, game, "east");
		expect(game.player.currentRoom).toEqual(second.id);
	});
});
